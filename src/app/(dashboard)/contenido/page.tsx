import Link from "next/link";
import { Panel } from "@/components/paneles";
import {
  CONTENIDO_RANGES,
  formatCompact,
  formatSigned,
  parseContenidoRange,
} from "@/lib/contenido-config";
import {
  getContenidoAccounts,
  getContenidoDashboard,
} from "@/lib/contenido-queries";
import {
  getInstagramDashboard,
  parseMediaTimestamp,
} from "@/lib/instagram-dashboard";
import { getInstagramAccounts } from "@/lib/instagram-queries";
import { formatDateTime, formatShortDateStr } from "@/lib/date";
import { EmptyState } from "./_components/EmptyState";
import { RitmoPanel } from "./_components/RitmoPanel";
import { TiktokMetrics } from "./_components/TiktokMetrics";
import { ViewsChart } from "./_components/ViewsChart";

export const metadata = { title: "Contenido" };

/** Selector de cuenta: `todas`, `ig:<id>` o `tt:<id>`. */
function parseAccountParam(
  value: string | undefined,
): { platform: "ig" | "tt"; id: string } | null {
  const match = value?.match(/^(ig|tt):([0-9a-f-]{36})$/);
  return match ? { platform: match[1] as "ig" | "tt", id: match[2] } : null;
}

export default async function ContenidoDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string; cuenta?: string }>;
}) {
  const params = await searchParams;
  const range = parseContenidoRange(params.rango);
  const selected = parseAccountParam(params.cuenta);
  const rangeLabel =
    CONTENIDO_RANGES.find((option) => option.value === range)?.label ?? range;

  const [igAccounts, ttAccounts] = await Promise.all([
    getInstagramAccounts(),
    getContenidoAccounts(),
  ]);
  const showIg = !selected || selected.platform === "ig";
  const showTt = !selected || selected.platform === "tt";

  const [ig, tiktok] = await Promise.all([
    getInstagramDashboard(
      range,
      selected?.platform === "ig" ? selected.id : undefined,
    ),
    getContenidoDashboard(
      range,
      selected?.platform === "tt" ? selected.id : undefined,
    ),
  ]);

  const accountOptions = [
    { value: "todas", label: "Todas" },
    ...igAccounts.map((account) => ({
      value: `ig:${account.id}`,
      label: `@${account.username ?? "instagram"}`,
    })),
    ...ttAccounts.map((account) => ({
      value: `tt:${account.id}`,
      label: `TikTok · ${account.displayName ?? account.projectName}`,
    })),
  ];
  const currentAccount = selected
    ? `${selected.platform}:${selected.id}`
    : "todas";
  const href = (overrides: { rango?: string; cuenta?: string }) => {
    const query = new URLSearchParams({
      rango: range,
      cuenta: currentAccount,
      ...overrides,
    });
    return `/contenido?${query}`;
  };

  if (igAccounts.length === 0 && ttAccounts.length === 0) {
    return (
      <EmptyState
        title="Todavía no hay cuentas conectadas"
        cta={{ href: "/contenido/cuentas", label: "Ir a Cuentas" }}
      >
        El dashboard se arma con las estadísticas de cada cuenta. Conectá la
        primera desde la pestaña Cuentas.
      </EmptyState>
    );
  }

  const t = ig.totals;
  const tiles: {
    label: string;
    value: number | null | undefined;
    signed?: boolean;
    hint: string;
  }[] = [
    { label: "Vistas", value: t.views, hint: "reels, posts e historias" },
    { label: "Alcance", value: t.reach, hint: "cuentas únicas" },
    {
      label: "Nuevos seguidores",
      value: ig.followersDelta,
      signed: true,
      hint: "según snapshots diarios",
    },
    {
      label: "Interacciones",
      value: t.total_interactions,
      hint: "likes + comentarios + guardados + compartidos",
    },
    {
      label: "Cuentas que interactuaron",
      value: t.accounts_engaged,
      hint: "cuentas únicas",
    },
    {
      label: "Visitas al perfil",
      value: t.profile_views,
      hint: rangeLabel.toLowerCase(),
    },
    { label: "Me gusta", value: t.likes, hint: rangeLabel.toLowerCase() },
    { label: "Guardados", value: t.saves, hint: rangeLabel.toLowerCase() },
    { label: "Compartidos", value: t.shares, hint: rangeLabel.toLowerCase() },
    { label: "Comentarios", value: t.comments, hint: rangeLabel.toLowerCase() },
    {
      label: "Respuestas a historias",
      value: t.replies,
      hint: rangeLabel.toLowerCase(),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {ig.errors.map((message) => (
        <p
          key={message}
          className="rounded-card border border-negative/40 bg-surface px-4 py-3 text-sm text-negative"
        >
          Instagram · {message}
        </p>
      ))}

      <RitmoPanel
        dailyVideos={[
          showIg ? ig.dailyVideos : {},
          showTt ? tiktok.dailyVideos : {},
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
          {accountOptions.map((option) => (
            <Link
              key={option.value}
              href={href({ cuenta: option.value })}
              className={`rounded-md px-3 py-1.5 text-xs transition ${
                option.value === currentAccount
                  ? "bg-accent/15 text-accent-ink"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {CONTENIDO_RANGES.map((option) => (
            <Link
              key={option.value}
              href={href({ rango: option.value })}
              className={`rounded-md px-3 py-1.5 text-xs transition ${
                option.value === range
                  ? "bg-accent/15 text-accent-ink"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>

      {showIg && ig.accountCount > 0 && (
        <p className="text-xs text-fg-muted">
          Instagram · del {formatShortDateStr(ig.since)} al{" "}
          {formatShortDateStr(ig.until)} · datos hasta ayer (IG actualiza con
          demora) · leído {formatDateTime(new Date(ig.fetchedAt))}.
        </p>
      )}

      {showIg && ig.accountCount > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className="rounded-card border border-border bg-surface px-4 py-3"
            >
              <p className="text-xs uppercase tracking-wider text-fg-muted">
                {tile.label}
              </p>
              <p className="mt-2 font-heading text-2xl tabular-nums text-fg">
                {tile.value == null
                  ? "—"
                  : tile.signed
                    ? formatSigned(tile.value)
                    : formatCompact(tile.value)}
              </p>
              <p className="mt-1.5 truncate text-xs text-fg-muted">
                {tile.value == null ? "sin datos suficientes" : tile.hint}
              </p>
            </div>
          ))}
        </div>
      )}

      {showIg && ig.accountCount > 0 && (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Panel
            title="Alcance por día"
            hint="Cuentas únicas alcanzadas cada día, todas las cuentas."
          >
            <div className="px-3 py-4">
              <ViewsChart
                label="Alcance por día"
                series={ig.reachSeries.map((point) => ({
                  date: point.date,
                  value: point.reach,
                }))}
                empty="Instagram todavía no devolvió alcance para este rango."
              />
            </div>
          </Panel>

          <Panel
            title="Mejor contenido"
            hint={`Publicado en ${rangeLabel.toLowerCase()}, por vistas.`}
          >
            {ig.best.length === 0 ? (
              <p className="px-5 py-6 text-sm text-fg-muted">
                Nada publicado en este rango.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {ig.best.map((item, index) => {
                  const cover =
                    item.thumbnailUrl ??
                    (item.mediaType === "VIDEO" ? null : item.mediaUrl);
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 px-5 py-3"
                    >
                      <span className="w-4 text-xs tabular-nums text-fg-muted">
                        {index + 1}
                      </span>
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cover}
                          alt=""
                          className="h-12 w-9 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div className="h-12 w-9 shrink-0 rounded bg-bg" />
                      )}
                      <div className="min-w-0 flex-1">
                        <a
                          href={item.permalink ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-sm text-fg hover:underline"
                        >
                          {item.caption?.split("\n")[0] || "Sin descripción"}
                        </a>
                        <p className="text-xs text-fg-muted">
                          {item.productType === "REELS"
                            ? "Reel"
                            : item.mediaType === "CAROUSEL_ALBUM"
                              ? "Carrusel"
                              : "Post"}{" "}
                          ·{" "}
                          {formatShortDateStr(
                            parseMediaTimestamp(item.timestamp)
                              .toISOString()
                              .slice(0, 10),
                          )}{" "}
                          ·{" "}
                          {item.insights?.views != null
                            ? `${formatCompact(item.insights.views)} vistas`
                            : "sin insights"}
                          {item.likeCount != null &&
                            ` · ${formatCompact(item.likeCount)} me gusta`}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {showTt && tiktok.accounts.length > 0 && (
        <TiktokMetrics data={tiktok} rangeLabel={rangeLabel} />
      )}
    </div>
  );
}
