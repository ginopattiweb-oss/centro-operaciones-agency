"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { setLeadStatus } from "@/lib/actions/leads";
import { LEAD_LOST_REASONS, LEAD_LOST_REASON_LABELS } from "@/lib/leads-config";
import type { LeadRow } from "@/lib/leads";
import { LEAD_INPUT } from "./ui";
import { useOverlay } from "@/components/overlay";

/**
 * Motivo de la pérdida. Se abre desde el kanban al soltar una tarjeta en
 * Perdido; sin motivo elegido no hay forma de guardar.
 */
export function LostReasonDialog({
  lead,
  onClose,
}: {
  lead: LeadRow;
  onClose: () => void;
}) {
  const [reason, setReason] = useState(lead.lostReason ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => onClose(), [onClose]);
  const router = useRouter();

  useOverlay(panelRef, close);

  function save() {
    startTransition(async () => {
      try {
        await setLeadStatus(lead.id, "perdido", reason);
        router.refresh();
        onClose();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No se pudo guardar el cambio.");
      }
    });
  }

  return (
    <div
      className="co-scrim fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 md:p-10"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Motivo de la pérdida"
        className="sp-card co-glass w-full max-w-sm"
      >
        <div className="flex items-center justify-between border-b border-[var(--sp-line)] px-5 py-4">
          <p className="sp-display text-base">Lead perdido</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-[var(--sp-muted)] hover:text-[var(--sp-ink)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <p className="text-sm text-[var(--sp-muted)]">{lead.contactName}</p>

          <label className="flex flex-col gap-1.5">
            <span className="sp-display text-[11px] text-[var(--sp-muted)]">
              Motivo de la pérdida
            </span>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={LEAD_INPUT}
            >
              <option value="" disabled>
                Elegí un motivo
              </option>
              {LEAD_LOST_REASONS.map((value) => (
                <option key={value} value={value}>
                  {LEAD_LOST_REASON_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          {error && <p className="text-sm text-[var(--sp-crit)]">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!reason || pending}
              onClick={save}
              className="sp-btn-gold inline-flex min-h-11 items-center px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {pending ? "Guardando..." : "Marcar como perdido"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="sp-pill inline-flex min-h-11 items-center border border-[var(--sp-line-strong)] px-4 py-2 text-sm font-medium text-[var(--sp-muted)] hover:border-[var(--sp-gold)] hover:text-[var(--sp-amber)]"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
