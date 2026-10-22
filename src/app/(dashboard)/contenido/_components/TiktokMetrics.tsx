import { Panel } from "@/components/paneles";
import { formatCompact, formatSigned } from "@/lib/contenido-config";
import type { ContenidoDashboard } from "@/lib/contenido-queries";
import { formatDateTime, formatShortDateStr } from "@/lib/date";
import { ViewsChart } from "./ViewsChart";

/**
 * Bloque de TikTok del dashboard. Los deltas (vistas ganadas, seguidores nuevos)
 * salen de los snapshots diarios y tardan dos días en aparecer; mientras tanto
 * mandan los acumulados de los videos publicados en el rango.
 */
export function TiktokMetrics({
  data,
  rangeLabel,
}: {
  data: ContenidoDashboard;
  rangeLabel: string;
}) {
  const hasDeltas = data.metrics.views !== null;
  const followers = data.accounts.reduce((sum, account) => sum + (account.followerCount ?? 0), 0);
  const likesTotal = data.accounts.reduce((sum, account) => sum + (account.likesCount ?? 0), 0);
  const hint = rangeLabel.toLowerCase();

  const tiles: { label: string; value: number | null; signed?: boolean; hint: string }[] = hasDeltas
    ? [
        { label: "Vistas ganadas", value: data.metrics.views, hint: `${hint} · todos los videos` },
        { label: "Nuevos seguidores", value: data.metrics.followers, signed: true, hint },
        { label: "Me gusta ganados", value: data.metrics.likes, hint },
        { label: "Comentarios", value: data.metrics.comments, hint },
        { label: "Compartidos", value: data.metrics.shares, hint },
        { label: "Videos publicados", value: data.published.count, hint },
        { label: "Seguidores", value: followers, hint: "total de la cuenta" },
        { label: "Me gusta totales", value: likesTotal, hint: "total de la cuenta" },
      ]
    : [
        { label: "Vistas", value: data.published.views, hint: `videos publicados en ${hint}` },
        { label: "Me gusta", value: data.published.likes, hint: `videos publicados en ${hint}` },
        { label: "Comentarios", value: data.published.comments, hint: `videos publicados en ${hint}` },
        { label: "Compartidos", value: data.published.shares, hint: `videos publicados en ${hint}` },
        { label: "Videos publicados", value: data.published.count, hint },
        { label: "Nuevos seguidores", value: data.metrics.followers, signed: true, hint },
        { label: "Seguidores", value: followers, hint: "total de la cuenta" },
        { label: "Me gusta totales", value: likesTotal, hint: "total de la cuenta" },
      ];

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-fg-muted">
        TikTok ·{" "}
        {hasDeltas
          ? "vistas y seguidores ganados según snapshots diarios"
          : "todavía hay un solo snapshot: se muestran los acumulados de lo publicado en el rango. Las vistas ganadas por día aparecen desde mañana"}
        {data.dataUntil && ` · sincronizado ${formatDateTime(data.dataUntil)}`}.
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-card border border-border bg-surface px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-fg-muted">{tile.label}</p>
            <p className="mt-2 font-heading text-2xl tabular-nums text-fg">
              {tile.value == null ? "—" : tile.signed ? formatSigned(tile.value) : formatCompact(tile.value)}
            </p>
            <p className="mt-1.5 truncate text-xs text-fg-muted">
              {tile.value == null ? "sin datos suficientes" : tile.hint}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Panel
          title={hasDeltas ? "Vistas ganadas por día" : "Vistas por día de publicación"}
          hint={
            hasDeltas
              ? "Diferencia entre snapshots consecutivos, todos los videos."
              : "Vistas acumuladas de los videos, agrupadas por el día en que salieron."
          }
        >
          <div className="px-3 py-4">
            <ViewsChart
              label="Vistas por día"
              series={
                hasDeltas
                  ? data.viewsSeries.map((point) => ({ date: point.date, value: point.views }))
                  : data.publishSeries.map((point) => ({ date: point.date, value: point.views }))
              }
              empty="Nada publicado en este rango."
            />
          </div>
        </Panel>

        <Panel title="Mejor contenido" hint={`Publicado en ${hint}, por vistas.`}>
          {data.best.length === 0 ? (
            <p className="px-5 py-6 text-sm text-fg-muted">Nada publicado en este rango.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {data.best.map((video, index) => (
                <li key={video.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-4 text-xs tabular-nums text-fg-muted">{index + 1}</span>
                  {video.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={video.coverImageUrl} alt="" className="h-12 w-9 shrink-0 rounded object-cover" />
                  ) : (
                    <div className="h-12 w-9 shrink-0 rounded bg-bg" />
                  )}
                  <div className="min-w-0 flex-1">
                    <a
                      href={video.shareUrl ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-sm text-fg hover:underline"
                    >
                      {video.title || video.videoDescription || "Sin título"}
                    </a>
                    <p className="text-xs text-fg-muted">
                      {formatShortDateStr(video.publishedAt.toISOString().slice(0, 10))} ·{" "}
                      {formatCompact(video.viewCount ?? 0)} vistas · {formatCompact(video.likeCount ?? 0)} me gusta
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
