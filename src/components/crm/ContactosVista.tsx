"use client";

/**
 * La vista de lista del CRM. UN componente para los cuatro lugares donde se usa:
 * CRM → Bandeja, CRM → Todos, y la vista de contactos de cada unidad.
 *
 * Lo que cambia entre esos usos es sólo el `alcance`, y de ahí salen dos cosas:
 *  - qué contactos trae la página (el servidor ya los filtró por derivación);
 *  - qué tarjetas de totales se muestran: en Todos son total / sin derivar / por
 *    unidad; dentro de una unidad son las etapas de SU pipeline.
 *
 * Todos los números vienen contados de la base. Ninguno se estima ni se deriva
 * del largo de la página.
 */
import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Columns3, Download, Plus, Rows3, Search, Upload, Users, X } from "lucide-react";
import { derivarMasivo, exportarContactos } from "@/lib/actions/crm";
import type { CrmContactoRow } from "@/lib/crm/contactos";
import { nombreVisible } from "@/lib/crm/contactos";
import type { ContadoresTransversales, CrmPagina } from "@/lib/crm/queries";
import {
  CRM_TODOS_PATH,
  estadosDe,
  etiquetaEstado,
  unidadContactosPath,
  UNIDADES,
  UNIDADES_ORDENADAS,
  type UnidadClave,
} from "@/lib/crm/unidades";
import {
  aFiltrosDeDatos,
  hayFiltros,
  type FiltrosUrl,
  type ModoVista,
} from "@/lib/crm/vista";
import type { ColumnaKanban } from "@/lib/crm/queries";
import { ContactosKanban } from "./ContactosKanban";
import { CONTACT_SOURCE_LABELS, CONTACT_SOURCES } from "@/lib/contactos/config";
import { formatShortDateStr } from "@/lib/date";
import { DerivarDialog } from "./DerivarDialog";
import { FichaPanel } from "./FichaPanel";
import {
  BOTON_PRIMARIO,
  BOTON_SECUNDARIO,
  CounterCard,
  CRM_INPUT,
  TagChip,
  UnidadesChips,
} from "./ui";

export type Alcance = UnidadClave | "sin_derivar" | "todos";

export type ContadoresVista =
  | { tipo: "transversal"; datos: ContadoresTransversales }
  | { tipo: "unidad"; unidad: UnidadClave; total: number; porEstado: Record<string, number> };

export function ContactosVista({
  titulo,
  descripcion,
  alcance,
  pagina,
  contadores,
  tagsDisponibles,
  filtros,
  modo,
  columnas,
  /** Oculta el importador donde no tiene sentido ofrecerlo. */
  permitirImportar = true,
}: {
  titulo: string;
  descripcion: string;
  alcance: Alcance;
  pagina: CrmPagina;
  contadores: ContadoresVista;
  tagsDisponibles: string[];
  filtros: FiltrosUrl;
  modo: ModoVista;
  /** Las columnas del kanban. Null en modo tabla y en las vistas transversales. */
  columnas: ColumnaKanban[] | null;
  permitirImportar?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startNav] = useTransition();

  const [busqueda, setBusqueda] = useState(filtros.q);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [derivando, setDerivando] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [errorDerivar, setErrorDerivar] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);

  const esUnidad = alcance !== "todos" && alcance !== "sin_derivar";

  /** Todo filtro viaja por la URL: la vista se comparte con un link. */
  const aplicar = useCallback(
    (cambios: Partial<FiltrosUrl & { page: string; vista: string }>) => {
      const params = new URLSearchParams();
      const merged = {
        ...filtros,
        page: "1",
        // La vista elegida se conserva al filtrar: cambiar un filtro no te
        // devuelve a la tabla.
        vista: modo === "kanban" ? "kanban" : "",
        ...cambios,
      };
      for (const [clave, valor] of Object.entries(merged)) {
        if (valor) params.set(clave, valor);
      }
      setSeleccion(new Set());
      startNav(() => router.push(`${pathname}?${params.toString()}`));
    },
    [filtros, modo, pathname, router]
  );

  const tagsElegidos = useMemo(
    () => filtros.tags.split(",").filter(Boolean),
    [filtros.tags]
  );

  const alternarTag = (tag: string) => {
    const siguiente = tagsElegidos.includes(tag)
      ? tagsElegidos.filter((t) => t !== tag)
      : [...tagsElegidos, tag];
    aplicar({ tags: siguiente.join(",") });
  };

  const alternarFila = (id: string) => {
    setSeleccion((previa) => {
      const siguiente = new Set(previa);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  };

  const idsPagina = pagina.rows.map((r) => r.id);
  const todaLaPaginaElegida =
    idsPagina.length > 0 && idsPagina.every((id) => seleccion.has(id));

  const alternarPagina = () => {
    setSeleccion((previa) => {
      const siguiente = new Set(previa);
      if (todaLaPaginaElegida) for (const id of idsPagina) siguiente.delete(id);
      else for (const id of idsPagina) siguiente.add(id);
      return siguiente;
    });
  };

  const confirmarDerivacion = async (unidad: UnidadClave, estado: string) => {
    setTrabajando(true);
    setErrorDerivar(null);
    try {
      const r = await derivarMasivo([...seleccion], { unidad, estado });
      if (!r.ok) {
        setErrorDerivar(r.error);
        return;
      }
      setDerivando(false);
      setSeleccion(new Set());
      setAviso(r.mensaje);
      startNav(() => router.refresh());
    } finally {
      setTrabajando(false);
    }
  };

  /** El CSV respeta los filtros de la vista: lo exportado es lo que se ve. */
  const exportar = async () => {
    setExportando(true);
    try {
      const csv = await exportarContactos(aFiltrosDeDatos(filtros, alcance));
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `crm-${alcance}-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportando(false);
    }
  };

  return (
    <>
      <header className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="sp-display text-2xl text-[var(--sp-ink)]">{titulo}</h1>
            <p className="mt-1 text-sm text-[var(--sp-muted)]">{descripcion}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* El kanban necesita UN pipeline, así que sólo aparece dentro de
                una unidad: en Todos y en la Bandeja conviven los tres. */}
            {esUnidad && (
              <div className="sp-pill inline-flex items-center border border-[var(--sp-line-strong)] p-0.5">
                <ToggleVista
                  activo={modo === "tabla"}
                  onClick={() => aplicar({ vista: "" })}
                  icono={<Rows3 className="h-4 w-4" />}
                  label="Tabla"
                />
                <ToggleVista
                  activo={modo === "kanban"}
                  onClick={() => aplicar({ vista: "kanban" })}
                  icono={<Columns3 className="h-4 w-4" />}
                  label="Kanban"
                />
              </div>
            )}
            <button
              type="button"
              onClick={exportar}
              disabled={exportando || pagina.total === 0}
              className={BOTON_SECUNDARIO}
            >
              <Download className="h-4 w-4" />
              {exportando ? "Generando…" : "Exportar CSV"}
            </button>
            {permitirImportar && (
              <button
                type="button"
                onClick={() => setImportando(true)}
                className={BOTON_SECUNDARIO}
              >
                <Upload className="h-4 w-4" />
                Importar CSV
              </button>
            )}
            <button type="button" onClick={() => setFichaId("nuevo")} className={BOTON_PRIMARIO}>
              <Plus className="h-4 w-4" />
              Nuevo contacto
            </button>
          </div>
        </div>

        <Totales
          contadores={contadores}
          filtros={filtros}
          aplicar={aplicar}
          irAUnidad={(clave) => startNav(() => router.push(unidadContactosPath(clave)))}
        />

        {/* ── Filtros ── */}
        <div className="flex flex-wrap items-end gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              aplicar({ q: busqueda });
            }}
            className="relative min-w-[220px] flex-1"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--sp-muted)]" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Mail, nombre, teléfono o Instagram"
              aria-label="Buscar contactos"
              className={`${CRM_INPUT} pl-9`}
            />
          </form>

          {esUnidad && modo === "tabla" && (
            <select
              value={filtros.estado}
              onChange={(e) => aplicar({ estado: e.target.value })}
              aria-label="Filtrar por estado"
              className={`${CRM_INPUT} w-auto`}
            >
              <option value="">Todas las etapas</option>
              {estadosDe(alcance).map((e) => (
                <option key={e} value={e}>
                  {etiquetaEstado(alcance, e)}
                </option>
              ))}
            </select>
          )}

          <select
            value={filtros.origen}
            onChange={(e) => aplicar({ origen: e.target.value })}
            aria-label="Filtrar por origen"
            className={`${CRM_INPUT} w-auto`}
          >
            <option value="">Todos los orígenes</option>
            {CONTACT_SOURCES.map((o) => (
              <option key={o} value={o}>
                {CONTACT_SOURCE_LABELS[o]}
              </option>
            ))}
          </select>

          <select
            value={filtros.suscripto}
            onChange={(e) => aplicar({ suscripto: e.target.value })}
            aria-label="Filtrar por suscripción a mails"
            className={`${CRM_INPUT} w-auto`}
          >
            <option value="">Mails: todos</option>
            <option value="si">Suscriptos</option>
            <option value="no">Dados de baja</option>
          </select>

          <select
            value={filtros.optin}
            onChange={(e) => aplicar({ optin: e.target.value })}
            aria-label="Filtrar por opt-in de WhatsApp"
            className={`${CRM_INPUT} w-auto`}
          >
            <option value="">WhatsApp: todos</option>
            <option value="si">Con opt-in</option>
            <option value="no">Sin opt-in</option>
          </select>

          {hayFiltros(filtros) && (
            <button
              type="button"
              onClick={() =>
                aplicar({ q: "", estado: "", origen: "", suscripto: "", optin: "", tags: "" })
              }
              className="text-sm text-[var(--sp-muted)] underline hover:text-[var(--sp-ink)]"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {tagsDisponibles.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {tagsDisponibles.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => alternarTag(tag)}
                aria-pressed={tagsElegidos.includes(tag)}
                className={`sp-pill border px-2.5 py-1 text-[11px] ${
                  tagsElegidos.includes(tag)
                    ? "border-[var(--sp-gold)] text-[var(--sp-amber)]"
                    : "border-[var(--sp-line)] text-[var(--sp-muted)]"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {aviso && (
          <div className="sp-card flex items-center justify-between gap-3 px-4 py-3 text-sm text-[var(--sp-ink)]">
            {aviso}
            <button
              type="button"
              onClick={() => setAviso(null)}
              aria-label="Cerrar aviso"
              className="text-[var(--sp-muted)] hover:text-[var(--sp-ink)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </header>

      {/* ── Barra de selección ── */}
      {seleccion.size > 0 && (
        <div className="sp-card sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm text-[var(--sp-ink)]">
            {seleccion.size.toLocaleString("es-AR")}{" "}
            {seleccion.size === 1 ? "contacto" : "contactos"} seleccionados
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSeleccion(new Set())}
              className={BOTON_SECUNDARIO}
            >
              Deseleccionar
            </button>
            <button
              type="button"
              onClick={() => {
                setErrorDerivar(null);
                setDerivando(true);
              }}
              className={BOTON_PRIMARIO}
            >
              <Users className="h-4 w-4" />
              Derivar a…
            </button>
          </div>
        </div>
      )}

      {modo === "kanban" && esUnidad && columnas ? (
        <ContactosKanban unidad={alcance} columnas={columnas} onOpen={setFichaId} />
      ) : (
        <>
        {/* ── Tabla ── */}
        <div className="sp-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--sp-line)] text-left">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={todaLaPaginaElegida}
                      onChange={alternarPagina}
                      aria-label="Seleccionar toda la página"
                      className="accent-[var(--sp-gold)]"
                    />
                  </th>
                  <Th>Persona</Th>
                  <Th>Contacto</Th>
                  <Th>Unidades</Th>
                  <Th>Origen</Th>
                  <Th>Mails</Th>
                  <Th>Alta</Th>
                </tr>
              </thead>
              <tbody>
                {pagina.rows.map((row) => (
                  <Fila
                    key={row.id}
                    row={row}
                    elegida={seleccion.has(row.id)}
                    onElegir={() => alternarFila(row.id)}
                    onAbrir={() => setFichaId(row.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {pagina.rows.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-[var(--sp-muted)]">
              {!hayFiltros(filtros) ? (
                <p>
                  {alcance === "sin_derivar"
                    ? "No hay contactos sin derivar. Todo el mundo está asignado a una unidad."
                    : "Todavía no hay contactos acá."}
                </p>
              ) : (
                <>
                  <p>Ningún contacto coincide con esos filtros.</p>
                  {/*
                    Buscar a alguien en una vista que lo excluye por definición y
                    recibir "no coincide" es técnicamente cierto e inútil: la
                    persona existe, y no aparece justamente por lo que esa vista
                    filtra. Se dice cuál es, y se ofrece el link a la vista que sí
                    lo tendría, conservando la búsqueda.
                  */}
                  {alcance === "sin_derivar" && (
                    <p className="mt-1">
                      La Bandeja muestra sólo a quien no está en ninguna unidad. Si ya lo
                      derivaste,{" "}
                      <Link
                        href={`${CRM_TODOS_PATH}?${new URLSearchParams(
                          Object.entries(filtros).filter(([, v]) => v)
                        )}`}
                        className="underline hover:text-[var(--sp-ink)]"
                      >
                        buscalo en Todos
                      </Link>
                      .
                    </p>
                  )}
                  {esUnidad && (
                    <p className="mt-1">
                      Esta vista muestra sólo a quien está derivado a{" "}
                      {UNIDADES[alcance].etiqueta}.{" "}
                      <Link
                        href={`${CRM_TODOS_PATH}?${new URLSearchParams(
                          Object.entries(filtros).filter(([, v]) => v && v !== filtros.estado)
                        )}`}
                        className="underline hover:text-[var(--sp-ink)]"
                      >
                        Buscalo en todo el CRM
                      </Link>
                      .
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        </>
      )}

      {modo === "tabla" && pagina.totalPages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-sm">
          <span className="text-[var(--sp-muted)]">
            Página {pagina.page} de {pagina.totalPages} · {pagina.total.toLocaleString("es-AR")}{" "}
            contactos
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pagina.page <= 1}
              onClick={() => aplicar({ page: String(pagina.page - 1) })}
              className={BOTON_SECUNDARIO}
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={pagina.page >= pagina.totalPages}
              onClick={() => aplicar({ page: String(pagina.page + 1) })}
              className={BOTON_SECUNDARIO}
            >
              Siguiente
            </button>
          </div>
        </nav>
      )}

      {derivando && (
        <DerivarDialog
          cantidad={seleccion.size}
          onCancelar={() => setDerivando(false)}
          onConfirmar={confirmarDerivacion}
          trabajando={trabajando}
          error={errorDerivar}
        />
      )}

      {fichaId && (
        <FichaPanel
          contactoId={fichaId}
          onCerrar={() => setFichaId(null)}
          onCambio={(mensaje) => {
            setAviso(mensaje);
            startNav(() => router.refresh());
          }}
        />
      )}

      {importando && (
        <ImportarLazy alcance={alcance} onCerrar={() => setImportando(false)} />
      )}
    </>
  );
}

/**
 * El importador se carga sólo cuando se abre: es el componente más grande del
 * módulo (parsea CSV con papaparse) y la mayoría de las visitas no lo usa.
 */
function ImportarLazy({
  alcance,
  onCerrar,
}: {
  alcance: Alcance;
  onCerrar: () => void;
}) {
  const [Comp, setComp] = useState<React.ComponentType<{
    unidadSugerida: UnidadClave | null;
    onCerrar: () => void;
  }> | null>(null);

  if (!Comp) {
    void import("./ImportarPanel").then((m) => setComp(() => m.ImportarPanel));
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim)]">
        <p className="sp-card px-5 py-4 text-sm text-[var(--sp-muted)]">Cargando importador…</p>
      </div>
    );
  }

  const esUnidad = alcance !== "todos" && alcance !== "sin_derivar";
  return <Comp unidadSugerida={esUnidad ? alcance : null} onCerrar={onCerrar} />;
}

function ToggleVista({
  activo,
  onClick,
  icono,
  label,
}: {
  activo: boolean;
  onClick: () => void;
  icono: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`sp-pill inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition ${
        activo
          ? "bg-[color-mix(in_srgb,var(--sp-gold)_18%,transparent)] text-[var(--sp-amber)]"
          : "text-[var(--sp-muted)] hover:text-[var(--sp-ink)]"
      }`}
    >
      {icono}
      {label}
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="sp-display px-4 py-3 text-[11px] font-normal text-[var(--sp-muted)]">
      {children}
    </th>
  );
}

function Fila({
  row,
  elegida,
  onElegir,
  onAbrir,
}: {
  row: CrmContactoRow;
  elegida: boolean;
  onElegir: () => void;
  onAbrir: () => void;
}) {
  return (
    <tr
      className={`border-b border-[var(--sp-line)] last:border-0 ${
        elegida ? "bg-[color-mix(in_srgb,var(--sp-gold)_8%,transparent)]" : ""
      }`}
    >
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={elegida}
          onChange={onElegir}
          aria-label={`Seleccionar ${nombreVisible(row)}`}
          className="accent-[var(--sp-gold)]"
        />
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={onAbrir}
          className="text-left text-[var(--sp-ink)] underline-offset-2 hover:underline"
        >
          {nombreVisible(row)}
        </button>
        {row.tags.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-1">
            {row.tags.map((t) => (
              <TagChip key={t}>{t}</TagChip>
            ))}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-[var(--sp-muted)]">
        <span className="flex flex-col gap-0.5">
          {row.email && <span className="break-all">{row.email}</span>}
          {row.telefonoE164 && <span className="tabular-nums">{row.telefonoE164}</span>}
          {/* Un teléfono que no normalizó se muestra marcado: no sirve para WhatsApp. */}
          {row.telefonoCrudo && (
            <span className="tabular-nums text-[var(--sp-crit)]" title="No está en formato internacional válido">
              {row.telefonoCrudo} (sin validar)
            </span>
          )}
          {row.instagram && <span>@{row.instagram}</span>}
        </span>
      </td>
      <td className="px-4 py-3">
        <UnidadesChips derivaciones={row.derivaciones} />
      </td>
      <td className="px-4 py-3 text-[var(--sp-muted)]">
        {CONTACT_SOURCE_LABELS[row.origen] ?? row.origen}
      </td>
      <td className="px-4 py-3">
        {row.suscripto ? (
          <span className="text-[var(--sp-muted)]">Suscripto</span>
        ) : (
          <span className="text-[var(--sp-crit)]">Dado de baja</span>
        )}
      </td>
      <td className="px-4 py-3 text-[var(--sp-muted)] tabular-nums">
        {formatShortDateStr(row.createdAt.slice(0, 10))}
      </td>
    </tr>
  );
}

/**
 * Las tarjetas de totales cambian según el contexto, y los números siempre
 * salen contados de la base:
 *  - en Todos / Bandeja: total, sin derivar y cuántos hay en cada unidad;
 *  - dentro de una unidad: las etapas de SU pipeline.
 */
function Totales({
  contadores,
  filtros,
  aplicar,
  irAUnidad,
}: {
  contadores: ContadoresVista;
  filtros: FiltrosUrl;
  aplicar: (cambios: Partial<FiltrosUrl & { page: string }>) => void;
  irAUnidad: (clave: UnidadClave) => void;
}) {
  if (contadores.tipo === "unidad") {
    const { unidad, total, porEstado } = contadores;
    return (
      <div className="flex flex-wrap gap-3">
        <CounterCard
          label="Total"
          value={total}
          activo={!filtros.estado}
          onClick={() => aplicar({ estado: "" })}
        />
        {estadosDe(unidad).map((e) => (
          <CounterCard
            key={e}
            label={etiquetaEstado(unidad, e)}
            value={porEstado[e] ?? 0}
            activo={filtros.estado === e}
            onClick={() => aplicar({ estado: e })}
          />
        ))}
      </div>
    );
  }

  const d = contadores.datos;
  return (
    <div className="flex flex-wrap gap-3">
      <CounterCard label="Total" value={d.total} />
      <CounterCard label="Sin derivar" value={d.sinDerivar} />
      {/* Las tarjetas de unidad llevan a su vista. Es el único camino desde acá
          al pipeline de esa unidad y a su kanban: esta pantalla no puede tener
          uno porque conviven los tres, y sin este link no habría forma de
          descubrirlo. */}
      {UNIDADES_ORDENADAS.map((clave) => (
        <CounterCard
          key={clave}
          label={UNIDADES[clave].etiqueta}
          value={d.porUnidad[clave] ?? 0}
          onClick={() => irAUnidad(clave)}
          titulo={`Ver los contactos de ${UNIDADES[clave].etiqueta}, en tabla o kanban`}
        />
      ))}
      <CounterCard label="Suscriptos a mails" value={d.suscriptos} />
      <CounterCard label="Opt-in WhatsApp" value={d.conOptIn} />
    </div>
  );
}
