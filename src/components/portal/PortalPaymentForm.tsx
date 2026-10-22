"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { createPortalPayment } from "@/lib/actions/finanzas";
import { todayStringBA } from "@/lib/date";
import { formatMoney, type Currency } from "@/lib/finanzas";

export type PayableInvoice = {
  id: string;
  number: string;
  balanceCents: number;
  currency: Currency;
};

/**
 * Carga de comprobante desde el portal. Sólo aparece si el proyecto la tiene
 * habilitada; el servidor la vuelve a chequear igual.
 */
export function PortalPaymentForm({ invoices }: { invoices: PayableInvoice[] }) {
  const [state, formAction, saving] = useActionState(createPortalPayment, null);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state]);

  if (invoices.length === 0) return null;

  return (
    <section className="rounded-card border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h3 className="font-heading text-base text-fg">Informar un pago</h3>
          <p className="mt-1 text-sm text-fg-muted">
            Subí el comprobante y lo aplicamos a tu factura.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-fg-muted hover:text-fg"
        >
          {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {open ? "Cancelar" : "Nuevo comprobante"}
        </button>
      </div>

      {state?.success && (
        <p className="border-b border-border px-5 py-3 text-sm text-positive">{state.success}</p>
      )}

      {open && (
        <form ref={formRef} action={formAction} className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm text-fg sm:col-span-2">
            Factura que pagaste
            <select name="invoiceId" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Elegí una factura
              </option>
              {invoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.number} · saldo {formatMoney(invoice.balanceCents, invoice.currency)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-fg">
            Fecha del pago
            <input
              type="date"
              name="paidAt"
              required
              defaultValue={todayStringBA()}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-fg">
            Monto
            <input
              name="amount"
              required
              inputMode="decimal"
              placeholder="0,00"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-fg">
            Medio de pago
            <input
              name="method"
              placeholder="Transferencia, efectivo..."
              autoComplete="off"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-fg">
            Link al comprobante
            <input name="fileUrl" type="url" placeholder="https://..." className={inputClass} />
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-fg sm:col-span-2">
            Notas
            <input name="notes" autoComplete="off" className={inputClass} />
          </label>

          {state?.error && <p className="text-sm text-negative sm:col-span-2">{state.error}</p>}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:brightness-110 disabled:opacity-50"
            >
              {saving ? "Enviando..." : "Enviar comprobante"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent-ink";
