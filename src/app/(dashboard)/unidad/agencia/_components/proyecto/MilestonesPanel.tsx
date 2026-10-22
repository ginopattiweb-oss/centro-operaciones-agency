"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { addMilestone, deleteMilestone, toggleMilestone } from "@/lib/actions/proyectos";
import { formatShortDateStr, todayStringBA } from "@/lib/date";

export type MilestoneRow = {
  id: string;
  title: string;
  dueDate: string | null;
  done: boolean;
};

/** Fases/hitos del proyecto. Arranca vacío: los carga el usuario. */
export function MilestonesPanel({
  clientProjectId,
  milestones,
}: {
  clientProjectId: string;
  milestones: MilestoneRow[];
}) {
  const [state, formAction, saving] = useActionState(addMilestone, null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const today = todayStringBA();

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <div className="sp-card flex flex-col">
      <div className="border-b border-[var(--sp-line)] px-5 py-4">
        <p className="sp-display text-sm text-[var(--sp-muted)]">Fases y hitos</p>
      </div>

      {milestones.length === 0 ? (
        <p className="px-5 py-6 text-sm text-[var(--sp-muted)]">
          Todavía no hay fases ni hitos cargados.
        </p>
      ) : (
        <ul className={`flex flex-col divide-y divide-[var(--sp-line)] ${isPending ? "opacity-60" : ""}`}>
          {milestones.map((milestone) => {
            const overdue = !milestone.done && milestone.dueDate && milestone.dueDate < today;
            return (
              <li key={milestone.id} className="flex items-center gap-3 px-5 py-3">
                <input
                  type="checkbox"
                  checked={milestone.done}
                  onChange={(event) => {
                    const done = event.target.checked;
                    startTransition(() => {
                      toggleMilestone(milestone.id, done);
                    });
                  }}
                  className="h-4 w-4"
                />
                <span
                  className={`flex-1 truncate text-sm ${
                    milestone.done ? "text-[var(--sp-muted)] line-through" : ""
                  }`}
                >
                  {milestone.title}
                </span>
                {milestone.dueDate && (
                  <span
                    className="text-xs tabular-nums"
                    style={{ color: overdue ? "var(--sp-crit)" : "var(--sp-muted)" }}
                  >
                    {formatShortDateStr(milestone.dueDate)}
                  </span>
                )}
                <button
                  type="button"
                  aria-label={`Borrar ${milestone.title}`}
                  onClick={() => startTransition(() => deleteMilestone(milestone.id))}
                  className="text-[var(--sp-muted)] hover:text-[var(--sp-crit)]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form
        ref={formRef}
        action={formAction}
        className="flex flex-wrap items-end gap-3 border-t border-[var(--sp-line)] px-5 py-4"
      >
        <input type="hidden" name="clientProjectId" value={clientProjectId} />
        <label className="flex min-w-[200px] flex-1 flex-col gap-1.5">
          <span className="sp-display text-[10px] text-[var(--sp-muted)]">Fase o hito</span>
          <input
            name="title"
            required
            className="rounded-co-control w-full border border-[var(--sp-line-strong)] bg-[var(--sp-bone)] px-3 py-2 text-sm"
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="sp-display text-[10px] text-[var(--sp-muted)]">Fecha</span>
          <input
            type="date"
            name="dueDate"
            className="rounded-co-control border border-[var(--sp-line-strong)] bg-[var(--sp-bone)] px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="sp-btn-gold inline-flex min-h-11 items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Agregar
        </button>
        {state?.error && <p className="w-full text-sm text-[var(--sp-crit)]">{state.error}</p>}
      </form>
    </div>
  );
}
