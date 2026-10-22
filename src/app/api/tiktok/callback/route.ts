/**
 * Vuelta del OAuth de TikTok: verifica el state, canjea el código, guarda la
 * cuenta y corre la primera sync (videos + snapshot del día).
 */
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { exchangeCodeForTokens, fetchProfile, TIKTOK_STATE_COOKIE, verifyOAuthState } from "@/lib/tiktok";
import { syncTiktokAccount, upsertTiktokAccount } from "@/lib/tiktok-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const cuentasUrl = new URL("/contenido/cuentas", request.url);
  const params = request.nextUrl.searchParams;

  const fail = (message: string) => {
    cuentasUrl.searchParams.set("error", message);
    const response = NextResponse.redirect(cuentasUrl);
    response.cookies.delete(TIKTOK_STATE_COOKIE);
    return response;
  };

  if (params.get("error")) {
    return fail(params.get("error_description") ?? "Se canceló la autorización en TikTok.");
  }

  const verified = verifyOAuthState(params.get("state"), request.cookies.get(TIKTOK_STATE_COOKIE)?.value);
  if (!verified) return fail("La autorización no coincide con la que iniciamos. Probá de nuevo.");

  const code = params.get("code");
  if (!code) return fail("TikTok no devolvió el código de autorización.");

  try {
    const tokens = await exchangeCodeForTokens(code, verified.redirectUri);
    const profile = await fetchProfile(tokens.accessToken);
    const accountId = await upsertTiktokAccount(verified.projectId, tokens, profile);
    // La primera sync puede fallar (p. ej. sin permiso video.list) sin invalidar la conexión.
    try {
      await syncTiktokAccount(accountId);
    } catch (error) {
      console.error("[tiktok] primera sync:", error);
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : "No se pudo conectar la cuenta.");
  }

  revalidatePath("/contenido");
  cuentasUrl.searchParams.set("conectada", "tiktok");
  const response = NextResponse.redirect(cuentasUrl);
  response.cookies.delete(TIKTOK_STATE_COOKIE);
  return response;
}
