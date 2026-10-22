"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { deleteAgreement, saveAgreement } from "@/lib/actions/finanzas";
import { formatFullDateStr } from "@/lib/date";
import {
  AGREEMENT_MODE_LABELS,
  CURRENCIES,
  CURRENCY_LABELS,
  centsToNumeric,
  formatMoney,
  type AgreementView,
} from "@/lib/finanzas";
import { EmptyRow, Field, FileLink, InternalBadge, PanelShell, spInput } from "./ui";

/**
 * Acuerdo de servicios. Los documentos cargados acá definen el "Total acordado"
 * del resumen: pago único suma al total, mensual se muestra como abono por mes.
 */
export function AgreementsPanel({
  clientProjectId,
  agreements,
}: {
  clientProjectId: string;
  agreements: AgreementView[];
}) {
  const [state, formAction, saving] = useActionState(saveAgreement, null);
  const [editing, setEditing] = useState<AgreementView | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (state?.success) {
      setOpen(false);
      setEditing(null);
    }
  }, [state]);

  const startNew = () => {
    setEditing(null);
    setOpen((value) => !value);
  };

  return (
    <PanelShell
      title="Acuerdo de servicios"
      hint="Subí el acuerdo firmado y su monto. Define el total acordado del proyecto."
      action={
        <button
          type="button"
          onClick={startNew}
          className="sp-pill inline-flex min-h-9 items-center gap-2 border border-[var(--sp-line-strong)] px-3 py-1.5 text-xs font-medium hover:border-[var(--sp-gold)] hover:text-[var(--sp-amber)]"
        >
          {open && !editing ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {open && !editing ? "Cancelar" : "Nuevo acuerdo"}
        </button>
      }
    >
      {agreements.length === 0 ? (
        <EmptyRow>Todavía no hay ningún acuerdo cargado.</EmptyRow>
      ) : (
        <ul className={`flex flex-col divide-y divide-[var(--sp-line)] ${pending ? "opacity-60" : ""}`}>
          {agreements.map((agreement) => (
            <li key={agreement.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="min-w-[200px] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{agreement.name}</p>
                  {agreement.internalOnly && <InternalBadge />}
                </div>
                <p className="mt-1 text-xs text-[var(--sp-muted)]">
                  {AGREEMENT_MODE_LABELS[agreement.mode]}
                  {agreement.signedAt ? ` · ${formatFullDateStr(agreement.signedAt)}` : ""}
                  {agreement.notes ? ` · ${agreement.notes}` : ""}
                </p>
                <div className="mt-1.5">
                  <FileLink url={agreement.fileUrl} name={agreement.fileName} />
                </div>
              </div>

              <p className="sp-display text-base tabular-nums">
                {formatMoney(agreement.totalCents, agreement.currency)}
                {agreement.mode === "mensual" && (
                  <span className="text-xs text-[var(--sp-muted)]"> /mes</span>
                )}
              </p>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={`Editar ${agreement.name}`}
                  onClick={() => {
                    setEditing(agreement);
                    setOpen(true);
                  }}
                  className="p-1.5 text-[var(--sp-muted)] hover:text-[var(--sp-amber)]"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Borrar ${agreement.name}`}
                  onClick={() => {
                    if (!confirm(`¿Borrar el acuerdo "${agreement.name}"?`)) return;
                    startTransition(() => {
                      deleteAgreement(agreement.id);
                    });
                  }}
                  className="p-1.5 text-[var(--sp-muted)] hover:text-[var(--sp-crit)]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <form
          key={editing?.id ?? "nuevo"}
          action={formAction}
          className="grid gap-4 border-t border-[var(--sp-line)] px-5 py-5 sm:grid-cols-2"
        >
          <input type="hidden" name="clientProjectId" value={clientProjectId} />
          {editing && <input type="hidden" name="id" value={editing.id} />}

          <Field label="Nombre del acuerdo" className="sm:col-span-2">
            <input
              name="name"
              required
              defaultValue={editing?.name ?? ""}
              autoComplete="off"
              className={spInput}
            />
          </Field>

          <Field label="Monto total">
            <input
              name="totalAmount"
              required
              inputMode="decimal"
              placeholder="0,00"
              defaultValue={editing ? centsToNumeric(editing.totalCents) : ""}
              className={spInput}
            />
          </Field>

          <Field label="Moneda">
            <select name="currency" defaultValue={editing?.currency ?? "ARS"} className={spInput}>
              {CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {CURRENCY_LABELS[currency]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Modalidad">
            <select name="mode" defaultValue={editing?.mode ?? "unico"} className={spInput}>
              <option value="unico">Pago único</option>
              <option value="mensual">Mensual (abono recurrente)</option>
            </select>
          </Field>

          <Field label="Fecha del acuerdo">
            <input
              type="date"
              name="signedAt"
              defaultValue={editing?.signedAt ?? ""}
              className={spInput}
            />
          </Field>

          <Field label="Link al documento (PDF o imagen)">
            <input
              name="fileUrl"
              type="url"
              placeholder="https://..."
              defaultValue={editing?.fileUrl ?? ""}
              className={spInput}
            />
          </Field>

          <Field label="Nombre del archivo">
            <input
              name="fileName"
              defaultValue={editing?.fileName ?? ""}
              autoComplete="off"
              className={spInput}
            />
          </Field>

          <Field label="Notas" className="sm:col-span-2">
            <input
              name="notes"
              defaultValue={editing?.notes ?? ""}
              autoComplete="off"
              className={spInput}
            />
          </Field>

          <label className="flex items-center gap-2 text-xs text-[var(--sp-muted)] sm:col-span-2">
            <input
              type="checkbox"
              name="internalOnly"
              defaultChecked={editing?.internalOnly ?? false}
              className="h-4 w-4"
            />
            Solo interno — no se muestra en el portal del cliente
          </label>

          {state?.error && (
            <p className="text-sm text-[var(--sp-crit)] sm:col-span-2">{state.error}</p>
          )}

          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="sp-btn-gold inline-flex min-h-11 items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Cargar acuerdo"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
              className="sp-pill inline-flex min-h-11 items-center border border-[var(--sp-line-strong)] px-4 py-2 text-sm text-[var(--sp-muted)] hover:text-[var(--sp-ink)]"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </PanelShell>
  );
}
