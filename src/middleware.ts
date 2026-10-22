import { NextRequest, NextResponse } from "next/server";
import { isValidSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { PORTAL_SESSION_COOKIE, readPortalSessionToken } from "@/lib/portal-auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- Portal de clientes: sesión propia, aislada del panel interno ---
  if (pathname === "/portal" || pathname.startsWith("/portal/")) {
    const session = await readPortalSessionToken(
      request.cookies.get(PORTAL_SESSION_COOKIE)?.value
    );
    const isPortalLogin = pathname === "/portal/login";

    if (!session && !isPortalLogin) {
      return NextResponse.redirect(new URL("/portal/login", request.url));
    }
    if (session && isPortalLogin) {
      return NextResponse.redirect(new URL("/portal", request.url));
    }
    return NextResponse.next();
  }

  // --- Panel interno ---
  const isAuthenticated = await isValidSessionToken(
    request.cookies.get(SESSION_COOKIE)?.value
  );
  const isLoginPage = pathname === "/login";

  if (!isAuthenticated && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthenticated && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  /**
   * `api/webhooks` queda afuera a propósito: es el único camino público del
   * panel y lo postea el sitio, sin cookie de sesión. Si el middleware lo
   * matcheara, el POST se comería un redirect a /login antes de ejecutarse.
   * Ese endpoint se defiende solo (allowlist de Origin, honeypot, rate limit).
   * `privacidad` y `terminos` son públicas: Meta y TikTok las exigen para aprobar las apps.
   */
  matcher: ["/((?!api/webhooks|privacidad|terminos|_next/static|_next/image|favicon.ico).*)"],
};
