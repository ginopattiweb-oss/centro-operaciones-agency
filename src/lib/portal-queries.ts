import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  briefings,
  clientAccesses,
  clientProjects,
  deliverables,
  portalUsers,
  projects,
} from "@/db/schema";
import { PORTAL_SESSION_COOKIE, readPortalSessionToken } from "@/lib/portal-auth";
import { PORTAL_UNIDAD_SLUG } from "@/lib/portal-config";

export { PORTAL_UNIDAD_SLUG };

export type PortalContext = {
  user: typeof portalUsers.$inferSelect;
  clientProject: typeof clientProjects.$inferSelect;
};

export async function getPortalContext(): Promise<PortalContext | null> {
  const cookieStore = await cookies();
  const session = await readPortalSessionToken(cookieStore.get(PORTAL_SESSION_COOKIE)?.value);
  if (!session) return null;

  const rows = await db
    .select({ user: portalUsers, clientProject: clientProjects, project: projects })
    .from(portalUsers)
    .innerJoin(clientProjects, eq(portalUsers.clientProjectId, clientProjects.id))
    .innerJoin(projects, eq(clientProjects.projectId, projects.id))
    .where(eq(portalUsers.id, session.uid));

  const row = rows[0];
  if (!row) return null;
  // El usuario puede haber sido desactivado o el portal apagado después de emitir la cookie.
  if (!row.user.isActive || !row.clientProject.portalEnabled) return null;
  if (row.project.slug !== PORTAL_UNIDAD_SLUG) return null;

  return { user: row.user, clientProject: row.clientProject };
}

/** Usar en toda página o acción del portal: garantiza sesión válida. */
export async function requirePortalContext(): Promise<PortalContext> {
  const context = await getPortalContext();
  if (!context) redirect("/portal/login");
  return context;
}

export async function getAccessesForClient(clientProjectId: string) {
  return db
    .select()
    .from(clientAccesses)
    .where(eq(clientAccesses.clientProjectId, clientProjectId))
    .orderBy(asc(clientAccesses.sortOrder), asc(clientAccesses.createdAt));
}

export async function getBriefingForClient(clientProjectId: string) {
  const rows = await db
    .select()
    .from(briefings)
    .where(eq(briefings.clientProjectId, clientProjectId));
  return rows[0] ?? null;
}

export async function getDeliverablesForClient(clientProjectId: string) {
  return db
    .select()
    .from(deliverables)
    .where(eq(deliverables.clientProjectId, clientProjectId))
    .orderBy(desc(deliverables.createdAt));
}

// --- Lado interno (Centro de Operaciones) ---

export async function getPortalClientProjects() {
  return db
    .select({ clientProject: clientProjects, project: projects })
    .from(clientProjects)
    .innerJoin(projects, eq(clientProjects.projectId, projects.id))
    .where(eq(projects.slug, PORTAL_UNIDAD_SLUG))
    .orderBy(asc(clientProjects.name));
}

export async function getPortalClientProject(clientProjectId: string) {
  const rows = await db
    .select({ clientProject: clientProjects, project: projects })
    .from(clientProjects)
    .innerJoin(projects, eq(clientProjects.projectId, projects.id))
    .where(and(eq(clientProjects.id, clientProjectId), eq(projects.slug, PORTAL_UNIDAD_SLUG)));
  return rows[0] ?? null;
}

export async function getPortalUsersForClient(clientProjectId: string) {
  return db
    .select()
    .from(portalUsers)
    .where(eq(portalUsers.clientProjectId, clientProjectId))
    .orderBy(asc(portalUsers.createdAt));
}

export async function countPortalUsersByClient() {
  const rows = await db
    .select({ clientProjectId: portalUsers.clientProjectId, id: portalUsers.id })
    .from(portalUsers);
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.clientProjectId, (counts.get(row.clientProjectId) ?? 0) + 1);
  }
  return counts;
}
