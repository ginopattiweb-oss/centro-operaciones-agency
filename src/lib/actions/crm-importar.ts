"use server";

/**
 * Importación masiva de contactos al CRM desde CSV.
 *
 * Las reglas de merge se aplican dentro del propio `ON CONFLICT DO UPDATE` y no
 * leyendo-y-escribiendo desde Node. Es a propósito: leer el contacto, decidir en
 * JavaScript y volver a escribir deja una ventana en la que otra escritura se
 * pierde. Acá cada fila se resuelve dentro de la misma sentencia.
 *
 * Sobre atomicidad: cada lote de 500 es UNA sentencia, así que es atómico por
 * lote y no por archivo. Es aceptable porque el import es reejecutable: volver a
 * subir el mismo CSV actualiza, nunca duplica.
 *
 * Los índices únicos de `crm_contactos` son PARCIALES (`WHERE email IS NOT NULL`),
 * y Postgres sólo infiere un índice por sentencia. Por eso las filas se parten
 * en dos pasadas: las que se deduplican por mail y las que se deduplican por
 * teléfono.
 */
import { revalidatePath } from "next/cache";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { crmContactos } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-server";
import type { FilaRechazada } from "@/lib/crm/csv";
import {
  enLotes,
  MAX_FILAS_IMPORT,
  planearImport,
  resumirImport,
  validarAjustes,
  type AjustesLote,
  type FilaPreparada,
  type FilaCsv,
  type Mapeo,
  type ResumenImport,
} from "@/lib/crm/importar";
import { escribirImportacion } from "@/lib/crm/escrituras";
import { requireUnidad } from "@/lib/crm/queries";
import {
  CRM_BANDEJA_PATH,
  CRM_TODOS_PATH,
  estadoInicial,
  UNIDADES,
  unidadContactosPath,
  type UnidadClave,
} from "@/lib/crm/unidades";

export type PayloadImport = {
  archivo: string;
  filas: FilaCsv[];
  mapeo: Mapeo;
  lote: AjustesLote;
};

export type ResultadoPreview =
  | { ok: true; resumen: ResumenImport; rechazadas: FilaRechazada[] }
  | { ok: false; error: string };

export type ResultadoImport =
  | {
      ok: true;
      creadas: number;
      actualizadas: number;
      omitidas: number;
      derivadas: number;
      rechazadas: FilaRechazada[];
    }
  | { ok: false; error: string };

function validarPayload(payload: PayloadImport): string | null {
  if (!payload.filas || payload.filas.length === 0) return "El archivo no tiene filas.";
  if (payload.filas.length > MAX_FILAS_IMPORT) {
    return `El archivo tiene más de ${MAX_FILAS_IMPORT.toLocaleString("es-AR")} filas. Partilo en varios.`;
  }
  const destinos = Object.values(payload.mapeo);
  if (!destinos.includes("email") && !destinos.includes("telefono")) {
    return "Hace falta mapear al menos la columna del mail o la del teléfono.";
  }
  return validarAjustes(payload.lote);
}

/** Las claves (mail o teléfono) que ya existen en el CRM, de las que trae el archivo. */
async function clavesExistentes(filas: FilaPreparada[]): Promise<Set<string>> {
  const emails = filas.filter((f) => f.claveEs === "email").map((f) => f.clave);
  const telefonos = filas.filter((f) => f.claveEs === "telefono").map((f) => f.clave);
  const encontradas = new Set<string>();

  for (const trozo of enLotes(emails, 1000)) {
    const r = await db
      .select({ email: crmContactos.email })
      .from(crmContactos)
      .where(inArray(crmContactos.email, trozo));
    for (const f of r) if (f.email) encontradas.add(f.email.toLowerCase());
  }
  for (const trozo of enLotes(telefonos, 1000)) {
    const r = await db
      .select({ telefonoE164: crmContactos.telefonoE164 })
      .from(crmContactos)
      .where(inArray(crmContactos.telefonoE164, trozo));
    for (const f of r) if (f.telefonoE164) encontradas.add(f.telefonoE164);
  }
  return encontradas;
}

/** Paso 4: qué va a pasar, sin escribir nada. */
export async function previsualizarImport(payload: PayloadImport): Promise<ResultadoPreview> {
  await requireAdmin();

  const error = validarPayload(payload);
  if (error) return { ok: false, error };

  const plan = planearImport(payload.filas, payload.mapeo, payload.lote);
  const existentes = await clavesExistentes(plan.filas);

  return {
    ok: true,
    resumen: resumirImport(plan, existentes, payload.lote.derivarA),
    rechazadas: plan.rechazadas,
  };
}

export async function confirmarImport(payload: PayloadImport): Promise<ResultadoImport> {
  await requireAdmin();

  const error = validarPayload(payload);
  if (error) return { ok: false, error };

  const destino = payload.lote.derivarA;
  const unidad = destino ? await requireUnidad(destino) : null;
  const estado = destino ? (payload.lote.estadoInicial ?? estadoInicial(destino)) : null;

  const r = await escribirImportacion(
    payload.archivo,
    payload.filas,
    payload.mapeo,
    payload.lote,
    unidad ? { clave: unidad.clave, projectId: unidad.projectId } : null,
    estado
  );

  revalidatePath(CRM_TODOS_PATH);
  revalidatePath(CRM_BANDEJA_PATH);
  for (const clave of Object.keys(UNIDADES) as UnidadClave[]) {
    revalidatePath(unidadContactosPath(clave));
  }

  return {
    ok: true,
    creadas: r.creadas,
    actualizadas: r.actualizadas,
    omitidas: r.omitidas,
    derivadas: r.derivadas,
    rechazadas: r.rechazadas,
  };
}
