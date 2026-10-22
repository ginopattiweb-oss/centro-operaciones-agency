/**
 * Insights y contenido de una cuenta profesional de Instagram (graph.instagram.com).
 *
 * A diferencia de TikTok, Instagram sí devuelve series históricas (hasta 30 días
 * hacia atrás), así que las métricas del período se piden en vivo y no se
 * reconstruyen con snapshots. Lo único que guardamos nosotros son los seguidores
 * por día: `follower_count` sólo existe para cuentas con más de 100 seguidores.
 *
 * Sólo servidor. Todas las funciones reciben el token ya descifrado.
 */

const GRAPH_URL = "https://graph.instagram.com/v21.0";

type GraphError = { error?: { message?: string; code?: number; error_subcode?: number } };

async function graphGet<T>(path: string, params: Record<string, string>, accessToken: string): Promise<T> {
  const query = new URLSearchParams({ ...params, access_token: accessToken });
  const response = await fetch(`${GRAPH_URL}/${path}?${query}`, { cache: "no-store" });
  const raw = await response.text();
  if (!response.ok) {
    let message = `Instagram respondió ${response.status}.`;
    try {
      message = (JSON.parse(raw) as GraphError).error?.message ?? message;
    } catch {
      /* cuerpo no JSON: queda el genérico */
    }
    console.error(`[instagram] ${response.status} ${path}: ${raw}`);
    throw new Error(message);
  }
  return JSON.parse(raw) as T;
}

// --- Insights de la cuenta ---

/** Métricas que la API sólo entrega como total del período (`metric_type=total_value`). */
const TOTAL_METRICS = [
  "views",
  "reach",
  "accounts_engaged",
  "total_interactions",
  "likes",
  "comments",
  // A nivel cuenta es `saves`; a nivel publicación, `saved`. Así lo nombra Meta.
  "saves",
  "shares",
  "replies",
  "profile_views",
] as const;

export type TotalMetric = (typeof TOTAL_METRICS)[number];
export type AccountTotals = Partial<Record<TotalMetric, number>>;

/** Totales del período [since, until) en epoch segundos. */
export async function fetchAccountTotals(
  accessToken: string,
  since: number,
  until: number
): Promise<AccountTotals> {
  const payload = await graphGet<{
    data: { name: string; total_value?: { value: number } }[];
  }>(
    "me/insights",
    {
      metric: TOTAL_METRICS.join(","),
      period: "day",
      metric_type: "total_value",
      since: String(since),
      until: String(until),
    },
    accessToken
  );
  const totals: AccountTotals = {};
  for (const entry of payload.data) {
    if (entry.total_value) totals[entry.name as TotalMetric] = entry.total_value.value;
  }
  return totals;
}

export type DailyReach = { date: string; reach: number };

/** Alcance por día. `end_time` viene en UTC-7 (horario de Meta); nos quedamos con la fecha. */
export async function fetchDailyReach(
  accessToken: string,
  since: number,
  until: number
): Promise<DailyReach[]> {
  const payload = await graphGet<{
    data: { name: string; values: { value: number; end_time: string }[] }[];
  }>(
    "me/insights",
    { metric: "reach", period: "day", since: String(since), until: String(until) },
    accessToken
  );
  const series = payload.data.find((entry) => entry.name === "reach")?.values ?? [];
  return series.map((point) => ({ date: point.end_time.slice(0, 10), reach: point.value }));
}

// --- Contenido ---

export type MediaType = "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
export type MediaProductType = "FEED" | "REELS" | "STORY" | "AD";

export type InstagramMedia = {
  id: string;
  caption: string | null;
  mediaType: MediaType;
  productType: MediaProductType;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  /** ISO 8601 con offset, tal como lo manda la API. */
  timestamp: string;
  likeCount: number | null;
  commentsCount: number | null;
};

const MEDIA_FIELDS =
  "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";

/** Últimas publicaciones (feed + reels), de la más nueva a la más vieja. */
export async function fetchRecentMedia(accessToken: string, limit = 50): Promise<InstagramMedia[]> {
  const payload = await graphGet<{
    data: {
      id: string;
      caption?: string;
      media_type: MediaType;
      media_product_type: MediaProductType;
      media_url?: string;
      thumbnail_url?: string;
      permalink?: string;
      timestamp: string;
      like_count?: number;
      comments_count?: number;
    }[];
  }>("me/media", { fields: MEDIA_FIELDS, limit: String(limit) }, accessToken);

  return payload.data.map((item) => ({
    id: item.id,
    caption: item.caption ?? null,
    mediaType: item.media_type,
    productType: item.media_product_type,
    mediaUrl: item.media_url ?? null,
    thumbnailUrl: item.thumbnail_url ?? null,
    permalink: item.permalink ?? null,
    timestamp: item.timestamp,
    likeCount: item.like_count ?? null,
    commentsCount: item.comments_count ?? null,
  }));
}

export type MediaInsights = {
  views: number | null;
  reach: number | null;
  saved: number | null;
  shares: number | null;
  totalInteractions: number | null;
};

/**
 * Insights de una publicación. Devuelve null si la API no los soporta para ese
 * ítem (publicaciones viejas, o tipos sin métricas): un post sin insights no
 * puede tirar abajo el dashboard entero.
 */
export async function fetchMediaInsights(
  accessToken: string,
  mediaId: string
): Promise<MediaInsights | null> {
  try {
    const payload = await graphGet<{ data: { name: string; values: { value: number }[] }[] }>(
      `${mediaId}/insights`,
      { metric: "views,reach,saved,shares,total_interactions" },
      accessToken
    );
    const get = (name: string) =>
      payload.data.find((entry) => entry.name === name)?.values[0]?.value ?? null;
    return {
      views: get("views"),
      reach: get("reach"),
      saved: get("saved"),
      shares: get("shares"),
      totalInteractions: get("total_interactions"),
    };
  } catch {
    return null;
  }
}
