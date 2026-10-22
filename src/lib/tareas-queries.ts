/** Lectura de la sección Tareas. Escribir va por `actions/tasks.ts`. */
import { asc, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { projects, subtasks, tasks } from "@/db/schema";
import { LIMITE_HECHAS, type TareaRow } from "@/lib/tareas";

export type TareasBoard = {
  hoy: TareaRow[];
  bandeja: TareaRow[];
  hechas: TareaRow[];
};

const seleccion = {
  id: tasks.id,
  title: tasks.title,
  notes: tasks.notes,
  location: tasks.location,
  priority: tasks.priority,
  projectId: tasks.projectId,
  unidadNombre: projects.name,
  sortOrder: tasks.sortOrder,
  movedToTodayAt: tasks.movedToTodayAt,
  completedAt: tasks.completedAt,
};

/** Totales de subtareas por tarea, para el contador `2/5` de la fila. */
async function contarSubtareas(): Promise<Map<string, { total: number; hechas: number }>> {
  const filas = await db
    .select({
      taskId: subtasks.taskId,
      total: count(),
      hechas: sql<number>`count(*) filter (where ${subtasks.done})::int`,
    })
    .from(subtasks)
    .groupBy(subtasks.taskId);

  return new Map(filas.map((f) => [f.taskId, { total: f.total, hechas: f.hechas }]));
}

/**
 * Las tres secciones de la vista. Hoy y Bandeja van completas y por orden manual;
 * de Hechas alcanza con las últimas, que es lo único que se mira.
 */
export async function getTareasBoard(): Promise<TareasBoard> {
  const abiertas = db
    .select(seleccion)
    .from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .where(sql`${tasks.location} <> 'hecha'`)
    .orderBy(asc(tasks.sortOrder), desc(tasks.createdAt));

  const hechas = db
    .select(seleccion)
    .from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .where(eq(tasks.location, "hecha"))
    .orderBy(desc(tasks.completedAt))
    .limit(LIMITE_HECHAS);

  const [filasAbiertas, filasHechas, subtareas] = await Promise.all([
    abiertas,
    hechas,
    contarSubtareas(),
  ]);

  const aFila = (fila: Omit<TareaRow, "subtareasTotal" | "subtareasHechas">): TareaRow => {
    const conteo = subtareas.get(fila.id);
    return {
      ...fila,
      subtareasTotal: conteo?.total ?? 0,
      subtareasHechas: conteo?.hechas ?? 0,
    };
  };

  return {
    hoy: filasAbiertas.filter((f) => f.location === "hoy").map(aFila),
    bandeja: filasAbiertas.filter((f) => f.location === "bandeja").map(aFila),
    hechas: filasHechas.map(aFila),
  };
}
