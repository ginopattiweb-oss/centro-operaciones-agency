// Definición única del formulario de briefing: la usan el form del cliente,
// el guardado en servidor y la vista de lectura del panel interno.

export type BriefingField = {
  key: string;
  label: string;
  help?: string;
  type: "text" | "textarea" | "url";
  required?: boolean;
};

export type BriefingSection = {
  key: string;
  title: string;
  fields: BriefingField[];
};

export const BRIEFING_SECTIONS: BriefingSection[] = [
  {
    key: "empresa",
    title: "La empresa",
    fields: [
      { key: "empresa_nombre", label: "Nombre de la empresa o marca", type: "text", required: true },
      { key: "empresa_rubro", label: "Rubro / industria", type: "text", required: true },
      {
        key: "empresa_descripcion",
        label: "¿A qué se dedica la empresa?",
        help: "Contanos en pocas líneas qué hacen y hace cuánto.",
        type: "textarea",
        required: true,
      },
      {
        key: "empresa_diferencial",
        label: "¿Qué los diferencia de la competencia?",
        type: "textarea",
      },
      { key: "empresa_web_actual", label: "Web actual (si tienen)", type: "url" },
    ],
  },
  {
    key: "objetivos",
    title: "Objetivos del proyecto",
    fields: [
      {
        key: "objetivo_principal",
        label: "Objetivo principal de la web",
        help: "Vender online, generar consultas, mostrar catálogo, dar institucionalidad...",
        type: "textarea",
        required: true,
      },
      {
        key: "objetivo_exito",
        label: "¿Cómo van a medir que el proyecto fue un éxito?",
        type: "textarea",
      },
      { key: "objetivo_fecha", label: "¿Hay una fecha límite o lanzamiento?", type: "text" },
    ],
  },
  {
    key: "publico",
    title: "Público y mercado",
    fields: [
      {
        key: "publico_objetivo",
        label: "¿Quién es el cliente ideal?",
        help: "Edad, ubicación, si es empresa o consumidor final, qué problema le resolvés.",
        type: "textarea",
        required: true,
      },
      {
        key: "publico_competencia",
        label: "Competidores directos (webs)",
        help: "Poné 2 o 3 links, uno por línea.",
        type: "textarea",
      },
      {
        key: "publico_referencias",
        label: "Webs que te gustan (aunque sean de otro rubro)",
        help: "Contanos qué te gusta de cada una.",
        type: "textarea",
      },
    ],
  },
  {
    key: "contenido",
    title: "Contenido y secciones",
    fields: [
      {
        key: "contenido_secciones",
        label: "Secciones que querés en la web",
        help: "Inicio, Nosotros, Servicios, Productos, Blog, Contacto...",
        type: "textarea",
        required: true,
      },
      {
        key: "contenido_estado",
        label: "¿Tenés textos e imágenes listos?",
        help: "Contanos qué está listo y qué falta producir.",
        type: "textarea",
      },
      {
        key: "contenido_funcionalidades",
        label: "Funcionalidades especiales",
        help: "Carrito, turnos, chat, multi-idioma, integración con CRM, etc.",
        type: "textarea",
      },
    ],
  },
  {
    key: "marca",
    title: "Marca y estilo",
    fields: [
      {
        key: "marca_manual",
        label: "¿Tenés manual de marca / logo en vectores?",
        type: "textarea",
      },
      { key: "marca_colores", label: "Colores y tipografías de la marca", type: "textarea" },
      {
        key: "marca_tono",
        label: "Tono de comunicación",
        help: "Formal, cercano, técnico, aspiracional...",
        type: "text",
      },
      { key: "marca_evitar", label: "Cosas que NO querés en la web", type: "textarea" },
    ],
  },
  {
    key: "contacto",
    title: "Contacto y responsables",
    fields: [
      { key: "contacto_nombre", label: "Responsable del proyecto", type: "text", required: true },
      { key: "contacto_email", label: "Email de contacto", type: "text", required: true },
      { key: "contacto_telefono", label: "Teléfono / WhatsApp", type: "text" },
      { key: "contacto_notas", label: "Algo más que quieras contarnos", type: "textarea" },
    ],
  },
];

export const BRIEFING_FIELDS: BriefingField[] = BRIEFING_SECTIONS.flatMap((s) => s.fields);

export const BRIEFING_FIELD_KEYS = new Set(BRIEFING_FIELDS.map((f) => f.key));

/** Se queda sólo con claves conocidas y recorta valores: el form del cliente no define el schema. */
export function sanitizeBriefingData(input: FormData): Record<string, string> {
  const data: Record<string, string> = {};
  for (const field of BRIEFING_FIELDS) {
    const value = input.get(field.key);
    if (typeof value !== "string") continue;
    const trimmed = value.trim().slice(0, 5000);
    if (trimmed) data[field.key] = trimmed;
  }
  return data;
}

export function missingRequiredFields(data: Record<string, string>): BriefingField[] {
  return BRIEFING_FIELDS.filter((f) => f.required && !data[f.key]);
}

export function briefingProgress(data: Record<string, string>): number {
  const total = BRIEFING_FIELDS.length;
  const filled = BRIEFING_FIELDS.filter((f) => data[f.key]).length;
  return total === 0 ? 0 : Math.round((filled / total) * 100);
}
