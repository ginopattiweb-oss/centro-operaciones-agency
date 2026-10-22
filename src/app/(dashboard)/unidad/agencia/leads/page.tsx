import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getProjectBySlug } from "@/lib/queries";
import { getLeadsForUnidad } from "@/lib/leads-queries";
import { getPortalClientProjects } from "@/lib/portal-queries";
import { endOfWeekStringBA, todayStringBA } from "@/lib/date";
import { LEADS_UNIDAD_SLUG } from "@/lib/leads-config";
import { PanelTheme } from "@/components/PanelTheme";
import { computeLeadMetrics } from "@/lib/leads-metrics";
import { LeadsSection } from "../_components/leads/LeadsSection";
import { LeadsMetrics } from "../_components/leads/LeadsMetrics";
import { AGENCY_NAME } from "@/lib/marca";

export const metadata: Metadata = {
  title: `Leads · ${AGENCY_NAME}`,
};

const BASE_PATH = `/unidad/${LEADS_UNIDAD_SLUG}`;

/**
 * Pipeline comercial de la agencia. La página es del panel interno: el
 * middleware ya bloquea el acceso sin sesión y cada action revalida con
 * `requireAdmin`, igual que Finanzas.
 */
export default async function LeadsPage({
  searchParams,
}: {
  /** `?lead=<id>` abre el drawer de ese lead: lo usan los avisos de duplicado. */
  searchParams: Promise<{ lead?: string }>;
}) {
  const openLeadId = (await searchParams).lead ?? null;
  const unidad = await getProjectBySlug(LEADS_UNIDAD_SLUG);
  if (!unidad) notFound();

  // Los archivados viajan también: el filtro "Ver archivados" los muestra sin otra consulta.
  const [leads, clientRows] = await Promise.all([
    getLeadsForUnidad(unidad.id, { includeArchived: true }),
    getPortalClientProjects(),
  ]);
  const clients = clientRows.map(({ clientProject }) => ({
    id: clientProject.id,
    name: clientProject.name,
  }));

  return (
    <PanelTheme>
      <div className="mx-auto flex max-w-[1240px] flex-col gap-8 p-6 md:p-10">
        <header className="flex flex-col gap-4">
          <Link
            href={BASE_PATH}
            className="inline-flex w-fit items-center gap-2 text-sm text-[var(--sp-muted)] hover:text-[var(--sp-amber)]"
          >
            <ArrowLeft className="h-4 w-4" />
            {unidad.name}
          </Link>
          <h1 className="sp-display text-4xl leading-none md:text-5xl">Leads</h1>
        </header>

        <LeadsMetrics metrics={computeLeadMetrics(leads)} />

        <LeadsSection
          leads={leads}
          clients={clients}
          today={todayStringBA()}
          weekEnd={endOfWeekStringBA()}
          openLeadId={openLeadId}
        />
      </div>
    </PanelTheme>
  );
}
