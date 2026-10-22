import Link from "next/link";
import { db } from "@/db";
import { videoTranscripts } from "@/db/schema";
import { getContenidoAccounts, getContenidoVideos } from "@/lib/contenido-queries";
import { getInstagramReels, parseMediaTimestamp } from "@/lib/instagram-dashboard";
import { getInstagramAccounts } from "@/lib/instagram-queries";
import { isTranscriptionConfigured } from "@/lib/transcripcion";
import { EmptyState } from "../_components/EmptyState";
import { VideoGrid, type VideoCardData } from "../_components/VideoGrid";

export const metadata = { title: "Videos · Contenido" };
/** Transcribir descarga el video y espera a Whisper: más que los 10 s por defecto. */
export const maxDuration = 120;

function parseAccountParam(value: string | undefined): { platform: "ig" | "tt"; id: string } | null {
  const match = value?.match(/^(ig|tt):([0-9a-f-]{36})$/);
  return match ? { platform: match[1] as "ig" | "tt", id: match[2] } : null;
}

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<{ cuenta?: string }>;
}) {
  const selected = parseAccountParam((await searchParams).cuenta);
  const [igAccounts, ttAccounts] = await Promise.all([getInstagramAccounts(), getContenidoAccounts()]);

  if (igAccounts.length === 0 && ttAccounts.length === 0) {
    return (
      <EmptyState
        title="Todavía no hay cuentas conectadas"
        cta={{ href: "/contenido/cuentas", label: "Ir a Cuentas" }}
      >
        Los videos se leen de cada cuenta de Instagram o TikTok conectada.
      </EmptyState>
    );
  }

  const showIg = !selected || selected.platform === "ig";
  const showTt = !selected || selected.platform === "tt";

  const [reels, tiktokVideos, transcribed] = await Promise.all([
    showIg ? getInstagramReels() : Promise.resolve([]),
    showTt ? getContenidoVideos() : Promise.resolve([]),
    db.select({ platform: videoTranscripts.platform, externalId: videoTranscripts.externalId }).from(videoTranscripts),
  ]);
  const transcriptKeys = new Set(transcribed.map((row) => `${row.platform}:${row.externalId}`));

  const igById = new Map(igAccounts.map((account) => [account.username, account.id]));
  const cards: VideoCardData[] = [
    ...reels
      .filter((reel) => !selected || igById.get(reel.accountUsername) === selected.id)
      .map((reel) => ({
        key: `instagram:${reel.id}`,
        platform: "instagram" as const,
        platformLabel: "Instagram" as const,
        externalId: reel.id,
        account: `@${reel.accountUsername ?? "instagram"}`,
        cover: reel.thumbnailUrl,
        title: reel.caption?.split("\n")[0] || "Sin descripción",
        caption: reel.caption,
        publishedAt: parseMediaTimestamp(reel.timestamp).toISOString(),
        durationSeconds: null,
        views: reel.insights?.views ?? null,
        likes: reel.likeCount,
        comments: reel.commentsCount,
        shares: reel.insights?.shares ?? null,
        saved: reel.insights?.saved ?? null,
        reach: reel.insights?.reach ?? null,
        totalInteractions: reel.insights?.totalInteractions ?? null,
        url: reel.permalink,
        mediaUrl: reel.mediaUrl,
        available: true,
        hasTranscript: transcriptKeys.has(`instagram:${reel.id}`),
      })),
    ...tiktokVideos
      .filter((video) => !selected || video.accountId === selected.id)
      .map((video) => ({
        key: `tiktok:${video.tiktokId}`,
        platform: "tiktok" as const,
        platformLabel: "TikTok" as const,
        externalId: video.tiktokId,
        account: video.accountName ?? "TikTok",
        cover: video.coverImageUrl,
        title: video.title || video.videoDescription || "Sin título",
        caption: video.videoDescription,
        publishedAt: video.publishedAt.toISOString(),
        durationSeconds: video.duration,
        views: video.viewCount,
        likes: video.likeCount,
        comments: video.commentCount,
        shares: video.shareCount,
        saved: null,
        reach: null,
        totalInteractions: null,
        url: video.shareUrl,
        mediaUrl: null,
        available: video.available,
        hasTranscript: transcriptKeys.has(`tiktok:${video.tiktokId}`),
      })),
  ].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const accountOptions = [
    { value: "todas", label: "Todas" },
    ...igAccounts.map((account) => ({ value: `ig:${account.id}`, label: `@${account.username ?? "instagram"}` })),
    ...ttAccounts.map((account) => ({
      value: `tt:${account.id}`,
      label: `TikTok · ${account.displayName ?? account.projectName}`,
    })),
  ];
  const current = selected ? `${selected.platform}:${selected.id}` : "todas";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
          {accountOptions.map((option) => (
            <Link
              key={option.value}
              href={option.value === "todas" ? "/contenido/videos" : `/contenido/videos?cuenta=${option.value}`}
              className={`rounded-md px-3 py-1.5 text-xs transition ${
                option.value === current ? "bg-accent/15 text-accent-ink" : "text-fg-muted hover:text-fg"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>
        <p className="text-xs text-fg-muted">{cards.length} videos · tocá uno para ver métricas y transcripción</p>
      </div>

      {cards.length === 0 ? (
        <EmptyState title="Sin videos todavía">Las cuentas seleccionadas no tienen videos sincronizados.</EmptyState>
      ) : (
        <VideoGrid videos={cards} transcriptionReady={isTranscriptionConfigured()} />
      )}
    </div>
  );
}
