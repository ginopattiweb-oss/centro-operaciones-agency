/** Lectura de ideas de contenido (Planificar). */
import { desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  contentIdeas,
  instagramAccounts,
  tiktokVideos,
  videoTranscripts,
  type ContentIdea,
  type VideoPlatform,
} from "@/db/schema";

export type ContentIdeaView = ContentIdea & { accountUsername: string | null };

/** Todas menos las descartadas, de la más nueva a la más vieja. */
export async function getContentIdeas(): Promise<ContentIdeaView[]> {
  const rows = await db
    .select({ idea: contentIdeas, accountUsername: instagramAccounts.username })
    .from(contentIdeas)
    .leftJoin(instagramAccounts, eq(instagramAccounts.id, contentIdeas.accountId))
    .where(ne(contentIdeas.status, "descartada"))
    .orderBy(desc(contentIdeas.createdAt));
  return rows.map((row) => ({ ...row.idea, accountUsername: row.accountUsername }));
}

/** Video ya transcripto, para elegirlo como fuente de trial reels. */
export type TranscriptOption = {
  id: string;
  platform: VideoPlatform;
  /** Título del video si se conoce (TikTok); si no, el arranque de la transcripción. */
  label: string;
  createdAt: Date;
};

export async function getTranscriptOptions(limit = 50): Promise<TranscriptOption[]> {
  const rows = await db
    .select({
      id: videoTranscripts.id,
      platform: videoTranscripts.platform,
      text: videoTranscripts.text,
      createdAt: videoTranscripts.createdAt,
      tiktokTitle: tiktokVideos.title,
    })
    .from(videoTranscripts)
    // De Instagram no se guarda el reel: sólo TikTok tiene título a mano.
    .leftJoin(tiktokVideos, eq(tiktokVideos.tiktokId, videoTranscripts.externalId))
    .orderBy(desc(videoTranscripts.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    platform: row.platform,
    label: (row.tiktokTitle?.trim() || row.text.replace(/\s+/g, " ").trim()).slice(0, 90),
    createdAt: row.createdAt,
  }));
}
