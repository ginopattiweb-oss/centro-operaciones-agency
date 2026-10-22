"use client";

/**
 * Asistente de importación de CSV al CRM, en cinco pasos:
 *
 *   1. Archivo        — se parsea en el navegador con papaparse.
 *   2. Mapeo          — qué columna va a qué campo, con sugerencia automática.
 *   3. Ajustes        — origen, tags, y A QUÉ UNIDAD derivar (o ninguna).
 *   4. Vista previa   — qué va a pasar, contado contra la base, sin escribir.
 *   5. Resultado      — y el CSV de las filas rechazadas, si hubo.
 *
 * El paso 3 es lo nuevo respecto del importador viejo: se puede importar SIN
 * derivar, y esa gente cae en la Bandeja del CRM para clasificarla después.
 */
import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { Download, Upload, X } from "lucide-react";
import { confirmarImport, previsualizarImport } from "@/lib/actions/crm-importar";
import type { ResultadoImport } from "@/lib/actions/crm-importar";
import { rechazadasACsv, type FilaRechazada } from "@/lib/crm/csv";
import {
  DESTINOS_IMPORT,
  DESTINOS_IMPORT_KEYS,
  MAX_FILAS_IMPORT,
  sugerirDestino,
  type DestinoImport,
  type FilaCsv,
  type Mapeo,
  type ResumenImport,
} from "@/lib/crm/importar";
import {
  estadoInicial,
  estadosDe,
  etiquetaEstado,
  UNIDADES,
  UNIDADES_ORDENADAS,
  type UnidadClave,
} from "@/lib/crm/unidades";
import { CONTACT_SOURCE_LABELS, CONTACT_SOURCES } from "@/lib/contactos/config";
import type { ContactSource } from "@/db/schema";
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, CRM_INPUT, Field } from "./ui";

type Paso = "archivo" | "mapeo" | "ajustes" | "preview" | "listo";

export function ImportarPanel({
  unidadSugerida,
  onCerrar,
}: {
  /** Si se abre desde la vista de una unidad, viene preseleccionada. */
  unidadSugerida: UnidadClave | null;
  onCerrar: () => void;
}) {
  const [paso, setPaso] = useState<Paso>("archivo");
  const [archivo, setArchivo] = useState("");
  const [filas, setFilas] = useState<FilaCsv[]>([]);
  const [encabezados, setEncabezados] = useState<string[]>([]);
  const [mapeo, setMapeo] = useState<Mapeo>({});
  const [origen, setOrigen] = useState<ContactSource>("import");
  const [tags, setTags] = useState("");
  const [consentimiento, setConsentimiento] = useState("");
  const [derivarA, setDerivarA] = useState<UnidadClave | "">(unidadSugerida ?? "");
  const [estado, setEstado] = useState<string>(
    unidadSugerida ? estadoInicial(unidadSugerida) : ""
  );
  const [resumen, setResumen] = useState<ResumenImport | null>(null);
  const [rechazadas, setRechazadas] = useState<FilaRechazada[]>([]);
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const inputFile = useRef<HTMLInputElement>(null);

  const lote = useMemo(
    () => ({
      origen,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      consentimientoFuente: consentimiento.trim() || null,
      derivarA: derivarA || null,
      estadoInicial: derivarA ? estado : null,
    }),
    [origen, tags, consentimiento, derivarA, estado]
  );

  const elegirArchivo = (file: File) => {
    setError(null);
    Papa.parse<FilaCsv>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const campos = res.meta.fields ?? [];
        if (campos.length === 0) {
          setError("El archivo no tiene encabezados.");
          return;
        }
        if (res.data.length > MAX_FILAS_IMPORT) {
          setError(
            `El archivo tiene más de ${MAX_FILAS_IMPORT.toLocaleString("es-AR")} filas. Partilo en varios.`
          );
          return;
        }
        setArchivo(file.name);
        setFilas(res.data);
        setEncabezados(campos);
        // El mapeo se presugiere por el nombre de la columna; el usuario corrige.
        setMapeo(Object.fromEntries(campos.map((c) => [c, sugerirDestino(c)])));
        setPaso("mapeo");
      },
      error: (e) => setError(`No se pudo leer el archivo: ${e.message}`),
    });
  };

  const hayClave =
    Object.values(mapeo).includes("email") || Object.values(mapeo).includes("telefono");

  const verPreview = async () => {
    setTrabajando(true);
    setError(null);
    try {
      const r = await previsualizarImport({ archivo, filas, mapeo, lote });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setResumen(r.resumen);
      setRechazadas(r.rechazadas);
      setPaso("preview");
    } finally {
      setTrabajando(false);
    }
  };

  const confirmar = async () => {
    setTrabajando(true);
    setError(null);
    try {
      const r = await confirmarImport({ archivo, filas, mapeo, lote });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setResultado(r);
      setRechazadas(r.rechazadas);
      setPaso("listo");
    } finally {
      setTrabajando(false);
    }
  };

  const bajarRechazadas = () => {
    const csv = rechazadasACsv(rechazadas);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `rechazadas-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] p-0 sm:items-center sm:p-6">
      <div className="sp-card flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--sp-line)] px-5 py-4">
          <div>
            <h2 className="sp-display text-lg text-[var(--sp-ink)]">Importar CSV</h2>
            <p className="mt-0.5 text-sm text-[var(--sp-muted)]">
              {archivo || "Elegí un archivo para empezar"}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-co-control p-1 text-[var(--sp-muted)] hover:text-[var(--sp-ink)]"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {error && <p className="mb-4 text-sm text-[var(--sp-crit)]">{error}</p>}

          {/* ── 1. Archivo ── */}
          {paso === "archivo" && (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-[var(--sp-muted)]">
                Un CSV con encabezados. Hace falta al menos una columna de mail o de teléfono:
                es la clave con la que se deduplica contra lo que ya está en el CRM.
              </p>
              <input
                ref={inputFile}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) elegirArchivo(f);
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => inputFile.current?.click()}
                className={BOTON_PRIMARIO}
              >
                <Upload className="h-4 w-4" />
                Elegir archivo
              </button>
            </div>
          )}

          {/* ── 2. Mapeo ── */}
          {paso === "mapeo" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-[var(--sp-muted)]">
                {filas.length.toLocaleString("es-AR")} filas. Revisá a qué campo va cada columna.
              </p>
              <div className="flex flex-col gap-2">
                {encabezados.map((col) => (
                  <div key={col} className="flex flex-wrap items-center gap-2">
                    <span className="min-w-[160px] flex-1 truncate text-sm text-[var(--sp-ink)]">
                      {col}
                    </span>
                    <select
                      value={mapeo[col] ?? "ignorar"}
                      onChange={(e) =>
                        setMapeo({ ...mapeo, [col]: e.target.value as DestinoImport })
                      }
                      aria-label={`Destino de la columna ${col}`}
                      className={`${CRM_INPUT} w-auto`}
                    >
                      {DESTINOS_IMPORT_KEYS.map((d) => (
                        <option key={d} value={d}>
                          {DESTINOS_IMPORT[d]}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {!hayClave && (
                <p className="text-sm text-[var(--sp-crit)]">
                  Falta mapear la columna del mail o la del teléfono.
                </p>
              )}
            </div>
          )}

          {/* ── 3. Ajustes, con el destino ── */}
          {paso === "ajustes" && (
            <div className="flex flex-col gap-4">
              <Field label="Origen" help="Se aplica a todas las filas del archivo.">
                <select
                  value={origen}
                  onChange={(e) => setOrigen(e.target.value as ContactSource)}
                  className={CRM_INPUT}
                >
                  {CONTACT_SOURCES.map((o) => (
                    <option key={o} value={o}>
                      {CONTACT_SOURCE_LABELS[o]}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Tags" help="Separados por coma. Se suman a los que ya tenga cada persona.">
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="gumroad, plantillas"
                  className={CRM_INPUT}
                />
              </Field>

              <Field
                label="Origen del consentimiento"
                help="Qué respalda que se le pueda escribir a esta gente. Es el dato que justifica el envío el día que se mande."
              >
                <input
                  value={consentimiento}
                  onChange={(e) => setConsentimiento(e.target.value)}
                  placeholder="Descarga de plantilla en el sitio"
                  className={CRM_INPUT}
                />
              </Field>

              <Field
                label="Derivar a"
                help="Sin derivar, la gente queda en la Bandeja del CRM para clasificarla después."
              >
                <div className="flex flex-col gap-2">
                  <label
                    className={`rounded-co-control flex cursor-pointer items-center gap-3 border px-3 py-2.5 text-sm ${
                      derivarA === ""
                        ? "border-[var(--sp-gold)] text-[var(--sp-ink)]"
                        : "border-[var(--sp-line-strong)] text-[var(--sp-muted)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="derivarA"
                      checked={derivarA === ""}
                      onChange={() => {
                        setDerivarA("");
                        setEstado("");
                      }}
                      className="accent-[var(--sp-gold)]"
                    />
                    Sin derivar (van a la Bandeja)
                  </label>
                  {UNIDADES_ORDENADAS.map((clave) => (
                    <label
                      key={clave}
                      className={`rounded-co-control flex cursor-pointer items-center gap-3 border px-3 py-2.5 text-sm ${
                        derivarA === clave
                          ? "border-[var(--sp-gold)] text-[var(--sp-ink)]"
                          : "border-[var(--sp-line-strong)] text-[var(--sp-muted)]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="derivarA"
                        checked={derivarA === clave}
                        onChange={() => {
                          setDerivarA(clave);
                          setEstado(estadoInicial(clave));
                        }}
                        className="accent-[var(--sp-gold)]"
                      />
                      {UNIDADES[clave].etiqueta}
                    </label>
                  ))}
                </div>
              </Field>

              {derivarA && (
                <Field label="Estado inicial">
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value)}
                    className={CRM_INPUT}
                  >
                    {estadosDe(derivarA).map((e) => (
                      <option key={e} value={e}>
                        {etiquetaEstado(derivarA, e)}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
          )}

          {/* ── 4. Vista previa ── */}
          {paso === "preview" && resumen && (
            <div className="flex flex-col gap-4">
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Celda label="Filas del archivo" valor={resumen.total} />
                <Celda label="A crear" valor={resumen.aCrear} />
                <Celda label="A actualizar" valor={resumen.aActualizar} />
                <Celda label="Omitidas" valor={resumen.omitidas} />
                <Celda label="Repetidas en el archivo" valor={resumen.fusionadas} />
                <Celda label="Entran como baja" valor={resumen.noSuscritas} />
                {derivarA && (
                  <Celda label={`A derivar a ${UNIDADES[derivarA].etiqueta}`} valor={resumen.aDerivar} />
                )}
              </dl>
              <p className="text-[11px] text-[var(--sp-muted)]">
                Las personas que ya estén en el CRM se actualizan: los campos vacíos se completan,
                los que ya tienen valor no se pisan, los tags se suman, y una baja nunca se
                reactiva.
              </p>
              {rechazadas.length > 0 && (
                <button type="button" onClick={bajarRechazadas} className={BOTON_SECUNDARIO}>
                  <Download className="h-4 w-4" />
                  Bajar las {rechazadas.length} rechazadas
                </button>
              )}
            </div>
          )}

          {/* ── 5. Resultado ── */}
          {paso === "listo" && resultado?.ok && (
            <div className="flex flex-col gap-4">
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Celda label="Creadas" valor={resultado.creadas} />
                <Celda label="Actualizadas" valor={resultado.actualizadas} />
                <Celda label="Derivadas" valor={resultado.derivadas} />
                <Celda label="Omitidas" valor={resultado.omitidas} />
              </dl>
              {rechazadas.length > 0 && (
                <button type="button" onClick={bajarRechazadas} className={BOTON_SECUNDARIO}>
                  <Download className="h-4 w-4" />
                  Bajar las {rechazadas.length} rechazadas
                </button>
              )}
            </div>
          )}
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--sp-line)] px-5 py-4">
          {paso === "mapeo" && (
            <>
              <button type="button" onClick={() => setPaso("archivo")} className={BOTON_SECUNDARIO}>
                Atrás
              </button>
              <button
                type="button"
                disabled={!hayClave}
                onClick={() => setPaso("ajustes")}
                className={BOTON_PRIMARIO}
              >
                Siguiente
              </button>
            </>
          )}
          {paso === "ajustes" && (
            <>
              <button type="button" onClick={() => setPaso("mapeo")} className={BOTON_SECUNDARIO}>
                Atrás
              </button>
              <button
                type="button"
                disabled={trabajando}
                onClick={verPreview}
                className={BOTON_PRIMARIO}
              >
                {trabajando ? "Calculando…" : "Ver qué va a pasar"}
              </button>
            </>
          )}
          {paso === "preview" && (
            <>
              <button type="button" onClick={() => setPaso("ajustes")} className={BOTON_SECUNDARIO}>
                Atrás
              </button>
              <button
                type="button"
                disabled={trabajando}
                onClick={confirmar}
                className={BOTON_PRIMARIO}
              >
                {trabajando ? "Importando…" : "Importar"}
              </button>
            </>
          )}
          {paso === "listo" && (
            <button type="button" onClick={onCerrar} className={BOTON_PRIMARIO}>
              Listo
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function Celda({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="sp-display text-[11px] text-[var(--sp-muted)]">{label}</dt>
      <dd className="text-xl tabular-nums text-[var(--sp-ink)]">
        {valor.toLocaleString("es-AR")}
      </dd>
    </div>
  );
}
