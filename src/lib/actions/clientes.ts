"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  clientAccesses,
  clientProjects,
  deliverables,
  portalUsers,
  type AccessType,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth-server";
import { encryptSecret, generateTempPassword, hashPassword } from "@/lib/crypto";
import { getPortalClientProject } from "@/lib/portal-queries";
import { PORTAL_UNIDAD_SLUG } from "@/lib/portal-config";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function assertPortalClient(clientProjectId: string) {
  const row = await getPortalClientProject(clientProjectId);
  if (!row) throw new Error("El proyecto de cliente no pertenece a la agencia.");
  return row.clientProject;
}

function revalidateClient(clientProjectId: string) {
  const base = `/unidad/${PORTAL_UNIDAD_SLUG}/clientes`;
  revalidatePath(base);
  revalidatePath(`${base}/${clientProjectId}`);
  revalidatePath("/portal", "layout");
}

export async function setPortalEnabled(clientProjectId: string, enabled: boolean) {
  await requireAdmin();
  await assertPortalClient(clientProjectId);
  await db
    .update(clientProjects)
    .set({ portalEnabled: enabled })
    .where(eq(clientProjects.id, clientProjectId));
  revalidateClient(clientProjectId);
}

export type AnalyticsFormState = { error?: string; success?: string } | null;

export async function saveClientAnalytics(
  _prevState: AnalyticsFormState,
  formData: FormData
): Promise<AnalyticsFormState> {
  await requireAdmin();
  const clientProjectId = String(formData.get("clientProjectId") ?? "");
  const raw = String(formData.get("gaPropertyId") ?? "").trim();
  const visible = formData.get("statsVisibleToClient") === "on";

  // GA4 Property ID es sólo el número; se acepta pegado como "properties/123".
  const propertyId = raw.replace(/^properties\//i, "");
  if (propertyId && !/^\d{6,}$/.test(propertyId)) {
    return { error: "El Property ID debe ser el número de la property GA4 (ej: 493827160)." };
  }

  try {
    await assertPortalClient(clientProjectId);
  } catch (error) {
    return { error: (error as Error).message };
  }

  await db
    .update(clientProjects)
    .set({
      gaPropertyId: propertyId || null,
      statsVisibleToClient: propertyId ? visible : false,
    })
    .where(eq(clientProjects.id, clientProjectId));

  revalidateClient(clientProjectId);
  revalidatePath(`/unidad/${PORTAL_UNIDAD_SLUG}`);
  return { success: propertyId ? "Analytics guardado." : "Analytics desvinculado." };
}

export type PortalUserResult =
  | { ok: true; message: string; tempPassword?: string }
  | { ok: false; error: string };

export async function createPortalUser(
  _prevState: PortalUserResult | null,
  formData: FormData
): Promise<PortalUserResult> {
  await requireAdmin();
  const clientProjectId = String(formData.get("clientProjectId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!name) return { ok: false, error: "El nombre es obligatorio." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Email inválido." };

  try {
    await assertPortalClient(clientProjectId);
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }

  const existing = await db.select().from(portalUsers).where(eq(portalUsers.email, email));
  if (existing.length > 0) {
    return { ok: false, error: "Ya existe un usuario de portal con ese email." };
  }

  const tempPassword = generateTempPassword();
  await db.insert(portalUsers).values({
    clientProjectId,
    name,
    email,
    passwordHash: await hashPassword(tempPassword),
    mustChangePassword: true,
  });

  revalidateClient(clientProjectId);
  return {
    ok: true,
    message: `Usuario creado para ${email}.`,
    tempPassword,
  };
}

export async function resetPortalPassword(
  _prevState: PortalUserResult | null,
  formData: FormData
): Promise<PortalUserResult> {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const rows = await db.select().from(portalUsers).where(eq(portalUsers.id, userId));
  const user = rows[0];
  if (!user) return { ok: false, error: "Usuario no encontrado." };

  const tempPassword = generateTempPassword();
  await db
    .update(portalUsers)
    .set({ passwordHash: await hashPassword(tempPassword), mustChangePassword: true })
    .where(eq(portalUsers.id, userId));

  revalidateClient(user.clientProjectId);
  return { ok: true, message: `Nueva contraseña para ${user.email}.`, tempPassword };
}

export async function setPortalUserActive(userId: string, isActive: boolean) {
  await requireAdmin();
  const rows = await db.select().from(portalUsers).where(eq(portalUsers.id, userId));
  const user = rows[0];
  if (!user) return;
  await db.update(portalUsers).set({ isActive }).where(eq(portalUsers.id, userId));
  revalidateClient(user.clientProjectId);
}

export async function deletePortalUser(userId: string) {
  await requireAdmin();
  const rows = await db.select().from(portalUsers).where(eq(portalUsers.id, userId));
  const user = rows[0];
  if (!user) return;
  await db.delete(portalUsers).where(eq(portalUsers.id, userId));
  revalidateClient(user.clientProjectId);
}

// --- Accesos ---

export type AccessFormState = { error?: string; success?: string } | null;

export async function saveAccess(
  _prevState: AccessFormState,
  formData: FormData
): Promise<AccessFormState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const clientProjectId = String(formData.get("clientProjectId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const type = String(formData.get("type") ?? "otro") as AccessType;
  const url = String(formData.get("url") ?? "").trim() || null;
  const username = String(formData.get("username") ?? "").trim() || null;
  const secret = String(formData.get("secret") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!label) return { error: "El nombre del acceso es obligatorio." };

  try {
    await assertPortalClient(clientProjectId);
  } catch (error) {
    return { error: (error as Error).message };
  }

  const now = new Date();

  if (id) {
    const rows = await db.select().from(clientAccesses).where(eq(clientAccesses.id, id));
    const existing = rows[0];
    if (!existing) return { error: "Acceso no encontrado." };
    await db
      .update(clientAccesses)
      .set({
        label,
        type,
        url,
        username,
        // Campo vacío al editar = dejar la contraseña como estaba.
        secretCipher: secret ? encryptSecret(secret) : existing.secretCipher,
        notes,
        updatedAt: now,
      })
      .where(eq(clientAccesses.id, id));
  } else {
    await db.insert(clientAccesses).values({
      clientProjectId,
      label,
      type,
      url,
      username,
      secretCipher: secret ? encryptSecret(secret) : null,
      notes,
      updatedAt: now,
    });
  }

  revalidateClient(clientProjectId);
  return { success: id ? "Acceso actualizado." : "Acceso creado." };
}

export async function deleteAccess(accessId: string) {
  await requireAdmin();
  const rows = await db.select().from(clientAccesses).where(eq(clientAccesses.id, accessId));
  const access = rows[0];
  if (!access) return;
  await db.delete(clientAccesses).where(eq(clientAccesses.id, accessId));
  revalidateClient(access.clientProjectId);
}

// --- Entregables ---

export type DeliverableFormState = { error?: string; success?: string } | null;

export async function createDeliverable(
  _prevState: DeliverableFormState,
  formData: FormData
): Promise<DeliverableFormState> {
  await requireAdmin();
  const clientProjectId = String(formData.get("clientProjectId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const url = String(formData.get("url") ?? "").trim();
  const kind = String(formData.get("kind") ?? "link") === "archivo" ? "archivo" : "link";

  if (!title) return { error: "El título es obligatorio." };
  if (!/^https?:\/\//i.test(url)) return { error: "La URL debe empezar con http:// o https://" };

  try {
    await assertPortalClient(clientProjectId);
  } catch (error) {
    return { error: (error as Error).message };
  }

  await db.insert(deliverables).values({ clientProjectId, title, description, url, kind });
  revalidateClient(clientProjectId);
  return { success: "Entregable publicado." };
}

export async function deleteDeliverable(deliverableId: string) {
  await requireAdmin();
  const rows = await db.select().from(deliverables).where(eq(deliverables.id, deliverableId));
  const item = rows[0];
  if (!item) return;
  await db.delete(deliverables).where(eq(deliverables.id, deliverableId));
  revalidateClient(item.clientProjectId);
}
