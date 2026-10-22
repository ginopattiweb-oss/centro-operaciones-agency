// Sesión del portal de clientes. Sólo Web Crypto: debe correr también en Edge (middleware).
export const PORTAL_SESSION_COOKIE = "co_portal_session";
export const PORTAL_SESSION_MAX_AGE = 60 * 60 * 24 * 14; // 14 días

export type PortalSession = { uid: string; exp: number };

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Falta SESSION_SECRET en el entorno");
  return secret;
}

async function sign(message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  // Namespace propio para que un token de portal nunca valga como token de admin.
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(`portal:${message}`)));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createPortalSessionToken(userId: string): Promise<string> {
  const payload: PortalSession = {
    uid: userId,
    exp: Math.floor(Date.now() / 1000) + PORTAL_SESSION_MAX_AGE,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `${encoded}.${await sign(encoded)}`;
}

export async function readPortalSessionToken(
  token: string | undefined
): Promise<PortalSession | null> {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  if (!safeEqual(signature, await sign(encoded))) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as PortalSession;
    if (!payload?.uid || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
