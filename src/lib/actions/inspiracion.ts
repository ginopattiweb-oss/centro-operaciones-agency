"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contentIdeas, inspirationAccounts, inspirationMedia, metaConnections } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-server";
import { adaptReferenceIdea } from "@/lib/contenido-ideas";
import { loadAccountMedia } from "@/lib/instagram-dashboard";
import { getInstagramAccounts } from "@/lib/instagram-queries";
import {
  getInspirationAccounts,
  getMetaConnection,
  markInspirationError,
  scanInspirationAccount,
} from "@/lib/inspiracion-queries";

const PATH = "/contenido/inspiracion";

export type InspiracionState = { error?: string; success?: string } | null;

function cleanUsername(value: FormDataEntryValue | null): string {
  return String(value ?? "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//, "")
    .replace(/[/?].*$/, "")
    .toLowerCase();
}

/** Agrega un referente y lo escanea en el acto. */
export async function addReferenceAction(_prev: InspiracionState, formData: FormData): Promise<InspiracionState> {
  await requireAdmin();
  const username = cleanUsername(formData.get("username"));
  if (!username) return { error: "Escribí el usuario de Instagram." };
  const connection = await getMetaConnection();
  if (!connection) return { error: "Primero conectá Facebook." };

  try {
    const { account } = await scanInspirationAccount(connection, username);
    revalidatePath(PATH);
    return { success: `@${account.username} agregada y escaneada.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo leer esa cuenta." };
  }
}

export async function removeReferenceAction(id: string): Promise<InspiracionState> {
  await requireAdmin();
  await db.delete(inspirationAccounts).where(eq(inspirationAccounts.id, id));
  revalidatePath(PATH);
  return null;
}

/** Vuelve a escanear todos los referentes. Una cuenta que falla no frena a las demás. */
export async function rescanAllAction(): Promise<InspiracionState> {
  await requireAdmin();
  const connection = await getMetaConnection();
  if (!connection) return { error: "Primero conectá Facebook." };
  const accounts = await getInspirationAccounts();
  const failed: string[] = [];
  for (const account of accounts) {
    try {
      await scanInspirationAccount(connection, account.username);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido.";
      await markInspirationError(account.username, message);
      failed.push(`@${account.username}`);
    }
  }
  revalidatePath(PATH);
  return failed.length
    ? { error: `Escaneadas ${accounts.length - failed.length}. Fallaron: ${failed.join(", ")}.` }
    : { success: `${accounts.length} cuentas escaneadas.` };
}

export async function disconnectMetaAction(): Promise<InspiracionState> {
  await requireAdmin();
  await db.delete(metaConnections);
  revalidatePath(PATH);
  return { success: "Facebook desconectado." };
}

/** Toma una publicación ajena y genera una idea propia con guion en Planificar. */
export async function adaptToBrandAction(mediaId: string): Promise<InspiracionState> {
  await requireAdmin();
  const reference = await db.query.inspirationMedia.findFirst({ where: eq(inspirationMedia.id, mediaId) });
  if (!reference) return { error: "La publicación ya no está." };
  const source = await db.query.inspirationAccounts.findFirst({
    where: eq(inspirationAccounts.id, reference.accountId),
  });
  const [own] = await getInstagramAccounts();
  if (!own) return { error: "Conectá tu cuenta de Instagram para adaptar a tu marca." };

  try {
    const media = await loadAccountMedia(own.id);
    const idea = await adaptReferenceIdea({
      reference: {
        username: source?.username ?? "referente",
        caption: reference.caption,
        permalink: reference.permalink,
        likeCount: reference.likeCount,
        commentsCount: reference.commentsCount,
        performanceRatio: reference.performanceRatio,
      },
      media,
      accountUsername: own.username,
    });
    await db.insert(contentIdeas).values({
      accountId: own.id,
      batchId: randomUUID(),
      brief: `Adaptado de @${source?.username ?? "referente"}${reference.permalink ? ` · ${reference.permalink}` : ""}`,
      title: idea.titulo,
      format: idea.formato,
      hook: idea.gancho,
      rationale: idea.por_que,
      script: {
        gancho: idea.guion.gancho,
        desarrollo: idea.guion.desarrollo,
        cierre: idea.guion.cierre,
        cta: idea.guion.cta,
        textoEnPantalla: idea.guion.texto_en_pantalla,
      },
      caption: idea.caption,
      hashtags: idea.hashtags,
      sources: [],
    });
    revalidatePath("/contenido/planificar");
    return { success: `Idea "${idea.titulo}" guardada en Planificar.` };
  } catch (error) {
    console.error("[inspiracion] adaptar:", error);
    return { error: error instanceof Error ? error.message : "No se pudo generar la idea." };
  }
}
