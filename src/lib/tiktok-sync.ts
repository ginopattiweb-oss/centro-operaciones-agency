/**
 * Sincronización de una cuenta de TikTok: tokens, perfil, videos y snapshots.
 *
 * Los contadores son acumulados al momento de la consulta, así que cada sync
 * guarda el snapshot del día (uno por video y uno por cuenta). Correr dos veces
 * el mismo día pisa el snapshot en vez de duplicarlo.
 */
import { and, eq, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  tiktokAccountSnapshots,
  tiktokAccounts,
  tiktokVideoSnapshots,
  tiktokVideos,
  type NewTiktokAccount,
  type TiktokAccount,
} from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { todayStringBA } from "@/lib/date";
import { fetchAllVideos, fetchProfile, refreshTokens, type TiktokTokens } from "@/lib/tiktok";

export class TiktokTokenExpired extends Error {
  constructor() {
    super("El acceso venció: volvé a conectar la cuenta.");
    this.name = "TiktokTokenExpired";
  }
}

function tokenColumns(tokens: TiktokTokens) {
  return {
    accessTokenCipher: encryptSecret(tokens.accessToken),
    refreshTokenCipher: encryptSecret(tokens.refreshToken),
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
    grantedScope: tokens.scope,
  };
}

/** Alta o reconexión por `open_id`: volver a autorizar pisa tokens y estado. */
export async function upsertTiktokAccount(
  projectId: string,
  tokens: TiktokTokens,
  profile: Awaited<ReturnType<typeof fetchProfile>>
): Promise<string> {
  const values: NewTiktokAccount = {
    projectId,
    openId: profile.openId || tokens.openId,
    unionId: profile.unionId,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    bioDescription: profile.bioDescription,
    isVerified: profile.isVerified,
    profileDeepLink: profile.profileDeepLink,
    followerCount: profile.followerCount,
    followingCount: profile.followingCount,
    likesCount: profile.likesCount,
    videoCount: profile.videoCount,
    ...tokenColumns(tokens),
    status: "conectada",
    lastError: null,
    lastProfileSyncAt: new Date(),
  };
  const [row] = await db
    .insert(tiktokAccounts)
    .values(values)
    .onConflictDoUpdate({
      target: tiktokAccounts.openId,
      set: { ...values, openId: undefined },
    })
    .returning({ id: tiktokAccounts.id });
  return row.id;
}

/**
 * Access token vigente. Dura 24 h, así que casi siempre se renueva con el
 * refresh; si el refresh venció, la cuenta queda marcada para reconectar.
 */
async function getValidAccessToken(account: TiktokAccount): Promise<string> {
  if (account.accessTokenExpiresAt.getTime() > Date.now() + 60_000) {
    return decryptSecret(account.accessTokenCipher);
  }
  if (account.refreshTokenExpiresAt.getTime() <= Date.now()) {
    await db
      .update(tiktokAccounts)
      .set({ status: "token_vencido", lastError: "El acceso venció: volvé a conectar la cuenta." })
      .where(eq(tiktokAccounts.id, account.id));
    throw new TiktokTokenExpired();
  }
  const tokens = await refreshTokens(decryptSecret(account.refreshTokenCipher));
  await db.update(tiktokAccounts).set(tokenColumns(tokens)).where(eq(tiktokAccounts.id, account.id));
  return tokens.accessToken;
}

/** Perfil + videos + snapshots del día. Devuelve cuántos videos quedaron sincronizados. */
export async function syncTiktokAccount(accountId: string): Promise<{ videos: number }> {
  const account = await db.query.tiktokAccounts.findFirst({ where: eq(tiktokAccounts.id, accountId) });
  if (!account) throw new Error("La cuenta ya no existe.");

  const accessToken = await getValidAccessToken(account);
  const [profile, videos] = await Promise.all([fetchProfile(accessToken), fetchAllVideos(accessToken)]);
  const now = new Date();
  const today = todayStringBA();

  await db
    .update(tiktokAccounts)
    .set({
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      bioDescription: profile.bioDescription,
      isVerified: profile.isVerified,
      profileDeepLink: profile.profileDeepLink,
      followerCount: profile.followerCount,
      followingCount: profile.followingCount,
      likesCount: profile.likesCount,
      videoCount: profile.videoCount,
      status: "conectada",
      lastError: null,
      lastProfileSyncAt: now,
      lastVideoSyncAt: now,
      lastSnapshotAt: now,
    })
    .where(eq(tiktokAccounts.id, accountId));

  if (
    profile.followerCount != null &&
    profile.followingCount != null &&
    profile.likesCount != null &&
    profile.videoCount != null
  ) {
    await db
      .insert(tiktokAccountSnapshots)
      .values({
        accountId,
        capturedOn: today,
        followerCount: profile.followerCount,
        followingCount: profile.followingCount,
        likesCount: profile.likesCount,
        videoCount: profile.videoCount,
      })
      .onConflictDoUpdate({
        target: [tiktokAccountSnapshots.accountId, tiktokAccountSnapshots.capturedOn],
        set: {
          capturedAt: sql`now()`,
          followerCount: profile.followerCount,
          followingCount: profile.followingCount,
          likesCount: profile.likesCount,
          videoCount: profile.videoCount,
        },
      });
  }

  if (videos.length > 0) {
    // Upsert por tiktok_id: la sync es idempotente.
    const rows = await db
      .insert(tiktokVideos)
      .values(videos.map((video) => ({ ...video, accountId, available: true, unavailableSince: null, lastSeenAt: now })))
      .onConflictDoUpdate({
        target: tiktokVideos.tiktokId,
        set: {
          title: sql`excluded.title`,
          videoDescription: sql`excluded.video_description`,
          coverImageUrl: sql`excluded.cover_image_url`,
          shareUrl: sql`excluded.share_url`,
          embedLink: sql`excluded.embed_link`,
          duration: sql`excluded.duration`,
          width: sql`excluded.width`,
          height: sql`excluded.height`,
          viewCount: sql`excluded.view_count`,
          likeCount: sql`excluded.like_count`,
          commentCount: sql`excluded.comment_count`,
          shareCount: sql`excluded.share_count`,
          available: true,
          unavailableSince: null,
          lastSeenAt: now,
        },
      })
      .returning({ id: tiktokVideos.id, tiktokId: tiktokVideos.tiktokId });

    const idByTiktokId = new Map(rows.map((row) => [row.tiktokId, row.id]));
    const snapshots = videos
      .filter((video) => video.viewCount != null)
      .map((video) => ({
        videoId: idByTiktokId.get(video.tiktokId)!,
        capturedOn: today,
        viewCount: video.viewCount ?? 0,
        likeCount: video.likeCount ?? 0,
        commentCount: video.commentCount ?? 0,
        shareCount: video.shareCount ?? 0,
      }));
    if (snapshots.length > 0) {
      await db
        .insert(tiktokVideoSnapshots)
        .values(snapshots)
        .onConflictDoUpdate({
          target: [tiktokVideoSnapshots.videoId, tiktokVideoSnapshots.capturedOn],
          set: {
            capturedAt: sql`now()`,
            viewCount: sql`excluded.view_count`,
            likeCount: sql`excluded.like_count`,
            commentCount: sql`excluded.comment_count`,
            shareCount: sql`excluded.share_count`,
          },
        });
    }

    // Lo que TikTok dejó de devolver (borrado o privado) se marca, nunca se borra.
    const seen = rows.map((row) => row.id);
    await db
      .update(tiktokVideos)
      .set({ available: false, unavailableSince: now })
      .where(
        and(eq(tiktokVideos.accountId, accountId), eq(tiktokVideos.available, true), notInArray(tiktokVideos.id, seen))
      );
  }

  return { videos: videos.length };
}

export async function markTiktokError(id: string, message: string): Promise<void> {
  await db.update(tiktokAccounts).set({ status: "error", lastError: message }).where(eq(tiktokAccounts.id, id));
}

export async function deleteTiktokAccount(id: string): Promise<void> {
  await db.delete(tiktokAccounts).where(eq(tiktokAccounts.id, id));
}
