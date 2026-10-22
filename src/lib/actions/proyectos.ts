"use server";

import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clientProjects, projectMilestones, type ClientProjectStatus } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-server";
import {
  createClientProjectForUnidad,
  ensureBriefing,
  resolvePerson,
} from "@/lib/proyectos-alta";
import { getPortalClientProject } from "@/lib/portal-queries";
import { PORTAL_UNIDAD_SLUG } from "@/lib/portal-config";
import { isProjectStatus } from "@/lib/proyecto-estados";

export type ProjectFormState = { error?: string; success?: string; id?: string } | null;

const BASE = `/unidad/${PORTAL_UNIDAD_SLUG}`;

function revalidateProject(id?: string) {
  revalidatePath(BASE);
  revalidatePath(`${BASE}/clientes`);
  if (id) {
    revalidatePath(`${BASE}/proyecto/${id}`);
    revalidatePath(`${BASE}/clientes/${id}`);
  }
}

function readStatus(value: FormDataEntryValue | null): ClientProjectStatus {
  const raw = String(value ?? "");
  return isProjectStatus(raw) ? raw : "briefing";
}

/**
 * Crea el proyecto o completa los datos de un cliente que ya existe en el Portal.
 * Proyecto y cliente son la misma fila, así que "cliente nuevo" inserta en
 * `client_projects` con el portal apagado y le deja el briefing vacío listo para
 * que el cliente lo complete desde su portal. Nada se precarga con ejemplos.
 */
export async function createProject(
  _prevState: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  await requireAdmin();

  const mode = String(formData.get("mode") ?? "nuevo");
  const name = String(formData.get("name") ?? "").trim();
  const service = String(formData.get("service") ?? "").trim() || null;
  const status = readStatus(formData.get("status"));
  const ownerPersonId = await resolvePerson(String(formData.get("owner") ?? ""));

  if (mode === "existente") {
    const clientProjectId = String(formData.get("clientProjectId") ?? "");
    const row = await getPortalClientProject(clientProjectId);
    if (!row) return { error: "Ese cliente no pertenece a la agencia." };

    await db
      .update(clientProjects)
      .set({ name: name || row.clientProject.name, service, status, ownerPersonId })
      .where(eq(clientProjects.id, clientProjectId));

    await ensureBriefing(clientProjectId);
    revalidateProject(clientProjectId);
    return { success: "Proyecto vinculado al cliente.", id: clientProjectId };
  }

  const created = await createClientProjectForUnidad({ name, service, status, ownerPersonId });
  if ("error" in created) return created;

  revalidateProject(created.id);
  return { success: "Proyecto creado.", id: created.id };
}

export async function updateProject(
  _prevState: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  await requireAdmin();

  const id = String(formData.get("clientProjectId") ?? "");
  const row = await getPortalClientProject(id);
  if (!row) return { error: "Proyecto no encontrado." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "El nombre no puede quedar vacío." };

  await db
    .update(clientProjects)
    .set({
      name,
      service: String(formData.get("service") ?? "").trim() || null,
      status: readStatus(formData.get("status")),
      ownerPersonId: await resolvePerson(String(formData.get("owner") ?? "")),
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .where(eq(clientProjects.id, id));

  revalidateProject(id);
  return { success: "Cambios guardados." };
}

export async function setProjectStatus(id: string, status: ClientProjectStatus) {
  await requireAdmin();
  const row = await getPortalClientProject(id);
  if (!row) throw new Error("Proyecto no encontrado.");
  if (!isProjectStatus(status)) throw new Error("Estado inválido.");

  await db.update(clientProjects).set({ status }).where(eq(clientProjects.id, id));
  revalidateProject(id);
}

// --- Hitos ---

export async function addMilestone(
  _prevState: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  await requireAdmin();

  const clientProjectId = String(formData.get("clientProjectId") ?? "");
  const row = await getPortalClientProject(clientProjectId);
  if (!row) return { error: "Proyecto no encontrado." };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Poné un nombre para la fase o hito." };

  const dueDate = String(formData.get("dueDate") ?? "").trim() || null;

  const last = await db
    .select({ sortOrder: projectMilestones.sortOrder })
    .from(projectMilestones)
    .where(eq(projectMilestones.clientProjectId, clientProjectId))
    .orderBy(asc(projectMilestones.sortOrder));

  await db.insert(projectMilestones).values({
    clientProjectId,
    title,
    dueDate,
    sortOrder: last.length === 0 ? 0 : last[last.length - 1].sortOrder + 1,
  });

  revalidateProject(clientProjectId);
  return { success: "Hito agregado." };
}

export async function toggleMilestone(id: string, done: boolean) {
  await requireAdmin();
  const rows = await db
    .update(projectMilestones)
    .set({ done })
    .where(eq(projectMilestones.id, id))
    .returning();
  revalidateProject(rows[0]?.clientProjectId);
}

export async function deleteMilestone(id: string) {
  await requireAdmin();
  const rows = await db
    .delete(projectMilestones)
    .where(eq(projectMilestones.id, id))
    .returning();
  revalidateProject(rows[0]?.clientProjectId);
}
