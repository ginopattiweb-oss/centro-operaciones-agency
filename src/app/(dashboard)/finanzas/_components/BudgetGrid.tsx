"use client";

/**
 * Presupuesto: filas = concepto, columnas = mes, celdas = lo estimado.
 * Se edita in-place (igual que la planilla): al salir de la celda se guarda.
 * Debajo de cada monto estimado aparece lo efectivamente cobrado ese mes, para
 * ver de un vistazo qué se cumplió y qué no.
 */
import { useActionState, useEffect, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Link2, Pencil, Plus } from "lucide-react";
import { formatMoney, type Currency } from "@/lib/finanzas";
import { formatMonthShort, type BudgetConceptView } from "@/lib/presupuesto";
import {
  deleteBudgetConcept,
  saveBudgetConcept,
  setBudgetAmount,
  setBudgetConceptArchived,
} from "@/lib/actions/presupuesto";
import {
  DeleteButton,
  Field,
  FormMessage,
  GhostButton,
  Modal,
  Panel,
  PrimaryButton,
  inputClass,
} from "@/components/paneles";

/** Meses visibles a la vez. Con más, la grilla se vuelve ilegible. */
const WINDOW = 12;

type Option = { id: string; name: string };

export function BudgetGrid({
  concepts,
  months,
  selectedMonth,
  currentMonth,
  currency,
  unidades,
  clientes,
}: {
  concepts: BudgetConceptView[];
  months: string[];
  selectedMonth: string;
  currentMonth: string;
  currency: Currency;
  unidades: Option[];
  clientes: Option[];
}) {
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<BudgetConceptView | null>(null);
  const [creating, setCreating] = useState(false);

  // La ventana arranca dos meses antes del elegido: se ve algo de pasado y el resto a futuro.
  const anchor = Math.max(0, months.indexOf(selectedMonth) - 2);
  const [start, setStart] = useState(anchor);
  useEffect(() => setStart(Math.min(anchor, Math.max(0, months.length - WINDOW))), [anchor, months.length]);

  const visible = months.slice(start, start + WINDOW);
  const rows = concepts.filter(
    (concept) => concept.currency === currency && (showArchived || !concept.archived)
  );

  const columnTotals = visible.map((month) => ({
    month,
    estimated: rows.reduce((sum, concept) => sum + (concept.estimated[month] ?? 0), 0),
    received: rows.reduce((sum, concept) => sum + (concept.received[month] ?? 0), 0),
  }));

  return (
    <>
      <Panel
        title="Presupuesto"
        hint="Lo que esperás facturar mes a mes. Escribí el monto en la celda: se guarda solo."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <GhostButton type="button" onClick={() => setShowArchived((value) => !value)}>
              {showArchived ? "Ocultar archivados" : "Ver archivados"}
            </GhostButton>
            <div className="flex items-center gap-1">
              <GhostButton
                type="button"
                disabled={start === 0}
                onClick={() => setStart((value) => Math.max(0, value - 6))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </GhostButton>
              <GhostButton
                type="button"
                disabled={start + WINDOW >= months.length}
                onClick={() =>
                  setStart((value) => Math.min(months.length - WINDOW, value + 6))
                }
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </GhostButton>
            </div>
            <PrimaryButton type="button" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5" />
              Concepto
            </PrimaryButton>
          </div>
        }
      >
        {rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-fg-muted">
            No hay conceptos en {currency}. Agregá el primero para empezar a presupuestar.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="sticky left-0 z-10 bg-surface px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-fg-muted">
                    Concepto
                  </th>
                  {visible.map((month) => (
                    <th
                      key={month}
                      className={`min-w-[104px] px-2 py-2 text-right text-xs font-medium uppercase tracking-wider ${
                        month === currentMonth ? "text-accent-ink" : "text-fg-muted"
                      }`}
                    >
                      {formatMonthShort(month)}
                    </th>
                  ))}
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-fg-muted">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {rows.map((concept) => {
                  const rowTotal = visible.reduce(
                    (sum, month) => sum + (concept.estimated[month] ?? 0),
                    0
                  );
                  return (
                    <tr key={concept.id} className={concept.archived ? "opacity-50" : ""}>
                      <td className="sticky left-0 z-10 max-w-[240px] bg-surface px-4 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-fg">{concept.name}</p>
                            <p className="flex items-center gap-1 truncate text-[11px] text-fg-muted">
                              {concept.projectName ?? "Sin unidad"}
                              {concept.clientProjectName && (
                                <>
                                  <Link2 className="h-3 w-3 shrink-0" />
                                  {concept.clientProjectName}
                                </>
                              )}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditing(concept)}
                            className="shrink-0 text-fg-muted hover:text-fg"
                            title="Editar concepto"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>

                      {visible.map((month) => (
                        <BudgetCell
                          key={`${concept.id}-${month}`}
                          conceptId={concept.id}
                          month={month}
                          cents={concept.estimated[month] ?? 0}
                          receivedCents={concept.received[month] ?? 0}
                          currency={currency}
                          highlight={month === currentMonth}
                        />
                      ))}

                      <td className="px-4 py-2 text-right tabular-nums text-fg">
                        {rowTotal > 0 ? formatMoney(rowTotal, currency) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot className="border-t-2 border-border">
                <tr>
                  <td className="sticky left-0 z-10 bg-surface px-4 py-2 text-xs font-medium uppercase tracking-wider text-fg-muted">
                    Total estimado
                  </td>
                  {columnTotals.map((column) => (
                    <td
                      key={column.month}
                      className="px-2 py-2 text-right text-xs tabular-nums text-fg"
                    >
                      {column.estimated > 0 ? formatMoney(column.estimated, currency) : "—"}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right text-xs tabular-nums text-fg">
                    {formatMoney(
                      columnTotals.reduce((sum, column) => sum + column.estimated, 0),
                      currency
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="sticky left-0 z-10 bg-surface px-4 pb-3 text-xs font-medium uppercase tracking-wider text-fg-muted">
                    Total cobrado
                  </td>
                  {columnTotals.map((column) => (
                    <td
                      key={column.month}
                      className="px-2 pb-3 text-right text-xs tabular-nums text-accent-ink"
                    >
                      {column.received > 0 ? formatMoney(column.received, currency) : "—"}
                    </td>
                  ))}
                  <td className="px-4 pb-3 text-right text-xs tabular-nums text-accent-ink">
                    {formatMoney(
                      columnTotals.reduce((sum, column) => sum + column.received, 0),
                      currency
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Panel>

      {(creating || editing) && (
        <ConceptModal
          concept={editing}
          unidades={unidades}
          clientes={clientes}
          defaultCurrency={currency}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

/** Celda editable. Vacío borra el monto de ese mes. */
function BudgetCell({
  conceptId,
  month,
  cents,
  receivedCents,
  currency,
  highlight,
}: {
  conceptId: string;
  month: string;
  cents: number;
  receivedCents: number;
  currency: Currency;
  highlight: boolean;
}) {
  const initial = cents > 0 ? (cents / 100).toLocaleString("es-AR") : "";
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Tras guardar, la página se revalida: la celda vuelve a leer el valor real.
  useEffect(() => setValue(initial), [initial]);

  function commit() {
    if (value.trim() === initial.trim()) return;
    startTransition(async () => {
      const result = await setBudgetAmount(conceptId, month, value);
      if (result.error) {
        setError(result.error);
        setValue(initial);
        return;
      }
      setError(null);
    });
  }

  return (
    <td className={`px-1 py-1 align-top ${highlight ? "bg-accent/5" : ""}`}>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setValue(initial);
            event.currentTarget.blur();
          }
        }}
        inputMode="decimal"
        placeholder="—"
        title={error ?? undefined}
        aria-label={`Estimado ${formatMonthShort(month)}`}
        className={`w-full rounded-md border bg-transparent px-2 py-1 text-right text-sm tabular-nums text-fg placeholder:text-fg-muted focus:border-accent focus:bg-surface focus:outline-none ${
          error ? "border-negative" : "border-transparent hover:border-border"
        } ${isPending ? "opacity-50" : ""}`}
      />
      {receivedCents > 0 && (
        <p
          className="px-2 text-right text-[10px] tabular-nums text-accent-ink"
          title="Cobrado este mes"
        >
          {formatMoney(receivedCents, currency)}
        </p>
      )}
    </td>
  );
}

function ConceptModal({
  concept,
  unidades,
  clientes,
  defaultCurrency,
  onClose,
}: {
  concept: BudgetConceptView | null;
  unidades: Option[];
  clientes: Option[];
  defaultCurrency: Currency;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(saveBudgetConcept, null);

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  return (
    <Modal title={concept ? "Editar concepto" : "Nuevo concepto"} onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-4">
        {concept && <input type="hidden" name="id" value={concept.id} />}

        <Field label="Concepto">
          <input
            name="name"
            required
            defaultValue={concept?.name ?? ""}
            placeholder="Ej: Mantenimiento web cliente X"
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Unidad">
            <select
              name="projectId"
              defaultValue={concept?.projectId ?? "none"}
              className={inputClass}
            >
              <option value="none">Sin unidad</option>
              {unidades.map((unidad) => (
                <option key={unidad.id} value={unidad.id}>
                  {unidad.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Moneda">
            <select
              name="currency"
              defaultValue={concept?.currency ?? defaultCurrency}
              className={inputClass}
            >
              <option value="ARS">Pesos (ARS)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
          </Field>
        </div>

        <Field
          label="Proyecto de cliente"
          hint="Si lo enganchás, lo cobrado sale solo de los comprobantes de ese cliente."
        >
          <select
            name="clientProjectId"
            defaultValue={concept?.clientProjectId ?? "none"}
            className={inputClass}
          >
            <option value="none">Sin vincular</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Notas">
          <textarea name="notes" rows={2} defaultValue={concept?.notes ?? ""} className={inputClass} />
        </Field>

        <FormMessage state={state} />

        <div className="flex items-center justify-between gap-2">
          {concept ? (
            <div className="flex items-center gap-2">
              <DeleteButton
                onDelete={async () => {
                  await deleteBudgetConcept(concept.id);
                  onClose();
                }}
              />
              <GhostButton
                type="button"
                onClick={async () => {
                  await setBudgetConceptArchived(concept.id, !concept.archived);
                  onClose();
                }}
              >
                {concept.archived ? "Desarchivar" : "Archivar"}
              </GhostButton>
            </div>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <GhostButton type="button" onClick={onClose}>
              Cancelar
            </GhostButton>
            <PrimaryButton type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : "Guardar"}
            </PrimaryButton>
          </div>
        </div>
      </form>
    </Modal>
  );
}
