"use server";

/**
 * Escrituras del CRM.
 *
 * Toda action arranca con `requireAdmin()`. Leer va por `lib/crm/queries.ts`.
 *
 * ── ATOMICIDAD ──
 * El driver `neon-http` NO soporta transacciones interactivas: `db.transaction()`
 * lanza "No transactions support in neon-http driver". Lo que sí soporta es
 * `db.batch([...])`, que por debajo llama a `client.transaction()` de Neon —
 * una transacción real, no interactiva: todas las sentencias van en un solo
 * viaje y o entran todas o no entra ninguna.
 *
 * Por eso las operaciones que tocan varias filas (derivación masiva, fusión)
 * se arman como un array de sentencias y se mandan con `db.batch()`. Lo que no
 * se puede hacer es decidir a mitad de camino con el resultado de la sentencia
 * anterior: todo lo que haya que decidir se decide antes, leyendo primero.
 *
 * ── EVENTOS ──
 * Cada cambio real deja un evento en `crm_eventos`. Sólo lo que pasó: no se
 * inventa historial. `actor` y `derivadoPor` quedan en null porque la sesión del
 * panel es una contraseña compartida y no hay identidad de persona todavía.
 */
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { crmContactos, crmDerivaciones, crmEventos } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-server";
import { propagarEstadoAcLeads } from "@/lib/crm/agencia";
import {
  crmContactoInputSchema,
  derivacionInputSchema,
  primerError,
  unirTags,
  whatsappOptInSchema,
  type CrmContactoInput,
  type DerivacionInput,
} from "@/lib/crm/contactos";
import {
  buscarPorClave,
  getFicha,
  getUnidades,
  requireUnidad,
  listarTodoParaExportar,
  type CrmFicha,
  type CrmFiltros,
} from "@/lib/crm/queries";
import { contactosACsv } from "@/lib/crm/csv";
import {
  derivarMasivoEnBase,
  ejecutarEnTransaccion,
  fusionarEnBase,
} from "@/lib/crm/escrituras";
import {
  CRM_BANDEJA_PATH,
  CRM_TODOS_PATH,
  esEstadoValido,
  estadoInicial,
  UNIDADES,
  unidadContactosPath,
  type UnidadClave,
} from "@/lib/crm/unidades";

export type CrmActionState =
  | { ok: true; id: string; mensaje: string }
  /** `duplicadoId` permite ofrecer el link al contacto que ya existía. */
  | { ok: false; error: string; duplicadoId?: string }
  | null;

/**
 * Revalida todo lo que puede mostrar un contacto: las dos vistas transversales
 * y la vista de cada unidad. Es barato y evita el bug de "lo cambié y la otra
 * pantalla sigue mostrando lo viejo".
 */
function revalidarCrm(): void {
  revalidatePath(CRM_BANDEJA_PATH);
  revalidatePath(CRM_TODOS_PATH);
  for (const clave of Object.keys(UNIDADES) as UnidadClave[]) {
    revalidatePath(unidadContactosPath(clave));
    revalidatePath(`/unidad/${UNIDADES[clave].slug}`);
  }
  revalidatePath("/");
}

/**
 * La ficha de una persona, para el panel de detalle.
 *
 * Es una action y no una query directa porque el panel es un componente de
 * cliente: se abre sobre la tabla sin navegar, así que no hay página de servidor
 * que pueda pasarle los datos como props.
 */
export async function cargarFicha(id: string): Promise<CrmFicha | null> {
  await requireAdmin();
  return getFicha(id);
}

// ─────────────────────────────────────────────────────── alta y edición

/**
 * Alta manual de una persona.
 *
 * El duplicado no se deja caer en el error del constraint: se detecta antes por
 * mail o teléfono y se devuelve el id del contacto existente para poder ofrecer
 * el link. Si se pide una unidad, se deriva en la misma operación.
 */
export async function crearContacto(
  input: CrmContactoInput,
  derivacion?: DerivacionInput | null
): Promise<CrmActionState> {
  await requireAdmin();

  const parsed = crmContactoInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: primerError(parsed.error) };
  const campos = parsed.data;

  let destino: { unidad: UnidadClave; estado: string; notas: string | null } | null = null;
  if (derivacion) {
    const d = derivacionInputSchema.safeParse(derivacion);
    if (!d.success) return { ok: false, error: primerError(d.error) };
    destino = {
      unidad: d.data.unidad,
      estado: d.data.estado ?? estadoInicial(d.data.unidad),
      notas: d.data.notas,
    };
  }

  const existente = await buscarPorClave(campos.email, campos.telefonoE164);
  if (existente) {
    return {
      ok: false,
      error: `Ya existe un contacto con ese ${campos.email ? "mail" : "teléfono"}.`,
      duplicadoId: existente,
    };
  }

  const unidadProjectId = destino ? (await requireUnidad(destino.unidad)).projectId : null;

  const id = crypto.randomUUID();
  const sentencias: unknown[] = [
    db.insert(crmContactos).values({
      id,
      ...campos,
      // Cargar a alguien a mano es afirmar que dio su consentimiento de email.
      consentimientoAt: new Date(),
      consentimientoFuente: campos.consentimientoFuente ?? "Alta manual en el panel",
    }),
    db.insert(crmEventos).values({
      contactoId: id,
      tipo: "contacto_creado",
      datos: { origen: campos.origen },
    }),
  ];

  if (destino && unidadProjectId) {
    const derivacionId = crypto.randomUUID();
    sentencias.push(
      db.insert(crmDerivaciones).values({
        id: derivacionId,
        contactoId: id,
        unidadProjectId,
        estado: destino.estado,
        notas: destino.notas,
      }),
      db.insert(crmEventos).values({
        contactoId: id,
        derivacionId,
        tipo: "derivacion_creada",
        datos: { unidad: destino.unidad, estado: destino.estado },
      })
    );
  }

  await ejecutarEnTransaccion(sentencias);
  revalidarCrm();
  return { ok: true, id, mensaje: "Contacto creado." };
}

/**
 * Edición de los datos de una persona.
 *
 * NO toca `suscripto` ni `whatsappOptIn`: los consentimientos se cambian por
 * acciones propias y explícitas. Editar el nombre de alguien no puede resucitar
 * una baja ni activarle WhatsApp.
 */
export async function actualizarContacto(
  id: string,
  input: CrmContactoInput
): Promise<CrmActionState> {
  await requireAdmin();

  const parsed = crmContactoInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: primerError(parsed.error) };
  const campos = parsed.data;

  const otro = await buscarPorClave(campos.email, campos.telefonoE164);
  if (otro && otro !== id) {
    return {
      ok: false,
      error: "Otro contacto ya usa ese mail o teléfono.",
      duplicadoId: otro,
    };
  }

  const [previo] = await db
    .select({
      email: crmContactos.email,
      telefonoE164: crmContactos.telefonoE164,
      nombre: crmContactos.nombre,
    })
    .from(crmContactos)
    .where(eq(crmContactos.id, id))
    .limit(1);
  if (!previo) return { ok: false, error: "Contacto no encontrado." };

  // `consentimientoFuente` no se re-escribe al editar: es el respaldo del
  // consentimiento original y pisarlo con cada edición lo volvería inútil.
  const datos = { ...campos };
  delete (datos as { consentimientoFuente?: unknown }).consentimientoFuente;
  const actualizado = await db
    .update(crmContactos)
    .set(datos)
    .where(eq(crmContactos.id, id))
    .returning({ id: crmContactos.id });
  if (actualizado.length === 0) return { ok: false, error: "Contacto no encontrado." };

  // Sólo se registran los campos que de verdad cambiaron.
  const cambios: Record<string, unknown> = {};
  if (previo.email !== campos.email) cambios.email = { de: previo.email, a: campos.email };
  if (previo.telefonoE164 !== campos.telefonoE164) {
    cambios.telefono = { de: previo.telefonoE164, a: campos.telefonoE164 };
  }
  if (previo.nombre !== campos.nombre) cambios.nombre = { de: previo.nombre, a: campos.nombre };

  if (Object.keys(cambios).length > 0) {
    await db.insert(crmEventos).values({ contactoId: id, tipo: "contacto_editado", datos: cambios });
  }

  revalidarCrm();
  return { ok: true, id, mensaje: "Cambios guardados." };
}

/**
 * Baja de la lista de mails. Va en un solo sentido y no hay action que la
 * revierta: ni el importador, ni la edición, ni una acción masiva.
 *
 * Es la misma regla que ya tenía la base de contactos de la comunidad, y el
 * motivo es el mismo: una baja es una decisión de la persona, no un dato
 * nuestro. El día que exista la página pública de desuscripción, `baja_token`
 * ya está en la tabla y la persona podrá volver a suscribirse por su cuenta.
 */
export async function darDeBaja(id: string, motivo: string): Promise<CrmActionState> {
  await requireAdmin();

  const actualizado = await db
    .update(crmContactos)
    .set({ suscripto: false, bajaAt: new Date(), bajaMotivo: motivo.trim() || null })
    .where(eq(crmContactos.id, id))
    .returning({ id: crmContactos.id });
  if (actualizado.length === 0) return { ok: false, error: "Contacto no encontrado." };

  await db.insert(crmEventos).values({
    contactoId: id,
    tipo: "contacto_editado",
    datos: { baja: true, motivo: motivo.trim() || null },
  });

  revalidarCrm();
  return { ok: true, id, mensaje: "Contacto dado de baja de los mails." };
}

/**
 * Opt-in de WhatsApp.
 *
 * Permiso separado del de email y nunca inferido de él: son dos canales y dos
 * consentimientos, y así lo exige la política de Meta antes de cualquier mensaje
 * de marketing. Activarlo requiere un teléfono en E.164 — lo pide también un
 * CHECK de la base.
 */
export async function setWhatsappOptIn(
  id: string,
  optIn: boolean,
  fuente?: string | null
): Promise<CrmActionState> {
  await requireAdmin();

  const parsed = whatsappOptInSchema.safeParse({ optIn, fuente });
  if (!parsed.success) return { ok: false, error: primerError(parsed.error) };

  const [contacto] = await db
    .select({ telefonoE164: crmContactos.telefonoE164 })
    .from(crmContactos)
    .where(eq(crmContactos.id, id))
    .limit(1);
  if (!contacto) return { ok: false, error: "Contacto no encontrado." };

  if (optIn && !contacto.telefonoE164) {
    return {
      ok: false,
      error: "No se puede activar WhatsApp sin un teléfono válido en formato internacional.",
    };
  }
  if (optIn && !parsed.data.fuente) {
    return {
      ok: false,
      error: "Hace falta indicar de dónde salió el consentimiento de WhatsApp.",
    };
  }

  await db
    .update(crmContactos)
    .set({
      whatsappOptIn: optIn,
      whatsappOptInAt: optIn ? new Date() : null,
      whatsappOptInFuente: optIn ? parsed.data.fuente : null,
    })
    .where(eq(crmContactos.id, id));

  await db.insert(crmEventos).values({
    contactoId: id,
    tipo: "contacto_editado",
    datos: { whatsappOptIn: optIn, fuente: optIn ? parsed.data.fuente : null },
  });

  revalidarCrm();
  return {
    ok: true,
    id,
    mensaje: optIn ? "Opt-in de WhatsApp activado." : "Opt-in de WhatsApp dado de baja.",
  };
}

/** Agrega tags sin pisar los que ya tiene. */
export async function agregarTags(id: string, tags: string[]): Promise<CrmActionState> {
  await requireAdmin();

  const [actual] = await db
    .select({ tags: crmContactos.tags })
    .from(crmContactos)
    .where(eq(crmContactos.id, id))
    .limit(1);
  if (!actual) return { ok: false, error: "Contacto no encontrado." };

  await db
    .update(crmContactos)
    .set({ tags: unirTags(actual.tags, tags) })
    .where(eq(crmContactos.id, id));

  revalidarCrm();
  return { ok: true, id, mensaje: "Tags actualizados." };
}

// ─────────────────────────────────────────────────────── derivaciones

/** Deriva una persona a una unidad. Idempotente: si ya está, no hace nada. */
export async function derivar(
  contactoId: string,
  input: DerivacionInput
): Promise<CrmActionState> {
  await requireAdmin();

  const parsed = derivacionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: primerError(parsed.error) };

  const unidad = await requireUnidad(parsed.data.unidad);
  const estado = parsed.data.estado ?? estadoInicial(parsed.data.unidad);

  const [existe] = await db
    .select({ id: crmDerivaciones.id })
    .from(crmDerivaciones)
    .where(
      and(
        eq(crmDerivaciones.contactoId, contactoId),
        eq(crmDerivaciones.unidadProjectId, unidad.projectId)
      )
    )
    .limit(1);
  if (existe) {
    return { ok: false, error: `Ese contacto ya está en ${unidad.etiqueta}.` };
  }

  const derivacionId = crypto.randomUUID();
  await ejecutarEnTransaccion([
    db.insert(crmDerivaciones).values({
      id: derivacionId,
      contactoId,
      unidadProjectId: unidad.projectId,
      estado,
      notas: parsed.data.notas,
    }),
    db.insert(crmEventos).values({
      contactoId,
      derivacionId,
      tipo: "derivacion_creada",
      datos: { unidad: unidad.clave, estado },
    }),
  ]);

  revalidarCrm();
  return { ok: true, id: contactoId, mensaje: `Derivado a ${unidad.etiqueta}.` };
}

export type DerivacionMasivaResultado =
  | { ok: true; derivados: number; yaEstaban: number; mensaje: string }
  | { ok: false; error: string };

/**
 * Deriva N personas a una unidad con un estado inicial, en UNA transacción.
 *
 * Las que ya estaban en esa unidad se saltean (no se les pisa el estado: el que
 * tienen lo puso alguien). Se resuelve antes quiénes están para que la decisión
 * no dependa del resultado de una sentencia anterior, que es lo único que
 * `db.batch()` no permite.
 */
export async function derivarMasivo(
  contactoIds: string[],
  input: DerivacionInput
): Promise<DerivacionMasivaResultado> {
  await requireAdmin();

  if (contactoIds.length === 0) return { ok: false, error: "No seleccionaste ningún contacto." };

  const parsed = derivacionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: primerError(parsed.error) };

  const unidad = await requireUnidad(parsed.data.unidad);
  const estado = parsed.data.estado ?? estadoInicial(parsed.data.unidad);

  const r = await derivarMasivoEnBase(
    contactoIds,
    unidad.clave,
    unidad.projectId,
    estado,
    parsed.data.notas ?? null
  );

  if (r.inexistentes.length > 0) {
    return { ok: false, error: "Alguno de los contactos seleccionados ya no existe." };
  }

  revalidarCrm();

  if (r.derivados === 0) {
    return {
      ok: true,
      derivados: 0,
      yaEstaban: r.yaEstaban,
      mensaje: `Los ${r.yaEstaban} contactos ya estaban en ${unidad.etiqueta}.`,
    };
  }
  const extra = r.yaEstaban > 0 ? ` (${r.yaEstaban} ya estaban)` : "";
  return {
    ok: true,
    derivados: r.derivados,
    yaEstaban: r.yaEstaban,
    mensaje: `${r.derivados} contactos derivados a ${unidad.etiqueta}${extra}.`,
  };
}

/** Cambia la etapa de una persona dentro de una unidad. */
export async function cambiarEstado(
  contactoId: string,
  unidadClave: UnidadClave,
  estado: string
): Promise<CrmActionState> {
  await requireAdmin();

  if (!esEstadoValido(unidadClave, estado)) {
    return { ok: false, error: "Ese estado no existe en el pipeline de esa unidad." };
  }
  const unidad = await requireUnidad(unidadClave);

  const [previa] = await db
    .select({ id: crmDerivaciones.id, estado: crmDerivaciones.estado })
    .from(crmDerivaciones)
    .where(
      and(
        eq(crmDerivaciones.contactoId, contactoId),
        eq(crmDerivaciones.unidadProjectId, unidad.projectId)
      )
    )
    .limit(1);
  if (!previa) return { ok: false, error: `Ese contacto no está en ${unidad.etiqueta}.` };
  if (previa.estado === estado) {
    return { ok: true, id: contactoId, mensaje: "Ya estaba en ese estado." };
  }

  await ejecutarEnTransaccion([
    db.update(crmDerivaciones).set({ estado }).where(eq(crmDerivaciones.id, previa.id)),
    db.insert(crmEventos).values({
      contactoId,
      derivacionId: previa.id,
      tipo: "estado_cambiado",
      datos: { unidad: unidadClave, de: previa.estado, a: estado },
    }),
  ]);

  // En agencia hay que mover también `leads.status`, que es lo que lee el Kanban
  // y las métricas. Ver src/lib/crm/agencia.ts.
  if (unidadClave === "agencia") await propagarEstadoAcLeads(contactoId, estado);

  revalidarCrm();
  return { ok: true, id: contactoId, mensaje: "Estado actualizado." };
}

/**
 * Saca a una persona de una unidad. El contacto NO se borra: si se queda sin
 * derivaciones vuelve a la Bandeja, que es exactamente donde tiene que estar.
 *
 * El evento se escribe ANTES de borrar la fila y con `derivacionId` en null: el
 * FK es ON DELETE SET NULL, así que apuntarlo a una fila que se está yendo
 * dejaría el evento huérfano igual. El detalle queda en `datos`.
 */
export async function quitarDerivacion(
  contactoId: string,
  unidadClave: UnidadClave
): Promise<CrmActionState> {
  await requireAdmin();

  const unidad = await requireUnidad(unidadClave);
  const [previa] = await db
    .select({ id: crmDerivaciones.id, estado: crmDerivaciones.estado })
    .from(crmDerivaciones)
    .where(
      and(
        eq(crmDerivaciones.contactoId, contactoId),
        eq(crmDerivaciones.unidadProjectId, unidad.projectId)
      )
    )
    .limit(1);
  if (!previa) return { ok: false, error: `Ese contacto no está en ${unidad.etiqueta}.` };

  await ejecutarEnTransaccion([
    db.insert(crmEventos).values({
      contactoId,
      tipo: "derivacion_quitada",
      datos: { unidad: unidadClave, estadoAlQuitar: previa.estado },
    }),
    db.delete(crmDerivaciones).where(eq(crmDerivaciones.id, previa.id)),
  ]);

  revalidarCrm();
  return { ok: true, id: contactoId, mensaje: `Quitado de ${unidad.etiqueta}.` };
}

// ─────────────────────────────────────────────────────── fusión manual

/**
 * Fusiona dos personas en una. `absorbidoId` desaparece; `principalId` queda.
 *
 * Qué pasa con cada cosa:
 *  - escalares: se completan los huecos del principal; lo que ya tenía valor NO
 *    se pisa, porque fue cargado o corregido a mano.
 *  - tags y notas: se suman. Perder una nota al fusionar es pérdida de datos.
 *  - `suscripto`: false AND false = false. Una baja nunca revive.
 *  - derivaciones: las del absorbido pasan al principal. Si los dos estaban en
 *    la misma unidad, gana el estado que ya tenía el principal.
 *  - eventos: se reasignan, así la línea de tiempo no pierde historia.
 *  - puentes: `leads` se reapunta al principal.
 *
 * Todo en un `db.batch()`: o se fusiona entero o no se fusiona.
 */
export async function fusionarContactos(
  principalId: string,
  absorbidoId: string
): Promise<CrmActionState> {
  await requireAdmin();

  const clavePorProjectId = new Map((await getUnidades()).map((u) => [u.projectId, u.clave]));
  const r = await fusionarEnBase(principalId, absorbidoId, clavePorProjectId);
  if (!r.ok) return { ok: false, error: r.error };

  revalidarCrm();
  return { ok: true, id: principalId, mensaje: "Contactos fusionados." };
}

// ─────────────────────────────────────────────────────── exportación

/**
 * CSV de lo que se ve en pantalla. Usa exactamente los mismos filtros que el
 * listado, así lo exportado y lo mostrado no pueden divergir.
 */
export async function exportarContactos(filtros: CrmFiltros): Promise<string> {
  await requireAdmin();
  return contactosACsv(await listarTodoParaExportar(filtros));
}

