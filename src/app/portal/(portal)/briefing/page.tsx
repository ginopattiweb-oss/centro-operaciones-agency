import { BriefingForm } from "@/components/portal/BriefingForm";
import { formatDateTime } from "@/lib/date";
import { getBriefingForClient, requirePortalContext } from "@/lib/portal-queries";

export const dynamic = "force-dynamic";

export default async function PortalBriefingPage() {
  const { clientProject } = await requirePortalContext();
  const briefing = await getBriefingForClient(clientProject.id);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h2 className="font-heading text-2xl text-fg">Briefing del proyecto</h2>
        <p className="text-sm text-fg-muted">
          Cuanto más completo, mejor sale la web. Podés guardarlo como borrador y seguir
          después: no se pierde nada.
        </p>
      </header>

      <BriefingForm
        initialData={briefing?.data ?? {}}
        status={briefing?.status ?? "borrador"}
        submittedAt={briefing?.submittedAt ? formatDateTime(briefing.submittedAt) : null}
      />
    </div>
  );
}
