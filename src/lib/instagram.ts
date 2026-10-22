/**
 * Cliente de "Instagram API with Instagram Login" (login de negocio).
 *
 * Es la variante que NO necesita página de Facebook: la persona autoriza con su
 * cuenta profesional de Instagram (Business o Creator) y Meta devuelve un token
 * corto (1 hora) que se canjea por uno largo (60 días). El largo se renueva
 * con `refresh_access_token` mientras tenga más de 24 horas y no haya vencido.
 *
 * Sólo servidor: acá viven el app secret y los tokens en claro.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const GRAPH_URL = "https://graph.instagram.com";
const GRAPH_VERSION = "v21.0";

/**
 * Permisos que pedimos. `manage_insights` es lo que habilita alcance, vistas y
 * seguidores por día.
 */
export const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_insights",
];

export const INSTAGRAM_STATE_COOKIE = "ig_oauth_state";

type Config = { appId: string; appSecret: string; redirectUri: string | null };

function getConfig(): Config | null {
  // trim: un espacio o salto de línea pegado en el panel de Vercel rompe el canje sin avisar.
  const appId = process.env.INSTAGRAM_APP_ID?.trim();
  const appSecret = process.env.INSTAGRAM_APP_SECRET?.trim();
  if (!appId || !appSecret) return null;
  return { appId, appSecret, redirectUri: process.env.INSTAGRAM_REDIRECT_URI?.trim() || null };
}

export function isInstagramConfigured(): boolean {
  return getConfig() !== null;
}

function requireConfig(): Config {
  const config = getConfig();
  if (!config) throw new Error("Faltan INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET en el entorno.");
  return config;
}

/**
 * Meta exige que la URI coincida exactamente con la cargada en el panel de la
 * app y que sea HTTPS. Si hay `INSTAGRAM_REDIRECT_URI` manda esa; si no, se arma
 * desde el origen de la request (sirve en Vercel, no en localhost sin túnel).
 */
export function instagramRedirectUri(requestOrigin: string): string {
  return requireConfig().redirectUri ?? `${requestOrigin}/api/instagram/callback`;
}

// --- State anti-CSRF ---
// El state viaja a Instagram y vuelve en el callback; su firma se guarda en una
// cookie httpOnly junto con la redirect_uri EXACTA usada en el authorize: Meta
// exige que el canje del código use la misma cadena, byte a byte, así que no se
// vuelve a derivar del origen de la request (en Vercel puede cambiar).

function sign(message: string): string {
  return createHmac("sha256", requireConfig().appSecret).update(message).digest("hex");
}

export function createOAuthState(
  projectId: string,
  redirectUri: string
): { state: string; cookieValue: string } {
  const state = `${projectId}.${randomBytes(16).toString("hex")}`;
  const encodedUri = Buffer.from(redirectUri).toString("base64url");
  return { state, cookieValue: `${sign(`${state}|${redirectUri}`)}.${encodedUri}` };
}

/** Devuelve projectId y redirect_uri si el state es el que emitimos; null si no. */
export function verifyOAuthState(
  state: string | null,
  cookieValue: string | undefined
): { projectId: string; redirectUri: string } | null {
  if (!state || !cookieValue) return null;
  const [signature, encodedUri] = cookieValue.split(".");
  if (!signature || !encodedUri) return null;
  const redirectUri = Buffer.from(encodedUri, "base64url").toString("utf8");
  const expected = Buffer.from(sign(`${state}|${redirectUri}`));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  const [projectId] = state.split(".");
  return projectId ? { projectId, redirectUri } : null;
}

export function buildAuthorizeUrl(state: string, redirectUri: string): string {
  const { appId } = requireConfig();
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: INSTAGRAM_SCOPES.join(","),
    state,
    // Fuerza la pantalla de permisos aunque la persona ya haya autorizado antes.
    force_reauth: "true",
  });
  return `${AUTHORIZE_URL}?${params}`;
}

// --- Tokens ---

type ApiError = { error?: { message?: string }; error_message?: string; error_type?: string };

async function readError(response: Response, fallback: string): Promise<string> {
  const raw = await response.text();
  console.error(`[instagram] ${response.status} ${response.url}: ${raw}`);
  try {
    const payload = JSON.parse(raw) as ApiError;
    return payload.error?.message ?? payload.error_message ?? fallback;
  } catch {
    return fallback;
  }
}

export type LongLivedToken = { accessToken: string; expiresAt: Date; igUserId: string; permissions: string };

/** Código del callback → token corto → token largo. Devuelve el largo. */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<LongLivedToken> {
  const { appId, appSecret } = requireConfig();

  // multipart/form-data, como el ejemplo de la doc de Meta (`curl -F`).
  const form = new FormData();
  form.set("client_id", appId);
  form.set("client_secret", appSecret);
  form.set("grant_type", "authorization_code");
  form.set("redirect_uri", redirectUri);
  form.set("code", code);
  const shortResponse = await fetch(TOKEN_URL, { method: "POST", body: form });
  if (!shortResponse.ok) {
    throw new Error(await readError(shortResponse, `Instagram rechazó el código (${shortResponse.status}).`));
  }
  // Instagram Login envuelve la respuesta en `data: [...]`; la doc vieja la
  // muestra plana. Se aceptan las dos.
  type ShortToken = { access_token: string; user_id: number | string; permissions?: string[] | string };
  const shortPayload = (await shortResponse.json()) as ShortToken | { data: ShortToken[] };
  const short = "data" in shortPayload ? shortPayload.data[0] : shortPayload;
  if (!short?.access_token) {
    console.error(`[instagram] respuesta de canje sin token: ${JSON.stringify(shortPayload)}`);
    throw new Error("Instagram no devolvió un token de acceso.");
  }

  const longParams = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: appSecret,
    access_token: short.access_token,
  });
  const longResponse = await fetch(`${GRAPH_URL}/access_token?${longParams}`);
  if (!longResponse.ok) {
    throw new Error(await readError(longResponse, `No se pudo obtener el token largo (${longResponse.status}).`));
  }
  const long = (await longResponse.json()) as { access_token: string; expires_in: number };

  return {
    accessToken: long.access_token,
    expiresAt: new Date(Date.now() + long.expires_in * 1000),
    igUserId: String(short.user_id),
    permissions: Array.isArray(short.permissions)
      ? short.permissions.join(",")
      : (short.permissions ?? ""),
  };
}

/** Renueva un token largo. Falla si ya venció: ahí hay que volver a autorizar. */
export async function refreshLongLivedToken(
  accessToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  const params = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: accessToken });
  const response = await fetch(`${GRAPH_URL}/refresh_access_token?${params}`);
  if (!response.ok) {
    throw new Error(await readError(response, `No se pudo renovar el token (${response.status}).`));
  }
  const payload = (await response.json()) as { access_token: string; expires_in: number };
  return {
    accessToken: payload.access_token,
    expiresAt: new Date(Date.now() + payload.expires_in * 1000),
  };
}

// --- Perfil ---

export type InstagramProfile = {
  igUserId: string;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
  biography: string | null;
  accountType: string | null;
  followerCount: number | null;
  followsCount: number | null;
  mediaCount: number | null;
};

const PROFILE_FIELDS =
  "user_id,username,name,profile_picture_url,biography,account_type,followers_count,follows_count,media_count";

export async function fetchProfile(accessToken: string): Promise<InstagramProfile> {
  const params = new URLSearchParams({ fields: PROFILE_FIELDS, access_token: accessToken });
  const response = await fetch(`${GRAPH_URL}/${GRAPH_VERSION}/me?${params}`);
  if (!response.ok) {
    throw new Error(await readError(response, `No se pudo leer el perfil (${response.status}).`));
  }
  const payload = (await response.json()) as {
    user_id?: number | string;
    id?: string;
    username?: string;
    name?: string;
    profile_picture_url?: string;
    biography?: string;
    account_type?: string;
    followers_count?: number;
    follows_count?: number;
    media_count?: number;
  };
  return {
    igUserId: String(payload.user_id ?? payload.id ?? ""),
    username: payload.username ?? null,
    name: payload.name ?? null,
    avatarUrl: payload.profile_picture_url ?? null,
    biography: payload.biography ?? null,
    accountType: payload.account_type ?? null,
    followerCount: payload.followers_count ?? null,
    followsCount: payload.follows_count ?? null,
    mediaCount: payload.media_count ?? null,
  };
}
