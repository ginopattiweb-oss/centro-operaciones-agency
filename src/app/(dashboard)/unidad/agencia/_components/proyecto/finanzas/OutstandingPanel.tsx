import { formatFullDateStr, daysFromToday } from "@/lib/date";
import {
  formatMoney,
  outstandingInvoices,
  type FinanceSummary,
  type InvoiceView,
} from "@/lib/finanzas";
import { EmptyRow, InvoiceStatusChip, PanelShell } from "./ui";

/** Lo que queda por cobrar: facturas impagas o parciales, de la más vencida en adelante. */
export function OutstandingPanel({
  invoices,
  summary,
}: {
  invoices: InvoiceView[];
  summary: FinanceSummary;
}) {
  const pending = outstandingInvoices(invoices);
  const totals = summary.totals.filter((row) => row.outstandingCents > 0);

  return (
    <PanelShell
      title="Pendiente de pago"
      hint="Ordenado por vencimiento. En rojo, lo que ya venció."
      action={
        totals.length > 0 ? (
          <div className="flex flex-wrap items-center gap-4">
            {totals.map((row) => (
              <div key={row.currency} className="text-right">
                <p className="sp-display text-[10px] text-[var(--sp-muted)]">
                  Total pendiente {row.currency}
                </p>
                <p
                  className="sp-display text-lg tabular-nums"
                  style={{ color: row.overdueCents > 0 ? "var(--sp-crit)" : "var(--sp-warn)" }}
                >
                  {formatMoney(row.outstandingCents, row.currency)}
                </p>
              </div>
            ))}
          </div>
        ) : null
      }
    >
      {pending.length === 0 ? (
        <EmptyRow>
          {invoices.length === 0
            ? "Sin facturas cargadas: no hay nada pendiente de cobro."
            : "No queda nada por cobrar."}
        </EmptyRow>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--sp-line)]">
          {pending.map((invoice) => {
            const days = daysFromToday(invoice.dueDate);
            return (
              <li
                key={invoice.id}
                className="flex flex-wrap items-center gap-4 px-5 py-3"
                style={
                  invoice.overdue
                    ? { background: "color-mix(in srgb, var(--sp-crit) 5%, transparent)" }
                    : undefined
                }
              >
                <div className="min-w-[180px] flex-1">
                  <p className="text-sm font-medium">Factura {invoice.number}</p>
                  <p
                    className="mt-1 text-xs tabular-nums"
                    style={{ color: invoice.overdue ? "var(--sp-crit)" : "var(--sp-muted)" }}
                  >
                    Vence {formatFullDateStr(invoice.dueDate)} ·{" "}
                    {invoice.overdue
                      ? `vencida hace ${Math.abs(days)} día${Math.abs(days) === 1 ? "" : "s"}`
                      : days === 0
                        ? "vence hoy"
                        : `en ${days} día${days === 1 ? "" : "s"}`}
                  </p>
                </div>

                <InvoiceStatusChip status={invoice.status} />

                <div className="text-right">
                  {invoice.paidCents > 0 && (
                    <p className="text-[11px] tabular-nums text-[var(--sp-muted)]">
                      {formatMoney(invoice.paidCents, invoice.currency)} de{" "}
                      {formatMoney(invoice.amountCents, invoice.currency)}
                    </p>
                  )}
                  <p
                    className="sp-display text-base tabular-nums"
                    style={{ color: invoice.overdue ? "var(--sp-crit)" : "var(--sp-warn)" }}
                  >
                    {formatMoney(invoice.balanceCents, invoice.currency)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PanelShell>
  );
}
