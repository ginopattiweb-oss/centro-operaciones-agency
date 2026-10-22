/** Arranque del Facebook Login para Inspiración. Sólo con sesión del panel (middleware). */
import { NextRequest, NextResponse } from "next/server";
import {
  buildAuthorizeUrl,
  createOAuthState,
  isMetaConfigured,
  META_STATE_COOKIE,
  metaRedirectUri,
} from "@/lib/meta-discovery";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const backUrl = new URL("/contenido/inspiracion", request.url);
  if (!isMetaConfigured()) {
    backUrl.searchParams.set("error", "Facebook no está configurado en el entorno.");
    return NextResponse.redirect(backUrl);
  }
  const redirectUri = metaRedirectUri(request.nextUrl.origin);
  const { state, cookieValue } = createOAuthState(redirectUri);
  const response = NextResponse.redirect(buildAuthorizeUrl(state, redirectUri));
  response.cookies.set(META_STATE_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/api/facebook",
    maxAge: 600,
  });
  return response;
}
