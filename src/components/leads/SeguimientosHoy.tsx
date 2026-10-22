"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { markLeadContacted, setLeadFollowUp } from "@/lib/actions/leads";
import { useRouter } from "next/navigation";
import { LEADS_BASE_PATH } from "@/lib/leads-config";
import type { LeadRow } from "@/lib/leads";
import { FollowUpQuickPicks } from "./FollowUpQuickPicks";

/**
 * Seguimientos del día en el dashboard: los leads con fecha para hoy o antes.
 * Es la vista que se abre todas las mañanas, así que todo se resuelve acá
 * mismo: marcar el contacto y reagendar sin salir de la página.
 */
export function SeguimientosHoy({ leads, today }: { leads: LeadRow[]; today: string }) {
  if (leads.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface p-6">
        <p className="text-sm text-fg-muted">Sin seguimientos pendientes.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
      {leads.map((lead) => (
        <SeguimientoRow key={lead.id} lead={lead} today={today} />
      ))}
    </div>
  );
}

function SeguimientoRow({ lead, today }: { lead: LeadRow; today: string }) {
  const [pending, startTransition] = useTransition();
  const [picking, setPicking] = useState(false);
  const router = useRouter();

  function onContacted() {
    startTransition(async () => {
      await markLeadContacted(lead.id);
      setPicking(true);
      router.refresh();
    });
  }

  function onPick(date: string | null) {
    startTransition(async () => {
      await setLeadFollowUp(lead.id, date);
      setPicking(false);
      router.refresh();
    });
  }

  const since =
    lead.daysSinceContact === null
      ? "Sin contacto registrado"
      : lead.daysSinceContact === 0
        ? "Contactado hoy"
        : `Último contacto hace ${lead.daysSinceContact} día(s)`;

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`${LEADS_BASE_PATH}?lead=${lead.id}`}
            className="truncate text-sm text-fg hover:text-accent-ink"
          >
            {lead.contactName}
          </Link>
          <p className="mt-0.5 truncate text-xs text-fg-muted">
            {lead.business ? `${lead.business} · ` : ""}
            {since}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {lead.followUp === "vencido" && lead.nextFollowUpAt && (
            <span className="text-xs text-negative">Vencido</span>
          )}
          <button
            type="button"
            onClick={onContacted}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-fg-muted transition hover:border-accent/50 hover:text-accent-ink disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            Contactado
          </button>
        </div>
      </div>

      {picking && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-fg-muted">¿Cuándo lo seguís?</span>
            <button
              type="button"
              onClick={() => setPicking(false)}
              className="text-xs text-fg-muted hover:text-fg"
            >
              Después
            </button>
          </div>
          <FollowUpQuickPicks
            today={today}
            value={lead.nextFollowUpAt}
            onPick={onPick}
            disabled={pending}
            allowClear
          />
        </div>
      )}
    </div>
  );
}
