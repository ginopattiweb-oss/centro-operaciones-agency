/**
 * Vocabulario compartido de contactos: orígenes y paginación del CRM.
 *
 * Sin nada de servidor, así lo importan también los componentes de cliente
 * (mismo criterio que `leads-config.ts` y `proyecto-estados.ts`).
 */
import type { ContactSource } from "@/db/schema";

// --- Orígenes ---

export const CONTACT_SOURCE_LABELS: Record<ContactSource, string> = {
  manual: "Carga manual",
  gumroad: "Gumroad",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  web: "Web",
  referido: "Referido",
  import: "Importación",
  formulario_web: "Formulario web",
  whatsapp: "WhatsApp",
};

export const CONTACT_SOURCES = Object.keys(CONTACT_SOURCE_LABELS) as ContactSource[];

export function isContactSource(value: unknown): value is ContactSource {
  return typeof value === "string" && value in CONTACT_SOURCE_LABELS;
}

// --- Paginación ---

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;
