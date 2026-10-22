"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Clapperboard, ExternalLink, FileText, RefreshCw, X } from "lucide-react";
import { FormMessage, GhostButton, PrimaryButton } from "@/components/paneles";
import type { VideoPlatform, VideoTranscript } from "@/db/schema";
import { formatCompact } from "@/lib/contenido-config";
import { formatDateTime } from "@/lib/date";
import { getTranscriptAction, transcribeVideoAction } from "@/lib/actions/transcripciones";

/** Datos de un video ya normalizados entre plataformas, serializables al cliente. */
export type VideoCardData = {
  key: string;
  platform: VideoPlatform;
  platformLabel: "Instagram" | "TikTok";
  externalId: string;
  account: string;
  cover: string | null;
  title: string;
  caption: string | null;
  publishedAt: string;
  durationSeconds: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saved: number | null;
  reach: number | null;
  totalInteractions: number | null;
  url: string | null;
  /** URL del archivo de video, si la plataforma la entrega. Habilita la transcripción. */
  mediaUrl: string | null;
  available: boolean;
  hasTranscript: boolean;
};

/** Cómo ordenar la grilla: por fecha, o por la métrica en la que mejor le fue. */
type SortKey = "recientes" | "views" | "likes" | "comments" | "shares" | "engagement";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recientes", label: "Recientes" },
  { value: "views", label: "Más vistas" },
  { value: "likes", label: "Más likes" },
  { value: "comments", label: "Más comentarios" },
  { value: "shares", label: "Más compartidos" },
  { value: "engagement", label: "Mejor engagement" },
];

function sortValue(video: VideoCardData, sort: Exclude<SortKey, "recientes">): number | null {
  return sort === "engagement" ? engagementOf(video) : video[sort];
}

export function VideoGrid({
  videos,
  transcriptionReady,
}: {
  videos: VideoCardData[];
  transcriptionReady: boolean;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("recientes");
  const selected = videos.find((video) => video.key === selectedKey) ?? null;

  const sorted = useMemo(() => {
    if (sort === "recientes") return videos;
    // Sin el dato (TikTok no da alcance, IG a veces no da insights) va al final:
    // un "—" no puede quedar arriba de un video que sí rindió.
    return [...videos].sort((a, b) => {
      const valueA = sortValue(a, sort);
      const valueB = sortValue(b, sort);
      if (valueA == null) return valueB == null ? 0 : 1;
      if (valueB == null) return -1;
      return valueB - valueA;
    });
  }, [videos, sort]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedKey(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-1 self-start">
        {SORT_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setSort(option.value)}
            className={`rounded-md px-3 py-1.5 text-xs transition ${
              sort === option.value ? "bg-accent/15 text-accent-ink" : "text-fg-muted hover:text-fg"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {sorted.map((video, index) => (
          <button
            key={video.key}
            type="button"
            onClick={() => setSelectedKey(video.key)}
            className={`flex flex-col overflow-hidden rounded-card border text-left transition hover:border-accent/40 ${
              video.key === selectedKey ? "border-accent/40 bg-accent/5" : "border-border bg-surface"
            } ${video.available ? "" : "opacity-60"}`}
          >
            <div className="relative aspect-[9/16] bg-bg">
              {video.cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={video.cover} alt="" className="h-full w-full object-cover" />
              )}
              <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                {video.platformLabel} · {video.account}
              </span>
              {sort !== "recientes" && sortValue(video, sort) != null && index < 3 && (
                <span className="absolute bottom-2 right-2 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-on-accent">
                  #{index + 1}
                </span>
              )}
              {video.hasTranscript && (
                <span className="absolute right-2 top-2 rounded bg-black/70 p-1 text-white" title="Transcripto">
                  <FileText className="h-3 w-3" />
                </span>
              )}
              {!video.available && (
                <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white">
                  no disponible
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1.5 p-3">
              <p className="line-clamp-2 text-sm text-fg">{video.title}</p>
              <p className="text-[11px] text-fg-muted">{formatDateTime(new Date(video.publishedAt))}</p>
              <p className="mt-auto flex flex-wrap gap-x-2 text-xs tabular-nums text-fg-muted">
                <span className={sort === "views" ? "text-fg" : ""}>▷ {fmt(video.views)}</span>
                <span className={sort === "likes" ? "text-fg" : ""}>♡ {fmt(video.likes)}</span>
                <span className={sort === "comments" ? "text-fg" : ""}>💬 {fmt(video.comments)}</span>
                <span className={sort === "shares" ? "text-fg" : ""}>↗ {fmt(video.shares)}</span>
                {sort === "engagement" && <span className="text-fg">{fmtRatio(engagementOf(video))}</span>}
              </p>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <VideoDrawer
          key={selected.key}
          video={selected}
          transcriptionReady={transcriptionReady}
          onClose={() => setSelectedKey(null)}
        />
      )}
    </>
  );
}

function fmt(value: number | null): string {
  return value == null ? "—" : formatCompact(value);
}

function fmtRatio(value: number | null): string {
  return value == null ? "—" : `${(value * 100).toFixed(2)}%`;
}

/** Instagram: interacciones / alcance. TikTok no da alcance: (likes + com. + comp.) / vistas. */
function engagementOf(video: VideoCardData): number | null {
  return video.platform === "instagram"
    ? ratio(video.totalInteractions, video.reach)
    : ratio((video.likes ?? 0) + (video.comments ?? 0) + (video.shares ?? 0), video.views);
}

function VideoDrawer({
  video,
  transcriptionReady,
  onClose,
}: {
  video: VideoCardData;
  transcriptionReady: boolean;
  onClose: () => void;
}) {
  const [transcript, setTranscript] = useState<VideoTranscript | null | undefined>(undefined);
  const [message, setMessage] = useState<{ error?: string; success?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    if (!video.hasTranscript) {
      setTranscript(null);
      return;
    }
    getTranscriptAction(video.platform, video.externalId).then((row) => {
      if (!cancelled) setTranscript(row);
    });
    return () => {
      cancelled = true;
    };
  }, [video.platform, video.externalId, video.hasTranscript]);

  const transcribe = () =>
    startTransition(async () => {
      setMessage(null);
      const result = await transcribeVideoAction({
        platform: video.platform,
        externalId: video.externalId,
        mediaUrl: video.mediaUrl,
      });
      if (result.transcript) {
        setTranscript(result.transcript);
        setMessage({ success: "Transcripción lista." });
      } else {
        setMessage({ error: result.error });
      }
    });

  const engagement = engagementOf(video);

  const canTranscribe = transcriptionReady && Boolean(video.mediaUrl);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="co-scrim absolute inset-0" aria-hidden />
      <aside
        className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-surface shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label={video.title}
      >
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          {video.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={video.cover} alt="" className="h-20 w-14 shrink-0 rounded object-cover" />
          ) : (
            <div className="h-20 w-14 shrink-0 rounded bg-bg" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wide text-fg-muted">
              {video.platformLabel} · {video.account}
            </p>
            <p className="mt-1 line-clamp-3 text-sm text-fg">{video.title}</p>
            <p className="mt-1 text-[11px] text-fg-muted">
              {formatDateTime(new Date(video.publishedAt))}
              {video.durationSeconds != null && ` · ${video.durationSeconds}s`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-fg-muted hover:text-fg" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-6 px-5 py-5">
          <div className="grid grid-cols-3 gap-3">
            <Metric label="Vistas" value={video.views} />
            <Metric label="Me gusta" value={video.likes} />
            <Metric label="Comentarios" value={video.comments} />
          </div>

          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-fg-muted">
              Métricas de la API ({video.platformLabel})
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {video.platform === "instagram" && <Metric label="Alcance" value={video.reach} />}
              {video.platform === "instagram" && <Metric label="Guardados" value={video.saved} />}
              <Metric label="Compartidos" value={video.shares} />
              {video.platform === "instagram" && (
                <Metric label="Interacciones" value={video.totalInteractions} />
              )}
              <div className="rounded-card border border-border bg-bg px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-fg-muted">Engagement</p>
                <p className="mt-1 font-heading text-lg tabular-nums text-fg">
                  {fmtRatio(engagement)}
                </p>
                <p className="text-[10px] text-fg-muted">
                  {video.platform === "instagram" ? "interacciones / alcance" : "(likes + com. + comp.) / vistas"}
                </p>
              </div>
            </div>
          </section>

          {video.caption && (
            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-fg-muted">Descripción</h3>
              <p className="whitespace-pre-wrap text-sm text-fg-muted">{video.caption}</p>
            </section>
          )}

          {video.url && (
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
            >
              Ver en {video.platformLabel} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}

          <section className="flex flex-col gap-3 border-t border-border pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-medium uppercase tracking-wider text-fg-muted">Transcripción</h3>
              {transcript ? (
                <GhostButton type="button" disabled={isPending || !canTranscribe} onClick={transcribe}>
                  <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
                  Re-transcribir
                </GhostButton>
              ) : (
                <PrimaryButton type="button" disabled={isPending || !canTranscribe} onClick={transcribe}>
                  <FileText className="h-3.5 w-3.5" />
                  {isPending ? "Transcribiendo…" : "Transcribir"}
                </PrimaryButton>
              )}
            </div>
            <FormMessage state={message} />

            {!video.mediaUrl && (
              <p className="text-xs text-fg-muted">
                {video.platform === "tiktok"
                  ? "TikTok no entrega el archivo de video por API, así que no se puede transcribir desde acá."
                  : "Esta publicación no tiene archivo de video disponible."}
              </p>
            )}
            {video.mediaUrl && !transcriptionReady && (
              <p className="text-xs text-fg-muted">
                Falta <code className="text-fg">GROQ_API_KEY</code> en el entorno para transcribir.
              </p>
            )}

            {transcript === undefined && video.hasTranscript && (
              <p className="text-xs text-fg-muted">Cargando…</p>
            )}
            {transcript && (
              <Link
                href={`/contenido/planificar?transcripcion=${transcript.id}`}
                className="inline-flex items-center gap-1.5 self-start text-sm text-fg-muted hover:text-fg"
              >
                <Clapperboard className="h-3.5 w-3.5" /> Sacar 5 trial reels de este video
              </Link>
            )}
            {transcript && (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] text-fg-muted">
                  {transcript.language && `Idioma: ${transcript.language} · `}
                  {transcript.durationSeconds != null && `${transcript.durationSeconds}s · `}
                  {formatDateTime(new Date(transcript.createdAt))}
                </p>
                {transcript.segments.length > 0 ? (
                  <ol className="flex flex-col gap-1.5">
                    {transcript.segments.map((segment, index) => (
                      <li key={index} className="grid grid-cols-[3rem_1fr] gap-2 text-sm">
                        <span className="text-[11px] tabular-nums text-fg-muted">{stamp(segment.start)}</span>
                        <span className="text-fg">{segment.text}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="whitespace-pre-wrap text-sm text-fg">{transcript.text}</p>
                )}
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-card border border-border bg-bg px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-fg-muted">{label}</p>
      <p className="mt-1 font-heading text-lg tabular-nums text-fg">{fmt(value)}</p>
    </div>
  );
}

function ratio(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || !denominator) return null;
  return numerator / denominator;
}

function stamp(seconds: number): string {
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
