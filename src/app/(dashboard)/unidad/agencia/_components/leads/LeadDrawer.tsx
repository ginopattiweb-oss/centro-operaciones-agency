"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  AtSign,
  ExternalLink,
  Globe,
  Mail,
  MessageCircle,
  Pencil,
  X,
} from "lucide-react";
import {
  setLeadArchived,
  setLeadFollowUp,
  setLeadStatus,
  updateLeadNotes,
} from "@/lib/actions/leads";
import { formatFullDateStr } from "@/lib/date";
import { PORTAL_UNIDAD_SLUG } from "@/lib/portal-config";
import { FollowUpQuickPicks } from "@/components/leads/FollowUpQuickPicks";
import {
  isActiveLeadStatus,
  LEAD_LOST_REASON_LABELS,
  LEAD_LOST_REASONS,
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
} from "@/lib/leads-config";
import {
  formatLeadMoney,
  instagramUrl,
  leadWhatsappUrl,
  type LeadRow,
} from "@/lib/leads";
import type { LeadStatus } from "@/db/schema";
import type { ExistingClient } from "../types";
import { LEAD_INPUT, FollowUpChip, LeadStatusPill } from "./ui";
import { useOverlay } from "@/components/overlay";
import { LeadDialog } from "./LeadDialog";
import { LeadTimeline } from "./LeadTimeline";
import { ConvertLeadDialog } from "./ConvertLeadDialog";

/**
 * Detalle del lead: panel lateral sobre el listado, no una página aparte.
 * Todo lo que se puede tocar sin abrir el formulario está acá: estado, próximo
 * seguimiento, notas, archivar y los accesos directos para escribirle.
 */
export function LeadDrawer({
  lead,
  clients,
  today,
  onClose,
}: {
  lead: LeadRow;
  /** Clientes del Portal, para vincular el lead cuando se gana. */
  clients: ExistingClient[];
  today: string;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const closeEditor = useCallback(() => setEditing(false), []);

  useOverlay(panelRef, onClose);

  const whatsapp = lead.whatsapp ? leadWhatsappUrl(lead.whatsapp) : null;

  return (
    <>
      <div className="fixed inset-0 z-40 flex justify-end">
        <div className="co-scrim absolute inset-0" onClick={onClose} />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Lead: ${lead.contactName}`}
          className="co-glass relative flex h-full w-full max-w-md flex-col gap-6 overflow-y-auto border-l p-5 md:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="sp-display text-xl leading-tight break-words">{lead.contactName}</p>
              <p className="mt-1 text-sm text-[var(--sp-muted)]">
                {lead.business ?? "Sin negocio cargado"} · {LEAD_SOURCE_LABELS[lead.source]}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="shrink-0 text-[var(--sp-muted)] hover:text-[var(--sp-ink)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <StatusEditor lead={lead} clients={clients} today={today} />

          <Section title="Contacto">
            {lead.email || whatsapp || lead.instagram || lead.website ? (
              <div className="flex flex-col gap-1.5">
                {lead.email && (
                  <ContactLink href={`mailto:${lead.email}`} icon={<Mail className="h-4 w-4" />}>
                    {lead.email}
                  </ContactLink>
                )}
                {whatsapp && (
                  <ContactLink href={whatsapp} icon={<MessageCircle className="h-4 w-4" />} external>
                    {lead.whatsapp}
                  </ContactLink>
                )}
                {lead.instagram && (
                  <ContactLink
                    href={instagramUrl(lead.instagram)}
                    icon={<AtSign className="h-4 w-4" />}
                    external
                  >
                    @{lead.instagram}
                  </ContactLink>
                )}
                {lead.website && (
                  <ContactLink
                    href={lead.website}
                    icon={<Globe className="h-4 w-4" />}
                    external
                  >
                    {lead.website.replace(/^https?:\/\//, "")}
                  </ContactLink>
                )}
              </div>
            ) : (
              <p className="text-sm text-[var(--sp-muted)]">Sin datos de contacto cargados.</p>
            )}
          </Section>

          {(lead.location || lead.payloadExtras.length > 0) && (
            <Section title="Datos del formulario">
              <dl className="flex flex-col gap-2 text-sm">
                {lead.location && <Row label="Ubicación">{lead.location}</Row>}
                {lead.payloadExtras.map((extra) => (
                  <Row key={extra.label} label={extra.label}>
                    <span className="whitespace-pre-line">{extra.value}</span>
                  </Row>
                ))}
              </dl>
            </Section>
          )}

          <Section title="Seguimiento">
            <dl className="flex flex-col gap-2 text-sm">
              <Row label="Primer contacto">{formatFullDateStr(lead.firstContactAt)}</Row>
              <Row label="Último contacto">
                {lead.lastContactAt
                  ? `${formatFullDateStr(lead.lastContactAt)}${
                      lead.daysSinceContact !== null && lead.daysSinceContact > 0
                        ? ` · hace ${lead.daysSinceContact} día(s)`
                        : ""
                    }`
                  : "Todavía sin registrar"}
              </Row>
              <Row label="Próximo seguimiento">
                <FollowUpChip state={lead.followUp} date={lead.nextFollowUpAt} />
              </Row>
              <Row label="Valor estimado">
                {lead.estimatedValueCents === null
                  ? "Sin cotizar"
                  : formatLeadMoney(lead.estimatedValueCents, lead.currency)}
              </Row>
              {lead.status === "perdido" && lead.lostReason && (
                <Row label="Motivo de la pérdida">
                  {LEAD_LOST_REASON_LABELS[lead.lostReason]}
                </Row>
              )}
            </dl>

            {isActiveLeadStatus(lead.status) && <FollowUpEditor lead={lead} today={today} />}
          </Section>

          {lead.clientProjectId && (
            <Section title="Cliente vinculado">
              <Link
                href={`/unidad/${PORTAL_UNIDAD_SLUG}/proyecto/${lead.clientProjectId}`}
                className="sp-card sp-hover-glow flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <span className="truncate">{lead.clientName ?? "Cliente"}</span>
                <ExternalLink className="h-4 w-4 shrink-0 text-[var(--sp-muted)]" />
              </Link>
            </Section>
          )}

          <Section title="Historial">
            <LeadTimeline leadId={lead.id} interactions={lead.interactions} today={today} />
          </Section>

          <Section title="Notas">
            <NotesEditor leadId={lead.id} value={lead.notes ?? ""} />
          </Section>

          <Footer lead={lead} onEdit={() => setEditing(true)} onClose={onClose} />
        </div>
      </div>

      {editing && <LeadDialog lead={lead} today={today} onClose={closeEditor} />}
    </>
  );
}

/**
 * Cambio de estado. Elegir uno abre el mismo diálogo donde se resuelve lo que
 * ese cambio arrastra: el motivo si se perdió, o el próximo seguimiento si
 * sigue abierto. El seguimiento se ofrece, no se obliga.
 */
function StatusEditor({
  lead,
  clients,
  today,
}: {
  lead: LeadRow;
  clients: ExistingClient[];
  today: string;
}) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<LeadStatus | null>(null);
  const [reason, setReason] = useState("");
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const closeConversion = useCallback(() => setConverting(false), []);
  const router = useRouter();

  function cancel() {
    setDraft(null);
    setReason("");
    setFollowUp(null);
    setError(null);
  }

  function onPick(status: LeadStatus) {
    if (status === lead.status) return cancel();
    // Ganar un lead no es sólo cambiar el estado: hay que decidir a qué cliente va.
    if (status === "ganado") {
      cancel();
      setConverting(true);
      return;
    }
    setDraft(status);
    setReason(lead.lostReason ?? "");
    setFollowUp(lead.nextFollowUpAt);
    setError(null);
  }

  function save() {
    if (!draft) return;
    startTransition(async () => {
      try {
        await setLeadStatus(lead.id, draft, draft === "perdido" ? reason : null, followUp);
        cancel();
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No se pudo guardar el cambio.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {converting && (
        <ConvertLeadDialog lead={lead} clients={clients} onClose={closeConversion} />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <LeadStatusPill status={lead.status} />
        <label className="flex items-center gap-2">
          <span className="sr-only">Cambiar estado</span>
          <select
            value={converting ? "ganado" : (draft ?? lead.status)}
            disabled={pending}
            onChange={(event) => onPick(event.target.value as LeadStatus)}
            className="rounded-co-control border border-[var(--sp-line-strong)] bg-[var(--sp-bone)] px-3 py-1.5 text-xs text-[var(--sp-ink)] disabled:opacity-50"
          >
            {LEAD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {LEAD_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {draft && (
        <div className="sp-card flex flex-col gap-4 p-4">
          <p className="sp-display text-[11px] text-[var(--sp-muted)]">
            Pasar a {LEAD_STATUS_LABELS[draft]}
          </p>

          {draft === "perdido" ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[var(--sp-muted)]">Motivo de la pérdida</span>
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
          ) : isActiveLeadStatus(draft) ? (
            <div className="flex flex-col gap-2">
              <span className="text-xs text-[var(--sp-muted)]">
                Próximo seguimiento (opcional)
              </span>
              <FollowUpQuickPicks
                today={today}
                value={followUp}
                onPick={setFollowUp}
                disabled={pending}
                allowClear
              />
            </div>
          ) : (
            <p className="text-xs text-[var(--sp-muted)]">
              El lead queda cerrado y sale del radar de seguimientos.
            </p>
          )}

          <p className="text-[11px] text-[var(--sp-muted)]">
            Se registra el contacto de hoy como último contacto.
          </p>

          {error && <p className="text-sm text-[var(--sp-crit)]">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || (draft === "perdido" && !reason)}
              onClick={save}
              className="sp-btn-gold inline-flex min-h-11 items-center px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {pending ? "Guardando..." : `Pasar a ${LEAD_STATUS_LABELS[draft]}`}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="sp-pill inline-flex min-h-11 items-center border border-[var(--sp-line-strong)] px-4 py-2 text-sm font-medium text-[var(--sp-muted)] hover:border-[var(--sp-gold)] hover:text-[var(--sp-amber)]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Agendar el próximo seguimiento sin tocar el estado. */
function FollowUpEditor({ lead, today }: { lead: LeadRow; today: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function pick(date: string | null) {
    startTransition(async () => {
      await setLeadFollowUp(lead.id, date);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 border-t border-[var(--sp-line)] pt-3">
      <span className="text-xs text-[var(--sp-muted)]">
        {lead.nextFollowUpAt ? "Reagendar seguimiento" : "Agendar seguimiento"}
      </span>
      <FollowUpQuickPicks
        today={today}
        value={lead.nextFollowUpAt}
        onPick={pick}
        disabled={pending}
        allowClear
      />
    </div>
  );
}

/** Notas con guardado automático: se guarda solo cuando dejás de tipear. */
function NotesEditor({ leadId, value }: { leadId: string; value: string }) {
  const [text, setText] = useState(value);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const saveRef = useRef(value);

  useEffect(() => {
    setText(value);
    saveRef.current = value;
  }, [value, leadId]);

  useEffect(() => {
    if (text === saveRef.current) return;
    const timer = setTimeout(() => {
      saveRef.current = text;
      startTransition(async () => {
        await updateLeadNotes(leadId, text);
        setSaved(true);
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [text, leadId]);

  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setSaved(false);
        }}
        rows={5}
        aria-label="Notas del lead"
        placeholder="Lo que haya que recordar de este lead."
        className={LEAD_INPUT}
      />
      <span className="text-[11px] text-[var(--sp-muted)]">
        {pending ? "Guardando..." : saved ? "Guardado." : "Se guarda solo."}
      </span>
    </div>
  );
}

function Footer({
  lead,
  onEdit,
  onClose,
}: {
  lead: LeadRow;
  onEdit: () => void;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggleArchive() {
    startTransition(async () => {
      await setLeadArchived(lead.id, !lead.archived);
      router.refresh();
      if (!lead.archived) onClose();
    });
  }

  return (
    <div className="mt-auto flex flex-wrap gap-2 border-t border-[var(--sp-line)] pt-5">
      <button
        type="button"
        onClick={onEdit}
        className="sp-pill inline-flex min-h-11 items-center gap-2 border border-[var(--sp-line-strong)] px-4 py-2 text-sm font-medium hover:border-[var(--sp-gold)] hover:text-[var(--sp-amber)]"
      >
        <Pencil className="h-4 w-4" />
        Editar
      </button>
      <button
        type="button"
        onClick={toggleArchive}
        disabled={pending}
        className="sp-pill inline-flex min-h-11 items-center gap-2 border border-[var(--sp-line-strong)] px-4 py-2 text-sm font-medium text-[var(--sp-muted)] hover:border-[var(--sp-gold)] hover:text-[var(--sp-amber)] disabled:opacity-50"
      >
        {lead.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
        {lead.archived ? "Desarchivar" : "Archivar"}
      </button>
      <p className="w-full text-[11px] text-[var(--sp-muted)]">
        Archivar no borra nada: el lead sale de las vistas por defecto y se puede recuperar.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="sp-display text-[11px] text-[var(--sp-muted)]">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <dt className="text-xs text-[var(--sp-muted)]">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function ContactLink({
  href,
  icon,
  external = false,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  external?: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="inline-flex items-center gap-2 text-sm text-[var(--sp-ink)] hover:text-[var(--sp-amber)]"
    >
      <span className="text-[var(--sp-muted)]">{icon}</span>
      <span className="truncate">{children}</span>
    </a>
  );
}
