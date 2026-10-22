import { getFinanzasTransversal } from "@/lib/presupuesto-queries";
import { FinanzasDashboard } from "./_components/FinanzasDashboard";

export const metadata = { title: "Finanzas" };

export default async function FinanzasPage() {
  const data = await getFinanzasTransversal();

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 md:p-10">
      <FinanzasDashboard data={data} />
    </div>
  );
}
