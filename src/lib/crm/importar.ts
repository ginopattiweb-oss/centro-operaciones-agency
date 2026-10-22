/**
 * Lógica del importador de CSV del CRM. Funciones puras: no tocan la base.
 *
 * Se separa de la action a propósito, para poder razonar (y probar) las reglas
 * de deduplicación sin una base de datos en el medio. Es el código más delicado
 * del módulo: un error acá reactiva bajas, y eso no se puede deshacer.
 *
 * ── REGLAS DE MERGE cuando el mail o el teléfono YA EXISTEN ──
 *
 *   tags            se SUMAN a los que ya tenía. Un import agrega información,
 *                   no la reemplaza; perder los tags de una segmentación
 *                   anterior es irreversible.
 *   campos vacíos   se completan con lo del CSV. Es ganancia neta.
 *   campos con dato  NO se pisan. Lo que ya está fue cargado o corregido a mano,
 *                   y un CSV viejo no puede ganarle a una corrección deliberada.
 *   suscripto       NUNCA pasa de false a true. Ver abajo.
 *   whatsapp_opt_in el importador NO lo toca jamás. Un CSV no es consentimiento
 *                   de WhatsApp.
 *
 * ── POR QUÉ UN IMPORT NO REACTIVA BAJAS ──
 * Cuando alguien se da de baja, `suscripto` pasa a false y no hay ningún camino
 * en el código que lo vuelva a true. Si un import pudiera revertirlo, bastaría
 * con volver a subir un CSV viejo —donde esa persona todavía figuraba— para
 * empezar a escribirle otra vez. Eso es enviar sin consentimiento.
 */
import type { ContactSource } from "@/db/schema";
import {
  normalizarEmail,
  normalizarInstagram,
  normalizarSitioWeb,
  normalizarTags,
  unirTags,
} from "./contactos";
import { parsearFechaCsv, type FilaRechazada } from "./csv";
import { normalizarTelefono } from "./telefono";
import { esEstadoValido, estadoInicial, type UnidadClave } from "./unidades";

/** Techo de filas por archivo. Más que esto se parte el CSV en varios. */
export const MAX_FILAS_IMPORT = 10_000;
/** Tamaño del lote de escritura. */
export const LOTE_IMPORT = 500;

/** A qué campo del contacto va cada columna del CSV. */
export const DESTINOS_IMPORT = {
  ignorar: "Ignorar",
  email: "Email",
  telefono: "Teléfono",
  nombre: "Nombre",
  instagram: "Instagram",
  sitioWeb: "Sitio web",
  origenDetalle: "Detalle de origen",
  consentimientoAt: "Fecha de consentimiento",
  noContactar: "No contactar",
} as const;

export type DestinoImport = keyof typeof DESTINOS_IMPORT;

export const DESTINOS_IMPORT_KEYS = Object.keys(DESTINOS_IMPORT) as DestinoImport[];

export function esDestinoImport(value: unknown): value is DestinoImport {
  return typeof value === "string" && value in DESTINOS_IMPORT;
}

/**
 * Preselección del mapeo por nombre de columna, ya en minúsculas. Incluye las
 * variantes que exporta Gumroad, que es de donde viene la mayoría de los
 * archivos.
 */
const PISTAS: Record<string, DestinoImport> = {
  email: "email",
  "e-mail": "email",
  mail: "email",
  correo: "email",
  "buyer email": "email",
  "purchase email": "email",
  nombre: "nombre",
  name: "nombre",
  "full name": "nombre",
  "buyer name": "nombre",
  phone: "telefono",
  telefono: "telefono",
  "teléfono": "telefono",
  celular: "telefono",
  whatsapp: "telefono",
  instagram: "instagram",
  ig: "instagram",
  usuario: "instagram",
  web: "sitioWeb",
  website: "sitioWeb",
  sitio: "sitioWeb",
  "sitio web": "sitioWeb",
  "item name": "origenDetalle",
  producto: "origenDetalle",
  product: "origenDetalle",
  "product name": "origenDetalle",
  "purchase date": "consentimientoAt",
  fecha: "consentimientoAt",
  date: "consentimientoAt",
  "created at": "consentimientoAt",
  "do not contact?": "noContactar",
  "do not contact": "noContactar",
  unsubscribed: "noContactar",
  "no contactar": "noContactar",
};

export function sugerirDestino(encabezado: string): DestinoImport {
  return PISTAS[encabezado.trim().toLowerCase()] ?? "ignorar";
}

/** Fila cruda del CSV: encabezado -> valor. */
export type FilaCsv = Record<string, string>;

/** Columna del archivo -> campo destino. Lo elige el usuario en el paso 2. */
export type Mapeo = Record<string, DestinoImport>;

/** Lo que se aplica igual a todas las filas del lote (paso 3). */
export type AjustesLote = {
  origen: ContactSource;
  tags: string[];
  consentimientoFuente: string | null;
  /** A qué unidad derivar. null = "sin derivar": van a la Bandeja. */
  derivarA: UnidadClave | null;
  /** Estado inicial en esa unidad. Se ignora si `derivarA` es null. */
  estadoInicial: string | null;
};

/** Una fila lista para escribir, ya normalizada y deduplicada. */
export type FilaPreparada = {
  /** La clave con la que se deduplica: el mail si hay, si no el teléfono E.164. */
  clave: string;
  claveEs: "email" | "telefono";
  email: string | null;
  telefonoE164: string | null;
  telefonoCrudo: string | null;
  nombre: string | null;
  instagram: string | null;
  sitioWeb: string | null;
  origenDetalle: string | null;
  tags: string[];
  consentimientoAt: Date | null;
  /** false cuando la fila venía marcada como "no contactar". */
  suscripto: boolean;
};

export type PlanImport = {
  filas: FilaPreparada[];
  rechazadas: FilaRechazada[];
  /** Cuántas filas del archivo se fusionaron con otra por tener la misma clave. */
  fusionadas: number;
};

/** Valores que cuentan como "no contactar" en un CSV. */
const VERDADEROS = new Set(["1", "true", "yes", "y", "si", "sí", "x", "verdadero"]);

export function esNoContactar(raw: string | null | undefined): boolean {
  return VERDADEROS.has(String(raw ?? "").trim().toLowerCase());
}

/** El valor de una columna mapeada a cierto destino, o null. */
function valorDe(fila: FilaCsv, mapeo: Mapeo, destino: DestinoImport): string | null {
  for (const [columna, mapeado] of Object.entries(mapeo)) {
    if (mapeado !== destino) continue;
    const raw = fila[columna];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return null;
}

/**
 * Convierte el archivo en filas listas para escribir.
 *
 * Dos cosas pasan acá y en ningún otro lado:
 *  - Las filas sin NINGUNA forma de contacto se descartan y se explican.
 *  - Las claves repetidas DENTRO del archivo se colapsan en una sola fila,
 *    sumando los tags. Sin esto, un INSERT con la misma clave dos veces en la
 *    misma sentencia falla entero y se pierde el lote completo.
 */
export function planearImport(
  filasCsv: FilaCsv[],
  mapeo: Mapeo,
  lote: AjustesLote
): PlanImport {
  const porClave = new Map<string, FilaPreparada>();
  const rechazadas: FilaRechazada[] = [];
  const tagsDelLote = normalizarTags(lote.tags);
  let fusionadas = 0;

  filasCsv.forEach((fila, index) => {
    // +2: la fila 1 del archivo es el encabezado y la gente cuenta desde 1.
    const numero = index + 2;

    const emailCrudo = valorDe(fila, mapeo, "email");
    const email = normalizarEmail(emailCrudo);
    const tel = normalizarTelefono(valorDe(fila, mapeo, "telefono"));

    // El mail, si viene, tiene que ser un mail. Un mail inválido no se "arregla"
    // cayendo al teléfono: es un error del archivo y hay que verlo.
    if (emailCrudo && (!email || !email.includes("@") || email.length > 320)) {
      rechazadas.push({ fila: numero, valor: emailCrudo, motivo: "Mail inválido" });
      return;
    }

    const instagramCrudo = valorDe(fila, mapeo, "instagram");
    const instagram = instagramCrudo ? normalizarInstagram(instagramCrudo) : null;
    const sitioWeb = normalizarSitioWeb(valorDe(fila, mapeo, "sitioWeb"));

    // La clave de deduplicación: el mail si hay, si no el teléfono normalizado.
    // Sin ninguno de los dos no hay con qué deduplicar, y además no hay forma de
    // contactar a la persona: la fila no entra.
    const clave = email ?? tel.e164;
    if (!clave) {
      rechazadas.push({
        fila: numero,
        valor: emailCrudo ?? tel.crudo ?? "",
        motivo: "Sin mail ni teléfono válido",
      });
      return;
    }

    const preparada: FilaPreparada = {
      clave,
      claveEs: email ? "email" : "telefono",
      email,
      telefonoE164: tel.e164,
      telefonoCrudo: tel.e164 ? null : tel.crudo,
      nombre: valorDe(fila, mapeo, "nombre"),
      instagram,
      sitioWeb,
      origenDetalle: valorDe(fila, mapeo, "origenDetalle"),
      tags: tagsDelLote,
      consentimientoAt: parsearFechaCsv(valorDe(fila, mapeo, "consentimientoAt")),
      // La columna "no contactar" entra como baja desde el minuto cero.
      suscripto: !esNoContactar(valorDe(fila, mapeo, "noContactar")),
    };

    const previa = porClave.get(clave);
    if (!previa) {
      porClave.set(clave, preparada);
      return;
    }

    // Repetida en el mismo archivo: gana el primer dato no vacío, los tags se
    // suman, y una sola marca de "no contactar" alcanza para dar de baja.
    fusionadas += 1;
    porClave.set(clave, {
      clave,
      claveEs: previa.claveEs,
      email: previa.email ?? preparada.email,
      telefonoE164: previa.telefonoE164 ?? preparada.telefonoE164,
      telefonoCrudo: (previa.telefonoE164 ?? preparada.telefonoE164)
        ? null
        : (previa.telefonoCrudo ?? preparada.telefonoCrudo),
      nombre: previa.nombre ?? preparada.nombre,
      instagram: previa.instagram ?? preparada.instagram,
      sitioWeb: previa.sitioWeb ?? preparada.sitioWeb,
      origenDetalle: previa.origenDetalle ?? preparada.origenDetalle,
      tags: unirTags(previa.tags, preparada.tags),
      consentimientoAt: previa.consentimientoAt ?? preparada.consentimientoAt,
      suscripto: previa.suscripto && preparada.suscripto,
    });
  });

  return { filas: [...porClave.values()], rechazadas, fusionadas };
}

export type ResumenImport = {
  /** Filas del archivo, no contactos resultantes. */
  total: number;
  aCrear: number;
  aActualizar: number;
  omitidas: number;
  /** Cuántas entran (o quedan) como no suscritas. */
  noSuscritas: number;
  fusionadas: number;
  /** Cuántos quedarían derivados a la unidad elegida. 0 si es "sin derivar". */
  aDerivar: number;
};

/**
 * El resumen del paso 4, antes de escribir una sola fila.
 *
 * `existentes` son las claves que ya están en el CRM. Se consulta una vez y se
 * compara en memoria: preguntar de a una clave por 10.000 filas sería una
 * tormenta de consultas.
 */
export function resumirImport(
  plan: PlanImport,
  existentes: Set<string>,
  derivarA: UnidadClave | null
): ResumenImport {
  let aCrear = 0;
  let aActualizar = 0;
  let noSuscritas = 0;

  for (const fila of plan.filas) {
    if (existentes.has(fila.clave)) aActualizar += 1;
    else aCrear += 1;
    if (!fila.suscripto) noSuscritas += 1;
  }

  return {
    // Las fusionadas se contaron una sola vez en `filas`; sin sumarlas el total
    // no cierra con las filas del CSV.
    total: plan.filas.length + plan.rechazadas.length + plan.fusionadas,
    aCrear,
    aActualizar,
    omitidas: plan.rechazadas.length,
    noSuscritas,
    fusionadas: plan.fusionadas,
    // Todas las filas que entran se derivan, existan o no: si la persona ya
    // estaba pero no en esa unidad, el import la deriva igual.
    aDerivar: derivarA ? plan.filas.length : 0,
  };
}

/** Valida los ajustes del lote. Devuelve el mensaje de error, o null. */
export function validarAjustes(lote: AjustesLote): string | null {
  if (lote.derivarA === null) return null;
  const estado = lote.estadoInicial ?? estadoInicial(lote.derivarA);
  if (!esEstadoValido(lote.derivarA, estado)) {
    return "Ese estado no existe en el pipeline de la unidad elegida.";
  }
  return null;
}

/** Parte en lotes del tamaño pedido. */
export function enLotes<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
