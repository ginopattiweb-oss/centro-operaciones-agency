/**
 * Arranque del OAuth de Instagram. Protegido por el middleware: sólo con sesión
 * del panel. Recibe la unidad dueña de la cuenta y manda a autorizar.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  buildAuthorizeUrl,
  createOAuthState,
  INSTAGRAM_STATE_COOKIE,
  instagramRedirectUri,
  isInstagramConfigured,
} from "@/lib/instagram";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const cuentasUrl = new URL("/contenido/cuentas", request.url);

  if (!isInstagramConfigured()) {
    cuentasUrl.searchParams.set("error", "Instagram no está configurado en el entorno.");
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

  const redirectUri = instagramRedirectUri(request.nextUrl.origin);
  console.log(`[instagram] authorize con redirect_uri=${redirectUri}`);
  const { state, cookieValue } = createOAuthState(project.id, redirectUri);
  const response = NextResponse.redirect(buildAuthorizeUrl(state, redirectUri));
  response.cookies.set(INSTAGRAM_STATE_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/api/instagram",
    maxAge: 600,
  });
  return response;
}
