/**
 * Lectura de la sección Contenido. Hoy la única fuente es TikTok: cuentas,
 * videos y snapshots diarios. Los snapshots guardan valores absolutos, así que
 * cada métrica "del período" es la diferencia entre el último día y el día
 * anterior al inicio del rango. Sin dos días de snapshots no hay delta.
 */
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  projects,
  tiktokAccountSnapshots,
  tiktokAccounts,
  tiktokVideoSnapshots,
  tiktokVideos,
  type TiktokAccount,
  type TiktokVideo,
} from "@/db/schema";
import { addDaysToDateStr, dateStringBA, startOfWeekUtc, todayStringBA } from "@/lib/date";
import {
  contenidoRangeDays,
  WEEKLY_VIDEO_TARGET,
  type ContenidoRange,
} from "@/lib/contenido-config";

export type AccountSummary = Pick<
  TiktokAccount,
  | "id"
  | "displayName"
  | "avatarUrl"
  | "profileDeepLink"
  | "status"
  | "lastError"
  | "followerCount"
  | "likesCount"
  | "videoCount"
  | "lastVideoSyncAt"
  | "lastSnapshotAt"
> & { projectName: string };

export type RitmoCard = {
  accountId: string;
  label: string;
  /** Videos publicados en la semana en curso (lunes a hoy, Buenos Aires). */
  thisWeek: number;
  lastWeek: number;
  target: number;
};

export type DailyTotals = {
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
};

/** null cuando no hay dos snapshots para comparar. */
export type PeriodMetrics = {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  followers: number | null;
  published: number;
};

export type BestVideo = Pick<
  TiktokVideo,
  | "id"
  | "title"
  | "videoDescription"
  | "coverImageUrl"
  | "shareUrl"
  | "publishedAt"
  | "viewCount"
  | "likeCount"
  | "commentCount"
  | "shareCount"
>;

/**
 * Contadores acumulados de los videos publicados dentro del rango. Es lo que se
 * puede mostrar desde el primer día, antes de tener dos snapshots para un delta.
 */
export type PublishedTotals = {
  count: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
};

export type ContenidoDashboard = {
  accounts: AccountSummary[];
  ritmo: RitmoCard[];
  metrics: PeriodMetrics;
  /** Vistas ganadas por día dentro del rango (delta entre snapshots consecutivos). */
  viewsSeries: { date: string; views: number }[];
  published: PublishedTotals;
  /** Videos publicados por día ('YYYY-MM-DD' Buenos Aires) desde el lunes de la semana pasada. */
  dailyVideos: Record<string, number>;
  /** Vistas acumuladas de los videos, agrupadas por día de publicación. */
  publishSeries: { date: string; views: number; count: number }[];
  best: BestVideo[];
  /** Última captura de snapshots; null si nunca corrió el cron. */
  dataUntil: Date | null;
};

const accountSummaryColumns = {
  id: tiktokAccounts.id,
  displayName: tiktokAccounts.displayName,
  avatarUrl: tiktokAccounts.avatarUrl,
  profileDeepLink: tiktokAccounts.profileDeepLink,
  status: tiktokAccounts.status,
  lastError: tiktokAccounts.lastError,
  followerCount: tiktokAccounts.followerCount,
  likesCount: tiktokAccounts.likesCount,
  videoCount: tiktokAccounts.videoCount,
  lastVideoSyncAt: tiktokAccounts.lastVideoSyncAt,
  lastSnapshotAt: tiktokAccounts.lastSnapshotAt,
};

export async function getContenidoAccounts(): Promise<AccountSummary[]> {
  return db
    .select({ ...accountSummaryColumns, projectName: projects.name })
    .from(tiktokAccounts)
    .innerJoin(projects, eq(projects.id, tiktokAccounts.projectId))
    .orderBy(asc(tiktokAccounts.createdAt));
}

/** Videos de todas las cuentas, del más nuevo al más viejo. */
export async function getContenidoVideos(): Promise<
  (TiktokVideo & { accountName: string | null })[]
> {
  const rows = await db
    .select({ video: tiktokVideos, accountName: tiktokAccounts.displayName })
    .from(tiktokVideos)
    .innerJoin(tiktokAccounts, eq(tiktokAccounts.id, tiktokVideos.accountId))
    .orderBy(desc(tiktokVideos.publishedAt));
  return rows.map((row) => ({ ...row.video, accountName: row.accountName }));
}

export async function getContenidoDashboard(
  range: ContenidoRange,
  accountId?: string
): Promise<ContenidoDashboard> {
  const allAccounts = await getContenidoAccounts();
  const accounts = accountId ? allAccounts.filter((account) => account.id === accountId) : allAccounts;
  const accountIds = accounts.map((account) => account.id);
  if (accounts.length === 0) {
    return {
      accounts,
      ritmo: [],
      metrics: { views: null, likes: null, comments: null, shares: null, followers: null, published: 0 },
      viewsSeries: [],
      published: { count: 0, views: 0, likes: 0, comments: 0, shares: 0 },
      dailyVideos: {},
      publishSeries: [],
      best: [],
      dataUntil: null,
    };
  }

  const days = contenidoRangeDays(range);
  const today = todayStringBA();
  // Un día extra hacia atrás: la base contra la que se resta el primer día del rango.
  const baseline = addDaysToDateStr(today, -days);
  const rangeStartAt = new Date(`${baseline}T03:00:00.000Z`);

  const [videoTotals, accountTotals, publishedRows, bestRows] = await Promise.all([
    db
      .select({
        date: tiktokVideoSnapshots.capturedOn,
        views: sql<number>`sum(${tiktokVideoSnapshots.viewCount})::bigint`,
        likes: sql<number>`sum(${tiktokVideoSnapshots.likeCount})::bigint`,
        comments: sql<number>`sum(${tiktokVideoSnapshots.commentCount})::bigint`,
        shares: sql<number>`sum(${tiktokVideoSnapshots.shareCount})::bigint`,
      })
      .from(tiktokVideoSnapshots)
      .innerJoin(tiktokVideos, eq(tiktokVideos.id, tiktokVideoSnapshots.videoId))
      .where(
        and(gte(tiktokVideoSnapshots.capturedOn, baseline), inArray(tiktokVideos.accountId, accountIds))
      )
      .groupBy(tiktokVideoSnapshots.capturedOn)
      .orderBy(tiktokVideoSnapshots.capturedOn),
    db
      .select({
        date: tiktokAccountSnapshots.capturedOn,
        followers: sql<number>`sum(${tiktokAccountSnapshots.followerCount})::bigint`,
      })
      .from(tiktokAccountSnapshots)
      .where(
        and(gte(tiktokAccountSnapshots.capturedOn, baseline), inArray(tiktokAccountSnapshots.accountId, accountIds))
      )
      .groupBy(tiktokAccountSnapshots.capturedOn)
      .orderBy(tiktokAccountSnapshots.capturedOn),
    db
      .select({
        accountId: tiktokVideos.accountId,
        publishedAt: tiktokVideos.publishedAt,
        viewCount: tiktokVideos.viewCount,
        likeCount: tiktokVideos.likeCount,
        commentCount: tiktokVideos.commentCount,
        shareCount: tiktokVideos.shareCount,
      })
      .from(tiktokVideos)
      .where(
        and(
          inArray(tiktokVideos.accountId, accountIds),
          gte(
            tiktokVideos.publishedAt,
            new Date(Math.min(rangeStartAt.getTime(), startOfWeekUtc().getTime() - 7 * 86_400_000))
          )
        )
      ),
    db
      .select({
        id: tiktokVideos.id,
        title: tiktokVideos.title,
        videoDescription: tiktokVideos.videoDescription,
        coverImageUrl: tiktokVideos.coverImageUrl,
        shareUrl: tiktokVideos.shareUrl,
        publishedAt: tiktokVideos.publishedAt,
        viewCount: tiktokVideos.viewCount,
        likeCount: tiktokVideos.likeCount,
        commentCount: tiktokVideos.commentCount,
        shareCount: tiktokVideos.shareCount,
      })
      .from(tiktokVideos)
      .where(
        and(
          inArray(tiktokVideos.accountId, accountIds),
          gte(tiktokVideos.publishedAt, rangeStartAt),
          eq(tiktokVideos.available, true)
        )
      )
      .orderBy(desc(tiktokVideos.viewCount))
      .limit(5),
  ]);

  const series: DailyTotals[] = videoTotals.map((row) => ({
    date: row.date,
    views: Number(row.views),
    likes: Number(row.likes),
    comments: Number(row.comments),
    shares: Number(row.shares),
  }));

  const delta = (key: keyof Omit<DailyTotals, "date">) =>
    series.length >= 2 ? series[series.length - 1][key] - series[0][key] : null;

  const followers =
    accountTotals.length >= 2
      ? Number(accountTotals[accountTotals.length - 1].followers) -
        Number(accountTotals[0].followers)
      : null;

  const viewsSeries = series.slice(1).map((point, index) => ({
    date: point.date,
    views: Math.max(0, point.views - series[index].views),
  }));

  // Ritmo semanal: lunes de esta semana y de la anterior, en Buenos Aires.
  const weekStart = startOfWeekUtc();
  const lastWeekStart = new Date(weekStart.getTime() - 7 * 86_400_000);
  const ritmo: RitmoCard[] = accounts.map((account) => {
    const mine = publishedRows.filter((row) => row.accountId === account.id);
    return {
      accountId: account.id,
      label: account.displayName ?? account.projectName,
      thisWeek: mine.filter((row) => row.publishedAt >= weekStart).length,
      lastWeek: mine.filter((row) => row.publishedAt >= lastWeekStart && row.publishedAt < weekStart)
        .length,
      target: WEEKLY_VIDEO_TARGET,
    };
  });

  const dailyVideos: Record<string, number> = {};
  for (const row of publishedRows) {
    if (row.publishedAt < lastWeekStart) continue;
    const day = dateStringBA(row.publishedAt);
    dailyVideos[day] = (dailyVideos[day] ?? 0) + 1;
  }

  const inRange = publishedRows.filter((row) => row.publishedAt >= rangeStartAt);
  const published: PublishedTotals = inRange.reduce(
    (acc, row) => ({
      count: acc.count + 1,
      views: acc.views + (row.viewCount ?? 0),
      likes: acc.likes + (row.likeCount ?? 0),
      comments: acc.comments + (row.commentCount ?? 0),
      shares: acc.shares + (row.shareCount ?? 0),
    }),
    { count: 0, views: 0, likes: 0, comments: 0, shares: 0 }
  );
  const byDay = new Map<string, { views: number; count: number }>();
  for (const row of inRange) {
    const day = dateStringBA(row.publishedAt);
    const current = byDay.get(day) ?? { views: 0, count: 0 };
    byDay.set(day, { views: current.views + (row.viewCount ?? 0), count: current.count + 1 });
  }
  const publishSeries = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, ...value }));

  const dataUntil = accounts.reduce<Date | null>((latest, account) => {
    if (!account.lastSnapshotAt) return latest;
    return !latest || account.lastSnapshotAt > latest ? account.lastSnapshotAt : latest;
  }, null);

  return {
    accounts,
    ritmo,
    metrics: {
      views: delta("views"),
      likes: delta("likes"),
      comments: delta("comments"),
      shares: delta("shares"),
      followers,
      published: published.count,
    },
    viewsSeries,
    published,
    dailyVideos,
    publishSeries,
    best: bestRows,
    dataUntil,
  };
}
