"use server";

import { db } from "@/db";
import { subtasks, tasks, type TaskLocation, type TaskPriority } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-server";
import { PORTAL_UNIDAD_SLUG } from "@/lib/portal-config";
import type { TareaRow } from "@/lib/tareas";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/tareas");
  revalidatePath("/unidad/[slug]", "page");
  // La agencia tiene ruta propia (no pasa por [slug]) y detalle por proyecto.
  revalidatePath(`/unidad/${PORTAL_UNIDAD_SLUG}`);
  revalidatePath(`/unidad/${PORTAL_UNIDAD_SLUG}/proyecto/[id]`, "page");
}

/**
 * Orden para meter una tarea arriba de su sección: un escalón por debajo de la
 * primera. `sort_order` es numeric justamente para poder intercalar sin
 * reescribir el resto de la lista.
 */
async function ordenParaElTope(location: TaskLocation): Promise<number> {
  const [fila] = await db
    .select({ minimo: sql<number | null>`min(${tasks.sortOrder})` })
    .from(tasks)
    .where(eq(tasks.location, location));

  return (fila?.minimo ?? 1) - 1;
}

/**
 * Captura rápida. La tarea cae en la bandeja salvo que se pida hoy explícitamente
 * (Cmd/Ctrl + Enter). Devuelve la fila creada para reemplazar la optimista.
 */
export async function crearTarea(input: {
  title: string;
  location?: TaskLocation;
  priority?: TaskPriority;
  projectId?: string | null;
  clientProjectId?: string | null;
}): Promise<TareaRow> {
  await requireAdmin();

  const title = input.title.trim();
  if (!title) throw new Error("La tarea necesita un título.");

  const location = input.location ?? "bandeja";

  const [creada] = await db
    .insert(tasks)
    .values({
      title,
      location,
      priority: input.priority ?? "normal",
      projectId: input.projectId || null,
      clientProjectId: input.clientProjectId || null,
      sortOrder: await ordenParaElTope(location),
      movedToTodayAt: location === "hoy" ? new Date() : null,
    })
    .returning();

  revalidateAll();

  return {
    id: creada.id,
    title: creada.title,
    notes: creada.notes,
    location: creada.location,
    priority: creada.priority,
    projectId: creada.projectId,
    unidadNombre: null,
    sortOrder: creada.sortOrder,
    movedToTodayAt: creada.movedToTodayAt,
    completedAt: creada.completedAt,
    subtareasTotal: 0,
    subtareasHechas: 0,
  };
}

/**
 * Mueve una tarea entre Hoy, Bandeja y Hechas. `movedToTodayAt` se setea al
 * entrar a hoy y se limpia al salir: es lo que alimenta el contador de días.
 */
export async function moverTarea(taskId: string, location: TaskLocation) {
  await requireAdmin();

  await db
    .update(tasks)
    .set({
      location,
      movedToTodayAt: location === "hoy" ? new Date() : null,
      completedAt: location === "hecha" ? new Date() : null,
      sortOrder: await ordenParaElTope(location),
    })
    .where(eq(tasks.id, taskId));

  revalidateAll();
}

/** Tildar una tarea la manda a Hechas; destildarla la devuelve a la bandeja. */
export async function completarTarea(taskId: string, hecha: boolean) {
  await moverTarea(taskId, hecha ? "hecha" : "bandeja");
}

export async function actualizarTarea(
  taskId: string,
  input: Partial<{
    title: string;
    notes: string | null;
    priority: TaskPriority;
    projectId: string | null;
  }>
) {
  await requireAdmin();

  if (input.title !== undefined && !input.title.trim()) {
    throw new Error("La tarea necesita un título.");
  }

  await db
    .update(tasks)
    .set({
      ...input,
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
    })
    .where(eq(tasks.id, taskId));

  revalidateAll();
}

export async function eliminarTarea(taskId: string) {
  await requireAdmin();
  // Las subtareas se van solas: la FK es on delete cascade.
  await db.delete(tasks).where(eq(tasks.id, taskId));
  revalidateAll();
}

/**
 * Guarda una sección entera después de arrastrar: cada tarea queda en la
 * ubicación de destino con su nuevo orden. `movedToTodayAt` se conserva si la
 * tarea ya estaba en hoy — arrastrarla dentro de la sección no reinicia el
 * contador de días.
 */
export async function reordenarSeccion(location: TaskLocation, idsEnOrden: string[]) {
  await requireAdmin();

  await Promise.all(
    idsEnOrden.map((id, indice) =>
      db
        .update(tasks)
        .set({
          location,
          sortOrder: indice,
          movedToTodayAt:
            location === "hoy" ? sql`coalesce(${tasks.movedToTodayAt}, now())` : null,
          completedAt:
            location === "hecha" ? sql`coalesce(${tasks.completedAt}, now())` : null,
        })
        .where(eq(tasks.id, id))
    )
  );

  revalidateAll();
}

// --- Subtareas ---

/** Las subtareas de una tarea, en su orden. Se piden al abrir el panel de detalle. */
export async function listarSubtareas(taskId: string) {
  await requireAdmin();
  return db
    .select()
    .from(subtasks)
    .where(eq(subtasks.taskId, taskId))
    .orderBy(asc(subtasks.sortOrder), asc(subtasks.createdAt));
}

export async function crearSubtarea(taskId: string, title: string) {
  await requireAdmin();

  const limpio = title.trim();
  if (!limpio) throw new Error("La subtarea necesita un título.");

  const [fila] = await db
    .select({ maximo: sql<number | null>`max(${subtasks.sortOrder})` })
    .from(subtasks)
    .where(eq(subtasks.taskId, taskId));

  const [creada] = await db
    .insert(subtasks)
    .values({ taskId, title: limpio, sortOrder: (fila?.maximo ?? -1) + 1 })
    .returning();

  revalidateAll();
  return creada;
}

export async function actualizarSubtarea(
  subtaskId: string,
  input: Partial<{ title: string; done: boolean }>
) {
  await requireAdmin();

  if (input.title !== undefined && !input.title.trim()) {
    throw new Error("La subtarea necesita un título.");
  }

  await db
    .update(subtasks)
    .set({
      ...input,
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
    })
    .where(eq(subtasks.id, subtaskId));

  revalidateAll();
}

export async function eliminarSubtarea(subtaskId: string) {
  await requireAdmin();
  await db.delete(subtasks).where(eq(subtasks.id, subtaskId));
  revalidateAll();
}
