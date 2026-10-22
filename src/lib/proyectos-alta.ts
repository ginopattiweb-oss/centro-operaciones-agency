/**
 * Alta de un cliente/proyecto de la unidad.
 *
 * Vive fuera de `actions/` porque lo usan dos flujos: el alta manual desde
 * la agencia y la conversión de un lead ganado. En este sistema cliente,
 * proyecto y portal son la misma fila de `client_projects`, así que dar de alta
 * un cliente ya es crear su proyecto.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { briefings, clientProjects, people, type ClientProjectStatus } from "@/db/schema";
import { getProjectBySlug } from "@/lib/queries";
import { PORTAL_UNIDAD_SLUG } from "@/lib/portal-config";

/** Briefing vacío: la estructura queda creada, sin un solo dato inventado. */
export async function ensureBriefing(clientProjectId: string) {
  const existing = await db
    .select()
    .from(briefings)
    .where(eq(briefings.clientProjectId, clientProjectId));
  if (existing[0]) return;
  await db.insert(briefings).values({ clientProjectId, data: {} });
}

/** Resuelve el responsable por nombre: si no existe todavía, se crea. Vacío = sin responsable. */
export async function resolvePerson(rawName: string): Promise<string | null> {
  const name = rawName.trim();
  if (!name) return null;

  const existing = await db
    .select()
    .from(people)
    .where(sql`lower(${people.name}) = lower(${name})`);
  if (existing[0]) return existing[0].id;

  const inserted = await db.insert(people).values({ name }).returning();
  return inserted[0].id;
}

export type ClientProjectDraft = {
  name: string;
  service?: string | null;
  status?: ClientProjectStatus;
  ownerPersonId?: string | null;
};

/**
 * Crea el cliente en el Portal con el portal apagado y su briefing vacío.
 * Devuelve el error de negocio en vez de tirar: los llamadores son server
 * actions que lo muestran en el formulario.
 */
export async function createClientProjectForUnidad(
  draft: ClientProjectDraft
): Promise<{ error: string } | { id: string }> {
  const name = draft.name.trim();
  if (!name) return { error: "Poné el nombre del cliente o del proyecto." };

  const unidad = await getProjectBySlug(PORTAL_UNIDAD_SLUG);
  if (!unidad) return { error: "No se encontró la unidad de la agencia. ¿Corriste el seed?" };

  const duplicate = await db
    .select()
    .from(clientProjects)
    .where(
      and(
        eq(clientProjects.projectId, unidad.id),
        sql`lower(${clientProjects.name}) = lower(${name})`
      )
    );
  if (duplicate[0]) return { error: "Ya existe un proyecto con ese nombre." };

  const inserted = await db
    .insert(clientProjects)
    .values({
      name,
      projectId: unidad.id,
      // El portal se provisiona apagado: se enciende cuando el proyecto está listo.
      portalEnabled: false,
      status: draft.status ?? "briefing",
      service: draft.service ?? null,
      ownerPersonId: draft.ownerPersonId ?? null,
    })
    .returning();

  await ensureBriefing(inserted[0].id);
  return { id: inserted[0].id };
}
