/**
 * Las unidades del CRM y el pipeline de cada una.
 *
 * ESTE ES EL ÚNICO LUGAR donde se editan los estados. Agregar, renombrar o
 * reordenar una etapa es una línea de acá y nada más: no hace falta migración,
 * porque `crm_derivaciones.estado` es `text` en la base.
 *
 * La contracara: Postgres no garantiza que un estado pertenezca a su unidad.
 * Eso lo garantiza este archivo, y toda escritura pasa por `esEstadoValido()`
 * antes de tocar la base.
 *
 * Sin nada de servidor, así lo importan también los componentes de cliente
 * (mismo criterio que `leads-config.ts` y `contactos/config.ts`).
 */

/** Clave estable de cada unidad. Es lo que guarda `crm_unidades.clave`. */
export const UNIDAD_CLAVES = ["agencia"] as const;

export type UnidadClave = (typeof UNIDAD_CLAVES)[number];

export function esUnidadClave(value: unknown): value is UnidadClave {
  return typeof value === "string" && (UNIDAD_CLAVES as readonly string[]).includes(value);
}

type DefinicionUnidad = {
  /** Cómo se llama la unidad en pantalla. */
  etiqueta: string;
  /** Nombre corto para los chips de la tabla, donde no entra el largo. */
  chip: string;
  /** El slug de `projects`. Resuelve el `project_id` real. */
  slug: string;
  /** Orden en que aparecen las unidades en filtros y tarjetas. */
  orden: number;
  /** Las etapas del pipeline, en orden. La primera es la inicial. */
  estados: readonly string[];
  /** Etiqueta de cada estado. Las claves tienen que cubrir `estados`. */
  etiquetasEstado: Record<string, string>;
  /** Estados cerrados: no son pipeline activo. */
  cerrados: readonly string[];
  /**
   * Opcional: jerarquía de estados para fusiones e importaciones (mayor = más
   * avanzado). Sin ella, al fusionar gana el estado que ya estaba.
   */
  rango?: Record<string, number>;
};

/**
 * Agencia usa EXACTAMENTE las seis etapas del enum `lead_status`.
 *
 * Para sumar otra unidad de negocio con su propio pipeline: agregar su clave a
 * `UNIDAD_CLAVES`, definirla acá, crear la fila en `projects` y registrarla en
 * `crm_unidades` (ver src/db/seed.ts).
 */
export const UNIDADES: Record<UnidadClave, DefinicionUnidad> = {
  agencia: {
    etiqueta: "Agencia",
    chip: "Agencia",
    slug: "agencia",
    orden: 1,
    estados: ["nuevo", "contactado", "en_conversacion", "cotizado", "ganado", "perdido"],
    etiquetasEstado: {
      nuevo: "Nuevo",
      contactado: "Contactado",
      en_conversacion: "En conversación",
      cotizado: "Cotizado",
      ganado: "Ganado",
      perdido: "Perdido",
    },
    cerrados: ["ganado", "perdido"],
  },
};

/** Las unidades en el orden en que se muestran. */
export const UNIDADES_ORDENADAS: UnidadClave[] = [...UNIDAD_CLAVES].sort(
  (a, b) => UNIDADES[a].orden - UNIDADES[b].orden
);

/** La etapa en la que entra una persona recién derivada a esa unidad. */
export function estadoInicial(unidad: UnidadClave): string {
  return UNIDADES[unidad].estados[0];
}

export function estadosDe(unidad: UnidadClave): readonly string[] {
  return UNIDADES[unidad].estados;
}

/**
 * Si un estado pertenece a una unidad. Lo usa Zod en TODA escritura: es lo que
 * reemplaza al CHECK que la base no puede hacer.
 */
export function esEstadoValido(unidad: UnidadClave, estado: unknown): estado is string {
  return typeof estado === "string" && UNIDADES[unidad].estados.includes(estado);
}

export function etiquetaEstado(unidad: UnidadClave, estado: string): string {
  return UNIDADES[unidad].etiquetasEstado[estado] ?? estado;
}

export function esEstadoCerrado(unidad: UnidadClave, estado: string): boolean {
  return UNIDADES[unidad].cerrados.includes(estado);
}

/** "Agencia · Cotizado", para los chips de la columna Unidades. */
export function chipDerivacion(unidad: UnidadClave, estado: string): string {
  return `${UNIDADES[unidad].chip} · ${etiquetaEstado(unidad, estado)}`;
}

/**
 * El estado que queda al fusionar dos derivaciones de la misma unidad. Si la
 * unidad define `rango`, gana el más alto; si no, el que ya estaba, porque es
 * el que alguien puso a mano.
 */
export function estadoAlFusionar(
  unidad: UnidadClave,
  actual: string,
  entrante: string
): string {
  const rango = UNIDADES[unidad].rango;
  if (!rango) return actual;
  return (rango[entrante] ?? 0) > (rango[actual] ?? 0) ? entrante : actual;
}

// ── Rutas ──

export const CRM_BASE_PATH = "/crm";
export const CRM_BANDEJA_PATH = `${CRM_BASE_PATH}/bandeja`;
export const CRM_TODOS_PATH = `${CRM_BASE_PATH}/todos`;

/** La vista de contactos de una unidad, dentro de la unidad. */
export function unidadContactosPath(unidad: UnidadClave): string {
  return `/unidad/${UNIDADES[unidad].slug}/contactos`;
}

/** La unidad del CRM que corresponde a un slug de `projects`, o null. */
export function claveDeSlug(slug: string): UnidadClave | null {
  return UNIDADES_ORDENADAS.find((clave) => UNIDADES[clave].slug === slug) ?? null;
}
