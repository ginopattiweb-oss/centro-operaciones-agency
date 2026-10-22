/**
 * Derivados, validación y normalización del CRM. Funciones puras.
 *
 * Nada de acá toca la base: `queries.ts` lee y `actions/crm.ts` escribe. La
 * validación va con Zod porque el importador procesa miles de filas de forma
 * desconocida y el webhook recibe JSON de internet: los dos necesitan un
 * contrato explícito, no chequeos sueltos.
 */
import { z } from "zod";
import type { CrmContacto, CrmDerivacion, CrmEvento, CrmEventoTipo } from "@/db/schema";
import { CONTACT_SOURCES } from "@/lib/contactos/config";
import type { ContactSource } from "@/db/schema";
import { normalizarTelefono } from "./telefono";
import { esEstadoValido, esUnidadClave, UNIDAD_CLAVES, type UnidadClave } from "./unidades";

// ─────────────────────────────────────────────────────── vistas al cliente

/** Una derivación tal como viaja al cliente. */
export type DerivacionView = {
  id: string;
  unidad: UnidadClave;
  estado: string;
  derivadoAt: string;
  notas: string | null;
};

/** Fila del CRM tal como viaja al cliente, ya derivada en el servidor. */
export type CrmContactoRow = {
  id: string;
  email: string | null;
  telefonoE164: string | null;
  telefonoCrudo: string | null;
  nombre: string | null;
  instagram: string | null;
  sitioWeb: string | null;
  origen: ContactSource;
  origenDetalle: string | null;
  suscripto: boolean;
  bajaAt: string | null;
  bajaMotivo: string | null;
  consentimientoAt: string | null;
  consentimientoFuente: string | null;
  whatsappOptIn: boolean;
  whatsappOptInAt: string | null;
  whatsappOptInFuente: string | null;
  tags: string[];
  notas: string | null;
  createdAt: string;
  /** Las unidades a las que está derivado, con su estado en cada una. */
  derivaciones: DerivacionView[];
};

export type CrmEventoView = {
  id: string;
  tipo: CrmEventoTipo;
  ocurridoAt: string;
  datos: Record<string, unknown>;
};

export function toDerivacionView(d: CrmDerivacion, clavePorProjectId: Map<string, UnidadClave>) {
  const unidad = clavePorProjectId.get(d.unidadProjectId);
  // Una derivación a un project que no está en `crm_unidades` no puede existir:
  // lo impide el FK. Si pasa, es un bug y hay que verlo, no esconderlo.
  if (!unidad) {
    throw new Error(`Derivación ${d.id} apunta a una unidad desconocida: ${d.unidadProjectId}`);
  }
  return {
    id: d.id,
    unidad,
    estado: d.estado,
    derivadoAt: d.derivadoAt.toISOString(),
    notas: d.notas,
  } satisfies DerivacionView;
}

export function toCrmContactoRow(
  c: CrmContacto,
  derivaciones: DerivacionView[] = []
): CrmContactoRow {
  return {
    id: c.id,
    email: c.email,
    telefonoE164: c.telefonoE164,
    telefonoCrudo: c.telefonoCrudo,
    nombre: c.nombre,
    instagram: c.instagram,
    sitioWeb: c.sitioWeb,
    origen: c.origen,
    origenDetalle: c.origenDetalle,
    suscripto: c.suscripto,
    bajaAt: c.bajaAt?.toISOString() ?? null,
    bajaMotivo: c.bajaMotivo,
    consentimientoAt: c.consentimientoAt?.toISOString() ?? null,
    consentimientoFuente: c.consentimientoFuente,
    whatsappOptIn: c.whatsappOptIn,
    whatsappOptInAt: c.whatsappOptInAt?.toISOString() ?? null,
    whatsappOptInFuente: c.whatsappOptInFuente,
    tags: c.tags,
    notas: c.notas,
    createdAt: c.createdAt.toISOString(),
    derivaciones: [...derivaciones].sort((a, b) => a.unidad.localeCompare(b.unidad)),
  };
}

export function toCrmEventoView(e: CrmEvento): CrmEventoView {
  return {
    id: e.id,
    tipo: e.tipo,
    ocurridoAt: e.ocurridoAt.toISOString(),
    datos: e.datos,
  };
}

/** Cómo se muestra una persona cuando no tiene nombre cargado. */
export function nombreVisible(row: CrmContactoRow): string {
  return row.nombre || row.email || row.telefonoE164 || row.telefonoCrudo || row.instagram || "Sin nombre";
}

// ─────────────────────────────────────────────────────── normalización

/** El mail siempre en minúsculas y sin espacios. La columna es `citext`; esto es para que lo guardado y lo mostrado coincidan. */
export function normalizarEmail(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().toLowerCase();
  return v || null;
}

/** Handle sin '@' ni URL, mismo criterio que lib/contactos y lib/leads. */
export function normalizarInstagram(raw: string | null | undefined): string | null {
  const v = (raw ?? "")
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "");
  return v || null;
}

/** URL con esquema. Sin esquema se asume https, igual que en leads. */
export function normalizarSitioWeb(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/**
 * Tags limpios: sin espacios de más, sin vacíos, sin repetidos y en minúsculas.
 * En minúsculas para que "Gumroad" y "gumroad" no convivan como dos etiquetas.
 */
export function normalizarTags(raw: readonly string[]): string[] {
  const vistos = new Set<string>();
  for (const tag of raw) {
    const limpio = tag.trim().toLowerCase();
    if (limpio) vistos.add(limpio);
  }
  return [...vistos].sort();
}

/** Une dos juegos de tags. Las importaciones suman, nunca reemplazan. */
export function unirTags(actual: readonly string[], entrante: readonly string[]): string[] {
  return normalizarTags([...actual, ...entrante]);
}

// ─────────────────────────────────────────────────────── validación

function textoOpcional(max: number, mensaje: string) {
  return z
    .string()
    .max(max, { message: mensaje })
    .nullish()
    .transform((v) => {
      const t = (v ?? "").trim();
      return t === "" ? null : t;
    });
}

const emailOpcional = textoOpcional(320, "Ese mail es demasiado largo.").refine(
  (v) => v === null || z.email().safeParse(v).success,
  { message: "Ese mail no tiene un formato válido." }
);

/**
 * Datos de una persona.
 *
 * El refine final replica el CHECK `crm_contactos_tiene_canal` de la base: una
 * fila sin ninguna forma de contactar a la persona no es un contacto. Se valida
 * acá además de en Postgres para poder dar un mensaje en castellano en vez de
 * un error de constraint.
 */
export const crmContactoInputSchema = z
  .object({
    email: emailOpcional,
    /** Se tipea libre y se normaliza a E.164; lo que no normaliza va a `telefonoCrudo`. */
    telefono: textoOpcional(50, "Ese teléfono es demasiado largo."),
    nombre: textoOpcional(200, "El nombre es demasiado largo."),
    instagram: textoOpcional(100, "El usuario de Instagram es demasiado largo."),
    sitioWeb: textoOpcional(300, "La URL es demasiado larga."),
    origen: z.enum(CONTACT_SOURCES as [ContactSource, ...ContactSource[]]).default("manual"),
    origenDetalle: textoOpcional(300, "El detalle de origen es demasiado largo."),
    tags: z.array(z.string()).default([]),
    notas: textoOpcional(5000, "Las notas son demasiado largas."),
    consentimientoFuente: textoOpcional(300, "El origen del consentimiento es demasiado largo."),
  })
  .transform((v) => {
    const tel = normalizarTelefono(v.telefono);
    return {
      email: normalizarEmail(v.email),
      telefonoE164: tel.e164,
      telefonoCrudo: tel.crudo,
      nombre: v.nombre,
      instagram: normalizarInstagram(v.instagram),
      sitioWeb: normalizarSitioWeb(v.sitioWeb),
      origen: v.origen,
      origenDetalle: v.origenDetalle,
      tags: normalizarTags(v.tags),
      notas: v.notas,
      consentimientoFuente: v.consentimientoFuente,
    };
  })
  .refine(
    (v) =>
      v.email !== null ||
      v.telefonoE164 !== null ||
      v.telefonoCrudo !== null ||
      v.instagram !== null ||
      v.sitioWeb !== null,
    {
      message:
        "Hace falta al menos una forma de contacto: mail, teléfono, Instagram o sitio web.",
    }
  );

export type CrmContactoInput = z.input<typeof crmContactoInputSchema>;
export type CrmContactoFields = z.output<typeof crmContactoInputSchema>;

/** Unidad + estado, validando que el estado pertenezca a esa unidad. */
export const derivacionInputSchema = z
  .object({
    unidad: z.enum(UNIDAD_CLAVES),
    /** Si falta, la action usa el estado inicial de la unidad. */
    estado: z.string().nullish(),
    notas: textoOpcional(2000, "Las notas son demasiado largas."),
  })
  .refine((v) => v.estado == null || esEstadoValido(v.unidad, v.estado), {
    message: "Ese estado no existe en el pipeline de esa unidad.",
    path: ["estado"],
  });

export type DerivacionInput = z.input<typeof derivacionInputSchema>;

/**
 * Opt-in de WhatsApp.
 *
 * Exige teléfono E.164 y fuente: es el respaldo de por qué se le puede escribir
 * a alguien por WhatsApp, y la política de Meta lo pide. NO se infiere del
 * consentimiento de email: son dos permisos distintos.
 */
export const whatsappOptInSchema = z.object({
  optIn: z.boolean(),
  fuente: textoOpcional(300, "La fuente es demasiado larga."),
});

export function esUnidad(value: unknown): value is UnidadClave {
  return esUnidadClave(value);
}

/** El primer mensaje de error legible de un parseo fallido. */
export function primerError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Los datos del contacto no son válidos.";
}
