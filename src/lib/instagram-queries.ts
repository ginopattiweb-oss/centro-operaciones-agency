/** Lectura y escritura de cuentas de Instagram de la sección Contenido. */
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  instagramAccountSnapshots,
  instagramAccounts,
  projects,
  type InstagramAccount,
  type NewInstagramAccount,
} from "@/db/schema";
import { todayStringBA } from "@/lib/date";

export type InstagramAccountView = Pick<
  InstagramAccount,
  | "id"
  | "username"
  | "name"
  | "avatarUrl"
  | "accountType"
  | "status"
  | "lastError"
  | "followerCount"
  | "followsCount"
  | "mediaCount"
  | "accessTokenExpiresAt"
  | "lastProfileSyncAt"
> & { projectName: string };

export async function getInstagramAccounts(): Promise<InstagramAccountView[]> {
  return db
    .select({
      id: instagramAccounts.id,
      username: instagramAccounts.username,
      name: instagramAccounts.name,
      avatarUrl: instagramAccounts.avatarUrl,
      accountType: instagramAccounts.accountType,
      status: instagramAccounts.status,
      lastError: instagramAccounts.lastError,
      followerCount: instagramAccounts.followerCount,
      followsCount: instagramAccounts.followsCount,
      mediaCount: instagramAccounts.mediaCount,
      accessTokenExpiresAt: instagramAccounts.accessTokenExpiresAt,
      lastProfileSyncAt: instagramAccounts.lastProfileSyncAt,
      projectName: projects.name,
    })
    .from(instagramAccounts)
    .innerJoin(projects, eq(projects.id, instagramAccounts.projectId))
    .orderBy(asc(instagramAccounts.createdAt));
}

export async function getInstagramAccountById(id: string): Promise<InstagramAccount | undefined> {
  return db.query.instagramAccounts.findFirst({ where: eq(instagramAccounts.id, id) });
}

/**
 * Alta o reconexión. La clave es `ig_user_id`: volver a autorizar la misma
 * cuenta pisa token, perfil y estado en vez de duplicar la fila.
 */
export async function upsertInstagramAccount(values: NewInstagramAccount): Promise<void> {
  await db
    .insert(instagramAccounts)
    .values(values)
    .onConflictDoUpdate({
      target: instagramAccounts.igUserId,
      set: {
        projectId: values.projectId,
        username: values.username,
        name: values.name,
        avatarUrl: values.avatarUrl,
        biography: values.biography,
        accountType: values.accountType,
        followerCount: values.followerCount,
        followsCount: values.followsCount,
        mediaCount: values.mediaCount,
        accessTokenCipher: values.accessTokenCipher,
        accessTokenExpiresAt: values.accessTokenExpiresAt,
        grantedScope: values.grantedScope,
        status: "conectada",
        lastError: null,
        lastProfileSyncAt: values.lastProfileSyncAt,
      },
    });

  await recordInstagramSnapshot(values.igUserId, values);
}

/** Un registro por día. Correr dos veces el mismo día actualiza en vez de duplicar. */
async function recordInstagramSnapshot(
  igUserId: string,
  counters: Pick<NewInstagramAccount, "followerCount" | "followsCount" | "mediaCount">
): Promise<void> {
  if (
    counters.followerCount == null ||
    counters.followsCount == null ||
    counters.mediaCount == null
  ) {
    return;
  }
  const account = await db.query.instagramAccounts.findFirst({
    where: eq(instagramAccounts.igUserId, igUserId),
    columns: { id: true },
  });
  if (!account) return;

  await db
    .insert(instagramAccountSnapshots)
    .values({
      accountId: account.id,
      capturedOn: todayStringBA(),
      followerCount: counters.followerCount,
      followsCount: counters.followsCount,
      mediaCount: counters.mediaCount,
    })
    .onConflictDoUpdate({
      target: [instagramAccountSnapshots.accountId, instagramAccountSnapshots.capturedOn],
      set: {
        capturedAt: sql`now()`,
        followerCount: counters.followerCount,
        followsCount: counters.followsCount,
        mediaCount: counters.mediaCount,
      },
    });
}

export async function updateInstagramProfile(
  id: string,
  profile: Pick<
    NewInstagramAccount,
    | "username"
    | "name"
    | "avatarUrl"
    | "biography"
    | "accountType"
    | "followerCount"
    | "followsCount"
    | "mediaCount"
  >,
  token?: { accessTokenCipher: string; accessTokenExpiresAt: Date }
): Promise<void> {
  const [row] = await db
    .update(instagramAccounts)
    .set({
      ...profile,
      ...token,
      status: "conectada",
      lastError: null,
      lastProfileSyncAt: new Date(),
    })
    .where(eq(instagramAccounts.id, id))
    .returning({ igUserId: instagramAccounts.igUserId });
  if (row) await recordInstagramSnapshot(row.igUserId, profile);
}

export async function markInstagramAccountError(
  id: string,
  status: InstagramAccount["status"],
  message: string
): Promise<void> {
  await db
    .update(instagramAccounts)
    .set({ status, lastError: message })
    .where(eq(instagramAccounts.id, id));
}

export async function deleteInstagramAccount(id: string): Promise<void> {
  await db.delete(instagramAccounts).where(eq(instagramAccounts.id, id));
}
