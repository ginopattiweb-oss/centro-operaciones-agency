/**
 * Ingesta de leads del formulario del sitio público.
 *
 * Es el único endpoint público del panel: no hay sesión, así que la puerta la
 * cuidan el `Origin` contra allowlist, el honeypot y un rate limit por IP.
 *
 * Hace dos cosas, en este orden: guarda el lead en la base (fuente de verdad) y
 * recién después reenvía a Web3Forms para que siga llegando el mail de siempre.
 * Si Web3Forms falla, el lead ya está guardado y la request igual responde 200:
 * perder el mail es molesto, perder el lead es caro.
 *
 * El sitio público postea acá con `fetch` y JSON. La `access_key` de Web3Forms
 * salió del bundle del navegador y vive sólo en el entorno del servidor.
 */
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { crmContactos, crmDerivaciones, crmEventos, leads } from "@/db/schema";
import { todayStringBA } from "@/lib/date";
import { normalizeWebsite } from "@/lib/leads";
import { LEADS_BASE_PATH, LEADS_UNIDAD_SLUG } from "@/lib/leads-config";
import {
  buildExternalId,
  buildNotes,
  MAX_BODY_BYTES,
  normalizeSubmissionPhone,
  parseSubmission,
} from "@/lib/leads-ingesta";
import { getProjectBySlug } from "@/lib/queries";
import { normalizarSitioWeb } from "@/lib/crm/contactos";
import { buscarPorClave, requireUnidad } from "@/lib/crm/queries";
import { estadoInicial, CRM_BANDEJA_PATH, CRM_TODOS_PATH } from "@/lib/crm/unidades";
import { normalizarTelefono } from "@/lib/crm/telefono";

/** Neon por HTTP y Web Crypto andan en Node; no hace falta el runtime edge. */
export const runtime = "nodejs";

const WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit";

/** Si Web3Forms se cuelga, no arrastramos la request del visitante. */
const WEB3FORMS_TIMEOUT_MS = 10_000;

const LOG = "[leads:ingesta]";

// --- CORS ---

/**
 * Allowlist explícita desde el entorno. Nunca `*`: este endpoint escribe en la
 * base, y un comodín deja que cualquier página del mundo nos cargue leads.
 */
function allowedOrigins(): string[] {
  return (process.env.LEADS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    // El origen permitido cambia la respuesta: sin esto un caché intermedio
    // puede servirle a un origen los headers calculados para otro.
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return Response.json(body, {
    status,
    headers: origin ? corsHeaders(origin) : undefined,
  });
}

/** El origen del pedido, o null si no está en la allowlist. */
function resolveOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  return allowedOrigins().includes(origin) ? origin : null;
}

// --- Rate limit ---

/**
 * Ventana deslizante en memoria: 5 submissions por IP por minuto.
 *
 * Vive en el proceso, así que cada instancia de la función lleva su propia
 * cuenta y un pico repartido entre instancias puede colarse. Alcanza para lo que
 * es: frenar el flood de un formulario que recibe unidades por día. Si algún día
 * hace falta exactitud, esto se muda a un store compartido.
 */
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((at) => now - at < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_MAX) {
    hits.set(ip, recent);
    return true;
  }

  recent.push(now);
  hits.set(ip, recent);

  // Barrido barato para que el Map no crezca sin techo en una instancia longeva.
  if (hits.size > 1000) {
    for (const [key, times] of hits) {
      if (times.every((at) => now - at >= RATE_LIMIT_WINDOW_MS)) hits.delete(key);
    }
  }
  return false;
}

/** Primera IP de la cadena: la del visitante. Las que siguen son proxies. */
function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "desconocida";
}

// --- Reenvío a Web3Forms ---

/**
 * Manda la submission a Web3Forms para que llegue el mail.
 *
 * Nunca tira: el lead ya está guardado cuando esto corre y un problema del
 * proveedor no puede convertirse en un error para el visitante. Se loguea y se
 * sigue; el dato no se pierde porque el panel ya lo tiene.
 */
async function forwardToWeb3Forms(payload: Record<string, unknown>): Promise<void> {
  const accessKey = process.env.WEB3FORMS_ACCESS_KEY;
  if (!accessKey) {
    console.error(`${LOG} falta WEB3FORMS_ACCESS_KEY: el lead se guardó pero no sale el mail`);
    return;
  }

  try {
    const response = await fetch(WEB3FORMS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ...payload, access_key: accessKey }),
      signal: AbortSignal.timeout(WEB3FORMS_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`${LOG} Web3Forms respondió ${response.status}`, await response.text());
    }
  } catch (error) {
    console.error(`${LOG} falló el reenvío a Web3Forms`, error);
  }
}

// --- Handlers ---

/** Preflight. El navegador lo manda solo por ser JSON cross-origin. */
export async function OPTIONS(request: Request): Promise<Response> {
  const origin = resolveOrigin(request);
  if (!origin) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request: Request): Promise<Response> {
  // 1. CORS. Sin origen permitido no se sigue leyendo el pedido.
  const origin = resolveOrigin(request);
  if (!origin) {
    console.warn(`${LOG} origen rechazado:`, request.headers.get("origin") ?? "(sin Origin)");
    return json({ ok: false, error: "Origen no permitido." }, 403, null);
  }

  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return json({ ok: false, error: "El pedido es demasiado grande." }, 413, origin);
    }
    raw = JSON.parse(text);
  } catch {
    return json({ ok: false, error: "El cuerpo del pedido no es JSON válido." }, 400, origin);
  }

  // 2. Honeypot. Al bot se le devuelve éxito y no se hace nada más: si le
  //    respondiéramos un error, quien lo escribió aprendería a esquivar el campo.
  //    El sitio manda el mismo valor con los dos nombres de la industria:
  //    `botcheck` (Web3Forms) y `_gotcha` (Formspree).
  const body = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const trapped = [body.botcheck, body._gotcha].some((value) =>
    typeof value === "string" ? value.trim() !== "" : Boolean(value)
  );
  if (trapped) {
    return json({ ok: true }, 200, origin);
  }

  // 3. Rate limit por IP.
  const ip = clientIp(request);
  if (rateLimited(ip)) {
    console.warn(`${LOG} rate limit alcanzado para ${ip}`);
    return json({ ok: false, error: "Demasiados envíos. Probá en un minuto." }, 429, origin);
  }

  // 4. Validación.
  const parsed = parseSubmission(raw);
  if ("error" in parsed) {
    return json({ ok: false, error: parsed.error }, 400, origin);
  }
  const { data, payload } = parsed;

  const unidad = await getProjectBySlug(LEADS_UNIDAD_SLUG);
  if (!unidad) {
    console.error(`${LOG} no existe la unidad "${LEADS_UNIDAD_SLUG}"`);
    return json({ ok: false, error: "No se pudo registrar el contacto." }, 500, origin);
  }

  // 5 y 6. Teléfono a E.164 y clave de idempotencia.
  const whatsapp = normalizeSubmissionPhone(data.Whatsapp, data.WhatsappCountry);
  const externalId = await buildExternalId(whatsapp, data.Name, todayStringBA());

  // 7. Insert.
  //
  //    Dos escrituras, y las dos importan:
  //
  //    a) `crm_contactos` es la PERSONA. Se deduplica por mail y por teléfono
  //       E.164: si ya existía (porque ya estaba en otra unidad, o ya había
  //       escrito antes), se reusa la fila y no se crea una segunda. Y se le
  //       crea la derivación a la unidad agencia en su etapa inicial, porque
  //       esto viene del sitio de la agencia y no de ningún otro lado.
  //
  //    b) `leads` es el DETALLE COMERCIAL de esa persona para la agencia: valor
  //       estimado, seguimiento, motivo de pérdida, el payload crudo. Se sigue
  //       escribiendo igual que siempre. Lo que ya NO significa nada es
  //       `leads.status`: la etapa del pipeline vive en la derivación.
  //
  //    El lead entra sin seguimiento agendado, para que aparezca en "Sin
  //    seguimiento" y alguien lo agarre.
  try {
    const agencia = await requireUnidad("agencia");

    // El teléfono ya viene en E.164 del paso 5, pero se normaliza igual contra
    // la misma función que usa todo el CRM: el CHECK de la base no perdona.
    const tel = normalizarTelefono(whatsapp);
    const sitioWeb = data.Site ? normalizarSitioWeb(data.Site) : null;
    const notas = buildNotes(data.About, data.Services);

    // Deduplicación. Sin mail ni teléfono válido no hay con qué deduplicar y se
    // crea una persona nueva: es lo correcto, no hay forma de saber si es alguien
    // que ya estaba.
    const existenteId = await buscarPorClave(null, tel.e164);
    const contactoId = existenteId ?? crypto.randomUUID();

    if (!existenteId) {
      await db.insert(crmContactos).values({
        id: contactoId,
        telefonoE164: tel.e164,
        telefonoCrudo: tel.crudo,
        nombre: data.Name,
        sitioWeb,
        origen: "formulario_web",
        notas,
        // Llenar el formulario del sitio es el consentimiento de email. El de
        // WhatsApp NO: queda en false, que es el default de la tabla.
        consentimientoAt: new Date(),
        consentimientoFuente: "Formulario del sitio público",
      });
      await db.insert(crmEventos).values({
        contactoId,
        tipo: "contacto_creado",
        datos: { origen: "formulario_web" },
      });
    }

    // La derivación a agencia. Si la persona ya estaba derivada (volvió a
    // escribir), NO se le pisa el estado: el que tiene lo puso alguien.
    const [yaDerivado] = await db
      .select({ id: crmDerivaciones.id })
      .from(crmDerivaciones)
      .where(
        and(
          eq(crmDerivaciones.contactoId, contactoId),
          eq(crmDerivaciones.unidadProjectId, agencia.projectId)
        )
      )
      .limit(1);

    if (!yaDerivado) {
      const derivacionId = crypto.randomUUID();
      const estado = estadoInicial("agencia");
      await db.insert(crmDerivaciones).values({
        id: derivacionId,
        contactoId,
        unidadProjectId: agencia.projectId,
        estado,
      });
      await db.insert(crmEventos).values({
        contactoId,
        derivacionId,
        tipo: "derivacion_creada",
        datos: { unidad: "agencia", estado, origen: "formulario_web" },
      });
    }

    await db
      .insert(leads)
      .values({
        projectId: unidad.id,
        crmContactoId: contactoId,
        contactName: data.Name,
        business: data.Brand,
        source: "formulario_web",
        whatsapp,
        website: data.Site ? normalizeWebsite(data.Site) : null,
        location: data.Location,
        notes: notas,
        status: "nuevo",
        origin: "formulario_web",
        payloadRaw: payload,
        externalId,
      })
      // El reintento del mismo POST choca acá y no duplica.
      .onConflictDoNothing({ target: leads.externalId });
  } catch (error) {
    console.error(`${LOG} falló el insert del lead`, error);
    return json({ ok: false, error: "No se pudo registrar el contacto." }, 500, origin);
  }

  // Que el panel muestre el lead sin esperar a que caduque el caché.
  revalidatePath(LEADS_BASE_PATH);
  revalidatePath(`/unidad/${LEADS_UNIDAD_SLUG}`);
  revalidatePath(CRM_TODOS_PATH);
  revalidatePath(CRM_BANDEJA_PATH);
  revalidatePath("/");

  // 8. El mail de siempre. Ya con el lead a salvo.
  await forwardToWeb3Forms(payload);

  // 9.
  return json({ ok: true }, 200, origin);
}
