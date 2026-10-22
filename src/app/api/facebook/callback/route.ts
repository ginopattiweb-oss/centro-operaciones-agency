/** Vuelta del Facebook Login: canjea el código, busca la página con Instagram vinculado y guarda la conexión. */
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { metaConnections } from "@/db/schema";
import { encryptSecret } from "@/lib/crypto";
import { exchangeCode, findLinkedInstagram, META_STATE_COOKIE, verifyOAuthState } from "@/lib/meta-discovery";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const backUrl = new URL("/contenido/inspiracion", request.url);
  const params = request.nextUrl.searchParams;

  const fail = (message: string) => {
    backUrl.searchParams.set("error", message);
    const response = NextResponse.redirect(backUrl);
    response.cookies.delete(META_STATE_COOKIE);
    return response;
  };

  if (params.get("error")) {
    return fail(params.get("error_description") ?? "Se canceló la autorización en Facebook.");
  }
  const redirectUri = verifyOAuthState(params.get("state"), request.cookies.get(META_STATE_COOKIE)?.value);
  if (!redirectUri) return fail("La autorización no coincide con la que iniciamos. Probá de nuevo.");
  const code = params.get("code");
  if (!code) return fail("Facebook no devolvió el código de autorización.");

  try {
    const token = await exchangeCode(code, redirectUri);
    const linked = await findLinkedInstagram(token.accessToken);
    const values = {
      ...linked,
      accessTokenCipher: encryptSecret(token.accessToken),
      accessTokenExpiresAt: token.expiresAt,
      lastError: null,
    };
    await db
      .insert(metaConnections)
      .values(values)
      .onConflictDoUpdate({ target: metaConnections.fbUserId, set: values });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "No se pudo conectar con Facebook.");
  }

  revalidatePath("/contenido/inspiracion");
  backUrl.searchParams.set("conectada", "1");
  const response = NextResponse.redirect(backUrl);
  response.cookies.delete(META_STATE_COOKIE);
  return response;
}
