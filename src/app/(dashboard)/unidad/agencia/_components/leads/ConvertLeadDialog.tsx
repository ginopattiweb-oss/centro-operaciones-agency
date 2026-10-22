"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Search, X } from "lucide-react";
import { convertLeadToClient } from "@/lib/actions/leads";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS } from "@/lib/proyecto-estados";
import type { LeadRow } from "@/lib/leads";
import type { ExistingClient } from "../types";
import { LEAD_INPUT, LeadField } from "./ui";
import { useOverlay } from "@/components/overlay";

/**
 * Cierre de un lead ganado. Dos caminos: dar de alta el cliente con los datos
 * del lead, o vincularlo a uno que ya existe.
 *
 * En este sistema cliente ≡ proyecto ≡ portal son la misma fila, así que el alta
 * ya crea el proyecto con su briefing vacío y el portal apagado: no hay un paso
 * aparte para crearlo. El lead queda en 'ganado' y vinculado, nunca se borra.
 */
export function ConvertLeadDialog({
  lead,
  clients,
  onClose,
}: {
  lead: LeadRow;
  clients: ExistingClient[];
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"nuevo" | "existente">(
    lead.clientProjectId ? "existente" : "nuevo"
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>(lead.clientProjectId ?? "");
  const [state, formAction, saving] = useActionState(convertLeadToClient, null);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useOverlay(panelRef, onClose);

  useEffect(() => {
    if (!state?.success) return;
    router.refresh();
    onClose();
  }, [state, router, onClose]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = needle
      ? clients.filter((client) => client.name.toLowerCase().includes(needle))
      : clients;
    return list.slice(0, 8);
  }, [clients, query]);

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
        aria-label="Marcar lead como ganado"
        className="sp-card co-glass w-full max-w-lg"
      >
        <div className="flex items-center justify-between border-b border-[var(--sp-line)] px-5 py-4">
          <p className="sp-display text-base">Lead ganado</p>
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
          <input type="hidden" name="leadId" value={lead.id} />
          <input type="hidden" name="mode" value={mode} />
          {mode === "existente" && (
            <input type="hidden" name="clientProjectId" value={selected} />
          )}

          <div className="flex flex-col gap-2">
            <span className="sp-display text-[11px] text-[var(--sp-muted)]">Cliente</span>
            <div className="flex flex-wrap gap-1.5">
              <ModeChip active={mode === "nuevo"} onClick={() => setMode("nuevo")}>
                Es un cliente nuevo
              </ModeChip>
              <ModeChip
                active={mode === "existente"}
                onClick={() => setMode("existente")}
                disabled={clients.length === 0}
              >
                Ya es cliente
              </ModeChip>
            </div>
          </div>

          {mode === "nuevo" ? (
            <>
              <LeadField
                label="Nombre del cliente / proyecto"
                help="Viene del negocio del lead. Cambialo si el nombre real es otro."
              >
                <input
                  name="clientName"
                  required
                  defaultValue={lead.business ?? lead.contactName}
                  className={LEAD_INPUT}
                  autoComplete="off"
                />
              </LeadField>

              <LeadField label="Servicio">
                <input name="service" className={LEAD_INPUT} autoComplete="off" />
              </LeadField>

              <LeadField label="Estado inicial del proyecto">
                <select name="projectStatus" defaultValue="briefing" className={LEAD_INPUT}>
                  {PROJECT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {PROJECT_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </LeadField>

              <p className="rounded-co-control border border-[var(--sp-line)] bg-[var(--sp-bone)] px-3 py-2 text-xs text-[var(--sp-muted)]">
                Cliente y proyecto son la misma ficha: se crea con el portal{" "}
                <strong>apagado</strong> y el briefing vacío. El lead queda en Ganado y
                vinculado, visible desde la ficha del cliente.
              </p>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <label className="rounded-co-control flex items-center gap-2 border border-[var(--sp-line-strong)] px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-[var(--sp-muted)]" />
                <span className="sr-only">Buscar cliente</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar cliente del Portal"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--sp-muted)]"
                />
              </label>

              {matches.length === 0 ? (
                <p className="text-sm text-[var(--sp-muted)]">
                  Ningún cliente coincide con la búsqueda.
                </p>
              ) : (
                <ul className="flex flex-col gap-px bg-[var(--sp-line)]">
                  {matches.map((client) => (
                    <li key={client.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(client.id)}
                        aria-pressed={selected === client.id}
                        className="flex w-full items-center justify-between gap-3 bg-[var(--sp-surface)] px-3 py-2.5 text-left text-sm hover:bg-[color-mix(in_srgb,var(--sp-gold)_10%,var(--sp-surface))]"
                      >
                        <span className="truncate">{client.name}</span>
                        {selected === client.id && (
                          <Check className="h-4 w-4 shrink-0 text-[var(--sp-pos)]" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {state?.error && <p className="text-sm text-[var(--sp-crit)]">{state.error}</p>}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving || (mode === "existente" && !selected)}
              className="sp-btn-gold inline-flex min-h-11 items-center px-5 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Marcar como ganado"}
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

function ModeChip({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="sp-pill inline-flex items-center border px-3.5 py-1.5 text-xs font-medium disabled:opacity-40"
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
