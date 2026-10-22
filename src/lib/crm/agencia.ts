/**
 * Sincronización del estado de la unidad agencia entre `leads.status` y
 * `crm_derivaciones.estado`.
 *
 * ── POR QUÉ EXISTE ESTO ──
 * La etapa del pipeline de agencia vive, conceptualmente, en la derivación: es
 * lo que leen las vistas del CRM y lo que hace que una persona pueda estar en
 * dos unidades con un estado propio en cada una.
 *
 * Pero `leads.status` sigue existiendo y sigue siendo lo que lee el Kanban, las
 * métricas, el bloque de seguimientos del dashboard y la conversión a cliente —
 * todo eso depende además de columnas que sólo están en `leads` (valor
 * estimado, motivo de pérdida, próximo seguimiento, cliente vinculado).
 * Reescribir el Kanban sobre derivaciones era un cambio mucho más grande y
 * riesgoso que lo que justifica esta tarea.
 *
 * La solución: las dos columnas se mueven JUNTAS, siempre, y por acá. No son
 * dos fuentes de verdad —`crm_derivaciones.estado` es la autoritativa— sino una
 * denormalización con un único camino de escritura.
 *
 * Los seis estados de agencia son, a propósito, exactamente los del enum
 * `lead_status`, así que la traducción es la identidad. Eso está garantizado por
 * `UNIDADES.agencia.estados` en unidades.ts.
 *
 * Cuando el Kanban migre a leer derivaciones, este archivo se borra.
 *
 * SÓLO SERVIDOR.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { crmDerivaciones, crmEventos, crmUnidades, leads } from "@/db/schema";
import { esEstadoValido } from "./unidades";

/** El `project_id` de la unidad agencia, o null si el CRM no está migrado. */
async function projectIdAgencia(): Promise<string | null> {
  const [fila] = await db
    .select({ projectId: crmUnidades.projectId })
    .from(crmUnidades)
    .where(eq(crmUnidades.clave, "agencia"))
    .limit(1);
  return fila?.projectId ?? null;
}

/**
 * Propaga a la derivación de agencia un cambio hecho desde el Kanban de Leads.
 *
 * No tira nunca: si el CRM todavía no está migrado en esta base, o el lead no
 * tiene contacto vinculado, no hay nada que sincronizar y el cambio en `leads`
 * ya quedó hecho. Un lead que no se puede espejar no puede hacer fallar la
 * acción que el usuario pidió.
 */
export async function propagarEstadoDeLead(
  leadId: string,
  estado: string
): Promise<void> {
  if (!esEstadoValido("agencia", estado)) return;

  const projectId = await projectIdAgencia();
  if (!projectId) return;

  const [lead] = await db
    .select({ crmContactoId: leads.crmContactoId })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  if (!lead?.crmContactoId) return;

  const [derivacion] = await db
    .select({ id: crmDerivaciones.id, estado: crmDerivaciones.estado })
    .from(crmDerivaciones)
    .where(
      and(
        eq(crmDerivaciones.contactoId, lead.crmContactoId),
        eq(crmDerivaciones.unidadProjectId, projectId)
      )
    )
    .limit(1);
  if (!derivacion || derivacion.estado === estado) return;

  await db.batch([
    db.update(crmDerivaciones).set({ estado }).where(eq(crmDerivaciones.id, derivacion.id)),
    db.insert(crmEventos).values({
      contactoId: lead.crmContactoId,
      derivacionId: derivacion.id,
      tipo: "estado_cambiado",
      datos: { unidad: "agencia", de: derivacion.estado, a: estado, desde: "kanban" },
    }),
  ]);
}

/**
 * Propaga a `leads.status` un cambio hecho desde el CRM.
 *
 * Una persona puede tener más de un lead (una reactivación crea otro), así que
 * se actualizan todos los que apunten a ese contacto: el Kanban no puede quedar
 * mostrando una etapa distinta de la que muestra la ficha.
 */
export async function propagarEstadoAcLeads(
  contactoId: string,
  estado: string
): Promise<void> {
  if (!esEstadoValido("agencia", estado)) return;
  await db
    .update(leads)
    .set({ status: estado as (typeof leads.$inferSelect)["status"], updatedAt: new Date() })
    .where(eq(leads.crmContactoId, contactoId));
}
