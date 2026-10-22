import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BarChart3, ExternalLink, Users } from "lucide-react";
import { getProjectDetail } from "@/lib/proyectos";
import { getProjectBySlug, getAllPeople, getTasksForClientProject } from "@/lib/queries";
import {
  getAccessesForClient,
  getBriefingForClient,
  getDeliverablesForClient,
  getPortalClientProjects,
} from "@/lib/portal-queries";
import { PORTAL_UNIDAD_SLUG } from "@/lib/portal-config";
import { parseRange } from "@/lib/analytics-format";
import { ACCESS_TYPE_LABELS } from "@/lib/access-types";
import { tryDecryptSecret } from "@/lib/crypto";
import { formatDateTime, formatShortDateStr } from "@/lib/date";
import { missingRequiredFields } from "@/lib/briefing";
import {
  BRIEFING_STATE_LABELS,
  PROJECT_STATUS_LABELS,
  statusColor,
} from "@/lib/proyecto-estados";
import { PortalToggle } from "@/components/clientes/PortalToggle";
import { AnalyticsSettings } from "@/components/clientes/AnalyticsSettings";
import { AccessesPanel } from "@/components/clientes/AccessesPanel";
import { DeliverablesPanel } from "@/components/clientes/DeliverablesPanel";
import { BriefingReadOnly } from "@/components/clientes/BriefingReadOnly";
import { UnidadTaskRow } from "@/components/tareas/UnidadTaskRow";
import { PanelTheme } from "@/components/PanelTheme";
import {
  AvatarStack,
  EmptyState,
  GhostLink,
  ProgressBar,
  SectionTitle,
  StatusChip,
} from "../../_components/ui";
import { RangeChips } from "../../_components/RangeChips";
import { StatsPanel } from "../../_components/StatsPanel";
import { StatsPanelSkeleton } from "../../_components/Skeletons";
import { Tabs, parseTab } from "../../_components/proyecto/Tabs";
import { ProjectMetaForm } from "../../_components/proyecto/ProjectMetaForm";
import { MilestonesPanel } from "../../_components/proyecto/MilestonesPanel";
import { AddProjectTask } from "../../_components/proyecto/AddProjectTask";
import { LeadsPanel } from "../../_components/proyecto/LeadsPanel";
import { getLeadsForClientProject } from "@/lib/leads-queries";
import { getFinanceForClient } from "@/lib/finanzas-queries";
import { FinanceSummaryCards } from "../../_components/proyecto/finanzas/FinanceSummaryCards";
import { AgreementsPanel } from "../../_components/proyecto/finanzas/AgreementsPanel";
import { InvoicesPanel } from "../../_components/proyecto/finanzas/InvoicesPanel";
import { PaymentsPanel } from "../../_components/proyecto/finanzas/PaymentsPanel";
import { OutstandingPanel } from "../../_components/proyecto/finanzas/OutstandingPanel";
import { FinanceVisibility } from "../../_components/proyecto/finanzas/FinanceVisibility";
import { AGENCY_NAME } from "@/lib/marca";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const detail = await getProjectDetail((await params).id);
  return { title: detail ? `${detail.project.name} · ${AGENCY_NAME}` : "Proyecto" };
}

export default async function ProyectoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; rango?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const tab = parseTab(query.tab);
  const range = parseRange(query.rango);

  const detail = await getProjectDetail(id);
  if (!detail) notFound();

  const { project } = detail;
  const basePath = `/unidad/${PORTAL_UNIDAD_SLUG}/proyecto/${project.id}`;

  return (
    <PanelTheme>
      <div className="mx-auto flex max-w-[1240px] flex-col gap-8 p-6 md:p-10">
        <header className="flex flex-col gap-5">
          <Link
            href={`/unidad/${PORTAL_UNIDAD_SLUG}`}
            className="flex w-fit items-center gap-2 text-xs text-[var(--sp-muted)] hover:text-[var(--sp-amber)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {AGENCY_NAME}
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-3">
              <h1 className="sp-display text-3xl leading-none md:text-4xl">{project.name}</h1>
              <div className="flex flex-wrap items-center gap-3">
                <StatusChip
                  label={PROJECT_STATUS_LABELS[project.status]}
                  color={statusColor(project.status)}
                />
                <span className="text-xs text-[var(--sp-muted)]">
                  {project.service ?? "Sin servicio cargado"}
                </span>
                <AvatarStack names={detail.team.map((person) => person.name)} size={24} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <PortalToggle clientProjectId={project.id} enabled={project.portalEnabled} />
              <GhostLink href={`/unidad/${PORTAL_UNIDAD_SLUG}/clientes/${project.id}`}>
                <Users className="h-4 w-4" />
                Usuarios del portal
              </GhostLink>
              <a
                href="/portal/login"
                target="_blank"
                rel="noreferrer"
                className="sp-pill inline-flex min-h-11 items-center gap-2 border border-[var(--sp-line-strong)] px-4 py-2 text-sm font-medium hover:border-[var(--sp-gold)] hover:text-[var(--sp-amber)]"
              >
                Ver portal como cliente
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-px bg-[var(--sp-line)] sm:grid-cols-3">
            <Tile label="Progreso">
              <ProgressBar
                value={detail.progress}
                detail={
                  detail.milestonesTotal > 0
                    ? `${detail.milestonesDone}/${detail.milestonesTotal} hitos`
                    : detail.totalTasks > 0
                      ? `${detail.totalTasks - detail.openTasks}/${detail.totalTasks} tareas`
                      : undefined
                }
              />
            </Tile>
            <Tile label="Próxima entrega">
              {detail.nextDue ? (
                <p
                  className="text-sm"
                  style={{ color: detail.nextDue.overdue ? "var(--sp-crit)" : undefined }}
                >
                  {formatShortDateStr(detail.nextDue.date)} · {detail.nextDue.label}
                </p>
              ) : (
                <p className="text-sm text-[var(--sp-muted)]">Sin fechas cargadas</p>
              )}
            </Tile>
            <Tile label="Tareas abiertas">
              <p className="sp-display text-2xl tabular-nums">{detail.openTasks}</p>
            </Tile>
          </div>
        </header>

        <Tabs basePath={basePath} active={tab} keep={{ rango: range }} />

        {tab === "resumen" && <ResumenTab id={id} />}
        {tab === "briefing" && <BriefingTab id={id} />}
        {tab === "documentos" && <DocumentosTab id={id} />}
        {tab === "accesos" && <AccesosTab id={id} />}
        {tab === "finanzas" && (
          <FinanzasTab
            id={id}
            financeVisibleToClient={project.financeVisibleToClient}
            clientCanUploadPayments={project.clientCanUploadPayments}
          />
        )}
        {tab === "analitica" && (
          <AnaliticaTab
            id={id}
            gaPropertyId={project.gaPropertyId}
            statsVisibleToClient={project.statsVisibleToClient}
            range={range}
            basePath={basePath}
          />
        )}
        {tab === "tareas" && <TareasTab id={id} />}
      </div>
    </PanelTheme>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 bg-[var(--sp-surface)] p-5">
      <p className="sp-display text-[11px] text-[var(--sp-muted)]">{label}</p>
      {children}
    </div>
  );
}

// --- Pestañas ---

async function ResumenTab({ id }: { id: string }) {
  const [detail, allPeople, projects, leads] = await Promise.all([
    getProjectDetail(id),
    getAllPeople(),
    getPortalClientProjects(),
    getLeadsForClientProject(id),
  ]);
  if (!detail) notFound();

  const services = [
    ...new Set(projects.map(({ clientProject }) => clientProject.service).filter(Boolean)),
  ].sort() as string[];

  return (
    <div className="flex flex-col gap-8">
      <ProjectMetaForm
        clientProjectId={detail.project.id}
        name={detail.project.name}
        status={detail.project.status}
        service={detail.project.service}
        owner={detail.owner?.name ?? null}
        notes={detail.project.notes}
        people={allPeople.map((person) => person.name)}
        services={services}
      />

      <MilestonesPanel
        clientProjectId={detail.project.id}
        milestones={detail.milestones.map((milestone) => ({
          id: milestone.id,
          title: milestone.title,
          dueDate: milestone.dueDate,
          done: milestone.done,
        }))}
      />

      <LeadsPanel clientProjectId={id} leads={leads} />

    </div>
  );
}

async function BriefingTab({ id }: { id: string }) {
  const [detail, briefing] = await Promise.all([
    getProjectDetail(id),
    getBriefingForClient(id),
  ]);
  if (!detail) notFound();

  const missing = missingRequiredFields(briefing?.data ?? {});

  return (
    <div className="flex flex-col gap-5">
      <div className="sp-card flex flex-col gap-2 px-5 py-4">
        <p className="sp-display text-sm">
          {BRIEFING_STATE_LABELS[detail.briefingState]}
        </p>
        <p className="text-xs text-[var(--sp-muted)]">
          Lo completa el cliente desde su portal; acá se lee. Es la misma entidad: lo que carga
          allá aparece acá.
        </p>
        {detail.briefingState === "incompleto" && (
          <p className="text-xs text-[var(--sp-warn)]">
            Faltan {missing.length} campo(s) obligatorio(s): {missing.map((f) => f.label).join(", ")}
          </p>
        )}
      </div>

      <BriefingReadOnly
        data={briefing?.data ?? {}}
        status={briefing?.status ?? null}
        submittedAt={briefing?.submittedAt ? formatDateTime(briefing.submittedAt) : null}
        updatedAt={briefing ? formatDateTime(briefing.updatedAt) : null}
      />
    </div>
  );
}

async function DocumentosTab({ id }: { id: string }) {
  const files = await getDeliverablesForClient(id);
  return (
    <DeliverablesPanel
      clientProjectId={id}
      items={files.map((file) => ({
        id: file.id,
        title: file.title,
        description: file.description,
        url: file.url,
        kind: file.kind,
        createdAt: formatDateTime(file.createdAt),
      }))}
    />
  );
}

async function AccesosTab({ id }: { id: string }) {
  const accesses = await getAccessesForClient(id);
  return (
    <AccessesPanel
      clientProjectId={id}
      accesses={accesses.map((access) => ({
        id: access.id,
        label: access.label,
        type: access.type,
        typeLabel: ACCESS_TYPE_LABELS[access.type] ?? "Otro",
        url: access.url,
        username: access.username,
        secret: tryDecryptSecret(access.secretCipher),
        notes: access.notes,
      }))}
    />
  );
}

/**
 * Finanzas del proyecto: registro y seguimiento (documentos + montos cargados a
 * mano). Sin pasarelas ni transacciones. Lo que se carga acá es lo mismo que ve
 * el cliente en su portal, salvo lo marcado "solo interno".
 */
async function FinanzasTab({
  id,
  financeVisibleToClient,
  clientCanUploadPayments,
}: {
  id: string;
  financeVisibleToClient: boolean;
  clientCanUploadPayments: boolean;
}) {
  const { agreements, invoices, summary } = await getFinanceForClient(id, "interno");

  return (
    <div className="flex flex-col gap-8">
      <FinanceSummaryCards summary={summary} />
      <AgreementsPanel clientProjectId={id} agreements={agreements} />
      <InvoicesPanel clientProjectId={id} invoices={invoices} agreements={agreements} />
      <PaymentsPanel invoices={invoices} />
      <OutstandingPanel invoices={invoices} summary={summary} />
      <FinanceVisibility
        clientProjectId={id}
        financeVisibleToClient={financeVisibleToClient}
        clientCanUploadPayments={clientCanUploadPayments}
      />
    </div>
  );
}

function AnaliticaTab({
  id,
  gaPropertyId,
  statsVisibleToClient,
  range,
  basePath,
}: {
  id: string;
  gaPropertyId: string | null;
  statsVisibleToClient: boolean;
  range: ReturnType<typeof parseRange>;
  basePath: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      {gaPropertyId ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle>Google Analytics 4 del cliente</SectionTitle>
            <RangeChips basePath={basePath} active={range} keep={{ tab: "analitica" }} />
          </div>
          <Suspense key={range} fallback={<StatsPanelSkeleton />}>
            <StatsPanel propertyId={gaPropertyId} range={range} />
          </Suspense>
        </>
      ) : (
        <EmptyState
          icon={<BarChart3 className="h-6 w-6" />}
          title="Sin analítica conectada"
          detail="Este cliente todavía no tiene su GA4 Property ID vinculado. Cargalo abajo para ver sus métricas reales."
        />
      )}

      <AnalyticsSettings
        clientProjectId={id}
        gaPropertyId={gaPropertyId}
        statsVisibleToClient={statsVisibleToClient}
        serviceAccountEmail={process.env.GA_SERVICE_ACCOUNT_EMAIL ?? null}
      />
    </div>
  );
}

async function TareasTab({ id }: { id: string }) {
  const [items, unidad] = await Promise.all([
    getTasksForClientProject(id),
    getProjectBySlug(PORTAL_UNIDAD_SLUG),
  ]);

  return (
    <div className="sp-card flex flex-col">
      <div className="border-b border-[var(--sp-line)] px-5 py-4">
        <p className="sp-display text-sm text-[var(--sp-muted)]">Tareas del proyecto</p>
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-[var(--sp-muted)]">
          Todavía no hay tareas en este proyecto.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-[var(--sp-line)]">
          {items.map((item) => (
            <UnidadTaskRow key={item.task.id} item={item} />
          ))}
        </div>
      )}

      {unidad && (
        <AddProjectTask unidadProjectId={unidad.id} clientProjectId={id} />
      )}
    </div>
  );
}
