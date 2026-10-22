"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ListChecks, StickyNote } from "lucide-react";
import { diasEnHoy, type TareaRow } from "@/lib/tareas";
import { Casilla, ChipUnidad, PuntoPrioridad } from "./controles";

/**
 * Una tarea es una sola línea. A la derecha se muestran como mucho dos datos, en
 * este orden: subtareas, nota, unidad y días acumulados en Hoy.
 */
export function TaskRow({
  tarea,
  tachada,
  onCompletar,
  onMover,
  onAbrir,
}: {
  tarea: TareaRow;
  /** Tildada pero todavía en la sección: se está yendo a Hechas. */
  tachada: boolean;
  onCompletar: (hecha: boolean) => void;
  onMover: () => void;
  onAbrir?: () => void;
}) {
  const hecha = tarea.location === "hecha";
  // Las hechas no se reordenan: van por fecha de completado.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tarea.id,
    disabled: hecha,
  });
  const dias = tarea.location === "hoy" ? diasEnHoy(tarea.movedToTodayAt) : 0;
  const claseTitulo = hecha || tachada ? "text-fg-muted line-through" : "text-fg";

  const metadatos: React.ReactNode[] = [];

  if (tarea.subtareasTotal > 0) {
    metadatos.push(
      <span key="subtareas" className="flex items-center gap-1 tabular-nums">
        <ListChecks className="h-3 w-3" aria-hidden="true" />
        {tarea.subtareasHechas}/{tarea.subtareasTotal}
      </span>
    );
  }
  if (tarea.notes?.trim()) {
    metadatos.push(<StickyNote key="nota" className="h-3 w-3" aria-label="Tiene notas" />);
  }
  if (tarea.unidadNombre) {
    metadatos.push(<ChipUnidad key="unidad" nombre={tarea.unidadNombre} />);
  }
  // "Más de un día en hoy": con un solo día no hay nada que señalar.
  if (dias >= 2) {
    metadatos.push(
      <span key="dias" className="tabular-nums" title={`${dias} días en hoy`}>
        {dias}d
      </span>
    );
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={`group flex items-start gap-2 bg-surface px-4 py-2.5 hover:bg-fg/[0.025] ${
        hecha ? "" : "cursor-grab active:cursor-grabbing"
      } ${isDragging ? "z-10 opacity-50" : ""}`}
    >
      <Casilla
        tildada={hecha || tachada}
        onChange={onCompletar}
        etiqueta={hecha ? `Devolver "${tarea.title}" a la bandeja` : `Completar "${tarea.title}"`}
        className="mt-[3px]"
      />

      <PuntoPrioridad alta={tarea.priority === "alta"} className="mt-[6px]" />

      {onAbrir ? (
        <button
          type="button"
          onClick={onAbrir}
          className={`min-w-0 flex-1 text-left text-sm leading-5 ${claseTitulo}`}
        >
          {tarea.title}
        </button>
      ) : (
        <span className={`min-w-0 flex-1 text-sm leading-5 ${claseTitulo}`}>{tarea.title}</span>
      )}

      <div className="flex shrink-0 items-center gap-2 pt-[2px] text-[11px] text-fg-muted">
        {!hecha && (
          <button
            type="button"
            onClick={onMover}
            className="opacity-0 transition-opacity hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
          >
            {tarea.location === "hoy" ? "Sacar de hoy" : "Mover a hoy"}
          </button>
        )}
        {metadatos.slice(0, 2)}
      </div>
    </li>
  );
}
