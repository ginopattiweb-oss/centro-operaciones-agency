/**
 * Nombre de la agencia y de quien la opera. Se configuran por variable de
 * entorno (ver .env.example) para no tener que tocar código al instalar.
 *
 * NEXT_PUBLIC_ porque también se leen desde componentes de cliente (el portal).
 */
export const AGENCY_NAME = process.env.NEXT_PUBLIC_AGENCY_NAME?.trim() || "Mi Agencia";

/** Nombre de pila para el saludo del dashboard. Vacío = saludo sin nombre. */
export const OWNER_NAME = process.env.NEXT_PUBLIC_OWNER_NAME?.trim() || "";

/**
 * URL pública del panel, sin barra final (ej: https://panel.miagencia.com).
 * Se usa en las páginas legales y en las instrucciones de conexión con Meta.
 */
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://tu-dominio.com").replace(/\/+$/, "");
