"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { createReactivationLead } from "@/lib/actions/leads";
import { LEADS_BASE_PATH, LEAD_SOURCE_LABELS } from "@/lib/leads-config";
import { formatLeadMoney, type LeadRow } from "@/lib/leads";
import { SectionTitle } from "../ui";
import { FollowUpChip, LeadStatusPill } from "../leads/ui";

/**
 * Historial comercial del cliente: de qué leads salió y cuáles tiene abiertos.
 * Un lead ganado no se borra ni se transforma, así que acá queda para siempre
 * cómo llegó este cliente.
 */
export function LeadsPanel({
  clientProjectId,
  leads,
}: {
  clientProjectId: string;
  leads: LeadRow[];
}) {
  return (
    <section className="flex flex-col gap-4">
      <SectionTitle action={<ReactivationButton clientProjectId={clientProjectId} />}>
        Leads
      </SectionTitle>

      {leads.length === 0 ? (
        <p className="text-sm text-[var(--sp-muted)]">
          Este cliente todavía no tiene leads vinculados.
        </p>
      ) : (
        <ul className="flex flex-col gap-px bg-[var(--sp-line)]">
          {leads.map((lead) => (
            <li key={lead.id}>
              <Link
                href={`${LEADS_BASE_PATH}?lead=${lead.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-[var(--sp-surface)] px-4 py-3 hover:bg-[color-mix(in_srgb,var(--sp-gold)_7%,var(--sp-surface))]"
              >
                <div className="min-w-[160px] flex-1">
                  <p className="text-sm">{lead.contactName}</p>
                  <p className="mt-0.5 text-xs text-[var(--sp-muted)]">
                    {LEAD_SOURCE_LABELS[lead.source]}
                    {lead.archived ? " · Archivado" : ""}
                  </p>
                </div>
                <LeadStatusPill status={lead.status} />
                <FollowUpChip state={lead.followUp} date={lead.nextFollowUpAt} />
                <span className="w-28 text-right text-xs tabular-nums text-[var(--sp-muted)]">
                  {lead.estimatedValueCents === null
                    ? "Sin cotizar"
                    : formatLeadMoney(lead.estimatedValueCents, lead.currency)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Abre un lead nuevo sobre un cliente que ya tuvimos, con los datos precargados
 * y el cliente vinculado: laburar la base histórica sin duplicar registros.
 */
function ReactivationButton({ clientProjectId }: { clientProjectId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const id = await createReactivationLead(clientProjectId);
          router.push(`${LEADS_BASE_PATH}?lead=${id}`);
        })
      }
      className="sp-pill inline-flex min-h-11 items-center gap-2 border border-[var(--sp-line-strong)] px-4 py-2 text-sm font-medium hover:border-[var(--sp-gold)] hover:text-[var(--sp-amber)] disabled:opacity-50"
    >
      <RefreshCw className="h-4 w-4" />
      {pending ? "Creando..." : "Crear lead de reactivación"}
    </button>
  );
}
