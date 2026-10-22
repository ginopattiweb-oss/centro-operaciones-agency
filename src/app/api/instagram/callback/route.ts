/**
 * Vuelta del OAuth de Instagram. Verifica el state contra la cookie, canjea el
 * código por el token largo, lee el perfil y guarda (o actualiza) la cuenta.
 * Cualquier falla vuelve a Cuentas con el mensaje en la URL: nada queda a medias.
 */
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { INSTAGRAM_CACHE_TAG } from "@/lib/instagram-dashboard";
import { encryptSecret } from "@/lib/crypto";
import {
  exchangeCodeForToken,
  fetchProfile,
  INSTAGRAM_STATE_COOKIE,
  verifyOAuthState,
} from "@/lib/instagram";
import { upsertInstagramAccount } from "@/lib/instagram-queries";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const cuentasUrl = new URL("/contenido/cuentas", request.url);
  const params = request.nextUrl.searchParams;

  const fail = (message: string) => {
    cuentasUrl.searchParams.set("error", message);
    const response = NextResponse.redirect(cuentasUrl);
    response.cookies.delete(INSTAGRAM_STATE_COOKIE);
    return response;
  };

  // Instagram devuelve error/error_reason cuando la persona cancela.
  if (params.get("error")) {
    return fail(params.get("error_description") ?? "Se canceló la autorización en Instagram.");
  }

  const verified = verifyOAuthState(
    params.get("state"),
    request.cookies.get(INSTAGRAM_STATE_COOKIE)?.value
  );
  if (!verified) return fail("La autorización no coincide con la que iniciamos. Probá de nuevo.");
  const { projectId, redirectUri } = verified;

  const code = params.get("code");
  if (!code) return fail("Instagram no devolvió el código de autorización.");

  try {
    console.log(`[instagram] canje con redirect_uri=${redirectUri}`);
    const token = await exchangeCodeForToken(code, redirectUri);
    const profile = await fetchProfile(token.accessToken);

    await upsertInstagramAccount({
      projectId,
      igUserId: profile.igUserId || token.igUserId,
      username: profile.username,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      biography: profile.biography,
      accountType: profile.accountType,
      followerCount: profile.followerCount,
      followsCount: profile.followsCount,
      mediaCount: profile.mediaCount,
      accessTokenCipher: encryptSecret(token.accessToken),
      accessTokenExpiresAt: token.expiresAt,
      grantedScope: token.permissions,
      status: "conectada",
      lastError: null,
      lastProfileSyncAt: new Date(),
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "No se pudo conectar la cuenta.");
  }

  revalidateTag(INSTAGRAM_CACHE_TAG);
  revalidatePath("/contenido");
  cuentasUrl.searchParams.set("conectada", "instagram");
  const response = NextResponse.redirect(cuentasUrl);
  response.cookies.delete(INSTAGRAM_STATE_COOKIE);
  return response;
}
