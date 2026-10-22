"use client";

/**
 * Ingresos del mes elegido. Dos orígenes en una sola lista:
 * los comprobantes ya cargados en un proyecto de cliente (no se tocan desde acá)
 * y los ingresos sueltos que se cargan a mano (transferencias, plataformas, cursos, etc.).
 */
import { useActionState, useEffect, useState } from "react";
import { ExternalLink, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { formatMoney, type Currency } from "@/lib/finanzas";
import { formatFullDateStr } from "@/lib/date";
import { monthOf, formatMonthLong, type BudgetConceptView, type IncomeRow } from "@/lib/presupuesto";
import { PORTAL_UNIDAD_SLUG } from "@/lib/portal-config";
import { deleteManualIncome, saveManualIncome } from "@/lib/actions/presupuesto";
import {
  DeleteButton,
  EmptyRow,
  Field,
  FormMessage,
  GhostButton,
  Modal,
  Panel,
  PrimaryButton,
  inputClass,
} from "@/components/paneles";

type Option = { id: string; name: string };

export function IncomePanel({
  incomes,
  month,
  currency,
  unidades,
  concepts,
}: {
  incomes: IncomeRow[];
  month: string;
  currency: Currency;
  unidades: Option[];
  concepts: BudgetConceptView[];
}) {
  const [editing, setEditing] = useState<IncomeRow | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = incomes.filter(
    (income) => income.currency === currency && monthOf(income.receivedAt) === month
  );
  const total = rows.reduce((sum, income) => sum + income.amountCents, 0);

  return (
    <>
      <Panel
        title="Ingresos del mes"
        hint={`Lo cobrado en ${formatMonthLong(month)}: ${formatMoney(total, currency)}`}
        action={
          <PrimaryButton type="button" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" />
            Ingreso
          </PrimaryButton>
        }
      >
        {rows.length === 0 ? (
          <EmptyRow>Todavía no entró nada este mes en {currency}.</EmptyRow>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((income) => (
              <li key={`${income.kind}-${income.id}`} className="flex items-start gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm text-fg">
                    <span className="truncate">{income.description}</span>
                    {income.kind !== "manual" && (
                      <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-fg-muted">
                        Cliente
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-fg-muted">
                    {formatFullDateStr(income.receivedAt)}
                    {income.projectName && ` · ${income.projectName}`}
                    {income.method && ` · ${income.method}`}
                  </p>
                </div>

                <span className="shrink-0 text-sm tabular-nums text-fg">
                  {formatMoney(income.amountCents, income.currency)}
                </span>

                {income.kind === "manual" ? (
                  <button
                    type="button"
                    onClick={() => setEditing(income)}
                    className="shrink-0 text-fg-muted hover:text-fg"
                    title="Editar ingreso"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <Link
                    href={`/unidad/${PORTAL_UNIDAD_SLUG}/proyecto/${income.clientProjectId}`}
                    className="shrink-0 text-fg-muted hover:text-fg"
                    title="Ver el proyecto del cliente"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {(creating || editing) && (
        <IncomeModal
          income={editing}
          month={month}
          currency={currency}
          unidades={unidades}
          concepts={concepts}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function IncomeModal({
  income,
  month,
  currency,
  unidades,
  concepts,
  onClose,
}: {
  income: IncomeRow | null;
  month: string;
  currency: Currency;
  unidades: Option[];
  concepts: BudgetConceptView[];
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(saveManualIncome, null);

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  return (
    <Modal title={income ? "Editar ingreso" : "Nuevo ingreso"} onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-4">
        {income && <input type="hidden" name="id" value={income.id} />}

        <Field label="Descripción">
          <input
            name="description"
            required
            defaultValue={income?.description ?? ""}
            placeholder="Ej: Consultoría agosto"
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto">
            <input
              name="amount"
              required
              inputMode="decimal"
              defaultValue={income ? (income.amountCents / 100).toLocaleString("es-AR") : ""}
              placeholder="150.000"
              className={inputClass}
            />
          </Field>

          <Field label="Fecha">
            <input
              type="date"
              name="receivedAt"
              required
              defaultValue={income?.receivedAt ?? `${month}-01`}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Moneda">
            <select
              name="currency"
              defaultValue={income?.currency ?? currency}
              className={inputClass}
            >
              <option value="ARS">Pesos (ARS)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
          </Field>

          <Field label="Unidad">
            <select
              name="projectId"
              defaultValue={income?.projectId ?? "none"}
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
        </div>

        <Field label="Concepto del presupuesto" hint="Para comparar contra lo estimado de esa fila.">
          <select
            name="conceptId"
            defaultValue={income?.conceptId ?? "none"}
            className={inputClass}
          >
            <option value="none">Sin imputar</option>
            {concepts.map((concept) => (
              <option key={concept.id} value={concept.id}>
                {concept.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Medio de cobro">
          <input
            name="method"
            defaultValue={income?.method ?? ""}
            placeholder="Transferencia, Mercado Pago…"
            className={inputClass}
          />
        </Field>

        <FormMessage state={state} />

        <div className="flex items-center justify-between gap-2">
          {income ? (
            <DeleteButton
              onDelete={async () => {
                await deleteManualIncome(income.id);
                onClose();
              }}
            />
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
