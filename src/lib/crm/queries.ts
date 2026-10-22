/**
 * Lectura del CRM. Escribir va por `actions/crm.ts`.
 *
 * ── LA REGLA DEL MÓDULO ──
 * `crm_contactos` es TRANSVERSAL: no tiene columna de unidad. La frontera de
 * datos de cada unidad es la EXISTENCIA de su derivación, y por eso toda vista
 * de unidad filtra con un EXISTS contra `crm_derivaciones` para ese
 * `unidad_project_id`. Una consulta de unidad sin ese EXISTS no devuelve una
 * lista mal ordenada: mezcla los contactos de la comunidad con el pipeline de
 * la agencia.
 *
 * Eso es exactamente lo que verifica tests/crm-aislamiento.test.ts, y es el
 * reemplazo del `project_id` que usaban `contacts` y `leads`.
 */
import { and, asc, count, desc, eq, exists, ilike, inArray, isNull, notExists, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  crmContactos,
  crmDerivaciones,
  crmEventos,
  crmUnidades,
  projects,
  type ContactSource,
} from "@/db/schema";
import {
  toCrmContactoRow,
  toCrmEventoView,
  toDerivacionView,
  type CrmContactoRow,
  type CrmEventoView,
  type DerivacionView,
} from "./contactos";
import { UNIDADES, UNIDADES_ORDENADAS, type UnidadClave } from "./unidades";

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

// ─────────────────────────────────────────────────────── unidades

export type UnidadResuelta = {
  clave: UnidadClave;
  projectId: string;
  /** El nombre de la fila de `projects`, que es lo que ve el usuario en el sidebar. */
  nombre: string;
  etiqueta: string;
  slug: string;
};

/**
 * Las unidades del CRM con su `project_id` real.
 *
 * Es el equivalente funcional de un `getOrgContext()`: resuelve el contexto a
 * partir del cual se filtra. Este panel no tiene organizaciones (ver
 * src/lib/contactos/README.md), así que el contexto es la unidad.
 */
export async function getUnidades(): Promise<UnidadResuelta[]> {
  const filas = await db
    .select({
      clave: crmUnidades.clave,
      projectId: crmUnidades.projectId,
      orden: crmUnidades.orden,
      nombre: projects.name,
      slug: projects.slug,
    })
    .from(crmUnidades)
    .innerJoin(projects, eq(projects.id, crmUnidades.projectId))
    .orderBy(asc(crmUnidades.orden));

  return filas
    .filter((f): f is typeof f & { clave: UnidadClave } => f.clave in UNIDADES)
    .map((f) => ({
      clave: f.clave,
      projectId: f.projectId,
      nombre: f.nombre,
      etiqueta: UNIDADES[f.clave].etiqueta,
      slug: f.slug,
    }));
}

/** La unidad pedida, o tira. Sin unidad resuelta no se consulta nada de unidad. */
export async function requireUnidad(clave: UnidadClave): Promise<UnidadResuelta> {
  const unidad = (await getUnidades()).find((u) => u.clave === clave);
  if (!unidad) {
    throw new Error(
      `La unidad "${clave}" no está registrada en crm_unidades. ¿Corrió la migración 0026?`
    );
  }
  return unidad;
}

/** clave de unidad por `project_id`, para derivar las filas que vuelven de la base. */
async function mapaClavePorProjectId(): Promise<Map<string, UnidadClave>> {
  return new Map((await getUnidades()).map((u) => [u.projectId, u.clave]));
}

/** `project_id` por clave. */
async function mapaProjectIdPorClave(): Promise<Map<UnidadClave, string>> {
  return new Map((await getUnidades()).map((u) => [u.clave, u.projectId]));
}

// ─────────────────────────────────────────────────────── filtros

export type CrmFiltros = {
  busqueda?: string;
  /**
   * Alcance de la vista:
   *  - una clave de unidad → sólo contactos derivados a esa unidad
   *  - 'sin_derivar'       → la Bandeja: sólo los que no tienen ninguna derivación
   *  - 'todos' / undefined → todos
   */
  alcance?: UnidadClave | "sin_derivar" | "todos";
  /** Estado dentro de la unidad del alcance. Se ignora si el alcance no es una unidad. */
  estado?: string | null;
  origen?: ContactSource | null;
  /** null = sin filtrar; true/false = sólo suscriptos o sólo dados de baja. */
  suscripto?: boolean | null;
  /** null = sin filtrar; true/false = sólo con o sin opt-in de WhatsApp. */
  whatsappOptIn?: boolean | null;
  /** true = sólo los que tienen un teléfono usable para WhatsApp. */
  conTelefono?: boolean | null;
  tags?: string[];
};

export type CrmPagina = {
  rows: CrmContactoRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * El EXISTS que define la pertenencia a una unidad. Un solo lugar, usado por el
 * listado, el conteo y la exportación, así los tres miran el mismo conjunto: un
 * export que no coincide con la tabla que tenés delante es peor que no tenerlo.
 */
function derivadoA(projectId: string, estado?: string | null): SQL {
  const cond = [
    eq(crmDerivaciones.contactoId, crmContactos.id),
    eq(crmDerivaciones.unidadProjectId, projectId),
  ];
  if (estado) cond.push(eq(crmDerivaciones.estado, estado));
  return exists(db.select({ x: sql`1` }).from(crmDerivaciones).where(and(...cond)));
}

/** El anti-join de la Bandeja: ninguna derivación, de ninguna unidad. */
function sinNingunaDerivacion(): SQL {
  return notExists(
    db
      .select({ x: sql`1` })
      .from(crmDerivaciones)
      .where(eq(crmDerivaciones.contactoId, crmContactos.id))
  );
}

async function buildWhere(filtros: CrmFiltros): Promise<SQL | undefined> {
  const cond: (SQL | undefined)[] = [];

  const alcance = filtros.alcance ?? "todos";
  if (alcance === "sin_derivar") {
    cond.push(sinNingunaDerivacion());
  } else if (alcance !== "todos") {
    const projectId = (await mapaProjectIdPorClave()).get(alcance);
    if (!projectId) throw new Error(`Unidad no registrada: ${alcance}`);
    cond.push(derivadoA(projectId, filtros.estado));
  }

  const busqueda = filtros.busqueda?.trim();
  if (busqueda) {
    const patron = `%${busqueda}%`;
    // Los tres campos por los que una persona se busca en la práctica. Usan los
    // índices trigram que crea la migración 0026.
    cond.push(
      or(
        ilike(sql`${crmContactos.email}::text`, patron),
        ilike(crmContactos.nombre, patron),
        ilike(crmContactos.telefonoE164, patron),
        ilike(crmContactos.telefonoCrudo, patron),
        ilike(crmContactos.instagram, patron)
      )
    );
  }

  if (filtros.origen) cond.push(eq(crmContactos.origen, filtros.origen));
  if (typeof filtros.suscripto === "boolean") {
    cond.push(eq(crmContactos.suscripto, filtros.suscripto));
  }
  if (typeof filtros.whatsappOptIn === "boolean") {
    cond.push(eq(crmContactos.whatsappOptIn, filtros.whatsappOptIn));
  }
  if (filtros.conTelefono === true) {
    cond.push(sql`${crmContactos.telefonoE164} is not null`);
  } else if (filtros.conTelefono === false) {
    cond.push(isNull(crmContactos.telefonoE164));
  }

  const tags = filtros.tags?.filter(Boolean) ?? [];
  if (tags.length > 0) cond.push(sql`${crmContactos.tags} @> ${tags}`);

  const limpias = cond.filter(Boolean);
  return limpias.length ? and(...limpias) : undefined;
}

// ─────────────────────────────────────────────────────── listado

/** Las derivaciones de un conjunto de contactos, agrupadas, en una sola consulta. */
async function derivacionesPorContacto(
  contactoIds: string[]
): Promise<Map<string, DerivacionView[]>> {
  const porContacto = new Map<string, DerivacionView[]>();
  if (contactoIds.length === 0) return porContacto;

  const clavePorProjectId = await mapaClavePorProjectId();
  const filas = await db
    .select()
    .from(crmDerivaciones)
    .where(inArray(crmDerivaciones.contactoId, contactoIds));

  for (const f of filas) {
    const lista = porContacto.get(f.contactoId) ?? [];
    lista.push(toDerivacionView(f, clavePorProjectId));
    porContacto.set(f.contactoId, lista);
  }
  return porContacto;
}

/** Página de contactos, del más nuevo al más viejo. Pagina en el servidor. */
export async function listarContactos(
  filtros: CrmFiltros = {},
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE
): Promise<CrmPagina> {
  const size = Math.min(Math.max(1, Math.trunc(pageSize)), MAX_PAGE_SIZE);
  const where = await buildWhere(filtros);

  const [{ total }] = await db.select({ total: count() }).from(crmContactos).where(where);

  const totalPages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.trunc(page)), totalPages);

  const filas = await db
    .select()
    .from(crmContactos)
    .where(where)
    .orderBy(desc(crmContactos.createdAt), asc(crmContactos.id))
    .limit(size)
    .offset((current - 1) * size);

  const derivaciones = await derivacionesPorContacto(filas.map((f) => f.id));

  return {
    rows: filas.map((f) => toCrmContactoRow(f, derivaciones.get(f.id) ?? [])),
    total,
    page: current,
    pageSize: size,
    totalPages,
  };
}

/** Todo lo que matchea los filtros, sin paginar. Sólo para exportar. */
export async function listarTodoParaExportar(filtros: CrmFiltros = {}): Promise<CrmContactoRow[]> {
  const filas = await db
    .select()
    .from(crmContactos)
    .where(await buildWhere(filtros))
    .orderBy(desc(crmContactos.createdAt), asc(crmContactos.id));

  const derivaciones = await derivacionesPorContacto(filas.map((f) => f.id));
  return filas.map((f) => toCrmContactoRow(f, derivaciones.get(f.id) ?? []));
}

// ─────────────────────────────────────────────────────── ficha

export type CrmFicha = {
  contacto: CrmContactoRow;
  eventos: CrmEventoView[];
};

/** La ficha completa de una persona: datos, derivaciones y línea de tiempo. */
export async function getFicha(id: string): Promise<CrmFicha | null> {
  const [contacto] = await db.select().from(crmContactos).where(eq(crmContactos.id, id)).limit(1);
  if (!contacto) return null;

  const derivaciones = await derivacionesPorContacto([id]);
  const eventos = await db
    .select()
    .from(crmEventos)
    .where(eq(crmEventos.contactoId, id))
    .orderBy(desc(crmEventos.ocurridoAt), desc(crmEventos.createdAt));

  return {
    contacto: toCrmContactoRow(contacto, derivaciones.get(id) ?? []),
    eventos: eventos.map(toCrmEventoView),
  };
}

export async function getContacto(id: string): Promise<CrmContactoRow | null> {
  return (await getFicha(id))?.contacto ?? null;
}

// ─────────────────────────────────────────────────────── búsqueda por clave

/**
 * Busca una persona por email o por teléfono E.164. Es la deduplicación que usan
 * el webhook, el importador y el alta manual.
 *
 * Devuelve null si los dos criterios vienen vacíos: un contacto sin ninguna de
 * las dos claves no se puede deduplicar y se crea nuevo.
 */
export async function buscarPorClave(
  email: string | null,
  telefonoE164: string | null
): Promise<string | null> {
  const criterios: SQL[] = [];
  if (email) criterios.push(eq(crmContactos.email, email));
  if (telefonoE164) criterios.push(eq(crmContactos.telefonoE164, telefonoE164));
  if (criterios.length === 0) return null;

  const [fila] = await db
    .select({ id: crmContactos.id })
    .from(crmContactos)
    .where(or(...criterios))
    .limit(1);
  return fila?.id ?? null;
}

/** Los contactos de una lista de mails, para que el importador no consulte de a uno. */
export async function buscarPorEmails(emails: string[]) {
  if (emails.length === 0) return [];
  return db
    .select({ id: crmContactos.id, email: crmContactos.email, tags: crmContactos.tags })
    .from(crmContactos)
    .where(inArray(crmContactos.email, emails));
}

// ─────────────────────────────────────────────────────── contadores

export type ContadoresTransversales = {
  total: number;
  sinDerivar: number;
  suscriptos: number;
  conOptIn: number;
  /** Cuántos contactos hay en cada unidad. */
  porUnidad: Record<UnidadClave, number>;
};

/**
 * Las tarjetas de la vista transversal. Todos los números salen de la base en
 * una sola pasada: con la tabla vacía dan cero, y ese cero es correcto.
 */
export async function getContadoresTransversales(): Promise<ContadoresTransversales> {
  const unidades = await getUnidades();

  const [base] = await db
    .select({
      total: count(),
      suscriptos: sql<number>`count(*) FILTER (WHERE ${crmContactos.suscripto})::int`,
      conOptIn: sql<number>`count(*) FILTER (WHERE ${crmContactos.whatsappOptIn})::int`,
    })
    .from(crmContactos);

  const [{ sinDerivar }] = await db
    .select({ sinDerivar: count() })
    .from(crmContactos)
    .where(sinNingunaDerivacion());

  const porUnidadFilas = await db
    .select({
      projectId: crmDerivaciones.unidadProjectId,
      n: count(),
    })
    .from(crmDerivaciones)
    .groupBy(crmDerivaciones.unidadProjectId);

  const porUnidad = Object.fromEntries(
    UNIDADES_ORDENADAS.map((clave) => [clave, 0])
  ) as Record<UnidadClave, number>;
  for (const fila of porUnidadFilas) {
    const clave = unidades.find((u) => u.projectId === fila.projectId)?.clave;
    if (clave) porUnidad[clave] = fila.n;
  }

  return {
    total: base?.total ?? 0,
    suscriptos: base?.suscriptos ?? 0,
    conOptIn: base?.conOptIn ?? 0,
    sinDerivar,
    porUnidad,
  };
}

/**
 * Los contadores de la vista de una unidad: cuántos hay en cada etapa de SU
 * pipeline. Las etapas con cero aparecen igual, porque una etapa vacía es
 * información: el cero sale de la base.
 */
export async function getContadoresUnidad(
  clave: UnidadClave
): Promise<{ total: number; porEstado: Record<string, number> }> {
  const unidad = await requireUnidad(clave);

  const filas = await db
    .select({ estado: crmDerivaciones.estado, n: count() })
    .from(crmDerivaciones)
    .where(eq(crmDerivaciones.unidadProjectId, unidad.projectId))
    .groupBy(crmDerivaciones.estado);

  const porEstado: Record<string, number> = {};
  for (const estado of UNIDADES[clave].estados) porEstado[estado] = 0;
  let total = 0;
  for (const fila of filas) {
    // Un estado que no está en la definición igual se cuenta: ocultarlo sería
    // mostrar un total que no cierra con la suma de las columnas.
    porEstado[fila.estado] = (porEstado[fila.estado] ?? 0) + fila.n;
    total += fila.n;
  }
  return { total, porEstado };
}

// ─────────────────────────────────────────────────────── kanban

/**
 * Cuántas tarjetas carga como máximo cada columna del kanban.
 *
 * Comunidad tiene 1286 personas en "Lead": traerlas todas haría una página de
 * varios megabytes para mostrar una columna por la que nadie va a scrollear
 * hasta el fondo. Se traen las más nuevas y el encabezado muestra el total de
 * verdad, así el número nunca miente aunque la columna esté recortada.
 */
export const LIMITE_KANBAN = 50;

export type ColumnaKanban = {
  estado: string;
  rows: CrmContactoRow[];
  /** El total real de la etapa, contado en la base. Puede ser mayor que `rows`. */
  total: number;
};

/**
 * Las columnas del kanban de una unidad: las etapas de SU pipeline, en orden, y
 * las primeras tarjetas de cada una.
 *
 * Una etapa sin nadie aparece igual, con su cero: una columna vacía es
 * información, y es donde se sueltan las tarjetas.
 */
export async function listarParaKanban(
  clave: UnidadClave,
  filtros: CrmFiltros = {},
  limite = LIMITE_KANBAN
): Promise<ColumnaKanban[]> {
  const estados = UNIDADES[clave].estados;

  // Una consulta por etapa, en paralelo. Van por el índice
  // (unidad_project_id, estado) y reusan el mismo camino que el listado, así la
  // tabla y el kanban no pueden discrepar sobre qué entra en cada filtro.
  const paginas = await Promise.all(
    estados.map((estado) =>
      listarContactos({ ...filtros, alcance: clave, estado }, 1, limite)
    )
  );

  return estados.map((estado, i) => ({
    estado,
    rows: paginas[i].rows,
    total: paginas[i].total,
  }));
}

/** Los tags en uso. Se derivan, no se guardan aparte. */
export async function getTagsEnUso(): Promise<string[]> {
  const filas = await db
    .select({ tag: sql<string>`DISTINCT unnest(${crmContactos.tags})` })
    .from(crmContactos);
  return filas.map((f) => f.tag).sort();
}
