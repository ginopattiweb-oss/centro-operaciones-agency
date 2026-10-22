"use client";

/**
 * Elegir unidad y estado inicial para derivar.
 *
 * Lo usan las dos acciones de derivar: la masiva de la barra de selección y la
 * de una persona desde su ficha. Mismo componente para que el vocabulario y el
 * orden de las etapas no puedan divergir entre las dos.
 *
 * Las etapas que ofrece salen de `UNIDADES` (src/lib/crm/unidades.ts), que es el
 * único lugar donde se editan.
 */
import { useState } from "react";
import { X } from "lucide-react";
import {
  estadoInicial,
  estadosDe,
  etiquetaEstado,
  UNIDADES,
  UNIDADES_ORDENADAS,
  type UnidadClave,
} from "@/lib/crm/unidades";
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, CRM_INPUT, Field } from "./ui";

export function DerivarDialog({
  cantidad,
  /** Unidades en las que ya está (no se ofrecen). Sólo cuando es una persona. */
  yaDerivadoA = [],
  onCancelar,
  onConfirmar,
  trabajando = false,
  error = null,
}: {
  cantidad: number;
  yaDerivadoA?: UnidadClave[];
  onCancelar: () => void;
  onConfirmar: (unidad: UnidadClave, estado: string) => void;
  trabajando?: boolean;
  error?: string | null;
}) {
  const disponibles = UNIDADES_ORDENADAS.filter((u) => !yaDerivadoA.includes(u));
  const [unidad, setUnidad] = useState<UnidadClave | "">(disponibles[0] ?? "");
  const [estado, setEstado] = useState<string>(
    disponibles[0] ? estadoInicial(disponibles[0]) : ""
  );

  const elegirUnidad = (clave: UnidadClave) => {
    setUnidad(clave);
    // Al cambiar de unidad el estado tiene que volver al inicial de la nueva:
    // un estado de agencia no existe en el pipeline de comunidad.
    setEstado(estadoInicial(clave));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] p-0 sm:items-center sm:p-6">
      <div className="sp-card w-full max-w-md overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--sp-line)] px-5 py-4">
          <div>
            <h2 className="sp-display text-lg text-[var(--sp-ink)]">Derivar a…</h2>
            <p className="mt-0.5 text-sm text-[var(--sp-muted)]">
              {cantidad === 1
                ? "Una persona"
                : `${cantidad.toLocaleString("es-AR")} personas seleccionadas`}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelar}
            aria-label="Cerrar"
            className="rounded-co-control p-1 text-[var(--sp-muted)] hover:text-[var(--sp-ink)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5">
          {disponibles.length === 0 ? (
            <p className="text-sm text-[var(--sp-muted)]">
              Esta persona ya está en todas las unidades.
            </p>
          ) : (
            <>
              <Field label="Unidad">
                <div className="flex flex-col gap-2">
                  {disponibles.map((clave) => (
                    <label
                      key={clave}
                      className={`rounded-co-control flex cursor-pointer items-center gap-3 border px-3 py-2.5 text-sm ${
                        unidad === clave
                          ? "border-[var(--sp-gold)] text-[var(--sp-ink)]"
                          : "border-[var(--sp-line-strong)] text-[var(--sp-muted)]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="unidad"
                        value={clave}
                        checked={unidad === clave}
                        onChange={() => elegirUnidad(clave)}
                        className="accent-[var(--sp-gold)]"
                      />
                      {UNIDADES[clave].etiqueta}
                    </label>
                  ))}
                </div>
              </Field>

              {unidad && (
                <Field
                  label="Estado inicial"
                  help="Es la etapa en la que entra al pipeline de esa unidad."
                >
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value)}
                    className={CRM_INPUT}
                  >
                    {estadosDe(unidad).map((e) => (
                      <option key={e} value={e}>
                        {etiquetaEstado(unidad, e)}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              {error && <p className="text-sm text-[var(--sp-crit)]">{error}</p>}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--sp-line)] px-5 py-4">
          <button type="button" onClick={onCancelar} className={BOTON_SECUNDARIO}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={!unidad || trabajando}
            onClick={() => unidad && onConfirmar(unidad, estado)}
            className={BOTON_PRIMARIO}
          >
            {trabajando ? "Derivando…" : "Derivar"}
          </button>
        </div>
      </div>
    </div>
  );
}
