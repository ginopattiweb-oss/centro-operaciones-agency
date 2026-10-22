import { getTareasBoard } from "@/lib/tareas-queries";
import { getUnidades } from "@/lib/queries";
import { formatFriendlyDate, nowInBA } from "@/lib/date";
import { PanelTheme } from "@/components/PanelTheme";
import { TareasBoard } from "@/components/tareas/TareasBoard";

export default async function TareasPage() {
  const [board, unidades] = await Promise.all([getTareasBoard(), getUnidades()]);

  return (
    <PanelTheme>
      <div className="p-6 md:p-10">
        <TareasBoard board={board} fechaHoy={formatFriendlyDate(nowInBA())} unidades={unidades} />
      </div>
    </PanelTheme>
  );
}
