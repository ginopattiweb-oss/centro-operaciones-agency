/**
 * Unidades de negocio que viven en una app externa.
 * El slug apunta a la URL del panel correspondiente en vez de a /unidad/[slug].
 * Ej: { "mi-otro-negocio": "https://panel.mi-otro-negocio.com/" }
 */
const EXTERNAL_UNIDAD_URLS: Record<string, string> = {};

export function unidadExternalUrl(slug: string): string | null {
  return EXTERNAL_UNIDAD_URLS[slug] ?? null;
}

export function unidadHref(slug: string): string {
  return unidadExternalUrl(slug) ?? `/unidad/${slug}`;
}
