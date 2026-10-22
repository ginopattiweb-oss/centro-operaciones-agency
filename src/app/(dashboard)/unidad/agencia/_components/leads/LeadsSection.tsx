"use client";

import { useCallback, useMemo, useState } from "react";
import { Columns3, List, Search, SearchX, UserPlus } from "lucide-react";
import { formatShortDateStr } from "@/lib/date";
import {
  LEAD_SOURCE_LABELS,
  LEAD_SOURCES,
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
} from "@/lib/leads-config";
import { formatLeadMoney, type LeadRow } from "@/lib/leads";
import type { LeadSource, LeadStatus } from "@/db/schema";
import { EmptyState, SectionTitle } from "../ui";
import type { ExistingClient } from "../types";
import { FollowUpChip, LeadStatusPill } from "./ui";
import { NewLeadButton } from "./LeadDialog";
import { LeadDrawer } from "./LeadDrawer";
import { LeadsKanban } from "./LeadsKanban";
import { ConvertLeadDialog } from "./ConvertLeadDialog";
import { LostReasonDialog } from "./LostReasonDialog";

type FollowUpFilter = "todos" | "vencidos" | "semana" | "sin";

/**
 * Listado de leads: buscador, filtros y tabla. La lista llega ya resuelta y
 * ordenada del servidor (vencidos primero); el filtrado es en memoria porque es
 * el pipeline de una sola unidad. Arranca vacío hasta que se carga el primero.
 */
export function LeadsSection({
  leads,
  clients,
  today,
  weekEnd,
  openLeadId = null,
}: {
  leads: LeadRow[];
  /** Clientes del Portal, para vincular un lead ganado. */
  clients: ExistingClient[];
  /** Hoy en Buenos Aires, calculado en el servidor para que el filtro no dependa del reloj del navegador. */
  today: string;
  /** Domingo de la semana en curso. */
  weekEnd: string;
  /** Lead a abrir de entrada, desde `?lead=<id>`. */
  openLeadId?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LeadStatus | "todos">("todos");
  const [source, setSource] = useState<LeadSource | "todos">("todos");
  const [followUp, setFollowUp] = useState<FollowUpFilter>("todos");
  const [showArchived, setShowArchived] = useState(false);
  const [view, setView] = useState<"tabla" | "kanban">("tabla");
  const [openId, setOpenId] = useState<string | null>(openLeadId);
  // Ganar o perder desde el kanban no es un cambio de estado a secas: cada uno
  // tiene su flujo (vincular cliente, pedir el motivo).
  const [winning, setWinning] = useState<LeadRow | null>(null);
  const [losing, setLosing] = useState<LeadRow | null>(null);

  const closeDrawer = useCallback(() => setOpenId(null), []);
  const closeWin = useCallback(() => setWinning(null), []);
  const closeLoss = useCallback(() => setLosing(null), []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (lead.archived !== showArchived) return false;
      if (
        needle &&
        !lead.contactName.toLowerCase().includes(needle) &&
        !(lead.business ?? "").toLowerCase().includes(needle)
      ) {
        return false;
      }
      if (status !== "todos" && lead.status !== status) return false;
      if (source !== "todos" && lead.source !== source) return false;
      if (followUp === "vencidos" && lead.followUp !== "vencido") return false;
      if (followUp === "sin" && lead.followUp !== "sin") return false;
      if (
        followUp === "semana" &&
        !(lead.nextFollowUpAt && lead.nextFollowUpAt >= today && lead.nextFollowUpAt <= weekEnd)
      ) {
        return false;
      }
      return true;
    });
  }, [leads, query, status, source, followUp, showArchived, today, weekEnd]);

  const open = openId ? (leads.find((lead) => lead.id === openId) ?? null) : null;

  return (
    <section className="flex flex-col gap-5">
      <SectionTitle action={<NewLeadButton today={today} />}>Leads</SectionTitle>

      {leads.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="h-6 w-6" />}
          title="Todavía no hay leads"
          detail="Cargá el primero. Lo único obligatorio es el nombre del contacto: el resto se completa cuando aparezca."
          action={<NewLeadButton today={today} />}
        />
      ) : (
        <>
          <div className="sp-card flex flex-col gap-4 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="rounded-co-control flex min-w-[220px] flex-1 items-center gap-2 border border-[var(--sp-line-strong)] px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-[var(--sp-muted)]" />
                <span className="sr-only">Buscar leads</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por contacto o negocio"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--sp-muted)]"
                />
              </label>

              <div className="flex items-center gap-1.5">
                <ViewToggle
                  active={view === "tabla"}
                  onClick={() => setView("tabla")}
                  label="Tabla"
                >
                  <List className="h-4 w-4" />
                </ViewToggle>
                <ViewToggle
                  active={view === "kanban"}
                  onClick={() => setView("kanban")}
                  label="Kanban"
                >
                  <Columns3 className="h-4 w-4" />
                </ViewToggle>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Select label="Estado" value={status} onChange={(v) => setStatus(v as typeof status)}>
                <option value="todos">Todos</option>
                {LEAD_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {LEAD_STATUS_LABELS[value]}
                  </option>
                ))}
              </Select>

              <Select label="Canal" value={source} onChange={(v) => setSource(v as typeof source)}>
                <option value="todos">Todos</option>
                {LEAD_SOURCES.map((value) => (
                  <option key={value} value={value}>
                    {LEAD_SOURCE_LABELS[value]}
                  </option>
                ))}
              </Select>

              <Select
                label="Seguimiento"
                value={followUp}
                onChange={(v) => setFollowUp(v as FollowUpFilter)}
              >
                <option value="todos">Todos</option>
                <option value="vencidos">Vencidos</option>
                <option value="semana">Esta semana</option>
                <option value="sin">Sin seguimiento</option>
              </Select>

              <Select
                label="Archivados"
                value={showArchived ? "si" : "no"}
                onChange={(v) => setShowArchived(v === "si")}
              >
                <option value="no">Ocultos</option>
                <option value="si">Ver archivados</option>
              </Select>
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={<SearchX className="h-6 w-6" />}
              title="Sin resultados"
              detail={
                showArchived
                  ? "Ningún lead archivado coincide con la búsqueda y los filtros aplicados."
                  : "Ningún lead coincide con la búsqueda y los filtros aplicados."
              }
            />
          ) : (
            <>
              {view === "kanban" ? (
                <LeadsKanban
                  leads={visible}
                  onOpen={setOpenId}
                  onWin={setWinning}
                  onLose={setLosing}
                />
              ) : (
                <>
                  <LeadsTable leads={visible} onOpen={setOpenId} />
                  <LeadsCards leads={visible} onOpen={setOpenId} />
                </>
              )}
            </>
          )}
        </>
      )}

      {open && (
        <LeadDrawer lead={open} clients={clients} today={today} onClose={closeDrawer} />
      )}
      {winning && (
        <ConvertLeadDialog lead={winning} clients={clients} onClose={closeWin} />
      )}
      {losing && <LostReasonDialog lead={losing} onClose={closeLoss} />}
    </section>
  );
}

/** Vista de escritorio. En pantallas chicas la reemplazan las tarjetas apiladas. */
function LeadsTable({
  leads,
  onOpen,
}: {
  leads: LeadRow[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="sp-card hidden overflow-x-auto md:block">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--sp-line)] text-left">
            <Th>Contacto</Th>
            <Th>Negocio</Th>
            <Th>Canal</Th>
            <Th>Estado</Th>
            <Th>Último contacto</Th>
            <Th>Próximo seguimiento</Th>
            <Th align="right">Valor estimado</Th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr
              key={lead.id}
              onClick={() => onOpen(lead.id)}
              className="cursor-pointer border-b border-[var(--sp-line)] last:border-b-0 hover:bg-[color-mix(in_srgb,var(--sp-gold)_7%,var(--sp-surface))]"
            >
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpen(lead.id);
                  }}
                  className="sp-display text-left text-sm hover:text-[var(--sp-amber)]"
                >
                  {lead.contactName}
                </button>
              </td>
              <td className="px-4 py-3 text-[var(--sp-muted)]">{lead.business ?? "—"}</td>
              <td className="px-4 py-3 text-[var(--sp-muted)]">
                {LEAD_SOURCE_LABELS[lead.source]}
              </td>
              <td className="px-4 py-3">
                <LeadStatusPill status={lead.status} />
              </td>
              <td className="px-4 py-3 text-[var(--sp-muted)]">
                {lead.lastContactAt ? formatShortDateStr(lead.lastContactAt) : "—"}
              </td>
              <td className="px-4 py-3">
                <FollowUpChip state={lead.followUp} date={lead.nextFollowUpAt} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {lead.estimatedValueCents === null
                  ? "—"
                  : formatLeadMoney(lead.estimatedValueCents, lead.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Misma información que la tabla, apilada, para 360px de ancho. */
function LeadsCards({ leads, onOpen }: { leads: LeadRow[]; onOpen: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-px bg-[var(--sp-line)] md:hidden">
      {leads.map((lead) => (
        <button
          key={lead.id}
          type="button"
          onClick={() => onOpen(lead.id)}
          className="flex flex-col gap-3 bg-[var(--sp-surface)] p-4 text-left"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="sp-display text-base leading-tight break-words">{lead.contactName}</p>
              <p className="mt-1 text-xs text-[var(--sp-muted)]">
                {lead.business ?? "Sin negocio"} · {LEAD_SOURCE_LABELS[lead.source]}
              </p>
            </div>
            <LeadStatusPill status={lead.status} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <FollowUpChip state={lead.followUp} date={lead.nextFollowUpAt} />
            <span className="text-xs tabular-nums text-[var(--sp-muted)]">
              {lead.estimatedValueCents === null
                ? "Sin cotizar"
                : formatLeadMoney(lead.estimatedValueCents, lead.currency)}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      className={`sp-display px-4 py-3 text-[10px] font-medium text-[var(--sp-muted)] ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="sp-display text-[10px] text-[var(--sp-muted)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-co-control border border-[var(--sp-line-strong)] bg-[var(--sp-bone)] px-3 py-1.5 text-xs text-[var(--sp-ink)]"
      >
        {children}
      </select>
    </label>
  );
}

function ViewToggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center border"
      style={
        active
          ? { background: "var(--sp-chip-active)", borderColor: "var(--sp-line-strong)", color: "var(--sp-ink)" }
          : {
              background: "transparent",
              borderColor: "var(--sp-line-strong)",
              color: "var(--sp-muted)",
            }
      }
    >
      {children}
    </button>
  );
}
