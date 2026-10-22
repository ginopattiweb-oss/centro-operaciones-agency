import { Suspense } from "react";
import {
  getUnidades,
  getPendingTasksForProject,
  getAllTasksWithRelations,
} from "@/lib/queries";
import { formatFriendlyDate, greeting, todayStringBA } from "@/lib/date";
import { countOverdueLeadsByProject, getPendingFollowUps } from "@/lib/leads-queries";
import { SeguimientosHoy } from "@/components/leads/SeguimientosHoy";
import { UnidadCard } from "@/components/UnidadCard";
import { TodayTaskRow } from "@/components/TodayTaskRow";
import { CapturaRapida } from "@/components/tareas/CapturaRapida";
import { AgendaHoy, AgendaHoySkeleton } from "@/components/AgendaHoy";
import { OWNER_NAME } from "@/lib/marca";

export default async function DashboardPage() {
  const [unidades, allItems, followUps, overdueLeads] = await Promise.all([
    getUnidades(),
    getAllTasksWithRelations(),
    getPendingFollowUps(),
    countOverdueLeadsByProject(),
  ]);
  const today = todayStringBA();

  const unidadesConTareas = await Promise.all(
    unidades.map(async (project) => ({
      project,
      pending: await getPendingTasksForProject(project.id),
    }))
  );

  // "Hoy" son las tareas que el usuario movió a hoy, no las que vencen hoy.
  const hoy = allItems.filter((i) => i.task.location === "hoy");

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto flex flex-col gap-10">
      <header>
        <p className="text-sm text-fg-muted capitalize">{formatFriendlyDate(new Date())}</p>
        <h1 className="font-heading text-3xl text-fg mt-1">
          {greeting()}
          {OWNER_NAME && `, ${OWNER_NAME}`}
        </h1>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {unidadesConTareas.map(({ project, pending }) => (
          <UnidadCard
            key={project.id}
            project={project}
            pending={pending}
            overdueLeads={overdueLeads.get(project.id) ?? 0}
          />
        ))}
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="font-heading text-xl text-fg">Hoy</h2>

        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-fg-muted">
            Agenda
          </h3>
          <Suspense fallback={<AgendaHoySkeleton />}>
            <AgendaHoy />
          </Suspense>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-fg-muted">
            Seguimientos
          </h3>
          <SeguimientosHoy leads={followUps} today={today} />
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-fg-muted">
            Tareas
          </h3>
          {hoy.length === 0 ? (
            <div className="rounded-card border border-border bg-surface p-6">
              <p className="text-sm text-fg-muted">
                Nada en hoy. Movés algo desde la bandeja cuando quieras.
              </p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface overflow-hidden">
              {hoy.map((item) => (
                <TodayTaskRow key={item.task.id} item={item} />
              ))}
            </div>
          )}

          <CapturaRapida />
        </div>
      </section>
    </div>
  );
}
