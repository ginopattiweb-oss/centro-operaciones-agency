/** Arranque del OAuth de TikTok. Protegido por el middleware: sólo con sesión del panel. */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import {
  buildAuthorizeUrl,
  createOAuthState,
  isTiktokConfigured,
  TIKTOK_STATE_COOKIE,
  tiktokRedirectUri,
} from "@/lib/tiktok";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const cuentasUrl = new URL("/contenido/cuentas", request.url);

  if (!isTiktokConfigured()) {
    cuentasUrl.searchParams.set("error", "TikTok no está configurado en el entorno.");
    return NextResponse.redirect(cuentasUrl);
  }

  const projectId = request.nextUrl.searchParams.get("project");
  const project = projectId
    ? await db.query.projects.findFirst({ where: eq(projects.id, projectId) })
    : undefined;
  if (!project || project.type !== "unidad") {
    cuentasUrl.searchParams.set("error", "Elegí la unidad dueña de la cuenta.");
    return NextResponse.redirect(cuentasUrl);
  }

  const redirectUri = tiktokRedirectUri(request.nextUrl.origin);
  console.log(`[tiktok] authorize con redirect_uri=${redirectUri}`);
  const { state, cookieValue } = createOAuthState(project.id, redirectUri);
  const response = NextResponse.redirect(buildAuthorizeUrl(state, redirectUri));
  response.cookies.set(TIKTOK_STATE_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/api/tiktok",
    maxAge: 600,
  });
  return response;
}
