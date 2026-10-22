"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  contentIdeas,
  videoTranscripts,
  type ContentIdeaFormat,
  type ContentIdeaStatus,
  type NewContentIdea,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth-server";
import { IDEA_COUNT_DEFAULT } from "@/lib/contenido-config";
import { generateContentIdeas } from "@/lib/contenido-ideas";
import { loadAccountMedia } from "@/lib/instagram-dashboard";
import { getInstagramAccountById } from "@/lib/instagram-queries";
import { TRIAL_REEL_FORMAT_LABELS, generateTrialReels, type TrialReelsOrigin } from "@/lib/trial-reels";

const PATH = "/contenido/planificar";

export type IdeasFormState = { error?: string; success?: string } | null;

const STATUSES: ContentIdeaStatus[] = ["idea", "planificada", "grabada", "publicada", "descartada"];

/** Corre la generación para una cuenta y guarda las ideas como una tanda. */
export async function generateIdeasAction(
  _prev: IdeasFormState,
  formData: FormData
): Promise<IdeasFormState> {
  await requireAdmin();

  const accountId = String(formData.get("accountId") ?? "");
  const brief = String(formData.get("brief") ?? "").trim() || null;
  const count = Number(formData.get("count")) || IDEA_COUNT_DEFAULT;

  const account = await getInstagramAccountById(accountId);
  if (!account) return { error: "Elegí una cuenta conectada." };

  try {
    const media = await loadAccountMedia(account.id);
    const result = await generateContentIdeas({
      media,
      accountUsername: account.username,
      brief,
      count,
    });

    const batchId = randomUUID();
    const sourcesById = new Map(result.sources.map((source) => [source.mediaId, source]));
    const rows: NewContentIdea[] = result.ideas.map((idea) => ({
      accountId: account.id,
      batchId,
      brief,
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
      sources: idea.basado_en
        .map((id) => sourcesById.get(id))
        .filter((source): source is NonNullable<typeof source> => Boolean(source)),
    }));
    await db.insert(contentIdeas).values(rows);

    revalidatePath(PATH);
    return {
      success: `${rows.length} ideas nuevas a partir de ${result.sources.length} publicaciones.`,
    };
  } catch (error) {
    console.error("[ideas] generación:", error);
    return { error: error instanceof Error ? error.message : "No se pudieron generar ideas." };
  }
}

/**
 * Trial reels: 5 guiones de 60 s sobre la idea de un guion o transcripción. Se
 * guardan como una tanda de ideas de formato reel, para planificarlas igual que
 * las demás. El texto sale de lo pegado o de un video ya transcripto en Videos.
 */
export async function generateTrialReelsAction(
  _prev: IdeasFormState,
  formData: FormData
): Promise<IdeasFormState> {
  await requireAdmin();

  const transcriptId = String(formData.get("transcriptId") ?? "").trim();
  const origin: TrialReelsOrigin = formData.get("origin") === "ajeno" ? "ajeno" : "propio";
  const ctaWord = String(formData.get("ctaWord") ?? "").trim() || null;
  const accountId = String(formData.get("accountId") ?? "");
  const account = accountId ? await getInstagramAccountById(accountId) : null;

  let transcript = String(formData.get("transcript") ?? "");
  if (transcriptId) {
    const row = await db.query.videoTranscripts.findFirst({ where: eq(videoTranscripts.id, transcriptId) });
    if (!row) return { error: "Esa transcripción ya no existe." };
    transcript = row.text;
  }
  if (!transcript.trim()) return { error: "Pegá un guion o elegí un video transcripto." };

  try {
    const result = await generateTrialReels({ transcript, origin, ctaWord });

    const batchId = randomUUID();
    const brief = [`Trial reels · video ${origin}`, ctaWord && `CTA: ${ctaWord}`].filter(Boolean).join(" · ");
    const context = [
      `Problema: ${result.problema}`,
      `Concepto: ${result.concepto}`,
      result.patron_extraido && `Patrón extraído: ${result.patron_extraido}`,
      `Supuestos: ${result.supuestos}`,
    ]
      .filter(Boolean)
      .join("\n");

    const rows: NewContentIdea[] = result.guiones.map((script) => ({
      accountId: account?.id ?? null,
      batchId,
      brief,
      title: `${TRIAL_REEL_FORMAT_LABELS[script.formato]} · ${script.titulo}`,
      format: "reel",
      hook: script.hook,
      rationale: `Trial reel, formato ${TRIAL_REEL_FORMAT_LABELS[script.formato].toLowerCase()} · hook de ${script.categoria_hook.toLowerCase()}.\n${context}`,
      script: {
        gancho: script.hook,
        desarrollo: script.bloques.map((block) => `[${block.tiempo}] ${block.etiqueta}: ${block.texto}`),
        // La estructura de la skill termina en el CTA: no hay cierre aparte.
        cierre: "",
        cta: script.cta,
      },
      // La skill escribe una sola descripción, la del guion base.
      caption: script.formato === "base" ? result.descripcion : null,
      hashtags: [],
    }));
    await db.insert(contentIdeas).values(rows);

    revalidatePath(PATH);
    return { success: "5 trial reels nuevos en Ideas: el base y 4 variaciones." };
  } catch (error) {
    console.error("[trial-reels] generación:", error);
    return { error: error instanceof Error ? error.message : "No se pudieron generar los guiones." };
  }
}

export async function setIdeaStatus(
  id: string,
  status: ContentIdeaStatus,
  scheduledFor?: string | null
): Promise<IdeasFormState> {
  await requireAdmin();
  if (!STATUSES.includes(status)) return { error: "Estado inválido." };
  await db
    .update(contentIdeas)
    .set({
      status,
      scheduledFor: status === "planificada" ? (scheduledFor || null) : scheduledFor === undefined ? undefined : scheduledFor,
    })
    .where(eq(contentIdeas.id, id));
  revalidatePath(PATH);
  return null;
}

const FORMATS: ContentIdeaFormat[] = ["reel", "carrusel", "post", "historia"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Un bullet por línea. Se aceptan pegados con "-", "•", "*" o "1." adelante. */
function parseBullets(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

/** Link del lead magnet: vacío, o una URL http(s). Sin protocolo se asume https. */
function parseLeadMagnetUrl(value: FormDataEntryValue | null): { url?: string; error?: string } {
  const raw = String(value ?? "").trim();
  if (!raw) return {};
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!url.hostname.includes(".")) return { error: "El link del lead magnet no es válido." };
    return { url: url.toString() };
  } catch {
    return { error: "El link del lead magnet no es válido." };
  }
}

/**
 * Video cargado a mano en el calendario, sin pasar por la IA. Va a la misma
 * tabla que las ideas generadas para que se planifique igual; el guion queda
 * vacío y se completa en las notas o regenerando.
 */
export async function createCalendarVideo(
  _prev: IdeasFormState,
  formData: FormData
): Promise<IdeasFormState> {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const format = String(formData.get("format") ?? "reel") as ContentIdeaFormat;
  const date = String(formData.get("date") ?? "");
  const hook = String(formData.get("hook") ?? "").trim();
  const bullets = parseBullets(formData.get("bullets"));
  const cta = String(formData.get("cta") ?? "").trim();
  const leadMagnet = parseLeadMagnetUrl(formData.get("leadMagnetUrl"));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const accountId = String(formData.get("accountId") ?? "") || null;

  if (!title) return { error: "Poné un título." };
  if (!FORMATS.includes(format)) return { error: "Formato inválido." };
  if (!DATE_RE.test(date)) return { error: "Elegí una fecha." };
  if (leadMagnet.error) return { error: leadMagnet.error };

  await db.insert(contentIdeas).values({
    accountId,
    batchId: randomUUID(),
    brief: "Cargado a mano en el calendario",
    title,
    format,
    hook,
    rationale: "",
    script: { gancho: hook, desarrollo: bullets, cierre: "", cta, leadMagnetUrl: leadMagnet.url },
    notes,
    status: "planificada",
    scheduledFor: date,
  });
  revalidatePath(PATH);
  return { success: "Video agendado." };
}

/**
 * Edita el guion de una idea: hook, bullets, CTA y link del lead magnet. Sirve
 * igual para las generadas por IA que para las cargadas a mano.
 */
export async function updateIdeaScript(
  _prev: IdeasFormState,
  formData: FormData
): Promise<IdeasFormState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const idea = await db.query.contentIdeas.findFirst({ where: eq(contentIdeas.id, id) });
  if (!idea) return { error: "Esa idea ya no existe." };

  const hook = String(formData.get("hook") ?? "").trim();
  const bullets = parseBullets(formData.get("bullets"));
  const cta = String(formData.get("cta") ?? "").trim();
  const leadMagnet = parseLeadMagnetUrl(formData.get("leadMagnetUrl"));
  if (leadMagnet.error) return { error: leadMagnet.error };

  // El texto en pantalla va alineado con los bloques: si cambian, ya no corresponde.
  const sameBlocks =
    bullets.length === idea.script.desarrollo.length &&
    bullets.every((bullet, index) => bullet === idea.script.desarrollo[index]);

  await db
    .update(contentIdeas)
    .set({
      hook,
      script: {
        ...idea.script,
        gancho: hook,
        desarrollo: bullets,
        cta,
        leadMagnetUrl: leadMagnet.url,
        textoEnPantalla: sameBlocks ? idea.script.textoEnPantalla : undefined,
      },
    })
    .where(eq(contentIdeas.id, id));
  revalidatePath(PATH);
  return { success: "Guion guardado." };
}

/**
 * Cambia la fecha de un video. Una idea suelta que recibe fecha pasa a
 * planificada; una grabada o publicada conserva su estado.
 */
export async function scheduleIdea(id: string, date: string): Promise<IdeasFormState> {
  await requireAdmin();
  if (!DATE_RE.test(date)) return { error: "Fecha inválida." };
  const idea = await db.query.contentIdeas.findFirst({ where: eq(contentIdeas.id, id) });
  if (!idea) return { error: "Ese video ya no existe." };
  await db
    .update(contentIdeas)
    .set({ scheduledFor: date, status: idea.status === "idea" || idea.status === "descartada" ? "planificada" : idea.status })
    .where(eq(contentIdeas.id, id));
  revalidatePath(PATH);
  return null;
}

/** Saca un video del calendario: vuelve a la lista de ideas sin fecha. */
export async function unscheduleIdea(id: string): Promise<IdeasFormState> {
  await requireAdmin();
  await db.update(contentIdeas).set({ status: "idea", scheduledFor: null }).where(eq(contentIdeas.id, id));
  revalidatePath(PATH);
  return null;
}

export async function saveIdeaNotes(id: string, notes: string): Promise<IdeasFormState> {
  await requireAdmin();
  await db.update(contentIdeas).set({ notes: notes.trim() || null }).where(eq(contentIdeas.id, id));
  revalidatePath(PATH);
  return null;
}
