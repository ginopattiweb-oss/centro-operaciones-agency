// Autenticación con la service account de Google: JWT RS256 firmado con node:crypto.
// Lo comparten Analytics y Calendar. No importar desde componentes de cliente.
import { createSign } from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export const SCOPE_ANALYTICS = "https://www.googleapis.com/auth/analytics.readonly";
export const SCOPE_CALENDAR = "https://www.googleapis.com/auth/calendar.readonly";

function getCredentials(): { email: string; privateKey: string } | null {
  const email = process.env.GA_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GA_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) return null;
  // En .env / Vercel la clave viaja con "\n" literales.
  return { email, privateKey: rawKey.replace(/\\n/g, "\n") };
}

export function isGoogleConfigured(): boolean {
  return getCredentials() !== null;
}

export function getServiceAccountEmail(): string | null {
  return getCredentials()?.email ?? null;
}

function base64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Un token por scope: el de Analytics no sirve para Calendar.
const tokenCache = new Map<string, { value: string; expiresAt: number }>();

export async function getAccessToken(scope: string): Promise<string> {
  const cached = tokenCache.get(scope);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;

  const credentials = getCredentials();
  if (!credentials) throw new Error("Faltan credenciales de Google en el entorno.");

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: credentials.email,
      scope,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const assertion = `${header}.${claims}.${base64Url(signer.sign(credentials.privateKey))}`;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`No se pudo autenticar contra Google (${response.status}).`);
  }

  const payload = (await response.json()) as { access_token: string; expires_in: number };
  tokenCache.set(scope, {
    value: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
  });
  return payload.access_token;
}
