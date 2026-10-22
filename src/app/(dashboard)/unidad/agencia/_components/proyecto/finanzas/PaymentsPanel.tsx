"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { deletePayment, savePayment } from "@/lib/actions/finanzas";
import { formatFullDateStr, todayStringBA } from "@/lib/date";
import {
  allPayments,
  formatMoney,
  knownPaymentMethods,
  type InvoiceView,
} from "@/lib/finanzas";
import { EmptyRow, Field, FileLink, PanelShell, spInput } from "./ui";

/**
 * Comprobantes de pago. Cada uno salda una factura: al asociarlo se recalculan
 * el estado de esa factura y el saldo pendiente del proyecto.
 */
export function PaymentsPanel({ invoices }: { invoices: InvoiceView[] }) {
  const [state, formAction, saving] = useActionState(savePayment, null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state]);

  const payments = allPayments(invoices);
  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const openInvoices = invoices.filter((invoice) => invoice.balanceCents > 0);
  const methods = knownPaymentMethods(invoices);

  return (
    <PanelShell
      title="Comprobantes de pago"
      hint="Un comprobante por pago. Una factura puede tener varios."
      action={
        invoices.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="sp-pill inline-flex min-h-9 items-center gap-2 border border-[var(--sp-line-strong)] px-3 py-1.5 text-xs font-medium hover:border-[var(--sp-gold)] hover:text-[var(--sp-amber)]"
          >
            {open ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {open ? "Cancelar" : "Nuevo comprobante"}
          </button>
        ) : null
      }
    >
      {payments.length === 0 ? (
        <EmptyRow>
          {invoices.length === 0
            ? "Primero cargá una factura: los comprobantes se asocian a una."
            : "Todavía no hay comprobantes cargados."}
        </EmptyRow>
      ) : (
        <ul className={`flex flex-col divide-y divide-[var(--sp-line)] ${pending ? "opacity-60" : ""}`}>
          {payments.map((payment) => {
            const invoice = invoiceById.get(payment.invoiceId);
            return (
              <li key={payment.id} className="flex flex-wrap items-center gap-4 px-5 py-3">
                <div className="min-w-[200px] flex-1">
                  <p className="text-sm">
                    Factura {invoice?.number ?? "—"}
                    {payment.method ? ` · ${payment.method}` : ""}
                    {payment.fromClient && (
                      <span className="text-xs text-[var(--sp-muted)]"> · subido por el cliente</span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-[var(--sp-muted)]">
                    {formatFullDateStr(payment.paidAt)}
                    {payment.notes ? ` · ${payment.notes}` : ""}
                  </p>
                  <div className="mt-1">
                    <FileLink url={payment.fileUrl} name={payment.fileName} />
                  </div>
                </div>

                <p
                  className="sp-display text-base tabular-nums"
                  style={{ color: "var(--sp-pos)" }}
                >
                  {formatMoney(payment.amountCents, payment.currency)}
                </p>

                <button
                  type="button"
                  aria-label="Borrar comprobante"
                  onClick={() => {
                    if (!confirm("¿Borrar este comprobante? El saldo se recalcula.")) return;
                    startTransition(() => {
                      deletePayment(payment.id);
                    });
                  }}
                  className="p-1.5 text-[var(--sp-muted)] hover:text-[var(--sp-crit)]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open && invoices.length > 0 && (
        <form
          ref={formRef}
          action={formAction}
          className="grid gap-4 border-t border-[var(--sp-line)] px-5 py-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Field label="Factura que salda" className="sm:col-span-2">
            <select name="invoiceId" required defaultValue="" className={spInput}>
              <option value="" disabled>
                Elegí una factura
              </option>
              {openInvoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.number} · saldo{" "}
                  {formatMoney(invoice.balanceCents, invoice.currency)}
                </option>
              ))}
            </select>
            {openInvoices.length === 0 && (
              <span className="text-xs text-[var(--sp-muted)]">
                No queda ninguna factura con saldo.
              </span>
            )}
          </Field>

          <Field label="Fecha del pago">
            <input
              type="date"
              name="paidAt"
              required
              defaultValue={todayStringBA()}
              className={spInput}
            />
          </Field>

          <Field label="Monto">
            <input
              name="amount"
              required
              inputMode="decimal"
              placeholder="0,00"
              className={spInput}
            />
          </Field>

          <Field label="Medio de pago">
            <input
              name="method"
              list="finanzas-medios-pago"
              placeholder="Transferencia, efectivo..."
              autoComplete="off"
              className={spInput}
            />
            <datalist id="finanzas-medios-pago">
              {methods.map((method) => (
                <option key={method} value={method} />
              ))}
            </datalist>
          </Field>

          <Field label="Link al comprobante">
            <input name="fileUrl" type="url" placeholder="https://..." className={spInput} />
          </Field>

          <Field label="Nombre del archivo">
            <input name="fileName" autoComplete="off" className={spInput} />
          </Field>

          <Field label="Notas" className="sm:col-span-2 lg:col-span-3">
            <input name="notes" autoComplete="off" className={spInput} />
          </Field>

          {state?.error && (
            <p className="text-sm text-[var(--sp-crit)] sm:col-span-2 lg:col-span-3">
              {state.error}
            </p>
          )}

          <div className="flex flex-wrap gap-3 sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={saving || openInvoices.length === 0}
              className="sp-btn-gold inline-flex min-h-11 items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Registrar comprobante"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
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
