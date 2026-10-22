/**
 * Lo que necesitan las páginas del CRM, en una sola función.
 *
 * Las cuatro vistas (Bandeja, Todos, y la de cada unidad) piden exactamente lo
 * mismo con distinto alcance, así que la carga vive acá y no repetida en cada
 * página. Sólo servidor.
 */
import {
  getContadoresTransversales,
  getContadoresUnidad,
  getTagsEnUso,
  listarContactos,
  listarParaKanban,
  DEFAULT_PAGE_SIZE,
} from "@/lib/crm/queries";
import {
  aFiltrosDeDatos,
  leerFiltrosUrl,
  leerModo,
  leerPagina,
  type SearchParamsCrm,
} from "@/lib/crm/vista";
import type { Alcance, ContadoresVista } from "@/components/crm/ContactosVista";

export async function cargarVista(alcance: Alcance, params: SearchParamsCrm) {
  const filtros = leerFiltrosUrl(params);
  const deDatos = aFiltrosDeDatos(filtros, alcance);
  const esUnidad = alcance !== "todos" && alcance !== "sin_derivar";
  // El kanban sólo existe dentro de una unidad: necesita UN pipeline, y en las
  // vistas transversales conviven los tres.
  const modo = esUnidad ? leerModo(params) : "tabla";

  const [pagina, tags, contadores] = await Promise.all([
    listarContactos(deDatos, leerPagina(params), DEFAULT_PAGE_SIZE),
    getTagsEnUso(),
    esUnidad
      ? getContadoresUnidad(alcance).then(
          (c): ContadoresVista => ({
            tipo: "unidad",
            unidad: alcance,
            total: c.total,
            porEstado: c.porEstado,
          })
        )
      : getContadoresTransversales().then(
          (datos): ContadoresVista => ({ tipo: "transversal", datos })
        ),
  ]);

  // Las columnas se cargan sólo cuando se van a mostrar: son una consulta por
  // etapa y no tiene sentido pagarlas en la vista de tabla.
  const columnas =
    modo === "kanban" && esUnidad
      ? await listarParaKanban(alcance, { ...deDatos, estado: null })
      : null;

  return { filtros, pagina, tags, contadores, modo, columnas };
}
