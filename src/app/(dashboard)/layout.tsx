import { AppShell } from "@/components/AppShell";
import { getUnidades } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const unidades = await getUnidades();

  return <AppShell unidades={unidades}>{children}</AppShell>;
}
