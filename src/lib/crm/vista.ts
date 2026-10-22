/**
 * Traducción entre los filtros de la URL y los de la capa de datos.
 *
 * Todo filtro viaja por la URL, igual que en el módulo de Contactos viejo: la
 * vista se comparte con un link y el botón "atrás" del navegador funciona sin
 * que haya que guardar estado en ningún lado.
 *
 * Funciones puras, sin servidor: las importan las páginas y los componentes de
 * cliente por igual.
 */
import { isContactSource } from "@/lib/contactos/config";
import type { CrmFiltros } from "./queries";
import { esEstadoValido, type UnidadClave } from "./unidades";

/** Los filtros tal como viven en la query string. */
export type FiltrosUrl = {
  q: string;
  estado: string;
  origen: string;
  suscripto: string;
  optin: string;
  tags: string;
};

export const FILTROS_VACIOS: FiltrosUrl = {
  q: "",
  estado: "",
  origen: "",
  suscripto: "",
  optin: "",
  tags: "",
};

export type SearchParamsCrm = Partial<Record<keyof FiltrosUrl | "page" | "vista", string>>;

/** Tabla o kanban. Va en la URL para que la elección se pueda compartir. */
export type ModoVista = "tabla" | "kanban";

export function leerModo(params: SearchParamsCrm): ModoVista {
  return params.vista === "kanban" ? "kanban" : "tabla";
}

/** Lee la query string sin validar nada: es lo que vuelve al cliente. */
export function leerFiltrosUrl(params: SearchParamsCrm): FiltrosUrl {
  return {
    q: params.q ?? "",
    estado: params.estado ?? "",
    origen: params.origen ?? "",
    suscripto: params.suscripto ?? "",
    optin: params.optin ?? "",
    tags: params.tags ?? "",
  };
}

/** "si" / "no" / cualquier otra cosa → true / false / null. */
function triestado(valor: string): boolean | null {
  if (valor === "si") return true;
  if (valor === "no") return false;
  return null;
}

/**
 * Los filtros de la URL convertidos a los de la capa de datos, ya validados.
 *
 * `alcance` NO sale de la URL: lo fija la página. La vista de una unidad no
 * puede recibir por query string un alcance de otra unidad.
 */
export function aFiltrosDeDatos(
  url: FiltrosUrl,
  alcance: UnidadClave | "sin_derivar" | "todos"
): CrmFiltros {
  const esUnidad = alcance !== "todos" && alcance !== "sin_derivar";
  return {
    alcance,
    busqueda: url.q.trim() || undefined,
    // El estado sólo tiene sentido dentro de una unidad, y tiene que pertenecer
    // a ESA unidad: un estado de agencia en la vista de comunidad se descarta.
    estado: esUnidad && esEstadoValido(alcance, url.estado) ? url.estado : null,
    origen: isContactSource(url.origen) ? url.origen : null,
    suscripto: triestado(url.suscripto),
    whatsappOptIn: triestado(url.optin),
    tags: url.tags ? url.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
  };
}

export function leerPagina(params: SearchParamsCrm): number {
  return Number.parseInt(params.page ?? "1", 10) || 1;
}

/** Si hay algún filtro puesto, para poder ofrecer "limpiar". */
export function hayFiltros(url: FiltrosUrl): boolean {
  return Object.values(url).some(Boolean);
}
