/** Lectura y escritura de Inspiración: conexión con Facebook, referentes y sus publicaciones. */
import { asc, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  inspirationAccounts,
  metaConnections,
  inspirationMedia,
  type InspirationAccount,
  type InspirationMedia,
  type MetaConnection,
} from "@/db/schema";
import { decryptSecret } from "@/lib/crypto";
import {
  discoverAccount,
  findLinkedInstagram,
  isUnreachableObject,
  type DiscoveredAccount,
} from "@/lib/meta-discovery";

export async function getMetaConnection(): Promise<MetaConnection | undefined> {
  return db.query.metaConnections.findFirst({ orderBy: (table, { desc }) => [desc(table.createdAt)] });
}

export async function getInspirationAccounts(): Promise<InspirationAccount[]> {
  return db.select().from(inspirationAccounts).orderBy(asc(inspirationAccounts.createdAt));
}

export type HookMedia = InspirationMedia & { username: string; avatarUrl: string | null };

/** Publicaciones que superan la mediana de su cuenta, de mayor a menor ratio. */
export async function getDetectedHooks(limit = 24): Promise<HookMedia[]> {
  const rows = await db
    .select({ media: inspirationMedia, username: inspirationAccounts.username, avatarUrl: inspirationAccounts.avatarUrl })
    .from(inspirationMedia)
    .innerJoin(inspirationAccounts, eq(inspirationAccounts.id, inspirationMedia.accountId))
    .where(gt(inspirationMedia.performanceRatio, 1.3))
    .orderBy(desc(inspirationMedia.performanceRatio))
    .limit(limit);
  return rows.map((row) => ({ ...row.media, username: row.username, avatarUrl: row.avatarUrl }));
}

export async function getInspirationMediaForAccount(accountId: string): Promise<InspirationMedia[]> {
  return db
    .select()
    .from(inspirationMedia)
    .where(eq(inspirationMedia.accountId, accountId))
    .orderBy(desc(inspirationMedia.publishedAt));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Escanea una cuenta con business_discovery y guarda perfil y publicaciones.
 * Calcula la mediana de me gusta y el ratio de cada publicación contra ella.
 */
export async function scanInspirationAccount(
  connection: MetaConnection,
  username: string
): Promise<{ account: InspirationAccount; discovered: DiscoveredAccount }> {
  if (connection.accessTokenExpiresAt.getTime() <= Date.now()) {
    throw new Error("El token de Facebook venció: volvé a conectar desde Inspiración.");
  }
  const accessToken = decryptSecret(connection.accessTokenCipher);
  let discovered: DiscoveredAccount;
  try {
    discovered = await discoverAccount(connection.igBusinessAccountId, accessToken, username);
  } catch (error) {
    if (!isUnreachableObject(error)) throw error;
    // El Instagram propio se desvinculó de la página. Con el mismo token se busca
    // el que esté vinculado ahora y se reintenta: business_discovery funciona
    // desde cualquier cuenta profesional, no hace falta que sea la de antes.
    await relinkInstagram(connection, accessToken);
    discovered = await discoverAccount(connection.igBusinessAccountId, accessToken, username);
  }

  const likes = discovered.media.map((item) => item.likeCount).filter((value): value is number => value != null);
  const medianLikes = median(likes);
  const now = new Date();

  const [account] = await db
    .insert(inspirationAccounts)
    .values({
      username: discovered.username,
      name: discovered.name,
      biography: discovered.biography,
      avatarUrl: discovered.avatarUrl,
      website: discovered.website,
      followersCount: discovered.followersCount,
      mediaCount: discovered.mediaCount,
      medianLikes,
      lastScannedAt: now,
      lastError: null,
    })
    .onConflictDoUpdate({
      target: inspirationAccounts.username,
      set: {
        name: discovered.name,
        biography: discovered.biography,
        avatarUrl: discovered.avatarUrl,
        website: discovered.website,
        followersCount: discovered.followersCount,
        mediaCount: discovered.mediaCount,
        medianLikes,
        lastScannedAt: now,
        lastError: null,
      },
    })
    .returning();

  if (discovered.media.length > 0) {
    await db
      .insert(inspirationMedia)
      .values(
        discovered.media.map((item) => ({
          accountId: account.id,
          igMediaId: item.id,
          caption: item.caption,
          mediaType: item.mediaType,
          productType: item.productType,
          thumbnailUrl: item.thumbnailUrl,
          permalink: item.permalink,
          publishedAt: new Date(item.timestamp.replace(/([+-]\d{2})(\d{2})$/, "$1:$2")),
          likeCount: item.likeCount,
          commentsCount: item.commentsCount,
          performanceRatio: medianLikes && item.likeCount != null ? item.likeCount / medianLikes : null,
          lastSeenAt: now,
        }))
      )
      .onConflictDoUpdate({
        target: inspirationMedia.igMediaId,
        set: {
          caption: sql`excluded.caption`,
          thumbnailUrl: sql`excluded.thumbnail_url`,
          likeCount: sql`excluded.like_count`,
          commentsCount: sql`excluded.comments_count`,
          performanceRatio: sql`excluded.performance_ratio`,
          lastSeenAt: now,
        },
      });
  }

  return { account, discovered };
}

/**
 * Vuelve a resolver la cuenta de Instagram de la conexión y la guarda. Actualiza
 * también el objeto recibido, así un escaneo de varias cuentas no repite esto
 * en cada una.
 */
async function relinkInstagram(connection: MetaConnection, accessToken: string): Promise<void> {
  const previous = connection.igUsername ?? connection.igBusinessAccountId;
  let linked;
  try {
    linked = await findLinkedInstagram(accessToken);
  } catch {
    throw new Error(
      `@${previous} ya no está vinculada a ninguna página de Facebook y no encontramos otra cuenta de Instagram profesional. Vinculala de nuevo desde Meta Business Suite y volvé a conectar.`
    );
  }
  if (linked.igBusinessAccountId === connection.igBusinessAccountId) {
    throw new Error(`Facebook no deja leer @${previous}. Desconectá y volvé a conectar desde Inspiración.`);
  }
  console.log(`[meta] @${previous} ya no responde; uso @${linked.igUsername ?? linked.igBusinessAccountId}`);

  const update = {
    pageId: linked.pageId,
    pageName: linked.pageName,
    igBusinessAccountId: linked.igBusinessAccountId,
    igUsername: linked.igUsername,
    lastError: null,
  };
  await db.update(metaConnections).set(update).where(eq(metaConnections.id, connection.id));
  Object.assign(connection, update);
}

export async function markInspirationError(username: string, message: string): Promise<void> {
  await db
    .update(inspirationAccounts)
    .set({ lastError: message })
    .where(eq(inspirationAccounts.username, username));
}
