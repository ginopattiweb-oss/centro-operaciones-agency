"use client";

import { useActionState } from "react";
import { updateProject } from "@/lib/actions/proyectos";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS } from "@/lib/proyecto-estados";
import type { ClientProjectStatus } from "@/db/schema";

const INPUT =
  "rounded-co-control w-full border border-[var(--sp-line-strong)] bg-[var(--sp-bone)] px-3 py-2 text-sm text-[var(--sp-ink)]";

/** Datos de gestión del proyecto. Todo editable; arranca con lo que haya cargado el usuario. */
export function ProjectMetaForm({
  clientProjectId,
  name,
  status,
  service,
  owner,
  notes,
  people,
  services,
}: {
  clientProjectId: string;
  name: string;
  status: ClientProjectStatus;
  service: string | null;
  owner: string | null;
  notes: string | null;
  people: string[];
  services: string[];
}) {
  const [state, formAction, saving] = useActionState(updateProject, null);

  return (
    <form action={formAction} className="sp-card flex flex-col gap-5 p-5 md:p-6">
      <input type="hidden" name="clientProjectId" value={clientProjectId} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Nombre">
          <input name="name" defaultValue={name} className={INPUT} autoComplete="off" />
        </Field>

        <Field label="Estado">
          <select name="status" defaultValue={status} className={INPUT}>
            {PROJECT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {PROJECT_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Servicio">
          <input
            name="service"
            defaultValue={service ?? ""}
            list="sp-servicios-detalle"
            className={INPUT}
            autoComplete="off"
          />
          <datalist id="sp-servicios-detalle">
            {services.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        </Field>

        <Field label="Responsable" help="Si el nombre no existe todavía, se crea la persona.">
          <input
            name="owner"
            defaultValue={owner ?? ""}
            list="sp-personas-detalle"
            className={INPUT}
            autoComplete="off"
          />
          <datalist id="sp-personas-detalle">
            {people.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        </Field>
      </div>

      <Field label="Notas del equipo">
        <textarea name="notes" defaultValue={notes ?? ""} rows={5} className={INPUT} />
      </Field>

      {state?.error && <p className="text-sm text-[var(--sp-crit)]">{state.error}</p>}
      {state?.success && <p className="text-sm text-[var(--sp-pos)]">{state.success}</p>}

      <button
        type="submit"
        disabled={saving}
        className="sp-btn-gold inline-flex min-h-11 w-fit items-center px-5 py-2 text-sm font-medium disabled:opacity-50"
      >
        {saving ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}

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
