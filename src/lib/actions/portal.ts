"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { briefings, clientProjects, portalUsers, projects } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import {
  createPortalSessionToken,
  PORTAL_SESSION_COOKIE,
  PORTAL_SESSION_MAX_AGE,
} from "@/lib/portal-auth";
import {
  missingRequiredFields,
  sanitizeBriefingData,
} from "@/lib/briefing";
import { PORTAL_UNIDAD_SLUG, requirePortalContext } from "@/lib/portal-queries";

export type PortalLoginState = { error: string } | null;

export async function portalLogin(
  _prevState: PortalLoginState,
  formData: FormData
): Promise<PortalLoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const genericError = "Email o contraseña incorrectos.";

  if (!email || !password) return { error: genericError };

  const rows = await db
    .select({ user: portalUsers, clientProject: clientProjects, project: projects })
    .from(portalUsers)
    .innerJoin(clientProjects, eq(portalUsers.clientProjectId, clientProjects.id))
    .innerJoin(projects, eq(clientProjects.projectId, projects.id))
    .where(eq(portalUsers.email, email));

  const row = rows[0];
  // Se verifica siempre contra un hash (real o señuelo) para no filtrar si el email existe.
  const storedHash =
    row?.user.passwordHash ??
    "scrypt$00000000000000000000000000000000$" + "0".repeat(128);
  const passwordOk = await verifyPassword(password, storedHash);

  if (!row || !passwordOk) return { error: genericError };
  if (!row.user.isActive) return { error: "Este usuario está desactivado. Escribinos." };
  if (!row.clientProject.portalEnabled || row.project.slug !== PORTAL_UNIDAD_SLUG) {
    return { error: "El portal de este proyecto no está habilitado todavía." };
  }

  await db
    .update(portalUsers)
    .set({ lastLoginAt: new Date() })
    .where(eq(portalUsers.id, row.user.id));

  const cookieStore = await cookies();
  cookieStore.set(PORTAL_SESSION_COOKIE, await createPortalSessionToken(row.user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PORTAL_SESSION_MAX_AGE,
  });

  redirect("/portal");
}

export async function portalLogout() {
  const cookieStore = await cookies();
  cookieStore.delete(PORTAL_SESSION_COOKIE);
  redirect("/portal/login");
}

export type BriefingFormState = { error?: string; success?: string } | null;

export async function savePortalBriefing(
  _prevState: BriefingFormState,
  formData: FormData
): Promise<BriefingFormState> {
  const { clientProject } = await requirePortalContext();
  const submit = formData.get("intent") === "enviar";
  const data = sanitizeBriefingData(formData);

  if (submit) {
    const missing = missingRequiredFields(data);
    if (missing.length > 0) {
      return {
        error: `Faltan campos obligatorios: ${missing.map((f) => f.label).join(", ")}.`,
      };
    }
  }

  const now = new Date();
  const existing = await db
    .select()
    .from(briefings)
    .where(eq(briefings.clientProjectId, clientProject.id));

  if (existing[0]) {
    await db
      .update(briefings)
      .set({
        data,
        status: submit ? "enviado" : existing[0].status,
        submittedAt: submit ? now : existing[0].submittedAt,
        updatedAt: now,
      })
      .where(eq(briefings.id, existing[0].id));
  } else {
    await db.insert(briefings).values({
      clientProjectId: clientProject.id,
      data,
      status: submit ? "enviado" : "borrador",
      submittedAt: submit ? now : null,
      updatedAt: now,
    });
  }

  revalidatePath("/portal");
  revalidatePath("/portal/briefing");
  revalidatePath(`/unidad/${PORTAL_UNIDAD_SLUG}/clientes/${clientProject.id}`);

  return {
    success: submit
      ? "¡Briefing enviado! Ya lo tenemos, cualquier duda te escribimos."
      : "Borrador guardado.",
  };
}

export type ChangePasswordState = { error?: string; success?: string } | null;

export async function changePortalPassword(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const { user } = await requirePortalContext();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!(await verifyPassword(current, user.passwordHash))) {
    return { error: "La contraseña actual no es correcta." };
  }
  if (next.length < 10) return { error: "La nueva contraseña debe tener al menos 10 caracteres." };
  if (next !== confirm) return { error: "Las contraseñas nuevas no coinciden." };
  if (next === current) return { error: "La nueva contraseña debe ser distinta de la actual." };

  await db
    .update(portalUsers)
    .set({ passwordHash: await hashPassword(next), mustChangePassword: false })
    .where(eq(portalUsers.id, user.id));

  revalidatePath("/portal/cuenta");
  return { success: "Contraseña actualizada." };
}
