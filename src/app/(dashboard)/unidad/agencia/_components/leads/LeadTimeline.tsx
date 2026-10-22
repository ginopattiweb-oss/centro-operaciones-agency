"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { addLeadInteraction, deleteLeadInteraction } from "@/lib/actions/leads";
import { formatFullDateStr } from "@/lib/date";
import {
  LEAD_INTERACTION_CHANNEL_LABELS,
  LEAD_INTERACTION_CHANNELS,
} from "@/lib/leads-config";
import type { LeadInteractionView } from "@/lib/leads";
import { LEAD_INPUT } from "./ui";

/**
 * Historial de contactos del lead. Cada interacción empuja la fecha de último
 * contacto: no hay que mantenerla a mano en dos lados.
 */
export function LeadTimeline({
  leadId,
  interactions,
  today,
}: {
  leadId: string;
  interactions: LeadInteractionView[];
  today: string;
}) {
  const [state, formAction, saving] = useActionState(addLeadInteraction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!state?.success) return;
    formRef.current?.reset();
    router.refresh();
  }, [state, router]);

  return (
    <div className="flex flex-col gap-4">
      <form ref={formRef} action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="leadId" value={leadId} />
        <div className="flex gap-2">
          <select name="channel" defaultValue="otro" className={LEAD_INPUT} aria-label="Canal">
            {LEAD_INTERACTION_CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {LEAD_INTERACTION_CHANNEL_LABELS[channel]}
              </option>
            ))}
          </select>
          <input
            type="date"
            name="occurredAt"
            defaultValue={today}
            max={today}
            aria-label="Fecha del contacto"
            className={LEAD_INPUT}
          />
        </div>
        <div className="flex gap-2">
          <input
            name="summary"
            required
            placeholder="Qué pasó en ese contacto"
            aria-label="Resumen del contacto"
            className={LEAD_INPUT}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={saving}
            aria-label="Registrar contacto"
            className="sp-btn-gold inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {state?.error && <p className="text-xs text-[var(--sp-crit)]">{state.error}</p>}
      </form>

      {interactions.length === 0 ? (
        <p className="text-sm text-[var(--sp-muted)]">Todavía no hay contactos registrados.</p>
      ) : (
        <ol className="flex flex-col gap-px bg-[var(--sp-line)]">
          {interactions.map((interaction) => (
            <InteractionRow key={interaction.id} interaction={interaction} />
          ))}
        </ol>
      )}
    </div>
  );
}

function InteractionRow({ interaction }: { interaction: LeadInteractionView }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <li className="flex items-start justify-between gap-3 bg-[var(--sp-surface)] px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs text-[var(--sp-muted)]">
          {formatFullDateStr(interaction.occurredAt.slice(0, 10))} ·{" "}
          {LEAD_INTERACTION_CHANNEL_LABELS[interaction.channel]}
        </p>
        <p className="mt-0.5 text-sm break-words">{interaction.summary}</p>
      </div>
      <button
        type="button"
        disabled={pending}
        aria-label="Borrar contacto"
        onClick={() =>
          startTransition(async () => {
            await deleteLeadInteraction(interaction.id);
            router.refresh();
          })
        }
        className="shrink-0 text-[var(--sp-muted)] hover:text-[var(--sp-crit)] disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
