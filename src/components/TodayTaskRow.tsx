"use client";

import { useTransition } from "react";
import { completarTarea, moverTarea } from "@/lib/actions/tasks";
import type { TaskWithRelations } from "@/db/relations";
import { Casilla, PuntoPrioridad } from "@/components/tareas/controles";

/**
 * Fila del bloque "Hoy" del inicio. Son las tareas que el usuario movió a hoy,
 * no las que vencen hoy: acá no hay fechas.
 */
export function TodayTaskRow({ item }: { item: TaskWithRelations }) {
  const { task, project } = item;
  const [pendiente, empezar] = useTransition();

  return (
    <div
      className={`group flex items-center gap-3 px-4 py-3 transition hover:bg-bg/40 ${
        pendiente ? "opacity-50" : ""
      }`}
    >
      <Casilla
        tildada={task.location === "hecha"}
        onChange={(valor) => empezar(() => void completarTarea(task.id, valor))}
        etiqueta={`Completar "${task.title}"`}
      />

      <PuntoPrioridad alta={task.priority === "alta"} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-fg">{task.title}</p>
        {project && <p className="truncate text-xs text-fg-muted">{project.name}</p>}
      </div>

      <button
        type="button"
        onClick={() => empezar(() => void moverTarea(task.id, "bandeja"))}
        className="shrink-0 text-xs text-fg-muted opacity-0 transition-opacity hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
      >
        Sacar de hoy
      </button>
    </div>
  );
}
