/**
 * Helpers puros de la ingesta de leads del formulario del sitio público.
 *
 * Nada de acá toca la base ni lee el entorno: sólo valida y transforma lo que
 * llega por el POST. El route handler (`app/api/webhooks/leads/route.ts`) se
 * queda con lo que sí es de servidor — CORS, rate limit, insert y reenvío.
 * Mismo criterio que `lib/leads.ts` frente a `actions/leads.ts`.
 */

/** Campos que el formulario manda hoy. Todos opcionales salvo `Name`. */
export type LeadSubmission = {
  Name: string;
  Brand: string | null;
  Whatsapp: string | null;
  WhatsappCountry: string | null;
  Location: string | null;
  Site: string | null;
  About: string | null;
  Services: string | null;
};

/**
 * Cota de tamaño del body. No es una defensa criptográfica: evita que alguien
 * nos haga guardar un jsonb de megabytes por accidente o por prueba.
 */
export const MAX_BODY_BYTES = 64 * 1024;

/** Cota por campo y cantidad de campos. El resto del body igual se guarda crudo. */
const MAX_FIELD_LENGTH = 5000;
const MAX_KEYS = 60;

export type ParseResult =
  | { error: string }
  | { data: LeadSubmission; payload: Record<string, unknown> };

/**
 * Lee el primer alias presente de un campo: string recortado, o null.
 *
 * Se aceptan varios nombres por campo porque el sitio manda `name`/`brand` en
 * minúscula y la especificación original hablaba de `Name`/`Brand`. Soportar los
 * dos evita que un renombre en el formulario nos deje sin leads en silencio.
 */
function field(body: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = body[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

/**
 * Valida el body de la submission.
 *
 * A propósito no rechaza claves desconocidas: el formulario va a sumar campos y
 * el objetivo de `payload_raw` es justamente no perderlos. Lo que sí exige es
 * que sea un objeto plano, con `Name`, y sin valores desmedidos.
 */
export function parseSubmission(raw: unknown): ParseResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { error: "El cuerpo del pedido tiene que ser un objeto JSON." };
  }

  const body = raw as Record<string, unknown>;

  const keys = Object.keys(body);
  if (keys.length > MAX_KEYS) {
    return { error: `El formulario mandó más de ${MAX_KEYS} campos.` };
  }
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string" && value.length > MAX_FIELD_LENGTH) {
      return { error: `El campo "${key}" supera los ${MAX_FIELD_LENGTH} caracteres.` };
    }
  }

  const name = field(body, "name", "Name");
  if (!name) return { error: "Falta el nombre del contacto." };

  return {
    data: {
      Name: name,
      Brand: field(body, "brand", "Brand"),
      // El sitio ya lo manda en E.164; la normalización queda como red de seguridad.
      Whatsapp: field(body, "whatsapp", "Whatsapp"),
      WhatsappCountry: field(body, "whatsapp_country", "Whatsapp country"),
      Location: field(body, "location", "Location"),
      Site: field(body, "site", "Site"),
      About: field(body, "about", "About"),
      Services: field(body, "services", "Services"),
    },
    payload: body,
  };
}

/**
 * Teléfono a E.164.
 *
 * El formulario manda el número por un lado ("+54 381 000 0000", o "3810000000")
 * y el país por otro ("Argentina (+54)"). Se limpia todo lo que no sea dígito y,
 * si el número no arranca con el código de país, se lo antepone.
 *
 * Devuelve null si no hay nada usable: un lead sin teléfono se guarda igual.
 */
export function normalizeSubmissionPhone(
  phone: string | null,
  country: string | null
): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  // Menos de 8 dígitos no es un teléfono, es un dedazo.
  if (digits.length < 8) return null;

  const code = (country ?? "").replace(/\D/g, "");
  if (!code) return `+${digits}`;

  return digits.startsWith(code) ? `+${digits}` : `+${code}${digits}`;
}

/**
 * Clave de idempotencia: SHA-256 de teléfono + nombre + día.
 *
 * Si el POST se reintenta (red que se corta, doble click, retry del navegador),
 * el segundo insert choca contra el unique y no pasa nada. El día entra en el
 * hash a propósito: la misma persona escribiendo de nuevo un mes después es un
 * lead nuevo, no un duplicado.
 */
export async function buildExternalId(
  phone: string | null,
  name: string,
  day: string
): Promise<string> {
  const source = `${phone ?? ""}|${name.toLowerCase()}|${day}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Las notas del lead a partir de los dos campos largos del formulario.
 * Con etiqueta, porque en el drawer se leen sueltos y sin contexto no se entiende
 * cuál es cuál.
 */
export function buildNotes(about: string | null, services: string | null): string | null {
  const blocks: string[] = [];
  if (about) blocks.push(`Sobre el proyecto:\n${about}`);
  if (services) blocks.push(`Servicios de interés:\n${services}`);
  return blocks.length ? blocks.join("\n\n") : null;
}

// --- Lectura del payload crudo en el panel ---

/**
 * Campos del formulario que ya tienen columna propia en `leads`. Se listan para
 * poder mostrar en el drawer sólo lo que no se ve en ningún otro lado.
 * `botcheck` y `access_key` no son datos del contacto: son plomería.
 */
const MAPPED_SUBMISSION_KEYS = new Set([
  // Con columna propia. En minúscula como los manda el sitio, y en la forma
  // capitalizada de la especificación original.
  "name",
  "Name",
  "brand",
  "Brand",
  "whatsapp",
  "Whatsapp",
  "whatsapp_country",
  "Whatsapp country",
  "location",
  "Location",
  "site",
  "Site",
  "about",
  "About",
  "services",
  "Services",
  // Plomería del envío, no datos del contacto.
  "subject",
  "access_key",
  "botcheck",
  // El honeypot que entiende Formspree, y el link de WhatsApp ya derivado del
  // teléfono: mostrarlos sería ruido.
  "_gotcha",
  "whatsapp_link",
]);

/**
 * Etiquetas en castellano para los campos que el formulario manda hoy sin
 * columna propia. Lo que no esté acá se muestra con la clave humanizada: sumar
 * un campo al sitio no debería exigir tocar el panel.
 */
const EXTRA_LABELS: Record<string, string> = {
  budget: "Presupuesto",
  // El "source" del formulario es cómo nos conoció, no el canal del lead.
  source: "Cómo nos conoció",
  language: "Idioma del formulario",
};

/** Un campo del formulario que todavía no tiene columna ni lugar en la UI. */
export type PayloadExtra = { label: string; value: string };

/** "budget_estimado" → "Budget estimado". El formulario no manda etiquetas. */
function humanizeKey(key: string): string {
  const clean = key.replace(/[_-]+/g, " ").trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Los campos del `payload_raw` que no se ven en ninguna otra parte del detalle.
 *
 * Existe para que sumar un campo al formulario del sitio no requiera tocar el
 * panel: el dato aparece solo, con su etiqueta. Nunca se muestra JSON crudo, así
 * que lo que no se puede leer como texto plano se descarta.
 */
export function payloadExtras(payload: unknown): PayloadExtra[] {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return [];

  const extras: PayloadExtra[] = [];
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (MAPPED_SUBMISSION_KEYS.has(key)) continue;

    let text: string | null = null;
    if (typeof value === "string") text = value.trim();
    else if (typeof value === "number" || typeof value === "boolean") text = String(value);
    // Un grupo de checkboxes llega como lista; se lee como enumeración.
    else if (Array.isArray(value)) {
      text = value.filter((item) => typeof item === "string" || typeof item === "number")
        .join(", ");
    }

    if (text) extras.push({ label: EXTRA_LABELS[key] ?? humanizeKey(key), value: text });
  }
  return extras;
}
