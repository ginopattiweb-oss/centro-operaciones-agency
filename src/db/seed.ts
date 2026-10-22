/**
 * Datos mínimos para arrancar. Es idempotente: se puede correr en cada deploy
 * sin duplicar nada (`npm run vercel-build` lo corre después de migrar).
 *
 * El nombre de la agencia y del dueño salen de NEXT_PUBLIC_AGENCY_NAME y
 * NEXT_PUBLIC_OWNER_NAME. El slug de la unidad es fijo ("agencia"): lo usan
 * las rutas del panel y el CRM.
 */
import { db } from "./index";
import { projects, people, crmUnidades } from "./schema";
import { eq } from "drizzle-orm";
import { AGENCY_NAME, OWNER_NAME } from "../lib/marca";
import { UNIDADES, UNIDADES_ORDENADAS } from "../lib/crm/unidades";

const seedProjects = [
  { name: AGENCY_NAME, slug: "agencia", type: "unidad" as const, color: "#FBB947" },
  { name: "Contenido", slug: "contenido", type: "transversal" as const, color: "#A1A1AA" },
];

async function seed() {
  for (const project of seedProjects) {
    const existing = await db.select().from(projects).where(eq(projects.slug, project.slug));

    if (existing.length === 0) {
      await db.insert(projects).values(project);
      console.log(`creado proyecto: ${project.name}`);
    } else {
      console.log(`ya existe proyecto: ${project.name}`);
    }
  }

  if (OWNER_NAME) {
    const existing = await db.select().from(people).where(eq(people.name, OWNER_NAME));
    if (existing.length === 0) {
      await db.insert(people).values({ name: OWNER_NAME, avatarColor: "#FBB947" });
      console.log(`creada persona: ${OWNER_NAME}`);
    }
  }

  // Cada unidad del CRM tiene que estar registrada en `crm_unidades` para poder
  // recibir contactos. Ver src/lib/crm/unidades.ts.
  for (const clave of UNIDADES_ORDENADAS) {
    const unidad = UNIDADES[clave];
    const [project] = await db.select().from(projects).where(eq(projects.slug, unidad.slug));
    if (!project) {
      console.warn(`unidad no encontrada para el CRM: ${unidad.slug}`);
      continue;
    }
    await db
      .insert(crmUnidades)
      .values({ projectId: project.id, clave, orden: unidad.orden })
      .onConflictDoNothing();
  }

  console.log("seed listo.");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
