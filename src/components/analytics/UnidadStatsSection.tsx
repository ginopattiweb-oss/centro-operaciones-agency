import Link from "next/link";
import { BarChart3 } from "lucide-react";
import {
  getStatsSummary,
  isAnalyticsConfigured,
  type StatsRange,
} from "@/lib/analytics";
import { getPortalClientProjects } from "@/lib/portal-queries";
import { StatsSummaryCards, StatsError } from "./StatsSummaryCards";

/**
 * Estadísticas de todas las webs de clientes de la unidad.
 * Es lento (una llamada a GA por cliente): envolver en <Suspense>.
 */
export async function UnidadStatsSection({
  slug,
  range,
}: {
  slug: string;
  range: StatsRange;
}) {
  const rows = await getPortalClientProjects();
  const withProperty = rows.filter(({ clientProject }) => clientProject.gaPropertyId);

  // La falta de credenciales ya la avisa la sección "Mi web": no repetirlo acá.
  if (!isAnalyticsConfigured()) return null;

  if (withProperty.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface px-6 py-10 text-center">
        <BarChart3 className="h-6 w-6 text-fg-muted" />
        <p className="text-sm text-fg-muted">
          Ningún cliente tiene su GA4 Property ID cargado todavía.
        </p>
        <Link
          href={`/unidad/${slug}/clientes`}
          className="text-sm text-accent-ink hover:underline"
        >
          Cargarlo desde el portal de clientes
        </Link>
      </div>
    );
  }

  const results = await Promise.all(
    withProperty.map(async ({ clientProject }) => ({
      clientProject,
      stats: await getStatsSummary(clientProject.gaPropertyId!, range),
    }))
  );

  return (
    <div className="flex flex-col gap-6">
      {results.map(({ clientProject, stats }) => (
        <div key={clientProject.id} className="flex flex-col gap-3">
          <Link
            href={`/unidad/${slug}/clientes/${clientProject.id}`}
            className="w-fit text-sm font-medium text-fg hover:text-accent-ink"
          >
            {clientProject.name}
          </Link>
          {stats.ok ? (
            <StatsSummaryCards current={stats.current} previous={stats.previous} compact />
          ) : (
            <StatsError message={stats.error} />
          )}
        </div>
      ))}
    </div>
  );
}

export function UnidadStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="h-24 animate-pulse rounded-card border border-border bg-surface"
        />
      ))}
    </div>
  );
}
