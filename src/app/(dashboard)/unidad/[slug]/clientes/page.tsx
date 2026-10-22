import Link from "next/link";
import { notFound } from "next/navigation";
import { Users, ExternalLink, ArrowLeft } from "lucide-react";
import {
  countPortalUsersByClient,
  getPortalClientProjects,
  PORTAL_UNIDAD_SLUG,
} from "@/lib/portal-queries";
import { getProjectBySlug } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ClientesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // El portal de clientes es exclusivo de la unidad de agencia.
  if (slug !== PORTAL_UNIDAD_SLUG) notFound();

  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const [rows, userCounts] = await Promise.all([
    getPortalClientProjects(),
    countPortalUsersByClient(),
  ]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-6 md:p-10">
      <header className="flex flex-col gap-4">
        <Link
          href={`/unidad/${slug}`}
          className="flex w-fit items-center gap-2 text-sm text-fg-muted hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" /> {project.name}
        </Link>
        <h1 className="font-heading text-3xl text-fg">Portal de clientes</h1>
        <p className="text-sm text-fg-muted">
          Habilitá el portal por cliente, creá sus usuarios y cargá accesos y entregables.
        </p>
        <Link
          href="/portal/login"
          target="_blank"
          className="flex w-fit items-center gap-2 text-sm text-accent-ink hover:underline"
        >
          Ver el portal como cliente <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-fg-muted">
          Todavía no hay proyectos de cliente en {project.name}.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          {rows.map(({ clientProject }) => (
            <Link
              key={clientProject.id}
              href={`/unidad/${slug}/clientes/${clientProject.id}`}
              className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-bg/60"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{clientProject.name}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-fg-muted">
                  <Users className="h-3.5 w-3.5" />
                  {userCounts.get(clientProject.id) ?? 0} usuario(s)
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                  clientProject.portalEnabled
                    ? "bg-accent/15 text-accent-ink"
                    : "bg-bg text-fg-muted"
                }`}
              >
                {clientProject.portalEnabled ? "Portal activo" : "Portal apagado"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
