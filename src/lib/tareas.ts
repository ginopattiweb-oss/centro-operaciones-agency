/**
 * Modelo de Tareas: una tarea vive en uno de tres lugares y nada más.
 *
 * "Hoy" no se deriva de una fecha de vencimiento: es una decisión que toma el
 * usuario cuando arranca el día. Lo que anota al vuelo cae en la bandeja. Por eso
 * acá no hay vencimientos ni tareas atrasadas.
 */
import type { TaskLocation, TaskPriority } from "@/db/schema";
import { dateStringBA, daysFromToday } from "@/lib/date";

/** Una fila de la lista, con lo justo que la vista necesita para pintarla. */
export type TareaRow = {
  id: string;
  title: string;
  notes: string | null;
  location: TaskLocation;
  priority: TaskPriority;
  projectId: string | null;
  /** Nombre de la unidad de negocio, para el chip. Null si la tarea no tiene unidad. */
  unidadNombre: string | null;
  sortOrder: number;
  movedToTodayAt: Date | null;
  completedAt: Date | null;
  subtareasTotal: number;
  subtareasHechas: number;
};

export const UBICACIONES: Record<TaskLocation, string> = {
  hoy: "Hoy",
  bandeja: "Bandeja",
  hecha: "Hechas",
};

/** Cuántas completadas se muestran en la sección Hechas. */
export const LIMITE_HECHAS = 20;

/**
 * Sintaxis de la captura rápida: un `!` al final marca prioridad alta y no forma
 * parte del título. Es la única sintaxis; no hay `@`, `#` ni `/`.
 */
export function parsearCaptura(texto: string): {
  title: string;
  priority: TaskPriority;
} {
  const limpio = texto.trim();
  if (limpio.endsWith("!")) {
    const sinMarca = limpio.slice(0, -1).trim();
    // "!" solo no es una tarea sin título: en ese caso el "!" es el título.
    if (sinMarca) return { title: sinMarca, priority: "alta" };
  }
  return { title: limpio, priority: "normal" };
}

/**
 * Días de calendario que la tarea lleva en Hoy. 0 si entró hoy mismo. Se calcula
 * en el cliente contra la fecha actual, así el contador avanza sin tocar la base.
 */
export function diasEnHoy(movedToTodayAt: Date | null): number {
  if (!movedToTodayAt) return 0;
  return Math.max(0, -daysFromToday(dateStringBA(movedToTodayAt)));
}
