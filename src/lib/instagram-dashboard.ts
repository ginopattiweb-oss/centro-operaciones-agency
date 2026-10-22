/**
 * Datos del dashboard de Contenido a partir de las cuentas de Instagram.
 *
 * Se piden en vivo a la Graph API y se cachean 10 minutos: Meta limita a 200
 * llamadas por hora por cuenta y un dashboard cuesta ~25 (totales, alcance por
 * día, listado y un insight por publicación del período). Cada apertura además
 * refresca el perfil y guarda el snapshot de seguidores del día, así el
 * historial crece aunque no haya cron.
 */
import { unstable_cache } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { instagramAccountSnapshots, instagramAccounts } from "@/db/schema";
import { addDaysToDateStr, dateStringBA, startOfWeekUtc, todayStringBA, TZ } from "@/lib/date";
import { fromZonedTime } from "date-fns-tz";
import { contenidoRangeDays, type ContenidoRange } from "@/lib/contenido-config";
import { fetchProfile } from "@/lib/instagram";
import {
  fetchAccountTotals,
  fetchDailyReach,
  fetchMediaInsights,
  fetchRecentMedia,
  type AccountTotals,
  type InstagramMedia,
  type MediaInsights,
  type TotalMetric,
} from "@/lib/instagram-insights";
import { updateInstagramProfile } from "@/lib/instagram-queries";
import { getValidAccessToken } from "@/lib/instagram-token";

export const INSTAGRAM_CACHE_TAG = "instagram";
const CACHE_SECONDS = 600;
/** Publicaciones del período a las que se les piden insights. Cota de llamadas. */
const MAX_MEDIA_INSIGHTS = 20;
/** Listado completo con insights (Reels, Planificar): una llamada por publicación. */
const MAX_MEDIA_WITH_INSIGHTS = 40;

export type RitmoItem = {
  key: string;
  label: string;
  thisWeek: number;
  lastWeek: number;
  target: number;
};

export type RankedMedia = InstagramMedia & {
  accountUsername: string | null;
  insights: MediaInsights | null;
};

export type InstagramDashboard = {
  accountCount: number;
  /** Ventana consultada, como fechas sueltas de Buenos Aires (until exclusivo). */
  since: string;
  until: string;
  ritmo: RitmoItem[];
  totals: AccountTotals;
  /** Seguidores ganados en el período según nuestros snapshots; null sin dos puntos. */
  followersDelta: number | null;
  reachSeries: { date: string; reach: number }[];
  best: RankedMedia[];
  /** Reels y videos publicados por día ('YYYY-MM-DD' Buenos Aires) en las últimas dos semanas. */
  dailyVideos: Record<string, number>;
  /** Mensajes de error por cuenta: una cuenta rota no oculta las demás. */
  errors: string[];
  fetchedAt: string;
};

/** Metas semanales por formato. */
export const WEEKLY_TARGETS = { reels: 3, posts: 2 } as const;

/** Instante UTC del inicio de un día 'YYYY-MM-DD' en Buenos Aires, en epoch segundos. */
function dayStartEpoch(dateStr: string): number {
  return Math.floor(fromZonedTime(`${dateStr}T00:00:00`, TZ).getTime() / 1000);
}

/** La API manda offsets sin dos puntos ("+0000"); Date los acepta con ellos. */
export function parseMediaTimestamp(value: string): Date {
  return new Date(value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
}

/**
 * Carga de una cuenta, cacheada por (cuenta, ventana). Si la API falla, la
 * excepción sale sin cachearse: el próximo intento vuelve a pegarle a Meta en
 * vez de mostrar el error diez minutos.
 */
const loadAccountDashboard = unstable_cache(
  async (accountId: string, since: string, until: string) => {
    const account = await db.query.instagramAccounts.findFirst({
      where: eq(instagramAccounts.id, accountId),
    });
    if (!account) throw new Error("La cuenta ya no existe.");
    return loadAccountData(account, since, until);
  },
  ["instagram-account-dashboard"],
  { revalidate: CACHE_SECONDS, tags: [INSTAGRAM_CACHE_TAG] }
);

async function loadAccountData(
  account: typeof instagramAccounts.$inferSelect,
  since: string,
  until: string
) {
  const accessToken = await getValidAccessToken(account);
  const sinceEpoch = dayStartEpoch(since);
  const untilEpoch = dayStartEpoch(until);

  const [profile, totals, reach, media] = await Promise.all([
    fetchProfile(accessToken),
    fetchAccountTotals(accessToken, sinceEpoch, untilEpoch),
    fetchDailyReach(accessToken, sinceEpoch, untilEpoch),
    fetchRecentMedia(accessToken),
  ]);

  await updateInstagramProfile(account.id, {
    username: profile.username,
    name: profile.name,
    avatarUrl: profile.avatarUrl,
    biography: profile.biography,
    accountType: profile.accountType,
    followerCount: profile.followerCount,
    followsCount: profile.followsCount,
    mediaCount: profile.mediaCount,
  });

  const sinceMs = sinceEpoch * 1000;
  const inRange = media
    .filter((item) => parseMediaTimestamp(item.timestamp).getTime() >= sinceMs)
    .slice(0, MAX_MEDIA_INSIGHTS);
  const ranked: RankedMedia[] = await Promise.all(
    inRange.map(async (item) => ({
      ...item,
      accountUsername: profile.username,
      insights: await fetchMediaInsights(accessToken, item.id),
    }))
  );

  // Seguidores: último snapshot del período contra el último anterior al inicio.
  const snapshots = await db
    .select({ capturedOn: instagramAccountSnapshots.capturedOn, followers: instagramAccountSnapshots.followerCount })
    .from(instagramAccountSnapshots)
    .where(eq(instagramAccountSnapshots.accountId, account.id))
    .orderBy(asc(instagramAccountSnapshots.capturedOn));
  const baseline = [...snapshots].reverse().find((row) => row.capturedOn < since);
  const latest = snapshots[snapshots.length - 1];
  const followersDelta =
    baseline && latest && latest.capturedOn >= since ? latest.followers - baseline.followers : null;

  return { totals, reach, media, ranked, followersDelta };
}

function countByWeek(media: InstagramMedia[], weekStart: Date, lastWeekStart: Date) {
  const isReel = (item: InstagramMedia) => item.productType === "REELS";
  const week = (item: InstagramMedia) => {
    const at = parseMediaTimestamp(item.timestamp).getTime();
    if (at >= weekStart.getTime()) return "this";
    if (at >= lastWeekStart.getTime()) return "last";
    return null;
  };
  const counts = { reels: { this: 0, last: 0 }, posts: { this: 0, last: 0 } };
  for (const item of media) {
    const bucket = week(item);
    if (!bucket) continue;
    counts[isReel(item) ? "reels" : "posts"][bucket] += 1;
  }
  return counts;
}

async function buildDashboard(range: ContenidoRange, accountId?: string): Promise<InstagramDashboard> {
  const days = contenidoRangeDays(range);
  const today = todayStringBA();
  // "Datos hasta ayer": el día en curso está incompleto y además Meta lo entrega con demora.
  const until = today;
  const since = addDaysToDateStr(today, -days);

  const accounts = (
    await db.select().from(instagramAccounts).orderBy(asc(instagramAccounts.createdAt))
  ).filter((account) => !accountId || account.id === accountId);

  const totals: AccountTotals = {};
  const reachByDate = new Map<string, number>();
  const allMedia: InstagramMedia[] = [];
  const best: RankedMedia[] = [];
  const errors: string[] = [];
  let followersDelta: number | null = null;
  let followersKnown = false;

  for (const account of accounts) {
    try {
      const data = await loadAccountDashboard(account.id, since, until);
      for (const [key, value] of Object.entries(data.totals)) {
        const metric = key as TotalMetric;
        totals[metric] = (totals[metric] ?? 0) + (value ?? 0);
      }
      for (const point of data.reach) {
        reachByDate.set(point.date, (reachByDate.get(point.date) ?? 0) + point.reach);
      }
      allMedia.push(...data.media);
      best.push(...data.ranked);
      if (data.followersDelta !== null) {
        followersDelta = (followersDelta ?? 0) + data.followersDelta;
        followersKnown = true;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido.";
      errors.push(`@${account.username ?? account.igUserId}: ${message}`);
      await db
        .update(instagramAccounts)
        .set({ status: account.status === "conectada" ? "error" : account.status, lastError: message })
        .where(eq(instagramAccounts.id, account.id));
    }
  }

  const weekStart = startOfWeekUtc();
  const lastWeekStart = new Date(weekStart.getTime() - 7 * 86_400_000);
  const counts = countByWeek(allMedia, weekStart, lastWeekStart);

  const dailyVideos: Record<string, number> = {};
  for (const item of allMedia) {
    if (item.productType !== "REELS" && item.mediaType !== "VIDEO") continue;
    const at = parseMediaTimestamp(item.timestamp);
    if (at < lastWeekStart) continue;
    const day = dateStringBA(at);
    dailyVideos[day] = (dailyVideos[day] ?? 0) + 1;
  }

  best.sort((a, b) => (b.insights?.views ?? -1) - (a.insights?.views ?? -1));

  return {
    accountCount: accounts.length,
    since,
    until,
    ritmo: [
      { key: "reels", label: "Reels", thisWeek: counts.reels.this, lastWeek: counts.reels.last, target: WEEKLY_TARGETS.reels },
      { key: "posts", label: "Publicaciones", thisWeek: counts.posts.this, lastWeek: counts.posts.last, target: WEEKLY_TARGETS.posts },
    ],
    totals,
    followersDelta: followersKnown ? followersDelta : null,
    reachSeries: [...reachByDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, reach]) => ({ date, reach })),
    best: best.slice(0, 5),
    dailyVideos,
    errors,
    fetchedAt: new Date().toISOString(),
  };
}

export const getInstagramDashboard = buildDashboard;

/** Publicaciones recientes de una cuenta (feed + reels) con insights, cacheadas. */
export const loadAccountMedia = unstable_cache(
  async (accountId: string): Promise<RankedMedia[]> => {
    const account = await db.query.instagramAccounts.findFirst({
      where: eq(instagramAccounts.id, accountId),
    });
    if (!account) return [];
    const accessToken = await getValidAccessToken(account);
    const media = await fetchRecentMedia(accessToken);
    return Promise.all(
      media.slice(0, MAX_MEDIA_WITH_INSIGHTS).map(async (item) => ({
        ...item,
        accountUsername: account.username,
        insights: await fetchMediaInsights(accessToken, item.id),
      }))
    );
  },
  ["instagram-account-media"],
  { revalidate: CACHE_SECONDS, tags: [INSTAGRAM_CACHE_TAG] }
);

const loadAccountReels = async (accountId: string): Promise<RankedMedia[]> =>
  (await loadAccountMedia(accountId)).filter((item) => item.productType === "REELS");

/** Reels de todas las cuentas con sus insights, para la pestaña Reels. */
export async function getInstagramReels(): Promise<RankedMedia[]> {
  const accounts = await db
    .select({ id: instagramAccounts.id, username: instagramAccounts.username })
    .from(instagramAccounts)
    .orderBy(asc(instagramAccounts.createdAt));
  const reels: RankedMedia[] = [];
  for (const account of accounts) {
    try {
      reels.push(...(await loadAccountReels(account.id)));
    } catch (error) {
      console.error(`[instagram] reels de ${account.username}:`, error);
    }
  }
  return reels.sort(
    (a, b) => parseMediaTimestamp(b.timestamp).getTime() - parseMediaTimestamp(a.timestamp).getTime()
  );
}
