import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Target, Users } from "lucide-react";
import { getProjectBySlug, getTasksForProject, getCompletedThisWeek } from "@/lib/queries";
import { PORTAL_UNIDAD_SLUG } from "@/lib/portal-config";
import { parseRange } from "@/lib/analytics-format";
import { getProjectSummaries } from "@/lib/proyectos";
import { startOfWeekUtc } from "@/lib/date";
import { UnidadTaskRow } from "@/components/tareas/UnidadTaskRow";
import type { TaskWithRelations } from "@/db/relations";
import { PanelTheme } from "@/components/PanelTheme";
import { GhostLink, SectionTitle } from "./_components/ui";
import { RangeChips } from "./_components/RangeChips";
import { StatsPanel } from "./_components/StatsPanel";
import { PropertySettings } from "./_components/PropertySettings";
import { ProjectsSection } from "./_components/ProjectsSection";
import { StatsPanelSkeleton } from "./_components/Skeletons";
import type { ProjectRow } from "./_components/types";
import { AGENCY_NAME } from "@/lib/marca";

export const metadata: Metadata = {
  title: `${AGENCY_NAME} · Centro de Operaciones`,
};

const BASE_PATH = `/unidad/${PORTAL_UNIDAD_SLUG}`;

export default async function AgenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string }>;
}) {
  const range = parseRange((await searchParams).rango);
  const project = await getProjectBySlug(PORTAL_UNIDAD_SLUG);
  if (!project) notFound();

  const [items, completedThisWeek, summaries] = await Promise.all([
    getTasksForProject(project.id),
    getCompletedThisWeek(project.id, startOfWeekUtc()),
    getProjectSummaries(),
  ]);
  const pendingCount = items.filter((item) => item.task.location !== "hecha").length;

  const rows: ProjectRow[] = summaries.map((summary) => ({
    id: summary.project.id,
    name: summary.project.name,
    status: summary.project.status,
    service: summary.project.service,
    ownerName: summary.owner?.name ?? null,
    team: summary.team.map((person) => person.name),
    portalEnabled: summary.project.portalEnabled,
    openTasks: summary.openTasks,
    progress: summary.progress,
    progressDetail:
      summary.milestonesTotal > 0
        ? `${summary.milestonesDone}/${summary.milestonesTotal} hitos`
        : summary.totalTasks > 0
          ? `${summary.totalTasks - summary.openTasks}/${summary.totalTasks} tareas`
          : null,
    nextDue: summary.nextDue
      ? {
          label: summary.nextDue.label,
          date: summary.nextDue.date,
          overdue: summary.nextDue.overdue,
        }
      : null,
    briefingState: summary.briefingState,
    hasAnalytics: Boolean(summary.project.gaPropertyId),
  }));

  // Filtros y datalists: sólo valores que el usuario ya cargó, nunca una taxonomía inventada.
  const services = [...new Set(rows.map((row) => row.service).filter(Boolean))].sort() as string[];
  const peopleNames = [
    ...new Set(summaries.flatMap((summary) => summary.team.map((person) => person.name))),
  ].sort();

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
    <PanelTheme>
      <div className="mx-auto flex max-w-[1240px] flex-col gap-12 p-6 md:p-10">
        <header className="flex flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <h1 className="sp-display text-4xl leading-none md:text-5xl">{project.name}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <RangeChips basePath={BASE_PATH} active={range} />
              <GhostLink href={`${BASE_PATH}/leads`}>
                <Target className="h-4 w-4" />
                Leads
              </GhostLink>
              <GhostLink href={`${BASE_PATH}/clientes`}>
                <Users className="h-4 w-4" />
                Portal de clientes
              </GhostLink>
            </div>
          </div>
          <PropertySettings
            gaPropertyId={project.gaPropertyId}
            serviceAccountEmail={process.env.GA_SERVICE_ACCOUNT_EMAIL ?? null}
          />
        </header>

        {project.gaPropertyId && (
          <Suspense key={range} fallback={<StatsPanelSkeleton />}>
            <StatsPanel propertyId={project.gaPropertyId} range={range} />
          </Suspense>
        )}

        <ProjectsSection
          projects={rows}
          clients={summaries.map((summary) => ({
            id: summary.project.id,
            name: summary.project.name,
          }))}
          people={peopleNames}
          services={services}
        />

        <section className="flex flex-col gap-5">
          <SectionTitle>Operación de la unidad</SectionTitle>
          <div className="grid grid-cols-1 gap-px bg-[var(--sp-line)] sm:grid-cols-2">
            <CountTile label="Pendientes" value={pendingCount} />
            <CountTile label="Completadas esta semana" value={completedThisWeek.length} />
          </div>

          {orderedGroups.map(([name, groupItems]) => (
            <div key={name} className="flex flex-col gap-2">
              <p className="sp-display text-xs text-[var(--sp-muted)]">{name}</p>
              <div className="sp-card flex flex-col divide-y divide-[var(--sp-line)]">
                {groupItems.map((item) => (
                  <UnidadTaskRow key={item.task.id} item={item} />
                ))}
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-sm text-[var(--sp-muted)]">
              Todavía no hay tareas en esta unidad.
            </p>
          )}
        </section>
      </div>
    </PanelTheme>
  );
}

function CountTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-3 bg-[var(--sp-surface)] p-5 md:p-6">
      <p className="sp-display text-[11px] text-[var(--sp-muted)]">{label}</p>
      <p className="sp-display text-[2.25rem] leading-none tabular-nums text-[var(--sp-ink)]">
        {value}
      </p>
    </div>
  );
}
