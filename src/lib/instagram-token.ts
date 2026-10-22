/** Token de acceso vigente de una cuenta de Instagram, renovado si está por vencer. */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { instagramAccounts, type InstagramAccount } from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { refreshLongLivedToken } from "@/lib/instagram";

/** Renovar cuando quedan menos de 7 días. Meta pide que el token tenga más de 24 h. */
const REFRESH_WINDOW_MS = 7 * 86_400_000;

export class InstagramTokenExpired extends Error {
  constructor() {
    super("El token venció: volvé a conectar la cuenta.");
    this.name = "InstagramTokenExpired";
  }
}

/**
 * Descifra el token y, si vence en menos de una semana, lo renueva y persiste
 * el nuevo. Tira `InstagramTokenExpired` si ya venció: no hay renovación posible.
 */
export async function getValidAccessToken(
  account: Pick<InstagramAccount, "id" | "accessTokenCipher" | "accessTokenExpiresAt">
): Promise<string> {
  if (account.accessTokenExpiresAt.getTime() <= Date.now()) {
    await db
      .update(instagramAccounts)
      .set({ status: "token_vencido", lastError: "El token venció: volvé a conectar la cuenta." })
      .where(eq(instagramAccounts.id, account.id));
    throw new InstagramTokenExpired();
  }

  const accessToken = decryptSecret(account.accessTokenCipher);
  if (account.accessTokenExpiresAt.getTime() - Date.now() >= REFRESH_WINDOW_MS) return accessToken;

  const refreshed = await refreshLongLivedToken(accessToken);
  await db
    .update(instagramAccounts)
    .set({
      accessTokenCipher: encryptSecret(refreshed.accessToken),
      accessTokenExpiresAt: refreshed.expiresAt,
    })
    .where(eq(instagramAccounts.id, account.id));
  return refreshed.accessToken;
}
