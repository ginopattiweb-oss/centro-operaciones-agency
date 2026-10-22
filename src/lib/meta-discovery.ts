/**
 * Facebook Login + business_discovery para la sección Inspiración.
 *
 * `business_discovery` sólo existe en la Graph API de Facebook (graph.facebook.com)
 * con un token de usuario de Facebook que tenga una página vinculada a la cuenta
 * profesional de Instagram. Por eso esta conexión es aparte de la de Instagram
 * Login, aunque use la misma app de Meta.
 *
 * Sólo servidor: acá viven el app secret y el token en claro.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const GRAPH = "https://graph.facebook.com/v21.0";
const DIALOG = "https://www.facebook.com/v21.0/dialog/oauth";

/** `instagram_basic` habilita business_discovery; los de páginas, listar la página vinculada. */
export const META_SCOPES = ["instagram_basic", "pages_show_list", "pages_read_engagement", "business_management"];

export const META_STATE_COOKIE = "fb_oauth_state";

type Config = { appId: string; appSecret: string; redirectUri: string | null; loginConfigId: string | null };

function getConfig(): Config | null {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) return null;
  return {
    appId,
    appSecret,
    redirectUri: process.env.META_REDIRECT_URI?.trim() || null,
    // Apps de tipo Business usan "Facebook Login for Business": los permisos van en
    // una configuración creada en el panel y se pasa su id, no `scope`.
    loginConfigId: process.env.META_LOGIN_CONFIG_ID?.trim() || null,
  };
}

export function isMetaConfigured(): boolean {
  return getConfig() !== null;
}

function requireConfig(): Config {
  const config = getConfig();
  if (!config) throw new Error("Faltan META_APP_ID / META_APP_SECRET en el entorno.");
  return config;
}

export function metaRedirectUri(requestOrigin: string): string {
  return requireConfig().redirectUri ?? `${requestOrigin}/api/facebook/callback`;
}

// --- State anti-CSRF (mismo esquema que Instagram y TikTok) ---

function sign(message: string): string {
  return createHmac("sha256", requireConfig().appSecret).update(message).digest("hex");
}

export function createOAuthState(redirectUri: string): { state: string; cookieValue: string } {
  const state = randomBytes(16).toString("hex");
  const encodedUri = Buffer.from(redirectUri).toString("base64url");
  return { state, cookieValue: `${sign(`${state}|${redirectUri}`)}.${encodedUri}` };
}

export function verifyOAuthState(state: string | null, cookieValue: string | undefined): string | null {
  if (!state || !cookieValue) return null;
  const [signature, encodedUri] = cookieValue.split(".");
  if (!signature || !encodedUri) return null;
  const redirectUri = Buffer.from(encodedUri, "base64url").toString("utf8");
  const expected = Buffer.from(sign(`${state}|${redirectUri}`));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  return redirectUri;
}

export function buildAuthorizeUrl(state: string, redirectUri: string): string {
  const { appId, loginConfigId } = requireConfig();
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    response_type: "code",
    ...(loginConfigId ? { config_id: loginConfigId } : { scope: META_SCOPES.join(",") }),
  });
  return `${DIALOG}?${params}`;
}

// --- Graph ---

type GraphError = { error?: { message?: string; code?: number; error_subcode?: number } };

/** Error de la Graph API con el código de Meta, para poder distinguir los casos. */
export class MetaGraphError extends Error {
  constructor(
    message: string,
    readonly code: number | null,
    readonly subcode: number | null
  ) {
    super(message);
  }
}

/**
 * El nodo no existe o el token ya no lo ve (código 100, subcódigo 33). Con la
 * cuenta propia pasa cuando se desvincula el Instagram de la página: el token
 * sigue sano, pero el id guardado quedó apuntando a algo inaccesible.
 */
export function isUnreachableObject(error: unknown): boolean {
  return error instanceof MetaGraphError && error.code === 100 && error.subcode === 33;
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const response = await fetch(`${GRAPH}/${path}?${new URLSearchParams(params)}`, { cache: "no-store" });
  const raw = await response.text();
  if (!response.ok) {
    let parsed: GraphError["error"];
    try {
      parsed = (JSON.parse(raw) as GraphError).error;
    } catch {
      /* cuerpo no JSON */
    }
    console.error(`[meta] ${response.status} ${path}: ${raw}`);
    throw new MetaGraphError(
      parsed?.message ?? `Meta respondió ${response.status}.`,
      parsed?.code ?? null,
      parsed?.error_subcode ?? null
    );
  }
  return JSON.parse(raw) as T;
}

export type MetaToken = { accessToken: string; expiresAt: Date };

/** Código → token corto → token largo (60 días). */
export async function exchangeCode(code: string, redirectUri: string): Promise<MetaToken> {
  const { appId, appSecret } = requireConfig();
  const short = await graphGet<{ access_token: string }>("oauth/access_token", {
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });
  const long = await graphGet<{ access_token: string; expires_in?: number }>("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: short.access_token,
  });
  return {
    accessToken: long.access_token,
    expiresAt: new Date(Date.now() + (long.expires_in ?? 60 * 86_400) * 1000),
  };
}

export type LinkedPage = {
  fbUserId: string;
  fbUserName: string | null;
  pageId: string;
  pageName: string | null;
  igBusinessAccountId: string;
  igUsername: string | null;
};

/**
 * Cuenta profesional de Instagram desde la que se consulta business_discovery.
 * Primero se busca una página del usuario con Instagram vinculado; si no hay,
 * las cuentas de Instagram del portfolio comercial (no necesitan página).
 */
export async function findLinkedInstagram(accessToken: string): Promise<LinkedPage> {
  const me = await graphGet<{ id: string; name?: string }>("me", { fields: "id,name", access_token: accessToken });
  const pages = await graphGet<{
    data: { id: string; name?: string; instagram_business_account?: { id: string; username?: string } }[];
  }>("me/accounts", {
    fields: "id,name,instagram_business_account{id,username}",
    limit: "50",
    access_token: accessToken,
  });
  console.log(
    `[meta] páginas de ${me.name ?? me.id}: ` +
      (pages.data.length === 0
        ? "ninguna"
        : pages.data
            .map((entry) => `${entry.name ?? entry.id} → IG ${entry.instagram_business_account?.username ?? "no vinculado"}`)
            .join("; "))
  );
  const page = pages.data.find((entry) => entry.instagram_business_account);
  if (page?.instagram_business_account) {
    return {
      fbUserId: me.id,
      fbUserName: me.name ?? null,
      pageId: page.id,
      pageName: page.name ?? null,
      igBusinessAccountId: page.instagram_business_account.id,
      igUsername: page.instagram_business_account.username ?? null,
    };
  }

  // Sin página: cuentas de Instagram que son activos del portfolio comercial.
  let businesses: { id: string; name?: string; owned_instagram_accounts?: { data: { id: string; username?: string }[] } }[] = [];
  try {
    businesses = (
      await graphGet<{ data: typeof businesses }>("me/businesses", {
        fields: "id,name,owned_instagram_accounts{id,username}",
        access_token: accessToken,
      })
    ).data;
  } catch (error) {
    console.error("[meta] me/businesses:", error instanceof Error ? error.message : error);
  }
  console.log(
    `[meta] portfolios: ` +
      (businesses.length === 0
        ? "ninguno"
        : businesses
            .map((b) => `${b.name ?? b.id} → IG ${(b.owned_instagram_accounts?.data ?? []).map((ig) => ig.username ?? ig.id).join(",") || "ninguna"}`)
            .join("; "))
  );
  for (const business of businesses) {
    const ig = business.owned_instagram_accounts?.data[0];
    if (ig) {
      return {
        fbUserId: me.id,
        fbUserName: me.name ?? null,
        pageId: `business:${business.id}`,
        pageName: business.name ?? null,
        igBusinessAccountId: ig.id,
        igUsername: ig.username ?? null,
      };
    }
  }

  throw new Error(
    pages.data.length === 0 && businesses.length === 0
      ? "Facebook no nos dio acceso a páginas ni al portfolio comercial. Revisá que la configuración de login incluya pages_show_list y business_management, y volvé a conectar."
      : "No encontramos una cuenta de Instagram profesional ni en tus páginas ni en tu portfolio comercial. Vinculá @webdesignnetwork a una página de Facebook o agregala como activo del portfolio (business.facebook.com → Configuración → Cuentas de Instagram)."
  );
}

// --- business_discovery ---

export type DiscoveredMedia = {
  id: string;
  caption: string | null;
  mediaType: string | null;
  productType: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  timestamp: string;
  likeCount: number | null;
  commentsCount: number | null;
};

export type DiscoveredAccount = {
  username: string;
  name: string | null;
  biography: string | null;
  avatarUrl: string | null;
  website: string | null;
  followersCount: number | null;
  mediaCount: number | null;
  media: DiscoveredMedia[];
};

const MEDIA_FIELDS =
  "id,caption,like_count,comments_count,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp";

/** Perfil público y últimas publicaciones de una cuenta profesional ajena. */
export async function discoverAccount(
  igBusinessAccountId: string,
  accessToken: string,
  username: string,
  limit = 30
): Promise<DiscoveredAccount> {
  const clean = username.replace(/^@/, "").trim();
  if (!/^[A-Za-z0-9._]{1,30}$/.test(clean)) throw new Error("Usuario inválido.");
  const fields = `business_discovery.username(${clean}){username,name,biography,profile_picture_url,website,followers_count,media_count,media.limit(${limit}){${MEDIA_FIELDS}}}`;
  const payload = await graphGet<{
    business_discovery: {
      username: string;
      name?: string;
      biography?: string;
      profile_picture_url?: string;
      website?: string;
      followers_count?: number;
      media_count?: number;
      media?: {
        data: {
          id: string;
          caption?: string;
          like_count?: number;
          comments_count?: number;
          media_type?: string;
          media_product_type?: string;
          media_url?: string;
          thumbnail_url?: string;
          permalink?: string;
          timestamp: string;
        }[];
      };
    };
  }>(igBusinessAccountId, { fields, access_token: accessToken });

  const account = payload.business_discovery;
  return {
    username: account.username,
    name: account.name ?? null,
    biography: account.biography ?? null,
    avatarUrl: account.profile_picture_url ?? null,
    website: account.website ?? null,
    followersCount: account.followers_count ?? null,
    mediaCount: account.media_count ?? null,
    media: (account.media?.data ?? []).map((item) => ({
      id: item.id,
      caption: item.caption ?? null,
      mediaType: item.media_type ?? null,
      productType: item.media_product_type ?? null,
      // Para imágenes el thumbnail viene en media_url; para videos, en thumbnail_url.
      thumbnailUrl: item.thumbnail_url ?? (item.media_type === "IMAGE" || item.media_type === "CAROUSEL_ALBUM" ? item.media_url ?? null : null),
      permalink: item.permalink ?? null,
      timestamp: item.timestamp,
      likeCount: item.like_count ?? null,
      commentsCount: item.comments_count ?? null,
    })),
  };
}
