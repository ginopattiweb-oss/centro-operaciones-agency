import { CalendarClock } from "lucide-react";
import { formatFullDateStr, daysFromToday } from "@/lib/date";
import {
  CURRENCY_LABELS,
  formatMoney,
  type CurrencyTotals,
  type FinanceSummary,
} from "@/lib/finanzas";

/**
 * Resumen de cuenta. Todo sale de lo cargado: acuerdos, facturas y comprobantes.
 * Cada moneda lleva su propia fila — ARS y USD no se suman entre sí.
 */
export function FinanceSummaryCards({ summary }: { summary: FinanceSummary }) {
  if (!summary.hasData) {
    return (
      <div className="sp-card px-5 py-6">
        <p className="sp-display text-sm">Sin movimientos cargados</p>
        <p className="mt-2 text-sm text-[var(--sp-muted)]">
          Cargá el acuerdo de servicios y las facturas para que el resumen de cuenta empiece a
          calcularse. Total acordado, facturado, pagado y saldo salen de ahí.
        </p>
      </div>
    );
  }

  const multi = summary.totals.length > 1;

  return (
    <div className="flex flex-col gap-5">
      {summary.totals.map((totals) => (
        <div key={totals.currency} className="flex flex-col gap-2">
          {multi && (
            <p className="sp-display text-[11px] text-[var(--sp-muted)]">
              {CURRENCY_LABELS[totals.currency]}
            </p>
          )}
          <CurrencyRow totals={totals} />
        </div>
      ))}

      <NextDueTile summary={summary} />
    </div>
  );
}

function CurrencyRow({ totals }: { totals: CurrencyTotals }) {
  const { currency } = totals;
  const agreedDetail =
    totals.monthlyCents > 0
      ? `${formatMoney(totals.monthlyCents, currency)} por mes${
          totals.agreedCents > 0 ? " además del pago único" : ""
        }`
      : undefined;

  return (
    <div className="grid grid-cols-1 gap-px bg-[var(--sp-line)] sm:grid-cols-2 lg:grid-cols-4">
      <Card
        label="Total acordado"
        value={formatMoney(totals.agreedCents, currency)}
        detail={agreedDetail}
      />
      <Card label="Facturado" value={formatMoney(totals.invoicedCents, currency)} />
      <Card
        label="Pagado"
        value={formatMoney(totals.paidCents, currency)}
        color={totals.paidCents > 0 ? "var(--sp-pos)" : undefined}
      />
      <Card
        label="Saldo pendiente"
        value={formatMoney(totals.outstandingCents, currency)}
        color={
          totals.overdueCents > 0
            ? "var(--sp-crit)"
            : totals.outstandingCents > 0
              ? "var(--sp-warn)"
              : "var(--sp-pos)"
        }
        detail={
          totals.overdueCents > 0
            ? `${formatMoney(totals.overdueCents, currency)} vencido`
            : totals.outstandingCents === 0
              ? "Todo cobrado"
              : undefined
        }
      />
    </div>
  );
}

function Card({
  label,
  value,
  detail,
  color,
}: {
  label: string;
  value: string;
  detail?: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-2 bg-[var(--sp-surface)] p-5">
      <p className="sp-display text-[11px] text-[var(--sp-muted)]">{label}</p>
      <p className="sp-display text-2xl tabular-nums" style={color ? { color } : undefined}>
        {value}
      </p>
      {detail && <p className="text-[11px] text-[var(--sp-muted)]">{detail}</p>}
    </div>
  );
}

function NextDueTile({ summary }: { summary: FinanceSummary }) {
  const next = summary.nextDue;

  if (!next) {
    return (
      <div className="sp-card flex items-center gap-3 px-5 py-4">
        <CalendarClock className="h-4 w-4 text-[var(--sp-muted)]" />
        <p className="text-sm text-[var(--sp-muted)]">
          {summary.totals.some((totals) => totals.invoicedCents > 0)
            ? "No queda ninguna factura con saldo."
            : "Todavía no hay facturas cargadas."}
        </p>
      </div>
    );
  }

  const days = daysFromToday(next.dueDate);
  const when = next.overdue
    ? `vencida hace ${Math.abs(days)} día${Math.abs(days) === 1 ? "" : "s"}`
    : days === 0
      ? "vence hoy"
      : `en ${days} día${days === 1 ? "" : "s"}`;

  return (
    <div className="sp-card flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="flex items-center gap-3">
        <CalendarClock
          className="h-4 w-4"
          style={{ color: next.overdue ? "var(--sp-crit)" : "var(--sp-amber)" }}
        />
        <div>
          <p className="sp-display text-[11px] text-[var(--sp-muted)]">Próximo vencimiento</p>
          <p className="text-sm">
            Factura {next.number} · {formatFullDateStr(next.dueDate)}{" "}
            <span style={{ color: next.overdue ? "var(--sp-crit)" : "var(--sp-muted)" }}>
              ({when})
            </span>
          </p>
        </div>
      </div>
      <p
        className="sp-display text-lg tabular-nums"
        style={{ color: next.overdue ? "var(--sp-crit)" : undefined }}
      >
        {formatMoney(next.balanceCents, next.currency)}
      </p>
    </div>
  );
}
