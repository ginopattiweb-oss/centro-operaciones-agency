import { PortalShell } from "@/components/portal/PortalShell";
import { requirePortalContext } from "@/lib/portal-queries";

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, clientProject } = await requirePortalContext();

  return (
    <PortalShell
      clientName={clientProject.name}
      userName={user.name}
      showStats={clientProject.statsVisibleToClient && Boolean(clientProject.gaPropertyId)}
      showFinance={clientProject.financeVisibleToClient}
    >
      {children}
    </PortalShell>
  );
}
