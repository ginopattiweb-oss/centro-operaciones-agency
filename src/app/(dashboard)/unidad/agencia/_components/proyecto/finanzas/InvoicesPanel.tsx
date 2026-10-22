"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { deleteInvoice, saveInvoice } from "@/lib/actions/finanzas";
import { formatFullDateStr } from "@/lib/date";
import {
  CURRENCIES,
  CURRENCY_LABELS,
  centsToNumeric,
  formatMoney,
  type AgreementView,
  type InvoiceView,
} from "@/lib/finanzas";
import {
  EmptyRow,
  Field,
  FileLink,
  InternalBadge,
  InvoiceStatusChip,
  PanelShell,
  spInput,
} from "./ui";

/**
 * Facturas emitidas. El estado no se guarda: "vencida" sale de la fecha y
 * "pagada"/"parcial" de la suma de sus comprobantes.
 */
export function InvoicesPanel({
  clientProjectId,
  invoices,
  agreements,
}: {
  clientProjectId: string;
  invoices: InvoiceView[];
  agreements: AgreementView[];
}) {
  const [state, formAction, saving] = useActionState(saveInvoice, null);
  const [editing, setEditing] = useState<InvoiceView | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (state?.success) {
      setOpen(false);
      setEditing(null);
    }
  }, [state]);

  return (
    <PanelShell
      title="Facturas"
      hint="Cargá cada factura emitida. El saldo y el estado se calculan con sus comprobantes."
      action={
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setOpen((value) => !value);
          }}
          className="sp-pill inline-flex min-h-9 items-center gap-2 border border-[var(--sp-line-strong)] px-3 py-1.5 text-xs font-medium hover:border-[var(--sp-gold)] hover:text-[var(--sp-amber)]"
        >
          {open && !editing ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {open && !editing ? "Cancelar" : "Nueva factura"}
        </button>
      }
    >
      {invoices.length === 0 ? (
        <EmptyRow>Todavía no hay facturas cargadas.</EmptyRow>
      ) : (
        <div className={`overflow-x-auto ${pending ? "opacity-60" : ""}`}>
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--sp-line)] text-left">
                {["Factura", "Emisión", "Vencimiento", "Monto", "Pagado", "Saldo", "Estado", ""].map(
                  (header, index) => (
                    <th
                      key={header || index}
                      className={`sp-display px-4 py-3 text-[10px] font-medium text-[var(--sp-muted)] ${
                        index >= 3 && index <= 5 ? "text-right" : ""
                      }`}
                    >
                      {header}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--sp-line)]">
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{invoice.number}</span>
                      {invoice.internalOnly && <InternalBadge />}
                    </div>
                    <div className="mt-1">
                      <FileLink url={invoice.fileUrl} name={invoice.fileName} />
                    </div>
                    {invoice.payments.length > 0 && (
                      <p className="mt-1 text-[11px] text-[var(--sp-muted)]">
                        {invoice.payments.length} comprobante
                        {invoice.payments.length === 1 ? "" : "s"}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-[var(--sp-muted)]">
                    {formatFullDateStr(invoice.issuedAt)}
                  </td>
                  <td
                    className="whitespace-nowrap px-4 py-3 text-xs tabular-nums"
                    style={{ color: invoice.overdue ? "var(--sp-crit)" : "var(--sp-muted)" }}
                  >
                    {formatFullDateStr(invoice.dueDate)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    {formatMoney(invoice.amountCents, invoice.currency)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[var(--sp-muted)]">
                    {formatMoney(invoice.paidCents, invoice.currency)}
                  </td>
                  <td
                    className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums"
                    style={{
                      color:
                        invoice.balanceCents === 0
                          ? "var(--sp-pos)"
                          : invoice.overdue
                            ? "var(--sp-crit)"
                            : undefined,
                    }}
                  >
                    {formatMoney(invoice.balanceCents, invoice.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <InvoiceStatusChip status={invoice.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        aria-label={`Editar factura ${invoice.number}`}
                        onClick={() => {
                          setEditing(invoice);
                          setOpen(true);
                        }}
                        className="p-1.5 text-[var(--sp-muted)] hover:text-[var(--sp-amber)]"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Borrar factura ${invoice.number}`}
                        onClick={() => {
                          if (
                            !confirm(
                              invoice.payments.length > 0
                                ? `La factura ${invoice.number} tiene ${invoice.payments.length} comprobante(s), que también se borran. ¿Seguir?`
                                : `¿Borrar la factura ${invoice.number}?`
                            )
                          ) {
                            return;
                          }
                          startTransition(() => {
                            deleteInvoice(invoice.id);
                          });
                        }}
                        className="p-1.5 text-[var(--sp-muted)] hover:text-[var(--sp-crit)]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <form
          key={editing?.id ?? "nueva"}
          action={formAction}
          className="grid gap-4 border-t border-[var(--sp-line)] px-5 py-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          <input type="hidden" name="clientProjectId" value={clientProjectId} />
          {editing && <input type="hidden" name="id" value={editing.id} />}

          <Field label="Número de factura">
            <input
              name="number"
              required
              defaultValue={editing?.number ?? ""}
              autoComplete="off"
              className={spInput}
            />
          </Field>

          <Field label="Fecha de emisión">
            <input
              type="date"
              name="issuedAt"
              required
              defaultValue={editing?.issuedAt ?? ""}
              className={spInput}
            />
          </Field>

          <Field label="Vencimiento">
            <input
              type="date"
              name="dueDate"
              required
              defaultValue={editing?.dueDate ?? ""}
              className={spInput}
            />
          </Field>

          <Field label="Monto">
            <input
              name="amount"
              required
              inputMode="decimal"
              placeholder="0,00"
              defaultValue={editing ? centsToNumeric(editing.amountCents) : ""}
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

          <Field label="Acuerdo (opcional)">
            <select
              name="agreementId"
              defaultValue={editing?.agreementId ?? ""}
              className={spInput}
            >
              <option value="">Sin vincular</option>
              {agreements.map((agreement) => (
                <option key={agreement.id} value={agreement.id}>
                  {agreement.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Link a la factura (PDF o imagen)" className="sm:col-span-2">
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

          <Field label="Notas" className="sm:col-span-2 lg:col-span-3">
            <input
              name="notes"
              defaultValue={editing?.notes ?? ""}
              autoComplete="off"
              className={spInput}
            />
          </Field>

          <label className="flex items-center gap-2 text-xs text-[var(--sp-muted)] sm:col-span-2 lg:col-span-3">
            <input
              type="checkbox"
              name="internalOnly"
              defaultChecked={editing?.internalOnly ?? false}
              className="h-4 w-4"
            />
            Solo interno — no se muestra en el portal del cliente
          </label>

          {state?.error && (
            <p className="text-sm text-[var(--sp-crit)] sm:col-span-2 lg:col-span-3">
              {state.error}
            </p>
          )}

          <div className="flex flex-wrap gap-3 sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={saving}
              className="sp-btn-gold inline-flex min-h-11 items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Cargar factura"}
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
