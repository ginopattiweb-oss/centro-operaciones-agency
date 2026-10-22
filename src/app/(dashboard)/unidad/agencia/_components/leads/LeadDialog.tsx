"use client";

import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, X } from "lucide-react";
import Link from "next/link";
import {
  createLead,
  findDuplicateContacts,
  updateLead,
  type DuplicateMatch,
} from "@/lib/actions/leads";
import {
  DEFAULT_LEAD_CURRENCY,
  isActiveLeadStatus,
  LEAD_CURRENCIES,
  LEAD_CURRENCY_LABELS,
  LEAD_LOST_REASON_LABELS,
  LEAD_LOST_REASONS,
  LEAD_SOURCE_LABELS,
  SELECTABLE_LEAD_SOURCES,
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
} from "@/lib/leads-config";
import type { LeadStatus } from "@/db/schema";
import type { LeadRow } from "@/lib/leads";
import { LEAD_INPUT, LeadField } from "./ui";
import { useOverlay } from "@/components/overlay";

/**
 * Alta y edición del lead. Es el mismo formulario para los dos casos: sin `lead`
 * crea, con `lead` edita. Lo único obligatorio es el nombre del contacto; el
 * motivo de pérdida se vuelve obligatorio si el estado elegido es 'perdido'.
 */
export function LeadDialog({
  lead,
  today,
  onClose,
}: {
  lead: LeadRow | null;
  today: string;
  onClose: () => void;
}) {
  const editing = lead !== null;
  const [state, formAction, saving] = useActionState(
    editing ? updateLead : createLead,
    null
  );
  const [status, setStatus] = useState<LeadStatus>(lead?.status ?? "nuevo");
  const [email, setEmail] = useState(lead?.email ?? "");
  const [instagram, setInstagram] = useState(lead?.instagram ?? "");
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  /**
   * 'Formulario web' no se puede elegir a mano, pero un lead que entró por ahí
   * conserva su canal al editarse: si la opción no estuviera, el select caería
   * en la primera y guardar le cambiaría el origen sin que nadie lo pidiera.
   */
  const sourceOptions =
    lead && !SELECTABLE_LEAD_SOURCES.includes(lead.source)
      ? [lead.source, ...SELECTABLE_LEAD_SOURCES]
      : SELECTABLE_LEAD_SOURCES;
  const [, startCheck] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  /**
   * Aviso de duplicados: no bloquea nada, sólo muestra a quién ya tenemos
   * cargado con ese mail o ese instagram. Se consulta al salir del campo.
   */
  function checkDuplicates() {
    startCheck(async () => {
      setDuplicates(await findDuplicateContacts(email, instagram, lead?.id ?? null));
    });
  }

  useOverlay(panelRef, onClose);

  useEffect(() => {
    if (!state?.success) return;
    router.refresh();
    onClose();
  }, [state, router, onClose]);

  const amount =
    lead?.estimatedValueCents === null || lead?.estimatedValueCents === undefined
      ? ""
      : (lead.estimatedValueCents / 100).toFixed(2);

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
        aria-label={editing ? "Editar lead" : "Nuevo lead"}
        className="sp-card co-glass w-full max-w-xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--sp-line)] px-5 py-4">
          <p className="sp-display text-base">{editing ? "Editar lead" : "Nuevo lead"}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-[var(--sp-muted)] hover:text-[var(--sp-ink)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form action={formAction} className="flex flex-col gap-5 p-5">
          {editing && <input type="hidden" name="leadId" value={lead.id} />}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <LeadField label="Nombre del contacto">
              <input
                name="contactName"
                required
                defaultValue={lead?.contactName ?? ""}
                className={LEAD_INPUT}
                autoComplete="off"
              />
            </LeadField>

            <LeadField label="Negocio o marca">
              <input
                name="business"
                defaultValue={lead?.business ?? ""}
                className={LEAD_INPUT}
                autoComplete="off"
              />
            </LeadField>

            <LeadField label="Canal de origen">
              <select
                name="source"
                defaultValue={lead?.source ?? "otro"}
                className={LEAD_INPUT}
              >
                {sourceOptions.map((source) => (
                  <option key={source} value={source}>
                    {LEAD_SOURCE_LABELS[source]}
                  </option>
                ))}
              </select>
            </LeadField>

            <LeadField label="Estado">
              <select
                name="status"
                value={status}
                onChange={(event) => setStatus(event.target.value as LeadStatus)}
                className={LEAD_INPUT}
              >
                {LEAD_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {LEAD_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </LeadField>

            {status === "perdido" && (
              <LeadField
                label="Motivo de la pérdida"
                help="Sin motivo no se guarda: a tres meses es el dato más útil del módulo."
              >
                <select
                  name="lostReason"
                  required
                  defaultValue={lead?.lostReason ?? ""}
                  className={LEAD_INPUT}
                >
                  <option value="" disabled>
                    Elegí un motivo
                  </option>
                  {LEAD_LOST_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {LEAD_LOST_REASON_LABELS[reason]}
                    </option>
                  ))}
                </select>
              </LeadField>
            )}

            <LeadField label="Mail">
              <input
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onBlur={checkDuplicates}
                className={LEAD_INPUT}
                autoComplete="off"
              />
            </LeadField>

            <LeadField label="Instagram" help="El handle, sin el arroba.">
              <input
                name="instagram"
                value={instagram}
                onChange={(event) => setInstagram(event.target.value)}
                onBlur={checkDuplicates}
                className={LEAD_INPUT}
                autoComplete="off"
              />
            </LeadField>

            <LeadField label="WhatsApp">
              <input
                name="whatsapp"
                defaultValue={lead?.whatsapp ?? ""}
                className={LEAD_INPUT}
                autoComplete="off"
              />
            </LeadField>

            <LeadField label="Sitio web">
              <input
                name="website"
                defaultValue={lead?.website ?? ""}
                className={LEAD_INPUT}
                autoComplete="off"
              />
            </LeadField>

            <LeadField label="Valor estimado" help="Opcional. Dejalo vacío si todavía no hay número.">
              <input
                name="estimatedValue"
                inputMode="decimal"
                defaultValue={amount}
                className={LEAD_INPUT}
                autoComplete="off"
              />
            </LeadField>

            <LeadField label="Moneda">
              <select
                name="currency"
                defaultValue={lead?.currency ?? DEFAULT_LEAD_CURRENCY}
                className={LEAD_INPUT}
              >
                {LEAD_CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {LEAD_CURRENCY_LABELS[currency]}
                  </option>
                ))}
              </select>
            </LeadField>

            <LeadField label="Primer contacto">
              <input
                name="firstContactAt"
                type="date"
                defaultValue={lead?.firstContactAt ?? today}
                className={LEAD_INPUT}
              />
            </LeadField>

            <LeadField label="Último contacto">
              <input
                name="lastContactAt"
                type="date"
                defaultValue={lead?.lastContactAt ?? ""}
                className={LEAD_INPUT}
              />
            </LeadField>

            {isActiveLeadStatus(status) && (
              <LeadField
                label="Próximo seguimiento"
                help="Sin fecha, el lead queda marcado como sin seguimiento en todas las vistas."
              >
                <input
                  name="nextFollowUpAt"
                  type="date"
                  defaultValue={lead?.nextFollowUpAt ?? ""}
                  className={LEAD_INPUT}
                />
              </LeadField>
            )}
          </div>

          <LeadField label="Notas">
            <textarea
              name="notes"
              rows={4}
              defaultValue={lead?.notes ?? ""}
              className={LEAD_INPUT}
            />
          </LeadField>

          {duplicates.length > 0 && (
            <div className="rounded-co-control flex flex-col gap-2 border border-[var(--sp-line-strong)] bg-[var(--sp-bone)] px-3 py-2.5">
              <p className="flex items-center gap-2 text-xs font-medium text-[var(--sp-warn)]">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Puede estar duplicado
              </p>
              {duplicates.map((match) => (
                <Link
                  key={match.href + match.label}
                  href={match.href}
                  className="text-xs text-[var(--sp-ink)] underline hover:text-[var(--sp-amber)]"
                >
                  {match.label}
                </Link>
              ))}
              <p className="text-[11px] text-[var(--sp-muted)]">
                Es sólo un aviso: podés guardar igual.
              </p>
            </div>
          )}

          {state?.error && <p className="text-sm text-[var(--sp-crit)]">{state.error}</p>}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="sp-btn-gold inline-flex min-h-11 items-center px-5 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear lead"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="sp-pill inline-flex min-h-11 items-center border border-[var(--sp-line-strong)] px-5 py-2 text-sm font-medium text-[var(--sp-muted)] hover:border-[var(--sp-gold)] hover:text-[var(--sp-amber)]"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Botón primario del listado. Mismo tono que "+ Crear proyecto". */
export function NewLeadButton({ today }: { today: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="sp-btn-gold inline-flex min-h-11 items-center gap-2 px-5 py-2 text-sm font-medium"
      >
        <Plus className="h-4 w-4" />
        Nuevo lead
      </button>
      {open && <LeadDialog lead={null} today={today} onClose={close} />}
    </>
  );
}
