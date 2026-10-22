import Link from "next/link";
import { KeyRound, ClipboardList, FolderDown, Wallet, AlertTriangle } from "lucide-react";
import { briefingProgress } from "@/lib/briefing";
import {
  getAccessesForClient,
  getBriefingForClient,
  getDeliverablesForClient,
  requirePortalContext,
} from "@/lib/portal-queries";
import { getFinanceForClient } from "@/lib/finanzas-queries";
import { formatMoney } from "@/lib/finanzas";

export const dynamic = "force-dynamic";

export default async function PortalHomePage() {
  const { user, clientProject } = await requirePortalContext();
  const [accesses, briefing, files, finance] = await Promise.all([
    getAccessesForClient(clientProject.id),
    getBriefingForClient(clientProject.id),
    getDeliverablesForClient(clientProject.id),
    clientProject.financeVisibleToClient
      ? getFinanceForClient(clientProject.id, "cliente")
      : null,
  ]);

  const progress = briefingProgress(briefing?.data ?? {});
  const briefingSent = briefing?.status === "enviado";

  // Con más de una moneda no se puede mostrar un solo número: se cuenta lo pendiente.
  const owing = finance?.summary.totals.filter((totals) => totals.outstandingCents > 0) ?? [];
  const pendingCount = finance?.invoices.filter((invoice) => invoice.balanceCents > 0).length ?? 0;
  const financeValue =
    owing.length === 0
      ? "Al día"
      : owing.length === 1
        ? formatMoney(owing[0].outstandingCents, owing[0].currency)
        : `${pendingCount} facturas`;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h2 className="font-heading text-2xl text-fg">Hola, {user.name.split(" ")[0]}</h2>
        <p className="text-sm text-fg-muted">
          Acá tenés todo lo de tu proyecto: los accesos de tu web, el briefing y los entregables.
        </p>
      </header>

      {user.mustChangePassword && (
        <div className="flex items-start gap-3 rounded-card border border-accent/40 bg-accent/10 px-5 py-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink" />
          <div className="text-sm text-fg">
            Estás usando la contraseña inicial que te dimos.{" "}
            <Link href="/portal/cuenta" className="text-accent-ink underline">
              Cambiala ahora
            </Link>
            .
          </div>
        </div>
      )}

      {!briefingSent && (
        <div className="rounded-card border border-border bg-surface px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-heading text-base text-fg">Briefing del proyecto</p>
              <p className="text-sm text-fg-muted">
                {progress === 0
                  ? "Todavía no lo empezaste. Es el primer paso para arrancar."
                  : `Lo tenés al ${progress}%. Podés seguir cuando quieras.`}
              </p>
            </div>
            <Link
              href="/portal/briefing"
              className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:brightness-110"
            >
              {progress === 0 ? "Empezar" : "Continuar"}
            </Link>
          </div>
          <div className="co-track mt-4 w-full">
            <div className="co-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div
        className={
          finance ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-4" : "grid gap-4 sm:grid-cols-3"
        }
      >
        <SummaryCard
          href="/portal/accesos"
          icon={<KeyRound className="h-5 w-5 text-accent-ink" />}
          value={accesses.length}
          label={accesses.length === 1 ? "Acceso guardado" : "Accesos guardados"}
        />
        <SummaryCard
          href="/portal/briefing"
          icon={<ClipboardList className="h-5 w-5 text-accent-ink" />}
          value={briefingSent ? "Enviado" : `${progress}%`}
          label="Briefing"
        />
        <SummaryCard
          href="/portal/entregables"
          icon={<FolderDown className="h-5 w-5 text-accent-ink" />}
          value={files.length}
          label={files.length === 1 ? "Entregable" : "Entregables"}
        />
        {finance && (
          <SummaryCard
            href="/portal/finanzas"
            icon={<Wallet className="h-5 w-5 text-accent-ink" />}
            value={financeValue}
            label="Saldo pendiente"
          />
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  href,
  icon,
  value,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-card border border-border bg-surface px-5 py-4 hover:border-accent/50"
    >
      <div className="mb-3">{icon}</div>
      <p className="font-heading text-2xl text-fg">{value}</p>
      <p className="mt-1 text-sm text-fg-muted">{label}</p>
    </Link>
  );
}
