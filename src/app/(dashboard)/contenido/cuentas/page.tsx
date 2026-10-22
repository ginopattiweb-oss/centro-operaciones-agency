import { Camera, Music2 } from "lucide-react";
import { getContenidoAccounts } from "@/lib/contenido-queries";
import { getInstagramAccounts } from "@/lib/instagram-queries";
import { isInstagramConfigured } from "@/lib/instagram";
import { isTiktokConfigured } from "@/lib/tiktok";
import { getUnidades } from "@/lib/queries";
import type { Project } from "@/db/schema";
import { EmptyState } from "../_components/EmptyState";
import { InstagramAccountCard } from "../_components/InstagramAccountCard";
import { TiktokAccountCard } from "../_components/TiktokAccountCard";

export const metadata = { title: "Cuentas · Contenido" };

export default async function CuentasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; conectada?: string }>;
}) {
  const [{ error, conectada }, unidades, instagram, tiktok] = await Promise.all([
    searchParams,
    getUnidades(),
    getInstagramAccounts(),
    getContenidoAccounts(),
  ]);
  const instagramReady = isInstagramConfigured();
  const tiktokReady = isTiktokConfigured();

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p className="rounded-card border border-negative/40 bg-surface px-4 py-3 text-sm text-negative">
          {error}
        </p>
      )}
      {conectada && (
        <p className="rounded-card border border-positive/40 bg-surface px-4 py-3 text-sm text-positive">
          Cuenta de {conectada === "tiktok" ? "TikTok" : "Instagram"} conectada. El historial empieza a
          contar desde hoy.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-heading text-base text-fg">
              <Camera className="h-4 w-4 text-fg-muted" /> Instagram
            </h2>
            <p className="text-xs text-fg-muted">
              Cuentas profesionales (Empresa o Creador). Las personales no pueden conectarse.
            </p>
          </div>

          <ConnectForm
            action="/api/instagram/connect"
            label="Conectar Instagram"
            ready={instagramReady}
            missing="Faltan INSTAGRAM_APP_ID e INSTAGRAM_APP_SECRET en el entorno"
            unidades={unidades}
          />
        </div>

        {!instagramReady && (
          <div className="rounded-card border border-dashed border-border bg-surface/50 px-5 py-4 text-xs text-fg-muted">
            <p className="text-sm text-fg">Falta configurar la app de Meta.</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>
                En{" "}
                <a
                  href="https://developers.facebook.com/apps/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  developers.facebook.com
                </a>{" "}
                creá una app de tipo <span className="text-fg">Business</span> y agregale el
                producto <span className="text-fg">Instagram</span> → &quot;API setup with Instagram
                login&quot;.
              </li>
              <li>
                En ese producto cargá como redirect URI:{" "}
                <code className="text-fg">https://&lt;tu-dominio&gt;/api/instagram/callback</code>{" "}
                (Meta exige HTTPS; en local hace falta un túnel).
              </li>
              <li>
                Copiá el <span className="text-fg">Instagram App ID</span> y{" "}
                <span className="text-fg">App Secret</span> a <code>INSTAGRAM_APP_ID</code> e{" "}
                <code>INSTAGRAM_APP_SECRET</code>. Opcional: <code>INSTAGRAM_REDIRECT_URI</code>{" "}
                si el dominio público no coincide con el de la request.
              </li>
              <li>
                Mientras la app esté en modo desarrollo, agregá tu cuenta de Instagram como
                &quot;Instagram Tester&quot; y aceptá la invitación desde Instagram.
              </li>
            </ol>
          </div>
        )}

        {instagram.length === 0 ? (
          instagramReady && (
            <EmptyState title="Todavía no hay cuentas de Instagram">
              Elegí la unidad dueña y tocá &quot;Conectar Instagram&quot;: te lleva a autorizar y
              vuelve acá.
            </EmptyState>
          )
        ) : (
          <ul className="flex flex-col gap-3">
            {instagram.map((account) => (
              <InstagramAccountCard key={account.id} account={account} />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-heading text-base text-fg">
              <Music2 className="h-4 w-4 text-fg-muted" /> TikTok
            </h2>
            <p className="text-xs text-fg-muted">
              Perfil, videos y contadores. El historial se arma con un snapshot por día.
            </p>
          </div>
          <ConnectForm
            action="/api/tiktok/connect"
            label="Conectar TikTok"
            ready={tiktokReady}
            missing="Faltan TIKTOK_CLIENT_KEY y TIKTOK_CLIENT_SECRET en el entorno"
            unidades={unidades}
          />
        </div>

        {!tiktokReady && (
          <div className="rounded-card border border-dashed border-border bg-surface/50 px-5 py-4 text-xs text-fg-muted">
            <p className="text-sm text-fg">Falta configurar la app de TikTok for Developers.</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>
                En{" "}
                <a
                  href="https://developers.tiktok.com/apps/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  developers.tiktok.com
                </a>{" "}
                creá una app y agregale los productos <span className="text-fg">Login Kit</span> y{" "}
                <span className="text-fg">Display API</span>, con scopes <code>user.info.basic</code>,{" "}
                <code>user.info.profile</code>, <code>user.info.stats</code> y <code>video.list</code>.
              </li>
              <li>
                En Login Kit → plataforma Web, cargá como redirect URI:{" "}
                <code className="text-fg">https://&lt;tu-dominio&gt;/api/tiktok/callback</code>.
              </li>
              <li>
                Copiá <span className="text-fg">Client key</span> y <span className="text-fg">Client secret</span>{" "}
                a <code>TIKTOK_CLIENT_KEY</code> y <code>TIKTOK_CLIENT_SECRET</code>. Opcional:{" "}
                <code>TIKTOK_REDIRECT_URI</code>.
              </li>
              <li>
                Hasta que TikTok apruebe la app sólo se conectan cuentas cargadas como{" "}
                <span className="text-fg">target users</span> en modo Sandbox.
              </li>
            </ol>
          </div>
        )}

        {tiktok.length === 0 ? (
          tiktokReady && (
            <EmptyState title="Todavía no hay cuentas de TikTok">
              Elegí la unidad dueña y tocá &quot;Conectar TikTok&quot;.
            </EmptyState>
          )
        ) : (
          <ul className="flex flex-col gap-3">
            {tiktok.map((account) => (
              <TiktokAccountCard key={account.id} account={account} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ConnectForm({
  action,
  label,
  ready,
  missing,
  unidades,
}: {
  action: string;
  label: string;
  ready: boolean;
  missing: string;
  unidades: Project[];
}) {
  if (!ready) {
    return (
      <button
        type="button"
        disabled
        title={missing}
        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-on-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {label}
      </button>
    );
  }
  return (
    <form action={action} method="get" className="flex items-center gap-2">
      <select
        name="project"
        required
        defaultValue=""
        className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-fg focus:border-accent focus:outline-none"
      >
        <option value="" disabled>
          Unidad dueña…
        </option>
        {unidades.map((unidad) => (
          <option key={unidad.id} value={unidad.id}>
            {unidad.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-on-accent hover:brightness-110"
      >
        {label}
      </button>
    </form>
  );
}
