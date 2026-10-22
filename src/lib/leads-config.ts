/**
 * Etiquetas, orden y tono de todo el vocabulario del módulo de Leads.
 *
 * Único lugar donde se editan los textos: estados, canales de origen, motivos de
 * pérdida y monedas. Sin nada de servidor, así lo importan también los
 * componentes de cliente (mismo criterio que `proyecto-estados.ts`).
 */
import type {
  LeadCurrency,
  LeadInteractionChannel,
  LeadLostReason,
  LeadSource,
  LeadStatus,
} from "@/db/schema";

/** Unidad de negocio dueña del pipeline de leads. */
export const LEADS_UNIDAD_SLUG = "agencia";

export const LEADS_BASE_PATH = `/unidad/${LEADS_UNIDAD_SLUG}/leads`;

// --- Estados ---

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  en_conversacion: "En conversación",
  cotizado: "Cotizado",
  ganado: "Ganado",
  perdido: "Perdido",
};

/** Orden del pipeline. Mover a cualquier estado está permitido: la vida real no es lineal. */
export const LEAD_STATUSES = Object.keys(LEAD_STATUS_LABELS) as LeadStatus[];

/** Los cerrados no necesitan seguimiento ni cuentan como pipeline abierto. */
export const CLOSED_LEAD_STATUSES: LeadStatus[] = ["ganado", "perdido"];

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && value in LEAD_STATUS_LABELS;
}

export function isActiveLeadStatus(status: LeadStatus): boolean {
  return !CLOSED_LEAD_STATUSES.includes(status);
}

/**
 * Color del pill de estado: el pipeline avanza por la paleta de datos, así el
 * estado se lee de un vistazo en el kanban. Los pills son tinte al 10%, no
 * bloques sólidos, para que la tabla no se convierta en un semáforo.
 */
export function leadStatusColor(status: LeadStatus): string {
  switch (status) {
    case "nuevo":
      return "var(--data-2)";
    case "contactado":
      return "var(--data-4)";
    case "en_conversacion":
      return "var(--data-1)";
    case "cotizado":
      return "var(--warning)";
    case "ganado":
      return "var(--positive)";
    case "perdido":
      return "var(--sp-line-strong)";
  }
}

// --- Canales de origen ---

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  frio: "Frío",
  referido: "Referido",
  contenido: "Contenido",
  formulario_web: "Formulario web",
  inbound: "Inbound",
  reactivacion: "Reactivación",
  otro: "Otro",
};

export const LEAD_SOURCES = Object.keys(LEAD_SOURCE_LABELS) as LeadSource[];

/**
 * El canal que escribe sólo la máquina. Se saca del alta manual porque si se
 * pudiera elegir a mano dejaría de significar "entró solo por el formulario".
 */
export const AUTOMATIC_LEAD_SOURCE: LeadSource = "formulario_web";

/**
 * Canales elegibles en el formulario de alta y edición.
 *
 * Los filtros y las métricas usan `LEAD_SOURCES` completo: hay que poder filtrar
 * por un canal aunque no se pueda tipear.
 */
export const SELECTABLE_LEAD_SOURCES: LeadSource[] = LEAD_SOURCES.filter(
  (source) => source !== AUTOMATIC_LEAD_SOURCE
);

export function isLeadSource(value: unknown): value is LeadSource {
  return typeof value === "string" && value in LEAD_SOURCE_LABELS;
}

// --- Motivos de pérdida ---

export const LEAD_LOST_REASON_LABELS: Record<LeadLostReason, string> = {
  precio: "Precio",
  timing: "Timing",
  no_responde: "No responde",
  eligio_otro: "Eligió otro",
  no_calificaba: "No calificaba",
  otro: "Otro",
};

export const LEAD_LOST_REASONS = Object.keys(LEAD_LOST_REASON_LABELS) as LeadLostReason[];

export function isLeadLostReason(value: unknown): value is LeadLostReason {
  return typeof value === "string" && value in LEAD_LOST_REASON_LABELS;
}

// --- Monedas ---

export const LEAD_CURRENCY_LABELS: Record<LeadCurrency, string> = {
  ARS: "Pesos (ARS)",
  USD: "Dólares (USD)",
  EUR: "Euros (EUR)",
};

export const LEAD_CURRENCIES = Object.keys(LEAD_CURRENCY_LABELS) as LeadCurrency[];

export const DEFAULT_LEAD_CURRENCY: LeadCurrency = "USD";

export function isLeadCurrency(value: unknown): value is LeadCurrency {
  return typeof value === "string" && value in LEAD_CURRENCY_LABELS;
}

// --- Canales de interacción ---

export const LEAD_INTERACTION_CHANNEL_LABELS: Record<LeadInteractionChannel, string> = {
  email: "Mail",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  llamada: "Llamada",
  reunion: "Reunión",
  otro: "Otro",
};

export const LEAD_INTERACTION_CHANNELS = Object.keys(
  LEAD_INTERACTION_CHANNEL_LABELS
) as LeadInteractionChannel[];

export function isLeadInteractionChannel(value: unknown): value is LeadInteractionChannel {
  return typeof value === "string" && value in LEAD_INTERACTION_CHANNEL_LABELS;
}

// --- Estado del seguimiento ---
// Derivado, no guardado: sale de comparar `nextFollowUpAt` con hoy (ver lib/leads.ts).

export type FollowUpState = "vencido" | "hoy" | "futuro" | "sin" | "cerrado";

export const FOLLOW_UP_LABELS: Record<FollowUpState, string> = {
  vencido: "Vencido",
  hoy: "Hoy",
  futuro: "Agendado",
  sin: "Sin seguimiento",
  cerrado: "Cerrado",
};

export function followUpColor(state: FollowUpState): string {
  switch (state) {
    case "vencido":
      return "var(--sp-crit)";
    case "hoy":
      return "var(--data-1)";
    case "futuro":
      return "var(--data-4)";
    default:
      return "var(--sp-muted)";
  }
}
