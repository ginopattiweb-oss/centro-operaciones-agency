import { ExternalLink, Lock } from "lucide-react";
import { INVOICE_STATUS_LABELS, invoiceStatusColor, type InvoiceStatus } from "@/lib/finanzas";
import { StatusChip } from "../../ui";

/** Primitivas compartidas por los paneles de Finanzas (scope "Sol de Mayo"). */

export const spInput =
  "rounded-co-control w-full border border-[var(--sp-line-strong)] bg-[var(--sp-bone)] px-3 py-2 text-sm";

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="sp-display text-[10px] text-[var(--sp-muted)]">{label}</span>
      {children}
    </label>
  );
}

export function InvoiceStatusChip({ status }: { status: InvoiceStatus }) {
  return (
    <StatusChip label={INVOICE_STATUS_LABELS[status]} color={invoiceStatusColor(status)} />
  );
}

/**
 * Adjunto. Se guarda como link al documento (Drive, Dropbox, el facturador),
 * igual que en Documentos y Accesos: acá no se sube ningún binario.
 */
export function FileLink({ url, name }: { url: string | null; name: string | null }) {
  if (!url) return <span className="text-xs text-[var(--sp-muted)]">Sin archivo</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-1.5 text-xs text-[var(--sp-amber)] hover:underline"
    >
      {name || "Ver archivo"}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

export function InternalBadge() {
  return (
    <span
      title="Solo interno: no se muestra en el portal del cliente"
      className="sp-pill inline-flex items-center gap-1 border px-2 py-0.5 text-[10px] font-medium"
      style={{
        color: "var(--sp-muted)",
        borderColor: "var(--sp-line-strong)",
      }}
    >
      <Lock className="h-2.5 w-2.5" />
      Solo interno
    </span>
  );
}

export function PanelShell({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="sp-card flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--sp-line)] px-5 py-4">
        <div>
          <p className="sp-display text-sm text-[var(--sp-muted)]">{title}</p>
          {hint && <p className="mt-1 text-xs text-[var(--sp-muted)]">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-6 text-sm text-[var(--sp-muted)]">{children}</p>;
}
