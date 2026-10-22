/**
 * Carga las credenciales de Google Analytics en .env.local a partir del JSON
 * de la service account que descargás de Google Cloud.
 *
 *   npx tsx scripts/setup-ga.ts ~/Downloads/mi-proyecto-abc123.json
 *
 * Escapa la clave privada como corresponde y, si las variables ya existían,
 * las reemplaza en lugar de duplicarlas.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ENV_PATH = resolve(process.cwd(), ".env.local");
const EMAIL_KEY = "GA_SERVICE_ACCOUNT_EMAIL";
const KEY_KEY = "GA_SERVICE_ACCOUNT_PRIVATE_KEY";

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

const jsonPath = process.argv[2];
if (!jsonPath) {
  fail("Pasá la ruta del JSON:  npx tsx scripts/setup-ga.ts ~/Downloads/tu-archivo.json");
}

const resolvedJsonPath = resolve(jsonPath.replace(/^~/, process.env.HOME ?? "~"));
if (!existsSync(resolvedJsonPath)) fail(`No encontré el archivo: ${resolvedJsonPath}`);

let credentials: { client_email?: string; private_key?: string; type?: string };
try {
  credentials = JSON.parse(readFileSync(resolvedJsonPath, "utf8"));
} catch {
  fail("Ese archivo no es un JSON válido.");
}

if (credentials.type !== "service_account") {
  fail("El JSON no es de una cuenta de servicio (falta \"type\": \"service_account\").");
}
if (!credentials.client_email || !credentials.private_key) {
  fail("Al JSON le faltan client_email o private_key.");
}

// En el archivo .env la clave va en una sola línea, con los saltos escapados.
const escapedKey = credentials.private_key.replace(/\n/g, "\\n");

let contents = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";

function upsert(source: string, key: string, value: string): string {
  const line = `${key}="${value}"`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(source)) return source.replace(pattern, line);
  return `${source.replace(/\n*$/, "")}\n${line}\n`;
}

const hadEmail = new RegExp(`^${EMAIL_KEY}=`, "m").test(contents);

if (!hadEmail) {
  contents = `${contents.replace(/\n*$/, "")}\n\n# Google Analytics (service account)\n`;
}
contents = upsert(contents, EMAIL_KEY, credentials.client_email);
contents = upsert(contents, KEY_KEY, escapedKey);

writeFileSync(ENV_PATH, contents, { mode: 0o600 });

console.log(`\n✓ Credenciales ${hadEmail ? "actualizadas" : "agregadas"} en .env.local`);
console.log(`\n  Service account: ${credentials.client_email}`);
console.log("\nAhora falta:");
console.log("  1. Dar acceso de Lector a ese email en tu property de GA4");
console.log("     (Analytics → Administrar → Gestión de accesos a la propiedad)");
console.log("  2. Reiniciar el server:  npm run dev");
console.log("  3. Pegar el Property ID en el dashboard de la agencia\n");
console.log("Para producción, copiá esas dos variables a Vercel.\n");
