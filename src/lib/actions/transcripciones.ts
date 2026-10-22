"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { videoTranscripts, type VideoPlatform, type VideoTranscript } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-server";
import { transcribeFromUrl, TRANSCRIPTION_PROVIDER } from "@/lib/transcripcion";

export type TranscriptResult = { transcript?: VideoTranscript; error?: string };

/**
 * Transcribe (o vuelve a transcribir) un video a partir de la URL del archivo.
 * Sólo Instagram entrega esa URL; para TikTok la acción devuelve error claro.
 */
export async function transcribeVideoAction(input: {
  platform: VideoPlatform;
  externalId: string;
  mediaUrl: string | null;
}): Promise<TranscriptResult> {
  await requireAdmin();
  if (!input.mediaUrl) {
    return { error: "Esta plataforma no entrega el archivo de video por API: no se puede transcribir." };
  }

  try {
    const result = await transcribeFromUrl(input.mediaUrl);
    const [transcript] = await db
      .insert(videoTranscripts)
      .values({
        platform: input.platform,
        externalId: input.externalId,
        text: result.text,
        segments: result.segments,
        language: result.language,
        durationSeconds: result.durationSeconds,
        provider: TRANSCRIPTION_PROVIDER,
      })
      .onConflictDoUpdate({
        target: [videoTranscripts.platform, videoTranscripts.externalId],
        set: {
          text: result.text,
          segments: result.segments,
          language: result.language,
          durationSeconds: result.durationSeconds,
          provider: TRANSCRIPTION_PROVIDER,
          createdAt: new Date(),
        },
      })
      .returning();
    revalidatePath("/contenido/videos");
    return { transcript };
  } catch (error) {
    console.error("[transcripcion]", error);
    return { error: error instanceof Error ? error.message : "No se pudo transcribir." };
  }
}

export async function getTranscriptAction(
  platform: VideoPlatform,
  externalId: string
): Promise<VideoTranscript | null> {
  await requireAdmin();
  const row = await db.query.videoTranscripts.findFirst({
    where: and(eq(videoTranscripts.platform, platform), eq(videoTranscripts.externalId, externalId)),
  });
  return row ?? null;
}
