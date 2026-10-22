"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { createDeliverable, deleteDeliverable } from "@/lib/actions/clientes";

export type DeliverableView = {
  id: string;
  title: string;
  description: string | null;
  url: string;
  kind: "link" | "archivo";
  createdAt: string;
};

export function DeliverablesPanel({
  clientProjectId,
  items,
}: {
  clientProjectId: string;
  items: DeliverableView[];
}) {
  const [state, formAction, saving] = useActionState(createDeliverable, null);
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (state?.success) setShowForm(false);
  }, [state]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg text-fg">Entregables</h2>
          <p className="mt-1 text-xs text-fg-muted">
            Publicá links a Drive, Figma, documentos o archivos. El cliente los ve en su portal.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-fg-muted hover:text-fg"
        >
          <Plus className="h-4 w-4" /> Nuevo entregable
        </button>
      </div>

      {showForm && (
        <form
          action={formAction}
          className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5"
        >
          <input type="hidden" name="clientProjectId" value={clientProjectId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm text-fg">
              Título
              <input name="title" required className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-fg">
              Tipo
              <select name="kind" defaultValue="link" className={inputClass}>
                <option value="link">Link</option>
                <option value="archivo">Archivo</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-fg sm:col-span-2">
              URL
              <input
                name="url"
                type="url"
                required
                placeholder="https://..."
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-fg sm:col-span-2">
              Descripción
              <input name="description" className={inputClass} />
            </label>
          </div>

          {state?.error && <p className="text-sm text-accent-ink">{state.error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:brightness-110 disabled:opacity-50"
            >
              {saving ? "Publicando..." : "Publicar"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm text-fg-muted hover:text-fg"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-fg-muted">Sin entregables publicados.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg">{item.title}</p>
                <p className="mt-1 truncate text-xs text-fg-muted">
                  {item.kind} · {item.createdAt}
                  {item.description ? ` · ${item.description}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-lg border border-border px-3 py-1.5 text-fg-muted hover:text-fg"
                  aria-label="Abrir"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(`¿Eliminar "${item.title}"?`)) return;
                    startTransition(async () => {
                      await deleteDeliverable(item.id);
                    });
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 text-fg-muted hover:text-accent-ink disabled:opacity-50"
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent-ink";
