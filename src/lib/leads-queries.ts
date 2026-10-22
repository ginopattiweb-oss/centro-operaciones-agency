/** Lectura del pipeline de leads de una unidad. Escribir va por `actions/leads.ts`. */
import { and, desc, eq, inArray, isNotNull, lt, lte, not } from "drizzle-orm";
import { db } from "@/db";
import { clientProjects, leadInteractions, leads, projects } from "@/db/schema";
import {
  compareByFollowUp,
  toInteractionView,
  toLeadRow,
  type LeadInteractionView,
  type LeadRow,
} from "@/lib/leads";
import { todayStringBA } from "@/lib/date";
import { CLOSED_LEAD_STATUSES, LEADS_UNIDAD_SLUG } from "@/lib/leads-config";

const withClient = {
  lead: leads,
  clientProject: clientProjects,
};

/** Historial de los leads pedidos, agrupado por lead y del más reciente al más viejo. */
async function interactionsByLead(
  leadIds: string[]
): Promise<Map<string, LeadInteractionView[]>> {
  const byLead = new Map<string, LeadInteractionView[]>();
  if (leadIds.length === 0) return byLead;

  const rows = await db
    .select()
    .from(leadInteractions)
    .where(inArray(leadInteractions.leadId, leadIds))
    .orderBy(desc(leadInteractions.occurredAt));

  for (const row of rows) {
    const list = byLead.get(row.leadId) ?? [];
    list.push(toInteractionView(row));
    byLead.set(row.leadId, list);
  }
  return byLead;
}

/**
 * Leads de la unidad, ya derivados y ordenados: vencidos primero.
 * Los archivados quedan fuera salvo que se los pida explícitamente.
 */
export async function getLeadsForUnidad(
  projectId: string,
  { includeArchived = false }: { includeArchived?: boolean } = {}
): Promise<LeadRow[]> {
  const rows = await db
    .select(withClient)
    .from(leads)
    .leftJoin(clientProjects, eq(leads.clientProjectId, clientProjects.id))
    .where(
      includeArchived
        ? eq(leads.projectId, projectId)
        : and(eq(leads.projectId, projectId), eq(leads.archived, false))
    );

  const history = await interactionsByLead(rows.map(({ lead }) => lead.id));

  return rows
    .map(({ lead, clientProject }) =>
      toLeadRow(lead, clientProject?.name ?? null, history.get(lead.id) ?? [])
    )
    .sort(compareByFollowUp);
}

/** Leads vinculados a un cliente: los muestra su ficha con el historial comercial. */
export async function getLeadsForClientProject(clientProjectId: string): Promise<LeadRow[]> {
  const rows = await db
    .select(withClient)
    .from(leads)
    .leftJoin(clientProjects, eq(leads.clientProjectId, clientProjects.id))
    .where(eq(leads.clientProjectId, clientProjectId));

  const history = await interactionsByLead(rows.map(({ lead }) => lead.id));

  return rows
    .map(({ lead, clientProject }) =>
      toLeadRow(lead, clientProject?.name ?? null, history.get(lead.id) ?? [])
    )
    .sort(compareByFollowUp);
}

/** Un lead con el nombre del cliente vinculado resuelto. */
export async function getLeadRow(id: string): Promise<LeadRow | null> {
  const rows = await db
    .select(withClient)
    .from(leads)
    .leftJoin(clientProjects, eq(leads.clientProjectId, clientProjects.id))
    .where(eq(leads.id, id));

  const row = rows[0];
  if (!row) return null;

  const history = await interactionsByLead([row.lead.id]);
  return toLeadRow(row.lead, row.clientProject?.name ?? null, history.get(row.lead.id) ?? []);
}

/** Fila cruda, para las actions: valida existencia y pertenencia a la unidad. */
export async function getLeadForUnidad(id: string, projectId: string) {
  const rows = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.projectId, projectId)));
  return rows[0] ?? null;
}

/**
 * Leads que hay que contactar hoy o antes: los que alimentan el bloque
 * SEGUIMIENTOS del dashboard. Sólo activos y sin archivar; los vencidos primero.
 */
export async function getPendingFollowUps(today = todayStringBA()): Promise<LeadRow[]> {
  const rows = await db
    .select(withClient)
    .from(leads)
    .innerJoin(projects, eq(leads.projectId, projects.id))
    .leftJoin(clientProjects, eq(leads.clientProjectId, clientProjects.id))
    .where(
      and(
        eq(projects.slug, LEADS_UNIDAD_SLUG),
        eq(leads.archived, false),
        not(inArray(leads.status, CLOSED_LEAD_STATUSES)),
        isNotNull(leads.nextFollowUpAt),
        lte(leads.nextFollowUpAt, today)
      )
    );

  return rows
    .map(({ lead, clientProject }) => toLeadRow(lead, clientProject?.name ?? null))
    .sort(compareByFollowUp);
}

/**
 * Cuántos leads con seguimiento vencido tiene cada unidad. Lo suma la tarjeta
 * del dashboard a sus tareas pendientes: es trabajo que también hay que hacer.
 */
export async function countOverdueLeadsByProject(
  today = todayStringBA()
): Promise<Map<string, number>> {
  const rows = await db
    .select({ projectId: leads.projectId })
    .from(leads)
    .where(
      and(
        eq(leads.archived, false),
        not(inArray(leads.status, CLOSED_LEAD_STATUSES)),
        isNotNull(leads.nextFollowUpAt),
        // Estrictamente anterior a hoy: lo agendado para hoy todavía no venció.
        lt(leads.nextFollowUpAt, today)
      )
    );

  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.projectId, (counts.get(row.projectId) ?? 0) + 1);
  }
  return counts;
}
