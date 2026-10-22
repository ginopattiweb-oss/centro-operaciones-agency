/**
 * Cliente de TikTok for Developers: Login Kit (OAuth) + Display API.
 *
 * El access token dura 24 horas y el refresh token un año, así que cada sync
 * empieza renovando el access token con el refresh. Si el refresh venció o la
 * persona revocó el acceso, hay que volver a autorizar.
 *
 * Sólo servidor: acá viven el client secret y los tokens en claro.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const API_URL = "https://open.tiktokapis.com/v2";

/** Perfil, contadores y listado de videos. Todos de la Display API. */
export const TIKTOK_SCOPES = ["user.info.basic", "user.info.profile", "user.info.stats", "video.list"];

export const TIKTOK_STATE_COOKIE = "tt_oauth_state";

type Config = { clientKey: string; clientSecret: string; redirectUri: string | null };

function getConfig(): Config | null {
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim();
  if (!clientKey || !clientSecret) return null;
  return { clientKey, clientSecret, redirectUri: process.env.TIKTOK_REDIRECT_URI?.trim() || null };
}

export function isTiktokConfigured(): boolean {
  return getConfig() !== null;
}

function requireConfig(): Config {
  const config = getConfig();
  if (!config) throw new Error("Faltan TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET en el entorno.");
  return config;
}

/** Tiene que coincidir byte a byte con la cargada en el panel de TikTok, y ser HTTPS. */
export function tiktokRedirectUri(requestOrigin: string): string {
  return requireConfig().redirectUri ?? `${requestOrigin}/api/tiktok/callback`;
}

// --- State anti-CSRF (mismo esquema que Instagram) ---

function sign(message: string): string {
  return createHmac("sha256", requireConfig().clientSecret).update(message).digest("hex");
}

export function createOAuthState(
  projectId: string,
  redirectUri: string
): { state: string; cookieValue: string } {
  const state = `${projectId}.${randomBytes(16).toString("hex")}`;
  const encodedUri = Buffer.from(redirectUri).toString("base64url");
  return { state, cookieValue: `${sign(`${state}|${redirectUri}`)}.${encodedUri}` };
}

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
  const params = new URLSearchParams({
    client_key: requireConfig().clientKey,
    scope: TIKTOK_SCOPES.join(","),
    response_type: "code",
    redirect_uri: redirectUri,
    state,
  });
  return `${AUTHORIZE_URL}?${params}`;
}

// --- Tokens ---

type TokenPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  open_id?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

export type TiktokTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  openId: string;
  scope: string;
};

async function requestToken(body: Record<string, string>): Promise<TiktokTokens> {
  const { clientKey, clientSecret } = requireConfig();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, ...body }),
    cache: "no-store",
  });
  const raw = await response.text();
  let payload: TokenPayload = {};
  try {
    payload = JSON.parse(raw) as TokenPayload;
  } catch {
    /* cuerpo no JSON */
  }
  if (!response.ok || payload.error || !payload.access_token || !payload.refresh_token) {
    console.error(`[tiktok] ${response.status} oauth/token: ${raw}`);
    throw new Error(payload.error_description ?? payload.error ?? `TikTok respondió ${response.status}.`);
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    accessTokenExpiresAt: new Date(Date.now() + (payload.expires_in ?? 86_400) * 1000),
    refreshTokenExpiresAt: new Date(Date.now() + (payload.refresh_expires_in ?? 31_536_000) * 1000),
    openId: payload.open_id ?? "",
    scope: payload.scope ?? "",
  };
}

export function exchangeCodeForTokens(code: string, redirectUri: string): Promise<TiktokTokens> {
  return requestToken({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

export function refreshTokens(refreshToken: string): Promise<TiktokTokens> {
  return requestToken({ grant_type: "refresh_token", refresh_token: refreshToken });
}

// --- Display API ---

type ApiEnvelope<T> = { data?: T; error?: { code?: string; message?: string; log_id?: string } };

async function apiCall<T>(
  path: string,
  accessToken: string,
  init: { method?: "GET" | "POST"; fields: string[]; body?: unknown }
): Promise<T> {
  const url = `${API_URL}/${path}?fields=${init.fields.join(",")}`;
  const response = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const raw = await response.text();
  let payload: ApiEnvelope<T> = {};
  try {
    payload = JSON.parse(raw) as ApiEnvelope<T>;
  } catch {
    /* cuerpo no JSON */
  }
  // TikTok responde 200 con error.code distinto de "ok" cuando algo falla.
  const failed = !response.ok || (payload.error?.code && payload.error.code !== "ok");
  if (failed || !payload.data) {
    console.error(`[tiktok] ${response.status} ${path}: ${raw}`);
    throw new Error(payload.error?.message ?? `TikTok respondió ${response.status}.`);
  }
  return payload.data;
}

export type TiktokProfile = {
  openId: string;
  unionId: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bioDescription: string | null;
  isVerified: boolean;
  profileDeepLink: string | null;
  followerCount: number | null;
  followingCount: number | null;
  likesCount: number | null;
  videoCount: number | null;
};

export async function fetchProfile(accessToken: string): Promise<TiktokProfile> {
  const { user } = await apiCall<{
    user: {
      open_id: string;
      union_id?: string;
      display_name?: string;
      avatar_url?: string;
      bio_description?: string;
      is_verified?: boolean;
      profile_deep_link?: string;
      follower_count?: number;
      following_count?: number;
      likes_count?: number;
      video_count?: number;
    };
  }>("user/info/", accessToken, {
    fields: [
      "open_id",
      "union_id",
      "display_name",
      "avatar_url",
      "bio_description",
      "is_verified",
      "profile_deep_link",
      "follower_count",
      "following_count",
      "likes_count",
      "video_count",
    ],
  });
  return {
    openId: user.open_id,
    unionId: user.union_id ?? null,
    displayName: user.display_name ?? null,
    avatarUrl: user.avatar_url ?? null,
    bioDescription: user.bio_description ?? null,
    isVerified: user.is_verified ?? false,
    profileDeepLink: user.profile_deep_link ?? null,
    followerCount: user.follower_count ?? null,
    followingCount: user.following_count ?? null,
    likesCount: user.likes_count ?? null,
    videoCount: user.video_count ?? null,
  };
}

export type TiktokVideoItem = {
  tiktokId: string;
  publishedAt: Date;
  title: string | null;
  videoDescription: string | null;
  coverImageUrl: string | null;
  shareUrl: string | null;
  embedLink: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  shareCount: number | null;
};

/** Todos los videos públicos de la cuenta, paginando de a 20 hasta `max`. */
export async function fetchAllVideos(accessToken: string, max = 200): Promise<TiktokVideoItem[]> {
  const videos: TiktokVideoItem[] = [];
  let cursor: number | undefined;
  do {
    const data = await apiCall<{
      videos: {
        id: string;
        create_time: number;
        title?: string;
        video_description?: string;
        cover_image_url?: string;
        share_url?: string;
        embed_link?: string;
        duration?: number;
        width?: number;
        height?: number;
        view_count?: number;
        like_count?: number;
        comment_count?: number;
        share_count?: number;
      }[];
      cursor: number;
      has_more: boolean;
    }>("video/list/", accessToken, {
      method: "POST",
      fields: [
        "id",
        "create_time",
        "title",
        "video_description",
        "cover_image_url",
        "share_url",
        "embed_link",
        "duration",
        "width",
        "height",
        "view_count",
        "like_count",
        "comment_count",
        "share_count",
      ],
      body: { max_count: 20, ...(cursor ? { cursor } : {}) },
    });
    for (const video of data.videos ?? []) {
      videos.push({
        tiktokId: video.id,
        publishedAt: new Date(video.create_time * 1000),
        title: video.title ?? null,
        videoDescription: video.video_description ?? null,
        coverImageUrl: video.cover_image_url ?? null,
        shareUrl: video.share_url ?? null,
        embedLink: video.embed_link ?? null,
        duration: video.duration ?? null,
        width: video.width ?? null,
        height: video.height ?? null,
        viewCount: video.view_count ?? null,
        likeCount: video.like_count ?? null,
        commentCount: video.comment_count ?? null,
        shareCount: video.share_count ?? null,
      });
    }
    cursor = data.has_more ? data.cursor : undefined;
  } while (cursor && videos.length < max);
  return videos;
}
