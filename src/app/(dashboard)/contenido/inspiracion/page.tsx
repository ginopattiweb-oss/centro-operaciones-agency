import { Link2 } from "lucide-react";
import { Panel } from "@/components/paneles";
import { isIdeasGeneratorConfigured } from "@/lib/contenido-ideas";
import { getDetectedHooks, getInspirationAccounts, getMetaConnection } from "@/lib/inspiracion-queries";
import { isMetaConfigured } from "@/lib/meta-discovery";
import { formatDateTime } from "@/lib/date";
import { DisconnectMetaButton, HooksGrid, ReferencesPanel } from "../_components/InspiracionPanel";
import { APP_URL } from "@/lib/marca";

export const metadata = { title: "Inspiración · Contenido" };
/** Escanear varios referentes y adaptar con IA superan los 10 s por defecto. */
export const maxDuration = 300;

export default async function InspiracionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; conectada?: string }>;
}) {
  const [{ error, conectada }, connection, accounts, hooks] = await Promise.all([
    searchParams,
    getMetaConnection(),
    getInspirationAccounts(),
    getDetectedHooks(),
  ]);
  const metaReady = isMetaConfigured();

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p className="rounded-card border border-negative/40 bg-surface px-4 py-3 text-sm text-negative">{error}</p>
      )}
      {conectada && (
        <p className="rounded-card border border-positive/40 bg-surface px-4 py-3 text-sm text-positive">
          Facebook conectado. Ya podés agregar referentes.
        </p>
      )}

      <Panel
        title="Conexión con Facebook"
        hint="Leer cuentas ajenas usa business_discovery, que sólo existe con Facebook Login y una página vinculada a tu Instagram."
        action={
          connection ? (
            <DisconnectMetaButton />
          ) : metaReady ? (
            <a
              href="/api/facebook/connect"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-on-accent hover:brightness-110"
            >
              <Link2 className="h-3.5 w-3.5" /> Conectar con Facebook
            </a>
          ) : (
            <button
              type="button"
              disabled
              title="Faltan META_APP_ID y META_APP_SECRET"
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-on-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              Conectar con Facebook
            </button>
          )
        }
      >
        <div className="px-5 py-4 text-sm text-fg-muted">
          {connection ? (
            <p>
              Conectado como <span className="text-fg">{connection.fbUserName ?? connection.fbUserId}</span> · página{" "}
              <span className="text-fg">{connection.pageName ?? connection.pageId}</span> · Instagram{" "}
              <span className="text-fg">@{connection.igUsername ?? connection.igBusinessAccountId}</span> · token vence{" "}
              {formatDateTime(connection.accessTokenExpiresAt)}.
              {connection.lastError && <span className="text-negative"> {connection.lastError}</span>}
            </p>
          ) : metaReady ? (
            <p>
              Requisito: tu Instagram profesional vinculado a una página de Facebook (Instagram → Configuración →
              Centro de cuentas). Al conectar, elegimos la primera página con Instagram vinculado.
            </p>
          ) : (
            <ol className="list-decimal space-y-1 pl-4 text-xs">
              <li>
                En tu app de Meta (developers.facebook.com) → Agregar producto →{" "}
                <span className="text-fg">Facebook Login for Business</span>.
              </li>
              <li>
                Facebook Login → Configuración → URI de redireccionamiento de OAuth válidos:{" "}
                <code className="text-fg">{APP_URL}/api/facebook/callback</code>.
              </li>
              <li>
                Configuración de la app → Básica: copiá <span className="text-fg">Identificador de la app</span> y{" "}
                <span className="text-fg">Clave secreta</span> (los de Meta, no los de Instagram) a{" "}
                <code>META_APP_ID</code> y <code>META_APP_SECRET</code>.
              </li>
              <li>Tu Instagram profesional tiene que estar vinculado a una página de Facebook.</li>
            </ol>
          )}
        </div>
      </Panel>

      <Panel
        title="Tus referentes"
        hint="Cuentas profesionales de Instagram que mirás. Se escanean sus últimas 30 publicaciones."
      >
        {connection ? (
          <ReferencesPanel accounts={accounts} />
        ) : (
          <p className="px-5 py-6 text-sm text-fg-muted">Conectá Facebook para agregar referentes.</p>
        )}
      </Panel>

      <Panel
        title="Ganchos detectados"
        hint="Publicaciones que superan 1,3× la mediana de me gusta de su propia cuenta. Adaptar genera una idea con guion en Planificar."
      >
        <HooksGrid hooks={hooks} canAdapt={isIdeasGeneratorConfigured()} />
      </Panel>
    </div>
  );
}
