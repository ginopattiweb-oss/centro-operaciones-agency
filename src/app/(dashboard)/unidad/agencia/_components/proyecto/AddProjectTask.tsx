"use client";

import { useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { crearTarea } from "@/lib/actions/tasks";

/**
 * Alta rápida de tarea del proyecto. Queda atada a la unidad y a este cliente, y
 * cae en la bandeja: pasarla a hoy es una decisión aparte, desde Tareas.
 */
export function AddProjectTask({
  unidadProjectId,
  clientProjectId,
}: {
  unidadProjectId: string;
  clientProjectId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const title = String(data.get("title") ?? "").trim();
        if (!title) return;

        setError(null);
        startTransition(async () => {
          try {
            await crearTarea({
              title,
              projectId: unidadProjectId,
              clientProjectId,
              priority: data.get("prioridadAlta") ? "alta" : "normal",
            });
            formRef.current?.reset();
          } catch (cause) {
            setError((cause as Error).message);
          }
        });
      }}
      className="flex flex-wrap items-end gap-3 border-t border-[var(--sp-line)] px-5 py-4"
    >
      <label className="flex min-w-[200px] flex-1 flex-col gap-1.5">
        <span className="sp-display text-[10px] text-[var(--sp-muted)]">Nueva tarea</span>
        <input
          name="title"
          required
          className="rounded-co-control w-full border border-[var(--sp-line-strong)] bg-[var(--sp-bone)] px-3 py-2 text-sm"
          autoComplete="off"
        />
      </label>

      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="prioridadAlta" className="h-4 w-4" />
        Prioridad alta
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="sp-btn-gold inline-flex min-h-11 items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        Agregar
      </button>

      {error && <p className="w-full text-sm text-[var(--sp-crit)]">{error}</p>}
    </form>
  );
}
