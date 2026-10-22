/**
 * Derivados y helpers puros del módulo de Leads.
 *
 * Nada de acá toca la base: `leads-queries.ts` lee y `actions/leads.ts` escribe.
 * El estado del seguimiento no se guarda, se deriva de `nextFollowUpAt` contra
 * la fecha de hoy en Buenos Aires, y se calcula en el servidor para que la fila
 * llegue al cliente ya resuelta.
 */
import type {
  Lead,
  LeadCurrency,
  LeadInteraction,
  LeadInteractionChannel,
  LeadLostReason,
  LeadSource,
  LeadStatus,
} from "@/db/schema";
import { daysFromToday, todayStringBA } from "@/lib/date";
import { toCents } from "@/lib/finanzas";
import {
  isActiveLeadStatus,
  type FollowUpState,
} from "@/lib/leads-config";
import { payloadExtras, type PayloadExtra } from "@/lib/leads-ingesta";

/** Una interacción del historial, ya serializada para el cliente. */
export type LeadInteractionView = {
  id: string;
  occurredAt: string;
  channel: LeadInteractionChannel;
  summary: string;
};

/** Fila de lead tal como viaja al cliente: sólo datos ya derivados en el servidor. */
export type LeadRow = {
  id: string;
  contactName: string;
  business: string | null;
  source: LeadSource;
  email: string | null;
  instagram: string | null;
  whatsapp: string | null;
  website: string | null;
  status: LeadStatus;
  lostReason: LeadLostReason | null;
  /** null cuando no se cargó valor estimado: no se dibuja un cero que aparente cotización. */
  estimatedValueCents: number | null;
  currency: LeadCurrency;
  firstContactAt: string;
  lastContactAt: string | null;
  nextFollowUpAt: string | null;
  /** Fecha en que se ganó o se perdió. null mientras siga abierto. */
  closedAt: string | null;
  notes: string | null;
  clientProjectId: string | null;
  /** Nombre del cliente vinculado, ya resuelto. */
  clientName: string | null;
  archived: boolean;
  /** Ciudad o zona declarada en el formulario. null en los leads cargados a mano. */
  location: string | null;
  /**
   * Campos del formulario que no tienen columna propia, ya derivados acá para
   * que el cliente no tenga que interpretar el jsonb.
   */
  payloadExtras: PayloadExtra[];
  followUp: FollowUpState;
  /** Días desde el último contacto. null si nunca se registró uno. */
  daysSinceContact: number | null;
  /** Historial de contactos, del más reciente al más viejo. */
  interactions: LeadInteractionView[];
};

/**
 * Estado del seguimiento de un lead.
 * - `cerrado` ← ganado o perdido: no se le persigue seguimiento.
 * - `sin`     ← activo y sin fecha cargada. Es la señal de advertencia persistente.
 * - `vencido` ← la fecha ya pasó y el lead sigue abierto.
 */
export function followUpStateOf(
  status: LeadStatus,
  nextFollowUpAt: string | null,
  today = todayStringBA()
): FollowUpState {
  if (!isActiveLeadStatus(status)) return "cerrado";
  if (!nextFollowUpAt) return "sin";
  if (nextFollowUpAt < today) return "vencido";
  if (nextFollowUpAt === today) return "hoy";
  return "futuro";
}

/** Los vencidos primero, después por fecha; los que no tienen fecha, al final. */
const FOLLOW_UP_RANK: Record<FollowUpState, number> = {
  vencido: 0,
  hoy: 1,
  futuro: 2,
  sin: 3,
  cerrado: 4,
};

export function compareByFollowUp(a: LeadRow, b: LeadRow): number {
  const rank = FOLLOW_UP_RANK[a.followUp] - FOLLOW_UP_RANK[b.followUp];
  if (rank !== 0) return rank;
  if (a.nextFollowUpAt && b.nextFollowUpAt) {
    const byDate = a.nextFollowUpAt.localeCompare(b.nextFollowUpAt);
    if (byDate !== 0) return byDate;
  }
  return a.contactName.localeCompare(b.contactName);
}

export function toInteractionView(row: LeadInteraction): LeadInteractionView {
  return {
    id: row.id,
    occurredAt: row.occurredAt.toISOString(),
    channel: row.channel,
    summary: row.summary,
  };
}

export function toLeadRow(
  lead: Lead,
  clientName: string | null = null,
  interactions: LeadInteractionView[] = []
): LeadRow {
  return {
    id: lead.id,
    contactName: lead.contactName,
    business: lead.business,
    source: lead.source,
    email: lead.email,
    instagram: lead.instagram,
    whatsapp: lead.whatsapp,
    website: lead.website,
    status: lead.status,
    lostReason: lead.lostReason,
    estimatedValueCents: lead.estimatedValue === null ? null : toCents(lead.estimatedValue),
    currency: lead.currency,
    firstContactAt: lead.firstContactAt,
    lastContactAt: lead.lastContactAt,
    nextFollowUpAt: lead.nextFollowUpAt,
    closedAt: lead.closedAt,
    notes: lead.notes,
    clientProjectId: lead.clientProjectId,
    clientName,
    archived: lead.archived,
    location: lead.location,
    payloadExtras: payloadExtras(lead.payloadRaw),
    followUp: followUpStateOf(lead.status, lead.nextFollowUpAt),
    daysSinceContact: lead.lastContactAt ? -daysFromToday(lead.lastContactAt) : null,
    interactions,
  };
}

// --- Validación y normalización de los datos de contacto ---

/**
 * Formato de mail, no existencia. Alcanza para no guardar "juan@" ni "juan.com";
 * lo demás lo dice el primer mail que rebota.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** Handle sin '@' ni URL: se acepta pegado desde el navegador y se limpia. */
export function normalizeInstagram(raw: string): string | null {
  const value = raw
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "");
  return value || null;
}

/** Sin esquema se asume https: pegar "estudio.com" tiene que abrir igual. */
export function normalizeWebsite(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export function instagramUrl(handle: string): string {
  return `https://instagram.com/${handle}`;
}

/**
 * Teléfono → sólo dígitos, como lo pide wa.me. Mismo criterio que Alumnos:
 * sin prefijo internacional se asume Argentina.
 */
export function leadWhatsappUrl(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (phone.trim().startsWith("+")) return `https://wa.me/${digits}`;
  return `https://wa.me/${digits.startsWith("54") ? digits : `54${digits}`}`;
}

// --- Dinero ---

/** Mismo formato que Finanzas, pero sobre la moneda propia de los leads. */
export function formatLeadMoney(cents: number, currency: LeadCurrency): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
