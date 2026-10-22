import { PanelTheme } from "@/components/PanelTheme";
import { ContactosVista } from "@/components/crm/ContactosVista";
import { cargarVista } from "../_datos";
import type { SearchParamsCrm } from "@/lib/crm/vista";

export const metadata = { title: "Bandeja · CRM" };

/**
 * La Bandeja: las personas que no están derivadas a ninguna unidad.
 *
 * Es la vista de trabajo para clasificar. Arranca vacía y eso es correcto: todo
 * el que migró venía de una unidad. Se llena con las importaciones "sin derivar"
 * y, en la Fase 2, con quien escriba por WhatsApp sin estar en la base.
 */
export default async function BandejaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsCrm>;
}) {
  const { filtros, pagina, tags, contadores, modo, columnas } = await cargarVista(
    "sin_derivar",
    await searchParams
  );

  return (
    <PanelTheme>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 md:p-10">
        <ContactosVista
          titulo="Bandeja"
          descripcion="Personas que todavía no están asignadas a ninguna unidad."
          alcance="sin_derivar"
          pagina={pagina}
          contadores={contadores}
          tagsDisponibles={tags}
          filtros={filtros}
          modo={modo}
          columnas={columnas}
        />
      </div>
    </PanelTheme>
  );
}
