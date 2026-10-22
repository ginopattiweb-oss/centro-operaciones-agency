import { AGENCY_NAME, APP_URL } from "@/lib/marca";

/** Datos que aparecen en las páginas legales públicas. */
export const LEGAL = {
  operator: AGENCY_NAME,
  product: "Centro de Operaciones",
  domain: APP_URL.replace(/^https?:\/\//, ""),
  /** A dónde escribir para consultas o pedidos de borrado. */
  contactEmail: process.env.LEGAL_CONTACT_EMAIL?.trim() || "contacto@tu-dominio.com",
  /** Fecha de la última revisión, como 'YYYY-MM-DD'. */
  updatedOn: "2026-10-22",
} as const;
