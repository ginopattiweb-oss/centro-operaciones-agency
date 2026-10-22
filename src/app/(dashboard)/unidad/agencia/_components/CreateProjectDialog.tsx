"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createProject } from "@/lib/actions/proyectos";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS } from "@/lib/proyecto-estados";
import type { ExistingClient } from "./types";

/**
 * Alta de proyecto. Cliente y proyecto son la misma entidad: "cliente nuevo"
 * lo crea en el Portal de clientes con el portal apagado y el briefing vacío;
 * "cliente existente" completa los datos de gestión de ese cliente.
 */
export function CreateProjectDialog({
  clients,
  people,
  services,
}: {
  clients: ExistingClient[];
  people: string[];
  services: string[];
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"nuevo" | "existente">("nuevo");
  const [state, formAction, saving] = useActionState(createProject, null);
  const router = useRouter();

  useEffect(() => {
    if (!state?.success) return;
    setOpen(false);
    router.refresh();
  }, [state, router]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="sp-btn-gold inline-flex min-h-11 items-center gap-2 px-5 py-2 text-sm font-medium"
      >
        <Plus className="h-4 w-4" />
        Crear proyecto
      </button>
    );
  }

  return (
    <div className="co-scrim fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 md:p-10">
      <div className="sp-card co-glass w-full max-w-lg">
        <div className="flex items-center justify-between border-b border-[var(--sp-line)] px-5 py-4">
          <p className="sp-display text-base">Crear proyecto</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
            className="text-[var(--sp-muted)] hover:text-[var(--sp-ink)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form action={formAction} className="flex flex-col gap-5 p-5">
          <input type="hidden" name="mode" value={mode} />

          <div className="flex flex-col gap-2">
            <span className="sp-display text-[11px] text-[var(--sp-muted)]">Cliente</span>
            <div className="flex flex-wrap gap-1.5">
              <ModeChip active={mode === "nuevo"} onClick={() => setMode("nuevo")}>
                Cliente nuevo
              </ModeChip>
              <ModeChip
                active={mode === "existente"}
                onClick={() => setMode("existente")}
                disabled={clients.length === 0}
              >
                Cliente existente
              </ModeChip>
            </div>
          </div>

          {mode === "existente" && (
            <Field label="Cliente del Portal">
              <select name="clientProjectId" required className={INPUT} defaultValue="">
                <option value="" disabled>
                  Elegí un cliente
                </option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field
            label={mode === "nuevo" ? "Nombre del cliente / proyecto" : "Nombre del proyecto"}
            help={
              mode === "nuevo"
                ? "Con este nombre se crea el cliente en el Portal y su proyecto."
                : "Vacío deja el nombre actual del cliente."
            }
          >
            <input
              name="name"
              required={mode === "nuevo"}
              className={INPUT}
              autoComplete="off"
            />
          </Field>

          <Field label="Servicio">
            <input name="service" list="sp-servicios" className={INPUT} autoComplete="off" />
            <datalist id="sp-servicios">
              {services.map((service) => (
                <option key={service} value={service} />
              ))}
            </datalist>
          </Field>

          <Field label="Responsable" help="Si el nombre no existe todavía, se crea la persona.">
            <input name="owner" list="sp-personas" className={INPUT} autoComplete="off" />
            <datalist id="sp-personas">
              {people.map((person) => (
                <option key={person} value={person} />
              ))}
            </datalist>
          </Field>

          <Field label="Estado inicial">
            <select name="status" defaultValue="briefing" className={INPUT}>
              {PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {PROJECT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </Field>

          <p className="rounded-co-control border border-[var(--sp-line)] bg-[var(--sp-bone)] px-3 py-2 text-xs text-[var(--sp-muted)]">
            Se crea el cliente en el Portal con el portal <strong>apagado</strong> y su briefing
            vacío. Documentos, accesos y tareas arrancan sin datos.
          </p>

          {state?.error && <p className="text-sm text-[var(--sp-crit)]">{state.error}</p>}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="sp-btn-gold inline-flex min-h-11 items-center px-5 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Creando..." : "Crear proyecto"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
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

const INPUT =
  "rounded-co-control w-full border border-[var(--sp-line-strong)] bg-[var(--sp-bone)] px-3 py-2 text-sm text-[var(--sp-ink)]";

function Field({
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
