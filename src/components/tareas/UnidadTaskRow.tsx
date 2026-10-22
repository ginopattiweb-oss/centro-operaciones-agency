"use client";

import { useTransition } from "react";
import { completarTarea } from "@/lib/actions/tasks";
import type { TaskWithRelations } from "@/db/relations";
import { UBICACIONES } from "@/lib/tareas";
import { Casilla, PuntoPrioridad } from "./controles";

/**
 * Fila de tarea dentro de una unidad de negocio. Muestra dónde vive la tarea en
 * vez de una fecha: sin vencimientos, la ubicación es la única señal de avance.
 */
export function UnidadTaskRow({ item }: { item: TaskWithRelations }) {
  const { task } = item;
  const [pendiente, empezar] = useTransition();
  const hecha = task.location === "hecha";

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 transition hover:bg-bg/40 ${
        pendiente ? "opacity-50" : ""
      }`}
    >
      <Casilla
        tildada={hecha}
        onChange={(valor) => empezar(() => void completarTarea(task.id, valor))}
        etiqueta={hecha ? `Devolver "${task.title}" a la bandeja` : `Completar "${task.title}"`}
      />

      <PuntoPrioridad alta={task.priority === "alta"} />

      <span
        className={`min-w-0 flex-1 truncate text-sm ${hecha ? "text-fg-muted line-through" : "text-fg"}`}
      >
        {task.title}
      </span>

      {!hecha && (
        <span className="shrink-0 text-xs text-fg-muted">{UBICACIONES[task.location]}</span>
      )}
    </div>
  );
}
