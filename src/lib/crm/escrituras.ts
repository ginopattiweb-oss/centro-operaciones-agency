/**
 * El núcleo de las escrituras complejas del CRM: derivación masiva, fusión e
 * importación.
 *
 * Está separado de `actions/crm.ts` por una razón concreta: las actions arrancan
 * con `requireAdmin()`, que lee cookies y sólo funciona dentro de una request de
 * Next. Eso vuelve intesteable justo el código más delicado del módulo — el que
 * mueve filas entre tablas y resuelve conflictos. Acá no hay auth ni
 * `revalidatePath`: sólo SQL. Las actions son el envoltorio que agrega las dos
 * cosas, y los tests llaman directo a esto.
 *
 * SÓLO SERVIDOR. No lo importe un componente de cliente.
 *
 * ── ATOMICIDAD ──
 * `neon-http` no soporta transacciones interactivas (`db.transaction()` lanza).
 * Lo que sí soporta es `db.batch([...])`, que por debajo usa la transacción HTTP
 * de Neon: un solo viaje, y entran todas las sentencias o ninguna. La limitación
 * es que no se puede decidir a mitad de camino con el resultado de la sentencia
 * anterior, así que todo lo que haya que decidir se lee y se decide ANTES.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  crmContactos,
  crmDerivaciones,
  crmEventos,
  crmImportaciones,
  leads,
} from "@/db/schema";
import type { FilaRechazada } from "./csv";
import {
  enLotes,
  LOTE_IMPORT,
  planearImport,
  type AjustesLote,
  type FilaCsv,
  type FilaPreparada,
  type Mapeo,
} from "./importar";
import { unirTags } from "./contactos";
import { estadoAlFusionar, type UnidadClave } from "./unidades";

type Sentencia = Parameters<typeof db.batch>[0][number];

/**
 * Manda las sentencias en una sola transacción de Neon.
 *
 * `db.batch()` pide una tupla no vacía y acá los arrays se arman dinámicamente
 * con sentencias de tablas distintas, así que el cast es inevitable. Queda
 * encapsulado para que no se repita en cada función.
 */
export async function ejecutarEnTransaccion(sentencias: unknown[]): Promise<void> {
  if (sentencias.length === 0) return;
  await db.batch(sentencias as unknown as [Sentencia, ...Sentencia[]]);
}

// ─────────────────────────────────────────────────────── derivación masiva

export type ResultadoDerivacionMasiva = {
  derivados: number;
  yaEstaban: number;
  /** Ids que se pidieron pero no existen en `crm_contactos`. */
  inexistentes: string[];
};

/**
 * Deriva N personas a una unidad con un estado, en UNA transacción.
 *
 * Las que ya estaban en esa unidad se saltean: no se les pisa el estado, porque
 * el que tienen lo puso alguien. Quiénes están se resuelve antes del batch.
 */
export async function derivarMasivoEnBase(
  contactoIds: string[],
  unidadClave: UnidadClave,
  unidadProjectId: string,
  estado: string,
  notas: string | null = null
): Promise<ResultadoDerivacionMasiva> {
  const ids = [...new Set(contactoIds.filter(Boolean))];
  if (ids.length === 0) return { derivados: 0, yaEstaban: 0, inexistentes: [] };

  const existen = new Set(
    (
      await db
        .select({ id: crmContactos.id })
        .from(crmContactos)
        .where(inArray(crmContactos.id, ids))
    ).map((f) => f.id)
  );
  const inexistentes = ids.filter((id) => !existen.has(id));
  const validos = ids.filter((id) => existen.has(id));
  if (validos.length === 0) return { derivados: 0, yaEstaban: 0, inexistentes };

  const yaDerivados = new Set(
    (
      await db
        .select({ contactoId: crmDerivaciones.contactoId })
        .from(crmDerivaciones)
        .where(
          and(
            eq(crmDerivaciones.unidadProjectId, unidadProjectId),
            inArray(crmDerivaciones.contactoId, validos)
          )
        )
    ).map((f) => f.contactoId)
  );

  const aDerivar = validos.filter((id) => !yaDerivados.has(id));
  if (aDerivar.length === 0) {
    return { derivados: 0, yaEstaban: yaDerivados.size, inexistentes };
  }

  const filas = aDerivar.map((contactoId) => ({
    id: crypto.randomUUID(),
    contactoId,
    unidadProjectId,
    estado,
    notas,
  }));

  await ejecutarEnTransaccion([
    db.insert(crmDerivaciones).values(filas),
    db.insert(crmEventos).values(
      filas.map((f) => ({
        contactoId: f.contactoId,
        derivacionId: f.id,
        tipo: "derivacion_creada" as const,
        datos: { unidad: unidadClave, estado, masiva: true },
      }))
    ),
  ]);

  return { derivados: filas.length, yaEstaban: yaDerivados.size, inexistentes };
}

// ─────────────────────────────────────────────────────── fusión

export type ResultadoFusion =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Fusiona dos personas en una. `absorbidoId` desaparece; `principalId` queda.
 *
 *  - escalares: se completan los huecos del principal; lo que ya tenía valor NO
 *    se pisa, porque fue cargado o corregido a mano.
 *  - tags y notas: se suman. Perder una nota al fusionar es pérdida de datos.
 *  - `suscripto`: AND de los dos. Una baja nunca revive.
 *  - `whatsapp_opt_in`: NO se hereda. El consentimiento se dio para un número y
 *    una persona concretos.
 *  - derivaciones: las del absorbido pasan al principal. Si los dos estaban en
 *    la misma unidad, el estado se resuelve con `estadoAlFusionar`.
 *  - eventos: se reasignan, así la línea de tiempo no pierde historia.
 *  - puentes: `leads` se reapunta al principal.
 *
 * Todo en un `db.batch()`: o se fusiona entero o no se fusiona.
 */
export async function fusionarEnBase(
  principalId: string,
  absorbidoId: string,
  clavePorProjectId: Map<string, UnidadClave>
): Promise<ResultadoFusion> {
  if (principalId === absorbidoId) return { ok: false, error: "Son el mismo contacto." };

  const filas = await db
    .select()
    .from(crmContactos)
    .where(inArray(crmContactos.id, [principalId, absorbidoId]));
  const principal = filas.find((f) => f.id === principalId);
  const absorbido = filas.find((f) => f.id === absorbidoId);
  if (!principal || !absorbido) return { ok: false, error: "Alguno de los contactos no existe." };

  const derivaciones = await db
    .select()
    .from(crmDerivaciones)
    .where(inArray(crmDerivaciones.contactoId, [principalId, absorbidoId]));
  const delPrincipal = new Map(
    derivaciones.filter((d) => d.contactoId === principalId).map((d) => [d.unidadProjectId, d])
  );
  const delAbsorbido = derivaciones.filter((d) => d.contactoId === absorbidoId);

  // Si el principal no tiene E.164 y el absorbido sí, gana el E.164 y el crudo
  // se descarta: el CHECK `crm_contactos_un_solo_telefono` no deja tener los dos.
  const telefonoE164 = principal.telefonoE164 ?? absorbido.telefonoE164;
  const telefonoCrudo = telefonoE164 ? null : (principal.telefonoCrudo ?? absorbido.telefonoCrudo);

  const suscripto = principal.suscripto && absorbido.suscripto;
  const bajaDelAbsorbido = !absorbido.suscripto && principal.suscripto;

  /**
   * EL ORDEN DE ESTAS SENTENCIAS NO ES COSMÉTICO.
   *
   * Los índices únicos de email y teléfono NO son DEFERRABLE, así que Postgres
   * los chequea sentencia por sentencia, no al final de la transacción. Si el
   * UPDATE del principal copiara el teléfono del absorbido antes de que el
   * absorbido se borre, habría dos filas con el mismo número por un instante y
   * la transacción entera falla con "duplicate key value violates unique
   * constraint crm_contactos_telefono_uk".
   *
   * Por eso: primero se vacía al absorbido de todo lo que lo referencia, después
   * se lo borra, y SÓLO ENTONCES el principal se queda con sus datos.
   */
  const sentencias: unknown[] = [];

  // 1. La historia del absorbido pasa a la ficha del principal. Va antes del
  //    DELETE porque el CASCADE de `crm_eventos` se la llevaría.
  sentencias.push(
    db
      .update(crmEventos)
      .set({ contactoId: principalId })
      .where(eq(crmEventos.contactoId, absorbidoId))
  );

  // 2. Las derivaciones del absorbido.
  for (const d of delAbsorbido) {
    const choque = delPrincipal.get(d.unidadProjectId);
    const clave = clavePorProjectId.get(d.unidadProjectId);
    if (choque && clave) {
      // Los dos estaban en la misma unidad: se resuelve el estado en la fila del
      // principal y la duplicada se borra.
      const estado = estadoAlFusionar(clave, choque.estado, d.estado);
      sentencias.push(
        db
          .update(crmDerivaciones)
          .set({
            estado,
            derivadoAt: choque.derivadoAt <= d.derivadoAt ? choque.derivadoAt : d.derivadoAt,
          })
          .where(eq(crmDerivaciones.id, choque.id)),
        // Los eventos que apuntaban a la derivación que se va se repuntan a la
        // que queda, para que no los deje en null el ON DELETE SET NULL.
        db
          .update(crmEventos)
          .set({ derivacionId: choque.id })
          .where(eq(crmEventos.derivacionId, d.id)),
        db.delete(crmDerivaciones).where(eq(crmDerivaciones.id, d.id))
      );
    } else {
      // Unidad nueva para el principal: la derivación se reasigna tal cual.
      sentencias.push(
        db
          .update(crmDerivaciones)
          .set({ contactoId: principalId })
          .where(eq(crmDerivaciones.id, d.id))
      );
    }
  }

  // 3. El detalle comercial (`leads`) apunta al que queda. Va antes del DELETE
  //    porque esa FK es ON DELETE SET NULL: borrar primero perdería el vínculo.
  sentencias.push(
    db.update(leads).set({ crmContactoId: principalId }).where(eq(leads.crmContactoId, absorbidoId))
  );

  // 4. Ahora sí: el absorbido se va. Ya no lo referencia nada.
  sentencias.push(db.delete(crmContactos).where(eq(crmContactos.id, absorbidoId)));

  // 5. Y recién ahora el principal puede quedarse con el mail y el teléfono del
  //    absorbido sin chocar contra el índice único.
  sentencias.push(
    db
      .update(crmContactos)
      .set({
        email: principal.email ?? absorbido.email,
        telefonoE164,
        telefonoCrudo,
        nombre: principal.nombre ?? absorbido.nombre,
        instagram: principal.instagram ?? absorbido.instagram,
        sitioWeb: principal.sitioWeb ?? absorbido.sitioWeb,
        origenDetalle: principal.origenDetalle ?? absorbido.origenDetalle,
        consentimientoAt: principal.consentimientoAt ?? absorbido.consentimientoAt,
        consentimientoFuente: principal.consentimientoFuente ?? absorbido.consentimientoFuente,
        importacionId: principal.importacionId ?? absorbido.importacionId,
        tags: unirTags(principal.tags, absorbido.tags),
        notas: [principal.notas, absorbido.notas].filter(Boolean).join("\n\n---\n\n") || null,
        suscripto,
        bajaAt: bajaDelAbsorbido ? absorbido.bajaAt : principal.bajaAt,
        bajaMotivo: bajaDelAbsorbido ? absorbido.bajaMotivo : principal.bajaMotivo,
        // El opt-in de WhatsApp NO se hereda: el consentimiento se dio para un
        // número y una persona concretos. Si el principal no lo tenía, no lo gana.
        createdAt:
          principal.createdAt <= absorbido.createdAt ? principal.createdAt : absorbido.createdAt,
      })
      .where(eq(crmContactos.id, principalId)),
    db.insert(crmEventos).values({
      contactoId: principalId,
      tipo: "fusion",
      datos: {
        absorbidoId,
        emailAbsorbido: absorbido.email,
        telefonoAbsorbido: absorbido.telefonoE164 ?? absorbido.telefonoCrudo,
        nombreAbsorbido: absorbido.nombre,
      },
    })
  );

  await ejecutarEnTransaccion(sentencias);
  return { ok: true };
}

// ─────────────────────────────────────────────────────── importación

export type ResultadoEscrituraImport = {
  importacionId: string;
  creadas: number;
  actualizadas: number;
  omitidas: number;
  derivadas: number;
  rechazadas: FilaRechazada[];
};

/**
 * El `SET` del `ON CONFLICT DO UPDATE`: las reglas de merge en SQL.
 *
 *  - `COALESCE(actual, nuevo)` = se completan los huecos, no se pisa lo que hay.
 *  - los tags se SUMAN.
 *  - `suscripto` es un AND: false AND cualquier cosa = false. Una baja no revive.
 *  - `whatsapp_opt_in` NO aparece: el importador no lo toca nunca. Un CSV no es
 *    consentimiento de WhatsApp.
 */
function setDeMerge() {
  return {
    nombre: sql`COALESCE(${crmContactos.nombre}, EXCLUDED.nombre)`,
    telefonoE164: sql`COALESCE(${crmContactos.telefonoE164}, EXCLUDED.telefono_e164)`,
    instagram: sql`COALESCE(${crmContactos.instagram}, EXCLUDED.instagram)`,
    sitioWeb: sql`COALESCE(${crmContactos.sitioWeb}, EXCLUDED.sitio_web)`,
    origenDetalle: sql`COALESCE(${crmContactos.origenDetalle}, EXCLUDED.origen_detalle)`,
    consentimientoAt: sql`COALESCE(${crmContactos.consentimientoAt}, EXCLUDED.consentimiento_at)`,
    consentimientoFuente: sql`COALESCE(${crmContactos.consentimientoFuente}, EXCLUDED.consentimiento_fuente)`,
    tags: sql`(SELECT COALESCE(array_agg(DISTINCT t ORDER BY t), '{}') FROM unnest(${crmContactos.tags} || EXCLUDED.tags) AS t)`,
    suscripto: sql`${crmContactos.suscripto} AND EXCLUDED.suscripto`,
    bajaAt: sql`CASE
      WHEN ${crmContactos.suscripto} AND NOT EXCLUDED.suscripto THEN EXCLUDED.baja_at
      ELSE ${crmContactos.bajaAt} END`,
    bajaMotivo: sql`CASE
      WHEN ${crmContactos.suscripto} AND NOT EXCLUDED.suscripto THEN EXCLUDED.baja_motivo
      ELSE ${crmContactos.bajaMotivo} END`,
  };
}

/**
 * Escribe una importación.
 *
 * Las filas se parten en DOS pasadas porque los índices únicos de
 * `crm_contactos` son PARCIALES (`WHERE email IS NOT NULL`) y Postgres sólo
 * infiere un índice por sentencia. `targetWhere` es lo que le dice cuál: sin el
 * predicado la sentencia falla con "there is no unique or exclusion constraint
 * matching the ON CONFLICT specification".
 */
export async function escribirImportacion(
  archivo: string,
  filasCsv: FilaCsv[],
  mapeo: Mapeo,
  lote: AjustesLote,
  unidad: { clave: UnidadClave; projectId: string } | null,
  estado: string | null
): Promise<ResultadoEscrituraImport> {
  const plan = planearImport(filasCsv, mapeo, lote);
  const importacionId = crypto.randomUUID();
  const ahora = new Date();

  // La corrida se registra ANTES de escribir contactos, así `importacion_id`
  // puede apuntarla desde la primera fila y la trazabilidad queda completa
  // incluso si el proceso se corta a mitad de camino.
  await db.insert(crmImportaciones).values({
    id: importacionId,
    archivo,
    mapeo,
    derivarAProjectId: unidad?.projectId ?? null,
    estadoInicial: unidad ? estado : null,
    filasTotal: plan.filas.length + plan.rechazadas.length + plan.fusionadas,
  });

  if (plan.filas.length === 0) {
    return {
      importacionId,
      creadas: 0,
      actualizadas: 0,
      omitidas: plan.rechazadas.length,
      derivadas: 0,
      rechazadas: plan.rechazadas,
    };
  }

  const valoresDe = (fila: FilaPreparada) => ({
    email: fila.email,
    telefonoE164: fila.telefonoE164,
    telefonoCrudo: fila.telefonoCrudo,
    nombre: fila.nombre,
    instagram: fila.instagram,
    sitioWeb: fila.sitioWeb,
    origen: lote.origen,
    origenDetalle: fila.origenDetalle,
    importacionId,
    tags: fila.tags,
    suscripto: fila.suscripto,
    bajaAt: fila.suscripto ? null : ahora,
    bajaMotivo: fila.suscripto ? null : "Marcado como no contactar en la importación",
    // Si el CSV traía fecha se respeta; si no, el consentimiento es de hoy.
    consentimientoAt: fila.consentimientoAt ?? ahora,
    consentimientoFuente: lote.consentimientoFuente,
  });

  let creadas = 0;
  let actualizadas = 0;
  const idsAfectados: string[] = [];

  const pasadas = [
    {
      filas: plan.filas.filter((f) => f.claveEs === "email"),
      target: crmContactos.email,
      targetWhere: sql`${crmContactos.email} IS NOT NULL`,
    },
    {
      filas: plan.filas.filter((f) => f.claveEs === "telefono"),
      target: crmContactos.telefonoE164,
      targetWhere: sql`${crmContactos.telefonoE164} IS NOT NULL`,
    },
  ];

  for (const pasada of pasadas) {
    for (const trozo of enLotes(pasada.filas, LOTE_IMPORT)) {
      if (trozo.length === 0) continue;
      const filas = await db
        .insert(crmContactos)
        .values(trozo.map(valoresDe))
        .onConflictDoUpdate({
          target: pasada.target,
          targetWhere: pasada.targetWhere,
          set: setDeMerge(),
        })
        // xmax = 0 sólo en las filas recién insertadas: así se separan altas de
        // actualizaciones sin una segunda consulta.
        .returning({ id: crmContactos.id, insertada: sql<boolean>`(xmax = 0) AS "insertada"` });

      for (const fila of filas) {
        idsAfectados.push(fila.id);
        if (fila.insertada) creadas += 1;
        else actualizadas += 1;
      }
    }
  }

  for (const trozo of enLotes(idsAfectados, LOTE_IMPORT)) {
    await db.insert(crmEventos).values(
      trozo.map((contactoId) => ({
        contactoId,
        tipo: "importacion" as const,
        datos: { importacionId, archivo },
      }))
    );
  }

  // Las derivaciones, si se eligió una unidad. ON CONFLICT DO NOTHING: a quien ya
  // estaba en esa unidad NO se le pisa el estado.
  let derivadas = 0;
  if (unidad && estado) {
    for (const trozo of enLotes(idsAfectados, LOTE_IMPORT)) {
      const filas = await db
        .insert(crmDerivaciones)
        .values(
          trozo.map((contactoId) => ({
            contactoId,
            unidadProjectId: unidad.projectId,
            estado,
          }))
        )
        .onConflictDoNothing({
          target: [crmDerivaciones.contactoId, crmDerivaciones.unidadProjectId],
        })
        .returning({ id: crmDerivaciones.id, contactoId: crmDerivaciones.contactoId });

      derivadas += filas.length;
      if (filas.length > 0) {
        await db.insert(crmEventos).values(
          filas.map((f) => ({
            contactoId: f.contactoId,
            derivacionId: f.id,
            tipo: "derivacion_creada" as const,
            datos: { unidad: unidad.clave, estado, importacionId },
          }))
        );
      }
    }
  }

  await db
    .update(crmImportaciones)
    .set({
      filasCreadas: creadas,
      filasActualizadas: actualizadas,
      filasOmitidas: plan.rechazadas.length,
    })
    .where(eq(crmImportaciones.id, importacionId));

  return {
    importacionId,
    creadas,
    actualizadas,
    omitidas: plan.rechazadas.length,
    derivadas,
    rechazadas: plan.rechazadas,
  };
}
