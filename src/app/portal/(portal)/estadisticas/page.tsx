import { Suspense } from "react";
import { notFound } from "next/navigation";
import { BarChart3 } from "lucide-react";
import {
  StatsSummaryCards,
  StatsError,
  RangeTabs,
} from "@/components/analytics/StatsSummaryCards";
import { UnidadStatsSkeleton } from "@/components/analytics/UnidadStatsSection";
import { TrendChart } from "@/components/analytics/TrendChart";
import {
  getStatsSummary,
  isAnalyticsConfigured,
  parseRange,
  type StatsRange,
} from "@/lib/analytics";
import { requirePortalContext } from "@/lib/portal-queries";

export const dynamic = "force-dynamic";

async function Stats({ propertyId, range }: { propertyId: string; range: StatsRange }) {
  const stats = await getStatsSummary(propertyId, range);
  if (!stats.ok) return <StatsError message={stats.error} />;
  return (
    <div className="flex flex-col gap-5">
      <StatsSummaryCards
        current={stats.current}
        previous={stats.previous}
        series={stats.series}
      />
      <div className="rounded-card border border-border bg-surface p-4 md:p-5">
        <TrendChart series={stats.series} />
      </div>
      <p className="text-xs text-fg-muted">
        Del {stats.from} al {stats.to}, comparado con el período anterior.
      </p>
    </div>
  );
}

export default async function PortalEstadisticasPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string }>;
}) {
  const { clientProject } = await requirePortalContext();
  // La pestaña sólo existe si vos la habilitaste para este cliente.
  if (!clientProject.statsVisibleToClient || !clientProject.gaPropertyId) notFound();

  const range = parseRange((await searchParams).rango);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="font-heading text-2xl text-fg">Estadísticas de tu web</h2>
          <p className="text-sm text-fg-muted">Datos de Google Analytics.</p>
        </div>
        <RangeTabs basePath="/portal/estadisticas" active={range} />
      </header>

      {isAnalyticsConfigured() ? (
        <Suspense key={range} fallback={<UnidadStatsSkeleton />}>
          <Stats propertyId={clientProject.gaPropertyId} range={range} />
        </Suspense>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface px-6 py-12 text-center">
          <BarChart3 className="h-6 w-6 text-fg-muted" />
          <p className="text-sm text-fg-muted">
            Las estadísticas no están disponibles en este momento.
          </p>
        </div>
      )}
    </div>
  );
}
