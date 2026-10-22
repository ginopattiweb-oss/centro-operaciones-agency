"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  clientProjects,
  leadInteractions,
  leads,
  portalUsers,
  type LeadStatus,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth-server";
import { propagarEstadoDeLead } from "@/lib/crm/agencia";
import { getProjectBySlug } from "@/lib/queries";
import { getLeadForUnidad } from "@/lib/leads-queries";
import { parseAmountInput } from "@/lib/finanzas";
import { dateStringBA, todayStringBA, TZ } from "@/lib/date";
import {
  isValidEmail,
  normalizeInstagram,
  normalizeWebsite,
} from "@/lib/leads";
import { fromZonedTime } from "date-fns-tz";
import { getPortalClientProject } from "@/lib/portal-queries";
import { createClientProjectForUnidad } from "@/lib/proyectos-alta";
import { isProjectStatus } from "@/lib/proyecto-estados";
import {
  DEFAULT_LEAD_CURRENCY,
  isActiveLeadStatus,
  isLeadCurrency,
  isLeadInteractionChannel,
  isLeadLostReason,
  isLeadSource,
  isLeadStatus,
  LEADS_BASE_PATH,
  LEADS_UNIDAD_SLUG,
} from "@/lib/leads-config";

export type LeadFormState = { error?: string; success?: string; id?: string } | null;

function revalidateLeads(clientProjectId?: string | null) {
  revalidatePath(LEADS_BASE_PATH);
  revalidatePath(`/unidad/${LEADS_UNIDAD_SLUG}`);
  // El dashboard muestra los seguimientos del día y el contador de la unidad.
  revalidatePath("/");
  // La ficha del cliente lista sus leads vinculados.
  if (clientProjectId) {
    revalidatePath(`/unidad/${LEADS_UNIDAD_SLUG}/proyecto/${clientProjectId}`);
  }
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function readDate(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return DATE_RE.test(value) ? value : null;
}

type LeadFields = {
  contactName: string;
  business: string | null;
  source: ReturnType<typeof readSource>;
  email: string | null;
  instagram: string | null;
  whatsapp: string | null;
  website: string | null;
  status: LeadStatus;
  lostReason: ReturnType<typeof readLostReason>;
  estimatedValue: string | null;
  currency: ReturnType<typeof readCurrency>;
  firstContactAt: string;
  lastContactAt: string | null;
  nextFollowUpAt: string | null;
  closedAt: string | null;
  notes: string | null;
};

function readSource(formData: FormData) {
  const raw = text(formData, "source");
  return isLeadSource(raw) ? raw : "otro";
}

function readStatus(formData: FormData): LeadStatus {
  const raw = text(formData, "status");
  return isLeadStatus(raw) ? raw : "nuevo";
}

function readLostReason(formData: FormData) {
  const raw = text(formData, "lostReason");
  return isLeadLostReason(raw) ? raw : null;
}

function readCurrency(formData: FormData) {
  const raw = text(formData, "currency");
  return isLeadCurrency(raw) ? raw : DEFAULT_LEAD_CURRENCY;
}

/**
 * Lee y valida el formulario del lead. La misma validación que hace el navegador
 * se repite acá: una action se puede invocar sin pasar por el form.
 */
function readLeadForm(formData: FormData): { error: string } | { fields: LeadFields } {
  const contactName = text(formData, "contactName");
  if (!contactName) return { error: "Poné el nombre del contacto." };

  const emailRaw = text(formData, "email");
  if (emailRaw && !isValidEmail(emailRaw)) {
    return { error: "Ese mail no tiene un formato válido." };
  }

  const valueRaw = text(formData, "estimatedValue");
  const estimatedValue = valueRaw ? parseAmountInput(valueRaw) : null;
  if (valueRaw && estimatedValue === null) {
    return { error: "El valor estimado tiene que ser un número mayor a cero." };
  }

  const status = readStatus(formData);
  const lostReason = readLostReason(formData);
  // El motivo es la mitad del valor del módulo: perdido sin motivo no se guarda.
  if (status === "perdido" && !lostReason) {
    return { error: "Elegí el motivo por el que se perdió el lead." };
  }

  const instagramRaw = text(formData, "instagram");
  const websiteRaw = text(formData, "website");

  return {
    fields: {
      contactName,
      business: text(formData, "business") || null,
      source: readSource(formData),
      email: emailRaw || null,
      instagram: instagramRaw ? normalizeInstagram(instagramRaw) : null,
      whatsapp: text(formData, "whatsapp") || null,
      website: websiteRaw ? normalizeWebsite(websiteRaw) : null,
      status,
      // Salir de 'perdido' limpia el motivo: si no, queda un dato que miente.
      lostReason: status === "perdido" ? lostReason : null,
      estimatedValue,
      currency: readCurrency(formData),
      firstContactAt: readDate(formData, "firstContactAt") ?? todayStringBA(),
      lastContactAt: readDate(formData, "lastContactAt"),
      // Un lead cerrado no lleva próximo seguimiento.
      nextFollowUpAt: isActiveLeadStatus(status) ? readDate(formData, "nextFollowUpAt") : null,
      // Se respeta la fecha de cierre ya registrada; si no había, es hoy.
      closedAt: isActiveLeadStatus(status)
        ? null
        : (readDate(formData, "closedAt") ?? todayStringBA()),
      notes: text(formData, "notes") || null,
    },
  };
}

/** El lead tiene que existir y pertenecer a la unidad. Vale para toda action. */
async function requireLead(id: string) {
  const unidad = await getProjectBySlug(LEADS_UNIDAD_SLUG);
  if (!unidad) throw new Error("No se encontró la unidad de la agencia. ¿Corriste el seed?");

  const lead = await getLeadForUnidad(id, unidad.id);
  if (!lead) throw new Error("Lead no encontrado.");
  return lead;
}

export async function createLead(
  _prevState: LeadFormState,
  formData: FormData
): Promise<LeadFormState> {
  await requireAdmin();

  const parsed = readLeadForm(formData);
  if ("error" in parsed) return parsed;

  const unidad = await getProjectBySlug(LEADS_UNIDAD_SLUG);
  if (!unidad) return { error: "No se encontró la unidad de la agencia. ¿Corriste el seed?" };

  const inserted = await db
    .insert(leads)
    .values({ ...parsed.fields, projectId: unidad.id })
    .returning();

  revalidateLeads();
  return { success: "Lead creado.", id: inserted[0].id };
}

export async function updateLead(
  _prevState: LeadFormState,
  formData: FormData
): Promise<LeadFormState> {
  await requireAdmin();

  const unidad = await getProjectBySlug(LEADS_UNIDAD_SLUG);
  if (!unidad) return { error: "No se encontró la unidad de la agencia. ¿Corriste el seed?" };

  const id = text(formData, "leadId");
  const existing = await getLeadForUnidad(id, unidad.id);
  if (!existing) return { error: "Lead no encontrado." };

  const parsed = readLeadForm(formData);
  if ("error" in parsed) return parsed;

  await db
    .update(leads)
    .set({ ...parsed.fields, updatedAt: new Date() })
    .where(eq(leads.id, id));

  revalidateLeads(existing.clientProjectId);
  return { success: "Cambios guardados.", id };
}

/**
 * Cambio de estado desde el drawer o el kanban.
 *
 * Todo lo que dispara un cambio de estado va junto: se registra el contacto de
 * hoy, se exige el motivo si el lead se perdió, y se guarda el próximo
 * seguimiento que el usuario haya elegido en el mismo diálogo. Un lead cerrado
 * no lleva seguimiento: se limpia.
 */
export async function setLeadStatus(
  id: string,
  status: LeadStatus,
  lostReason: string | null,
  nextFollowUpAt: string | null = null
) {
  await requireAdmin();

  if (!isLeadStatus(status)) throw new Error("Estado inválido.");
  if (status === "perdido" && !isLeadLostReason(lostReason)) {
    throw new Error("Elegí el motivo por el que se perdió el lead.");
  }
  if (nextFollowUpAt !== null && !DATE_RE.test(nextFollowUpAt)) {
    throw new Error("Fecha de seguimiento inválida.");
  }

  const existing = await requireLead(id);

  await db
    .update(leads)
    .set({
      status,
      lostReason: status === "perdido" && isLeadLostReason(lostReason) ? lostReason : null,
      // Cambiar de estado es haber hablado con el lead: queda registrado.
      lastContactAt: todayStringBA(),
      nextFollowUpAt: isActiveLeadStatus(status)
        ? (nextFollowUpAt ?? existing.nextFollowUpAt)
        : null,
      // Reabrir un lead borra la fecha de cierre: dejarla mentiría las métricas.
      closedAt: isActiveLeadStatus(status) ? null : (existing.closedAt ?? todayStringBA()),
      updatedAt: new Date(),
    })
    .where(eq(leads.id, id));

  // La etapa del pipeline vive en `crm_derivaciones.estado`: `leads.status` es
  // una denormalización que se mueve con ella. Ver src/lib/crm/agencia.ts.
  await propagarEstadoDeLead(id, status);

  revalidateLeads(existing.clientProjectId);
}

/** Agendar o borrar el próximo seguimiento, sin tocar el estado. */
export async function setLeadFollowUp(id: string, nextFollowUpAt: string | null) {
  await requireAdmin();

  if (nextFollowUpAt !== null && !DATE_RE.test(nextFollowUpAt)) {
    throw new Error("Fecha de seguimiento inválida.");
  }
  const lead = await requireLead(id);

  await db
    .update(leads)
    .set({ nextFollowUpAt, updatedAt: new Date() })
    .where(eq(leads.id, id));

  revalidateLeads(lead.clientProjectId);
}

/**
 * Botón "Contactado" del dashboard: deja registrado el contacto de hoy. El
 * próximo seguimiento se elige después, en el selector que se abre al lado.
 */
export async function markLeadContacted(id: string) {
  await requireAdmin();
  const lead = await requireLead(id);

  await db
    .update(leads)
    .set({ lastContactAt: todayStringBA(), updatedAt: new Date() })
    .where(eq(leads.id, id));

  revalidateLeads(lead.clientProjectId);
}

/** Guardado automático de las notas desde el drawer. */
export async function updateLeadNotes(id: string, notes: string) {
  await requireAdmin();
  const lead = await requireLead(id);

  await db
    .update(leads)
    .set({ notes: notes.trim() || null, updatedAt: new Date() })
    .where(eq(leads.id, id));

  revalidateLeads(lead.clientProjectId);
}

/**
 * Archivar es lo más cerca de borrar que llega el módulo: la fila queda,
 * sale de las vistas por defecto. Los leads perdidos son el histórico más útil.
 */
export async function setLeadArchived(id: string, archived: boolean) {
  await requireAdmin();
  const lead = await requireLead(id);

  await db.update(leads).set({ archived, updatedAt: new Date() }).where(eq(leads.id, id));
  revalidateLeads(lead.clientProjectId);
}

// --- Duplicados ---

export type DuplicateMatch = {
  /** Qué dato coincide: 'mail' o 'instagram'. */
  field: string;
  label: string;
  href: string;
};

/**
 * Avisa, sin bloquear, si el mail o el instagram ya están cargados en otro lead
 * o en un usuario del portal de un cliente. `client_projects` no guarda datos de
 * contacto, así que el lado "cliente" se busca contra `portal_users`.
 */
export async function findDuplicateContacts(
  email: string,
  instagram: string,
  excludeLeadId: string | null = null
): Promise<DuplicateMatch[]> {
  await requireAdmin();

  const mail = email.trim().toLowerCase();
  const handle = (normalizeInstagram(instagram) ?? "").toLowerCase();
  if (!mail && !handle) return [];

  const conditions = [];
  if (mail) conditions.push(sql`lower(${leads.email}) = ${mail}`);
  if (handle) conditions.push(sql`lower(${leads.instagram}) = ${handle}`);

  const leadMatches = await db
    .select({ id: leads.id, contactName: leads.contactName, email: leads.email })
    .from(leads)
    .where(
      excludeLeadId
        ? and(or(...conditions), ne(leads.id, excludeLeadId))
        : or(...conditions)
    );

  const clientMatches = mail
    ? await db
        .select({
          clientProjectId: portalUsers.clientProjectId,
          clientName: clientProjects.name,
          userName: portalUsers.name,
        })
        .from(portalUsers)
        .innerJoin(clientProjects, eq(portalUsers.clientProjectId, clientProjects.id))
        .where(sql`lower(${portalUsers.email}) = ${mail}`)
    : [];

  return [
    ...leadMatches.map((row) => ({
      field: row.email?.toLowerCase() === mail ? "mail" : "instagram",
      label: `Ya hay un lead con ese dato: ${row.contactName}`,
      href: `${LEADS_BASE_PATH}?lead=${row.id}`,
    })),
    ...clientMatches.map((row) => ({
      field: "mail",
      label: `Ese mail ya es de un cliente: ${row.clientName} (${row.userName})`,
      href: `/unidad/${LEADS_UNIDAD_SLUG}/proyecto/${row.clientProjectId}`,
    })),
  ];
}

// --- Conversión a cliente ---

/**
 * Un lead ganado se vincula a un cliente; nunca se borra ni se transforma. En
 * este sistema cliente y proyecto son la misma fila, así que "cliente nuevo" ya
 * crea el proyecto: no hay un segundo paso que crearle.
 *
 * `mode` = 'nuevo' da de alta el cliente con los datos del lead;
 * `mode` = 'existente' lo vincula a uno que ya está en el Portal.
 */
export async function convertLeadToClient(
  _prevState: LeadFormState,
  formData: FormData
): Promise<LeadFormState> {
  await requireAdmin();

  const leadId = text(formData, "leadId");
  const lead = await requireLead(leadId);
  const mode = text(formData, "mode") || "nuevo";

  let clientProjectId: string;

  if (mode === "existente") {
    clientProjectId = text(formData, "clientProjectId");
    const row = await getPortalClientProject(clientProjectId);
    if (!row) return { error: "Ese cliente no pertenece a la agencia." };
  } else {
    const statusRaw = text(formData, "projectStatus");
    const created = await createClientProjectForUnidad({
      name: text(formData, "clientName") || lead.business || lead.contactName,
      service: text(formData, "service") || null,
      status: isProjectStatus(statusRaw) ? statusRaw : "briefing",
    });
    if ("error" in created) return created;
    clientProjectId = created.id;
  }

  await db
    .update(leads)
    .set({
      status: "ganado",
      lostReason: null,
      clientProjectId,
      lastContactAt: todayStringBA(),
      nextFollowUpAt: null,
      closedAt: lead.closedAt ?? todayStringBA(),
      updatedAt: new Date(),
    })
    .where(eq(leads.id, leadId));

  revalidateLeads(clientProjectId);
  return { success: "Lead ganado y vinculado al cliente.", id: clientProjectId };
}

/**
 * Lead de reactivación sobre un cliente que ya tuvimos. Precarga lo que el
 * sistema sabe (nombre del negocio y, si hay, el usuario del portal) y deja el
 * cliente vinculado desde el arranque, para no duplicar registros.
 */
export async function createReactivationLead(clientProjectId: string): Promise<string> {
  await requireAdmin();

  const row = await getPortalClientProject(clientProjectId);
  if (!row) throw new Error("Ese cliente no pertenece a la agencia.");

  const users = await db
    .select()
    .from(portalUsers)
    .where(eq(portalUsers.clientProjectId, clientProjectId))
    .orderBy(asc(portalUsers.createdAt));
  const contact = users[0] ?? null;

  const inserted = await db
    .insert(leads)
    .values({
      projectId: row.clientProject.projectId,
      contactName: contact?.name ?? row.clientProject.name,
      business: row.clientProject.name,
      email: contact?.email ?? null,
      source: "reactivacion",
      status: "nuevo",
      clientProjectId,
    })
    .returning();

  revalidateLeads(clientProjectId);
  return inserted[0].id;
}

// --- Historial de interacciones ---

/**
 * Registra un contacto. La hora se fija al mediodía de Buenos Aires: sólo nos
 * importa el día, y así no se corre de fecha al mostrarlo.
 */
export async function addLeadInteraction(
  _prevState: LeadFormState,
  formData: FormData
): Promise<LeadFormState> {
  await requireAdmin();

  const leadId = text(formData, "leadId");
  const lead = await requireLead(leadId);

  const summary = text(formData, "summary");
  if (!summary) return { error: "Contá en una línea qué pasó en ese contacto." };

  const channelRaw = text(formData, "channel");
  const channel = isLeadInteractionChannel(channelRaw) ? channelRaw : "otro";
  const date = readDate(formData, "occurredAt") ?? todayStringBA();

  await db.insert(leadInteractions).values({
    leadId,
    channel,
    summary,
    occurredAt: fromZonedTime(`${date}T12:00:00`, TZ),
  });

  // El último contacto sale del historial: sólo avanza, nunca retrocede.
  if (!lead.lastContactAt || date > lead.lastContactAt) {
    await db
      .update(leads)
      .set({ lastContactAt: date, updatedAt: new Date() })
      .where(eq(leads.id, leadId));
  }

  revalidateLeads(lead.clientProjectId);
  return { success: "Interacción registrada." };
}

/** Borra una interacción mal cargada y recalcula el último contacto del lead. */
export async function deleteLeadInteraction(id: string) {
  await requireAdmin();

  const rows = await db.delete(leadInteractions).where(eq(leadInteractions.id, id)).returning();
  const removed = rows[0];
  if (!removed) return;

  const lead = await requireLead(removed.leadId);

  const remaining = await db
    .select()
    .from(leadInteractions)
    .where(eq(leadInteractions.leadId, removed.leadId))
    .orderBy(desc(leadInteractions.occurredAt));

  await db
    .update(leads)
    .set({
      lastContactAt: remaining[0] ? dateStringBA(remaining[0].occurredAt) : null,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, removed.leadId));

  revalidateLeads(lead.clientProjectId);
}
