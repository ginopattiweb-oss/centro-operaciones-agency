"use client";

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { ListChecks, StickyNote } from "lucide-react";
import type { TaskLocation } from "@/db/schema";
import { diasEnHoy, UBICACIONES, type TareaRow } from "@/lib/tareas";
import { ChipUnidad, PuntoPrioridad } from "./controles";

const COLUMNAS: TaskLocation[] = ["hoy", "bandeja", "hecha"];

/**
 * Vista secundaria: las mismas tres ubicaciones, en columnas. Arrastrar una
 * tarjeta de una columna a otra es lo mismo que mover la tarea.
 */
export function TareasKanban({
  secciones,
  onMover,
  onAbrir,
}: {
  secciones: Record<TaskLocation, TareaRow[]>;
  onMover: (tarea: TareaRow, destino: TaskLocation) => void;
  onAbrir?: (taskId: string) => void;
}) {
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function alSoltar(evento: DragEndEvent) {
    const { active, over } = evento;
    if (!over) return;

    const destino = over.id as TaskLocation;
    const tarea = COLUMNAS.flatMap((columna) => secciones[columna]).find(
      (t) => t.id === active.id
    );
    if (!tarea || tarea.location === destino) return;

    onMover(tarea, destino);
  }

  return (
    <DndContext sensors={sensores} onDragEnd={alSoltar}>
      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNAS.map((columna) => (
          <Columna
            key={columna}
            ubicacion={columna}
            tareas={secciones[columna]}
            onAbrir={onAbrir}
          />
        ))}
      </div>
    </DndContext>
  );
}

function Columna({
  ubicacion,
  tareas,
  onAbrir,
}: {
  ubicacion: TaskLocation;
  tareas: TareaRow[];
  onAbrir?: (taskId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: ubicacion });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[16rem] flex-col gap-2 border bg-surface p-3 transition ${
        isOver ? "border-accent" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between px-1 pb-1">
        <h3 className="text-[11px] uppercase tracking-[0.18em] text-fg-muted">
          {UBICACIONES[ubicacion]}
        </h3>
        <span className="text-xs tabular-nums text-fg-muted">{tareas.length}</span>
      </div>

      {tareas.map((tarea) => (
        <Tarjeta key={tarea.id} tarea={tarea} onAbrir={onAbrir} />
      ))}
    </div>
  );
}

function Tarjeta({
  tarea,
  onAbrir,
}: {
  tarea: TareaRow;
  onAbrir?: (taskId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: tarea.id,
  });
  const dias = tarea.location === "hoy" ? diasEnHoy(tarea.movedToTodayAt) : 0;

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      {...listeners}
      {...attributes}
      className={`flex cursor-grab flex-col gap-2 rounded-co-control border border-border bg-bg p-3 active:cursor-grabbing ${
        isDragging ? "z-10 opacity-50" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <PuntoPrioridad alta={tarea.priority === "alta"} className="mt-[6px]" />
        {onAbrir ? (
          <button
            type="button"
            onClick={(evento) => {
              evento.stopPropagation();
              onAbrir(tarea.id);
            }}
            className={`min-w-0 flex-1 text-left text-sm ${
              tarea.location === "hecha" ? "text-fg-muted line-through" : "text-fg"
            }`}
          >
            {tarea.title}
          </button>
        ) : (
          <span
            className={`min-w-0 flex-1 text-sm ${
              tarea.location === "hecha" ? "text-fg-muted line-through" : "text-fg"
            }`}
          >
            {tarea.title}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-fg-muted">
        {tarea.subtareasTotal > 0 && (
          <span className="flex items-center gap-1 tabular-nums">
            <ListChecks className="h-3 w-3" aria-hidden="true" />
            {tarea.subtareasHechas}/{tarea.subtareasTotal}
          </span>
        )}
        {tarea.notes?.trim() && <StickyNote className="h-3 w-3" aria-label="Tiene notas" />}
        {tarea.unidadNombre && <ChipUnidad nombre={tarea.unidadNombre} />}
        {dias >= 2 && <span className="tabular-nums">{dias}d</span>}
      </div>
    </div>
  );
}
