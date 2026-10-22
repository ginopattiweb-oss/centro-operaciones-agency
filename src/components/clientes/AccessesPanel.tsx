"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { deleteAccess, saveAccess } from "@/lib/actions/clientes";
import { ACCESS_TYPES, ACCESS_TYPE_LABELS } from "@/lib/access-types";
import type { AccessType } from "@/db/schema";

export type AdminAccessView = {
  id: string;
  label: string;
  type: AccessType;
  typeLabel: string;
  url: string | null;
  username: string | null;
  secret: string | null;
  notes: string | null;
};

export function AccessesPanel({
  clientProjectId,
  accesses,
}: {
  clientProjectId: string;
  accesses: AdminAccessView[];
}) {
  const [state, formAction, saving] = useActionState(saveAccess, null);
  const [editing, setEditing] = useState<AdminAccessView | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (state?.success) {
      setShowForm(false);
      setEditing(null);
    }
  }, [state]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg text-fg">Accesos</h2>
          <p className="mt-1 text-xs text-fg-muted">
            Las contraseñas se guardan cifradas y el cliente las ve en su portal.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowForm((v) => !v || editing !== null);
          }}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-fg-muted hover:text-fg"
        >
          <Plus className="h-4 w-4" /> Nuevo acceso
        </button>
      </div>

      {(showForm || editing) && (
        <form
          key={editing?.id ?? "new"}
          action={formAction}
          className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5"
        >
          <input type="hidden" name="clientProjectId" value={clientProjectId} />
          {editing && <input type="hidden" name="id" value={editing.id} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <Labeled label="Nombre del acceso">
              <input
                name="label"
                required
                defaultValue={editing?.label ?? ""}
                placeholder="Ej: Panel de WordPress"
                className={inputClass}
              />
            </Labeled>
            <Labeled label="Tipo">
              <select name="type" defaultValue={editing?.type ?? "otro"} className={inputClass}>
                {ACCESS_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {ACCESS_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </Labeled>
            <Labeled label="URL">
              <input
                name="url"
                type="url"
                defaultValue={editing?.url ?? ""}
                placeholder="https://..."
                className={inputClass}
              />
            </Labeled>
            <Labeled label="Usuario">
              <input name="username" defaultValue={editing?.username ?? ""} className={inputClass} />
            </Labeled>
            <Labeled
              label="Contraseña"
              help={editing ? "Dejalo vacío para no cambiarla." : undefined}
            >
              <input name="secret" type="text" autoComplete="off" className={inputClass} />
            </Labeled>
            <Labeled label="Notas para el cliente">
              <input name="notes" defaultValue={editing?.notes ?? ""} className={inputClass} />
            </Labeled>
          </div>

          {state?.error && <p className="text-sm text-accent-ink">{state.error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:brightness-110 disabled:opacity-50"
            >
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear acceso"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
              className="rounded-lg border border-border px-4 py-2 text-sm text-fg-muted hover:text-fg"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {accesses.length === 0 ? (
        <p className="text-sm text-fg-muted">Sin accesos cargados.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          {accesses.map((access) => (
            <AccessRow
              key={access.id}
              access={access}
              pending={pending}
              onEdit={() => {
                setEditing(access);
                setShowForm(true);
              }}
              onDelete={() => {
                if (!confirm(`¿Eliminar el acceso "${access.label}"?`)) return;
                startTransition(async () => {
                  await deleteAccess(access.id);
                });
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function AccessRow({
  access,
  pending,
  onEdit,
  onDelete,
}: {
  access: AdminAccessView;
  pending: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg">
          {access.label}
          <span className="ml-2 text-xs text-fg-muted">{access.typeLabel}</span>
        </p>
        <p className="mt-1 truncate text-xs text-fg-muted">
          {access.username ?? "sin usuario"} ·{" "}
          <span className="font-mono">
            {access.secret ? (revealed ? access.secret : "••••••••") : "sin contraseña"}
          </span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        {access.secret && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? "Ocultar" : "Mostrar"}
            className="rounded-lg border border-border px-3 py-1.5 text-fg-muted hover:text-fg"
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg border border-border px-3 py-1.5 text-fg-muted hover:text-fg"
          aria-label="Editar"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onDelete}
          className="rounded-lg border border-border px-3 py-1.5 text-fg-muted hover:text-accent-ink disabled:opacity-50"
          aria-label="Eliminar"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent-ink";

function Labeled({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-fg">
      {label}
      {help && <span className="text-xs text-fg-muted">{help}</span>}
      {children}
    </label>
  );
}
