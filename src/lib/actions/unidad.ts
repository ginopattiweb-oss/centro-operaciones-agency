"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-server";

export type UnidadAnalyticsState = { error?: string; success?: string } | null;

export async function saveUnidadAnalytics(
  _prevState: UnidadAnalyticsState,
  formData: FormData
): Promise<UnidadAnalyticsState> {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "");
  const raw = String(formData.get("gaPropertyId") ?? "").trim();

  // GA4 Property ID es sólo el número; se acepta pegado como "properties/123".
  const propertyId = raw.replace(/^properties\//i, "");
  if (propertyId && !/^\d{6,}$/.test(propertyId)) {
    return { error: "El Property ID debe ser el número de la property GA4 (ej: 493827160)." };
  }

  const rows = await db.select().from(projects).where(eq(projects.slug, slug));
  if (!rows[0]) return { error: "Unidad no encontrada." };

  await db
    .update(projects)
    .set({ gaPropertyId: propertyId || null })
    .where(eq(projects.id, rows[0].id));

  revalidatePath(`/unidad/${slug}`);
  return { success: propertyId ? "Property vinculada." : "Property desvinculada." };
}
