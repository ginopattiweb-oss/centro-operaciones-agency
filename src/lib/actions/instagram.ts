"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth-server";
import { fetchProfile } from "@/lib/instagram";
import { INSTAGRAM_CACHE_TAG } from "@/lib/instagram-dashboard";
import {
  deleteInstagramAccount,
  getInstagramAccountById,
  markInstagramAccountError,
  updateInstagramProfile,
} from "@/lib/instagram-queries";
import { getValidAccessToken, InstagramTokenExpired } from "@/lib/instagram-token";

export type InstagramActionState = { error?: string; success?: string } | null;

/**
 * Vuelve a leer el perfil y guarda el snapshot del día. Si el token está por
 * vencer lo renueva antes; si ya venció, marca la cuenta para reconectar.
 */
export async function syncInstagramAccount(id: string): Promise<InstagramActionState> {
  await requireAdmin();
  const account = await getInstagramAccountById(id);
  if (!account) return { error: "La cuenta ya no existe." };

  try {
    const accessToken = await getValidAccessToken(account);
    const profile = await fetchProfile(accessToken);
    await updateInstagramProfile(id, {
      username: profile.username,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      biography: profile.biography,
      accountType: profile.accountType,
      followerCount: profile.followerCount,
      followsCount: profile.followsCount,
      mediaCount: profile.mediaCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falló la sincronización.";
    // El token vencido ya quedó marcado por getValidAccessToken.
    if (!(error instanceof InstagramTokenExpired)) await markInstagramAccountError(id, "error", message);
    revalidatePath("/contenido/cuentas");
    return { error: message };
  }

  revalidateTag(INSTAGRAM_CACHE_TAG);
  revalidatePath("/contenido");
  revalidatePath("/contenido/cuentas");
  return { success: "Perfil actualizado." };
}

/** Borra la cuenta y su historial. El token deja de usarse; la app sigue autorizada en Instagram. */
export async function disconnectInstagramAccount(id: string): Promise<InstagramActionState> {
  await requireAdmin();
  await deleteInstagramAccount(id);
  revalidateTag(INSTAGRAM_CACHE_TAG);
  revalidatePath("/contenido");
  revalidatePath("/contenido/cuentas");
  return { success: "Cuenta desconectada." };
}
