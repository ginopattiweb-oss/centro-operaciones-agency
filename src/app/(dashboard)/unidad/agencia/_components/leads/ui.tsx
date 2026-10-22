import { AlertTriangle, CalendarClock, CalendarX2 } from "lucide-react";
import { formatShortDateStr } from "@/lib/date";
import {
  FOLLOW_UP_LABELS,
  followUpColor,
  LEAD_STATUS_LABELS,
  leadStatusColor,
} from "@/lib/leads-config";
import type { FollowUpState } from "@/lib/leads-config";
import type { LeadStatus } from "@/db/schema";
import { StatusChip } from "../ui";

/** Campo de formulario del módulo, con el mismo alto y tono que los de Proyectos. */
export const LEAD_INPUT =
  "rounded-co-control w-full border border-[var(--sp-line-strong)] bg-[var(--sp-bone)] px-3 py-2 text-sm text-[var(--sp-ink)]";

export function LeadStatusPill({ status }: { status: LeadStatus }) {
  return <StatusChip label={LEAD_STATUS_LABELS[status]} color={leadStatusColor(status)} />;
}

/**
 * Estado del seguimiento. Un lead activo sin fecha muestra la advertencia en
 * todas las vistas: no bloquea nada, pero no se deja de ver.
 */
export function FollowUpChip({
  state,
  date,
  showLabel = true,
}: {
  state: FollowUpState;
  date: string | null;
  showLabel?: boolean;
}) {
  if (state === "cerrado") {
    return <span className="text-xs text-[var(--sp-muted)]">—</span>;
  }

  const color = followUpColor(state);
  const Icon = state === "sin" ? AlertTriangle : state === "vencido" ? CalendarX2 : CalendarClock;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color }}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {state === "sin" ? (
        FOLLOW_UP_LABELS.sin
      ) : (
        <>
          {date && formatShortDateStr(date)}
          {showLabel && state !== "futuro" && ` · ${FOLLOW_UP_LABELS[state]}`}
        </>
      )}
    </span>
  );
}

export function LeadField({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="sp-display text-[11px] text-[var(--sp-muted)]">{label}</span>
      {children}
      {help && <span className="text-[11px] text-[var(--sp-muted)]">{help}</span>}
    </label>
  );
}
