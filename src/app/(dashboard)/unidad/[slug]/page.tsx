import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { getProjectBySlug, getTasksForProject, getCompletedThisWeek } from "@/lib/queries";
import { PORTAL_UNIDAD_SLUG } from "@/lib/portal-config";
import {
  getStatsSummary,
  isAnalyticsConfigured,
  parseRange,
  type StatsRange,
} from "@/lib/analytics";
import { startOfWeekUtc } from "@/lib/date";
import { UnidadTaskRow } from "@/components/tareas/UnidadTaskRow";
import {
  RangeTabs,
  StatsSummaryCards,
  StatsError,
} from "@/components/analytics/StatsSummaryCards";
import {
  UnidadStatsSection,
  UnidadStatsSkeleton,
} from "@/components/analytics/UnidadStatsSection";
import { TrendChart } from "@/components/analytics/TrendChart";
import { UnidadAnalyticsSettings } from "@/components/analytics/UnidadAnalyticsSettings";
import type { TaskWithRelations } from "@/db/relations";

async function MiWebStats({
  propertyId,
  range,
}: {
  propertyId: string;
  range: StatsRange;
}) {
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

export default async function UnidadPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ rango?: string }>;
}) {
  const { slug } = await params;
  const range = parseRange((await searchParams).rango);
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const items = await getTasksForProject(project.id);
  const completedThisWeek = await getCompletedThisWeek(project.id, startOfWeekUtc());
  const pendingCount = items.filter((i) => i.task.location !== "hecha").length;

  const groups = new Map<string, TaskWithRelations[]>();
  for (const item of items) {
    const key = item.clientProject?.name ?? "Sin proyecto de cliente";
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  const orderedGroups = [...groups.entries()].sort(([a], [b]) => {
    if (a === "Sin proyecto de cliente") return 1;
    if (b === "Sin proyecto de cliente") return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto flex flex-col gap-10">
      <header className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-heading text-3xl text-fg">{project.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {slug === PORTAL_UNIDAD_SLUG && (
              <Link
                href={`/unidad/${slug}/clientes`}
                className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-fg-muted hover:border-accent/50 hover:text-fg"
              >
                <Users className="h-4 w-4" />
                Portal de clientes
              </Link>
            )}
          </div>
        </div>
        <div className="flex gap-4">
          <div className="rounded-card border border-border bg-surface px-6 py-4">
            <p className="text-3xl font-heading text-accent-ink">{pendingCount}</p>
            <p className="text-sm text-fg-muted mt-1">Pendientes</p>
          </div>
          <div className="rounded-card border border-border bg-surface px-6 py-4">
            <p className="text-3xl font-heading text-accent-ink">{completedThisWeek.length}</p>
            <p className="text-sm text-fg-muted mt-1">Completadas esta semana</p>
          </div>
        </div>
      </header>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg text-fg">Mi web</h2>
          {project.gaPropertyId && (
            <RangeTabs basePath={`/unidad/${slug}`} active={range} />
          )}
        </div>

        {!isAnalyticsConfigured() ? (
          <p className="text-sm text-fg-muted">
            Falta configurar las credenciales de Google Analytics en el entorno
            (<code>GA_SERVICE_ACCOUNT_EMAIL</code> y{" "}
            <code>GA_SERVICE_ACCOUNT_PRIVATE_KEY</code>).
          </p>
        ) : (
          project.gaPropertyId && (
            <Suspense key={range} fallback={<UnidadStatsSkeleton />}>
              <MiWebStats propertyId={project.gaPropertyId} range={range} />
            </Suspense>
          )
        )}

        <UnidadAnalyticsSettings
          slug={slug}
          gaPropertyId={project.gaPropertyId}
          serviceAccountEmail={process.env.GA_SERVICE_ACCOUNT_EMAIL ?? null}
          defaultOpen={!project.gaPropertyId}
        />
      </section>

      {slug === PORTAL_UNIDAD_SLUG && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-lg text-fg">Webs de clientes</h2>
            {!project.gaPropertyId && (
              <RangeTabs basePath={`/unidad/${slug}`} active={range} />
            )}
          </div>
          <Suspense key={range} fallback={<UnidadStatsSkeleton />}>
            <UnidadStatsSection slug={slug} range={range} />
          </Suspense>
        </section>
      )}

      <div className="flex flex-col gap-8">
        {orderedGroups.map(([name, groupItems]) => (
          <section key={name}>
            <h2 className="font-heading text-lg text-fg mb-3">{name}</h2>
            <div className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface overflow-hidden">
              {groupItems.map((item) => (
                <UnidadTaskRow key={item.task.id} item={item} />
              ))}
            </div>
          </section>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-fg-muted">Todavía no hay tareas en esta unidad.</p>
        )}
      </div>
    </div>
  );
}
