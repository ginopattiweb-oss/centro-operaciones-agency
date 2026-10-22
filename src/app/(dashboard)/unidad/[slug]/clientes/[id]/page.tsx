import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, LayoutDashboard } from "lucide-react";
import { PortalToggle } from "@/components/clientes/PortalToggle";
import { PortalUsersPanel } from "@/components/clientes/PortalUsersPanel";
import { formatDateTime } from "@/lib/date";
import {
  getPortalClientProject,
  getPortalUsersForClient,
  PORTAL_UNIDAD_SLUG,
} from "@/lib/portal-queries";

export const dynamic = "force-dynamic";

/**
 * Administración del portal de un cliente: encendido/apagado y usuarios.
 * El resto del proyecto (briefing, documentos, accesos, analítica, tareas) vive
 * en /unidad/agencia/proyecto/[id]: es la misma entidad, no se duplica.
 */
export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  if (slug !== PORTAL_UNIDAD_SLUG) notFound();

  const row = await getPortalClientProject(id);
  if (!row) notFound();

  const { clientProject } = row;
  const users = await getPortalUsersForClient(clientProject.id);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10 p-6 md:p-10">
      <header className="flex flex-col gap-4">
        <Link
          href={`/unidad/${slug}/clientes`}
          className="flex w-fit items-center gap-2 text-sm text-fg-muted hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" /> Portal de clientes
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-heading text-3xl text-fg">{clientProject.name}</h1>
          <PortalToggle
            clientProjectId={clientProject.id}
            enabled={clientProject.portalEnabled}
          />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href={`/unidad/${slug}/proyecto/${clientProject.id}`}
            className="flex items-center gap-2 text-sm text-accent-ink hover:underline"
          >
            <LayoutDashboard className="h-4 w-4" />
            Ver el proyecto
          </Link>
          <Link
            href="/portal/login"
            target="_blank"
            className="flex items-center gap-2 text-sm text-accent-ink hover:underline"
          >
            Ver el portal como cliente <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      <PortalUsersPanel
        clientProjectId={clientProject.id}
        users={users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          isActive: user.isActive,
          mustChangePassword: user.mustChangePassword,
          lastLogin: user.lastLoginAt ? formatDateTime(user.lastLoginAt) : null,
        }))}
      />
    </div>
  );
}
