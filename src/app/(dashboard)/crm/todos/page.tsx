import { PanelTheme } from "@/components/PanelTheme";
import { ContactosVista } from "@/components/crm/ContactosVista";
import { cargarVista } from "../_datos";
import type { SearchParamsCrm } from "@/lib/crm/vista";

export const metadata = { title: "Todos los contactos · CRM" };

/** Todas las personas del CRM, de cualquier unidad y sin derivar. */
export default async function TodosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsCrm>;
}) {
  const { filtros, pagina, tags, contadores, modo, columnas } = await cargarVista("todos", await searchParams);

  return (
    <PanelTheme>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 md:p-10">
        <ContactosVista
          titulo="Todos los contactos"
          descripcion="Cada persona aparece una sola vez, con las unidades a las que está derivada."
          alcance="todos"
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
