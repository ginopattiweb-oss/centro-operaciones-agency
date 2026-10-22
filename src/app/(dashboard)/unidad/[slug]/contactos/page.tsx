import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getProjectBySlug } from "@/lib/queries";
import { PanelTheme } from "@/components/PanelTheme";
import { ContactosVista } from "@/components/crm/ContactosVista";
import { claveDeSlug, UNIDADES } from "@/lib/crm/unidades";
import type { SearchParamsCrm } from "@/lib/crm/vista";
import { cargarVista } from "../../../crm/_datos";

export const metadata = { title: "Contactos" };

/**
 * La vista de contactos de una unidad.
 *
 * Lee del CRM filtrado por la derivación a ESTA unidad: `leads` es la tabla de
 * detalle comercial y la pertenencia a la unidad es una fila en
 * `crm_derivaciones`.
 *
 * Sirve para cualquier unidad del CRM con el mismo componente: sumar una unidad
 * en src/lib/crm/unidades.ts le da su vista de contactos sin escribir nada nuevo.
 */
export default async function ContactosUnidadPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParamsCrm>;
}) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project || project.type !== "unidad") notFound();

  // Sólo las unidades registradas en el CRM tienen vista de contactos.
  const clave = claveDeSlug(slug);
  if (!clave) notFound();

  const { filtros, pagina, tags, contadores, modo, columnas } = await cargarVista(clave, await searchParams);

  return (
    <PanelTheme>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 md:p-10">
        <Link
          href={`/unidad/${slug}`}
          className="inline-flex w-fit items-center gap-2 text-sm text-[var(--sp-muted)] hover:text-[var(--sp-amber)]"
        >
          <ArrowLeft className="h-4 w-4" />
          {project.name}
        </Link>

        <ContactosVista
          titulo="Contactos"
          descripcion={`Personas derivadas a ${UNIDADES[clave].etiqueta}, con su etapa en este pipeline.`}
          alcance={clave}
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
