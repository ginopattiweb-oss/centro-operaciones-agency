import { notFound } from "next/navigation";
import { CalendarClock, ExternalLink, FileText, Receipt, Wallet } from "lucide-react";
import { daysFromToday, formatFullDateStr } from "@/lib/date";
import { requirePortalContext } from "@/lib/portal-queries";
import { getFinanceForClient } from "@/lib/finanzas-queries";
import {
  AGREEMENT_MODE_LABELS,
  INVOICE_STATUS_LABELS,
  allPayments,
  formatMoney,
  outstandingInvoices,
  type CurrencyTotals,
  type InvoiceStatus,
  type InvoiceView,
} from "@/lib/finanzas";
import { PortalPaymentForm } from "@/components/portal/PortalPaymentForm";

export const dynamic = "force-dynamic";

/**
 * La parte financiera del cliente: es la misma información que ve el equipo en
 * la pestaña Finanzas del proyecto, menos lo marcado "solo interno".
 */
export default async function PortalFinanzasPage() {
  const { clientProject } = await requirePortalContext();
  if (!clientProject.financeVisibleToClient) notFound();

  const { agreements, invoices, summary } = await getFinanceForClient(clientProject.id, "cliente");
  const pending = outstandingInvoices(invoices);
  const payments = allPayments(invoices);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h2 className="font-heading text-2xl text-fg">Finanzas</h2>
        <p className="text-sm text-fg-muted">
          Tu acuerdo, tus facturas, tus comprobantes y lo que queda pendiente.
        </p>
      </header>

      {!summary.hasData ? (
        <EmptyCard icon={<Wallet className="h-6 w-6 text-fg-muted" />}>
          Todavía no hay nada cargado en tu cuenta.
        </EmptyCard>
      ) : (
        <>
          <div className="flex flex-col gap-6">
            {summary.totals.map((totals) => (
              <TotalsBlock
                key={totals.currency}
                totals={totals}
                showCurrency={summary.totals.length > 1}
              />
            ))}
          </div>

          {summary.nextDue && (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-card border px-5 py-4"
              style={{
                borderColor: summary.nextDue.overdue
                  ? "var(--color-negative)"
                  : "var(--color-border)",
              }}
            >
              <div className="flex items-center gap-3">
                <CalendarClock
                  className="h-5 w-5"
                  style={{
                    color: summary.nextDue.overdue
                      ? "var(--color-negative)"
                      : "var(--color-accent-ink)",
                  }}
                />
                <div>
                  <p className="text-xs uppercase tracking-wider text-fg-muted">
                    Próximo vencimiento
                  </p>
                  <p className="text-sm text-fg">
                    Factura {summary.nextDue.number} ·{" "}
                    {formatFullDateStr(summary.nextDue.dueDate)} ·{" "}
                    {relativeDue(summary.nextDue.dueDate, summary.nextDue.overdue)}
                  </p>
                </div>
              </div>
              <p
                className="font-heading text-lg tabular-nums"
                style={{ color: summary.nextDue.overdue ? "var(--color-negative)" : undefined }}
              >
                {formatMoney(summary.nextDue.balanceCents, summary.nextDue.currency)}
              </p>
            </div>
          )}
        </>
      )}

      <Section title="Acuerdo de servicios" icon={<FileText className="h-4 w-4" />}>
        {agreements.length === 0 ? (
          <Row>Todavía no hay un acuerdo publicado.</Row>
        ) : (
          agreements.map((agreement) => (
            <div
              key={agreement.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg">{agreement.name}</p>
                <p className="mt-1 text-xs text-fg-muted">
                  {AGREEMENT_MODE_LABELS[agreement.mode]}
                  {agreement.signedAt ? ` · ${formatFullDateStr(agreement.signedAt)}` : ""}
                </p>
                {agreement.fileUrl && (
                  <FileLink url={agreement.fileUrl} name={agreement.fileName} />
                )}
              </div>
              <p className="font-heading text-base tabular-nums text-fg">
                {formatMoney(agreement.totalCents, agreement.currency)}
                {agreement.mode === "mensual" && (
                  <span className="text-xs text-fg-muted"> /mes</span>
                )}
              </p>
            </div>
          ))
        )}
      </Section>

      <Section title="Pendiente de pago" icon={<CalendarClock className="h-4 w-4" />}>
        {pending.length === 0 ? (
          <Row>
            {invoices.length === 0
              ? "Todavía no hay facturas emitidas."
              : "No tenés nada pendiente. Está todo al día."}
          </Row>
        ) : (
          pending.map((invoice) => <PendingRow key={invoice.id} invoice={invoice} />)
        )}
      </Section>

      {clientProject.clientCanUploadPayments && (
        <PortalPaymentForm
          invoices={pending.map((invoice) => ({
            id: invoice.id,
            number: invoice.number,
            balanceCents: invoice.balanceCents,
            currency: invoice.currency,
          }))}
        />
      )}

      <Section title="Facturas" icon={<Receipt className="h-4 w-4" />}>
        {invoices.length === 0 ? (
          <Row>Todavía no hay facturas emitidas.</Row>
        ) : (
          invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg">Factura {invoice.number}</p>
                <p className="mt-1 text-xs text-fg-muted">
                  Emitida {formatFullDateStr(invoice.issuedAt)} · vence{" "}
                  {formatFullDateStr(invoice.dueDate)}
                </p>
                {invoice.fileUrl && <FileLink url={invoice.fileUrl} name={invoice.fileName} />}
              </div>
              <div className="text-right">
                <p className="font-heading text-base tabular-nums text-fg">
                  {formatMoney(invoice.amountCents, invoice.currency)}
                </p>
                <StatusTag status={invoice.status} />
              </div>
            </div>
          ))
        )}
      </Section>

      <Section title="Comprobantes de pago" icon={<Wallet className="h-4 w-4" />}>
        {payments.length === 0 ? (
          <Row>Todavía no hay comprobantes registrados.</Row>
        ) : (
          payments.map((payment) => {
            const invoice = invoices.find((row) => row.id === payment.invoiceId);
            return (
              <div
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="text-sm text-fg">
                    Factura {invoice?.number ?? "—"}
                    {payment.method ? ` · ${payment.method}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-fg-muted">{formatFullDateStr(payment.paidAt)}</p>
                  {payment.fileUrl && <FileLink url={payment.fileUrl} name={payment.fileName} />}
                </div>
                <p className="font-heading text-base tabular-nums text-positive">
                  {formatMoney(payment.amountCents, payment.currency)}
                </p>
              </div>
            );
          })
        )}
      </Section>
    </div>
  );
}

function relativeDue(dueDate: string, overdue: boolean): string {
  const days = daysFromToday(dueDate);
  if (overdue) return `vencida hace ${Math.abs(days)} día${Math.abs(days) === 1 ? "" : "s"}`;
  if (days === 0) return "vence hoy";
  return `en ${days} día${days === 1 ? "" : "s"}`;
}

function TotalsBlock({
  totals,
  showCurrency,
}: {
  totals: CurrencyTotals;
  showCurrency: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      {showCurrency && (
        <p className="text-xs uppercase tracking-wider text-fg-muted">{totals.currency}</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Total acordado"
          value={formatMoney(totals.agreedCents, totals.currency)}
          detail={
            totals.monthlyCents > 0
              ? `${formatMoney(totals.monthlyCents, totals.currency)} por mes`
              : undefined
          }
        />
        <Stat label="Facturado" value={formatMoney(totals.invoicedCents, totals.currency)} />
        <Stat label="Pagado" value={formatMoney(totals.paidCents, totals.currency)} />
        <Stat
          label="Saldo pendiente"
          value={formatMoney(totals.outstandingCents, totals.currency)}
          color={
            totals.overdueCents > 0
              ? "var(--color-negative)"
              : totals.outstandingCents === 0
                ? "var(--color-positive)"
                : undefined
          }
          detail={
            totals.overdueCents > 0
              ? `${formatMoney(totals.overdueCents, totals.currency)} vencido`
              : undefined
          }
        />
      </div>
    </div>
  );
}

function Stat({
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
    <div className="rounded-card border border-border bg-surface px-5 py-4">
      <p className="text-xs uppercase tracking-wider text-fg-muted">{label}</p>
      <p
        className="mt-2 font-heading text-xl tabular-nums text-fg"
        style={color ? { color } : undefined}
      >
        {value}
      </p>
      {detail && <p className="mt-1 text-xs text-fg-muted">{detail}</p>}
    </div>
  );
}

function PendingRow({ invoice }: { invoice: InvoiceView }) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
      style={
        invoice.overdue
          ? { background: "color-mix(in srgb, var(--color-negative) 6%, transparent)" }
          : undefined
      }
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg">Factura {invoice.number}</p>
        <p
          className="mt-1 text-xs"
          style={{ color: invoice.overdue ? "var(--color-negative)" : undefined }}
        >
          <span className={invoice.overdue ? "" : "text-fg-muted"}>
            Vence {formatFullDateStr(invoice.dueDate)} ·{" "}
            {relativeDue(invoice.dueDate, invoice.overdue)}
          </span>
        </p>
      </div>
      <div className="text-right">
        {invoice.paidCents > 0 && (
          <p className="text-xs tabular-nums text-fg-muted">
            {formatMoney(invoice.paidCents, invoice.currency)} de{" "}
            {formatMoney(invoice.amountCents, invoice.currency)}
          </p>
        )}
        <p
          className="font-heading text-base tabular-nums text-fg"
          style={{ color: invoice.overdue ? "var(--color-negative)" : undefined }}
        >
          {formatMoney(invoice.balanceCents, invoice.currency)}
        </p>
        <StatusTag status={invoice.status} />
      </div>
    </div>
  );
}

function StatusTag({ status }: { status: InvoiceStatus }) {
  const color =
    status === "pagada"
      ? "var(--color-positive)"
      : status === "vencida"
        ? "var(--color-negative)"
        : "var(--color-accent-ink)";
  return (
    <span
      className="mt-1 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 34%, transparent)`,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
      }}
    >
      {INVOICE_STATUS_LABELS[status]}
    </span>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-card border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4 text-accent-ink">
        {icon}
        <h3 className="font-heading text-base text-fg">{title}</h3>
      </div>
      <div className="flex flex-col divide-y divide-border">{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-6 text-sm text-fg-muted">{children}</p>;
}

function EmptyCard({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface px-6 py-12 text-center">
      {icon}
      <p className="text-sm text-fg-muted">{children}</p>
    </div>
  );
}

function FileLink({ url, name }: { url: string; name: string | null }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-accent-ink hover:underline"
    >
      {name || "Ver archivo"}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}
