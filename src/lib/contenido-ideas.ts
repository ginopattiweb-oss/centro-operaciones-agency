/**
 * Generación de ideas de contenido con guion a partir de lo ya publicado.
 *
 * Toma las últimas publicaciones de Instagram con sus métricas, se las da a
 * Claude ordenadas por rendimiento y le pide ideas nuevas que sigan la línea
 * de lo que funcionó. La salida es JSON validado con Zod: si el modelo
 * devuelve algo fuera de esquema, se descarta la corrida entera antes que
 * guardar ideas a medias.
 *
 * Sólo servidor: acá vive la API key de Anthropic.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ContentIdeaSource } from "@/db/schema";
import { IDEA_COUNT_DEFAULT, IDEA_COUNT_MAX } from "@/lib/contenido-config";
import { formatShortDateStr } from "@/lib/date";
import { parseMediaTimestamp, type RankedMedia } from "@/lib/instagram-dashboard";

export const IDEAS_MODEL = "claude-opus-5";
/** Publicaciones que entran al prompt. Más no ayuda: el patrón se ve con estas. */
const MAX_SOURCES = 30;


const IdeaSchema = z.object({
  titulo: z.string().describe("Nombre corto y concreto de la idea, para reconocerla en una lista."),
  formato: z.enum(["reel", "carrusel", "post", "historia"]),
  gancho: z
    .string()
    .describe("Primera frase, dicha a cámara o en texto. Tiene que frenar el scroll en 3 segundos."),
  por_que: z
    .string()
    .describe(
      "Por qué debería funcionar, citando explícitamente qué publicaciones anteriores (por su descripción) muestran ese patrón."
    ),
  guion: z.object({
    gancho: z.string(),
    desarrollo: z
      .array(z.string())
      .describe("Bloques en el orden en que se dicen. Frases cortas, hablables, sin relleno."),
    cierre: z.string(),
    cta: z.string().describe("Llamado a la acción concreto, en el estilo que la cuenta ya usa."),
    texto_en_pantalla: z.array(z.string()).describe("Rótulos sugeridos, uno por bloque. Vacío si no aplica."),
  }),
  caption: z.string().describe("Descripción para publicar, en el tono de la cuenta."),
  hashtags: z.array(z.string()).describe("Sin #, entre 3 y 8."),
  basado_en: z
    .array(z.string())
    .describe("IDs de las publicaciones en las que se basa, tomados de la lista dada."),
});

const IdeasSchema = z.object({ ideas: z.array(IdeaSchema) });

export type GeneratedIdea = z.infer<typeof IdeaSchema>;

function isConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function isIdeasGeneratorConfigured(): boolean {
  return isConfigured();
}

function describeMedia(item: RankedMedia): string {
  const kind =
    item.productType === "REELS" ? "reel" : item.mediaType === "CAROUSEL_ALBUM" ? "carrusel" : "post";
  const date = formatShortDateStr(parseMediaTimestamp(item.timestamp).toISOString().slice(0, 10));
  const metrics = [
    item.insights?.views != null && `${item.insights.views} vistas`,
    item.insights?.reach != null && `${item.insights.reach} alcance`,
    item.likeCount != null && `${item.likeCount} me gusta`,
    item.commentsCount != null && `${item.commentsCount} comentarios`,
    item.insights?.saved != null && `${item.insights.saved} guardados`,
    item.insights?.shares != null && `${item.insights.shares} compartidos`,
  ]
    .filter(Boolean)
    .join(", ");
  const caption = (item.caption ?? "(sin descripción)").replace(/\s+/g, " ").trim().slice(0, 600);
  return `- id: ${item.id} · ${kind} · ${date} · ${metrics || "sin métricas"}\n  descripción: ${caption}`;
}

const SYSTEM_PROMPT = `Sos estratega de contenido para redes sociales de una agencia de diseño y desarrollo web en Argentina. Escribís en español rioplatense, con voseo, directo y sin relleno.

Vas a recibir las publicaciones recientes de una cuenta de Instagram con sus métricas, ordenadas de mayor a menor rendimiento, y tenés que proponer ideas NUEVAS de contenido con guion completo.

Cómo trabajar:
- Primero detectá qué patrones explican el rendimiento: temas, formatos, tipo de gancho, CTA ("comentá X y te paso..."), duración implícita, tono. Las ideas tienen que apoyarse en esos patrones, no en generalidades.
- Cada idea tiene que ser distinta de las demás y de lo ya publicado: misma línea, otro ángulo. No repitas una publicación existente con otras palabras.
- El guion es para grabar: frases cortas, hablables, en el orden en que se dicen. Nada de "en este video vamos a ver".
- El gancho tiene que funcionar solo, en 3 segundos, sin contexto.
- Si la cuenta usa un mecanismo de CTA que funcionó (ej. "comentá PROMPT"), reutilizalo con una palabra clave nueva.
- En "por_que" citá publicaciones concretas por su descripción y sus números. En "basado_en" poné sus IDs exactos.
- Si el usuario da una consigna, es prioritaria: ajustá tema y formato a eso sin perder lo que aprendiste de las métricas.`;

export type GenerationResult = {
  ideas: GeneratedIdea[];
  sources: ContentIdeaSource[];
  usage: { input: number; output: number };
};

/**
 * Genera `count` ideas para una cuenta. `media` debería venir con insights y
 * ordenada como salga: acá se reordena por vistas y se recorta.
 */
export async function generateContentIdeas({
  media,
  accountUsername,
  brief,
  count = IDEA_COUNT_DEFAULT,
}: {
  media: RankedMedia[];
  accountUsername: string | null;
  brief?: string | null;
  count?: number;
}): Promise<GenerationResult> {
  if (!isConfigured()) throw new Error("Falta ANTHROPIC_API_KEY en el entorno.");
  if (media.length === 0) throw new Error("No hay publicaciones para analizar todavía.");

  const ranked = [...media]
    .sort((a, b) => (b.insights?.views ?? b.likeCount ?? -1) - (a.insights?.views ?? a.likeCount ?? -1))
    .slice(0, MAX_SOURCES);

  const n = Math.min(Math.max(1, count), IDEA_COUNT_MAX);
  const userPrompt = [
    `Cuenta: @${accountUsername ?? "instagram"}.`,
    "",
    `Publicaciones recientes (${ranked.length}), de mayor a menor rendimiento:`,
    ...ranked.map(describeMedia),
    "",
    brief?.trim() ? `Consigna del equipo: ${brief.trim()}` : "Sin consigna extra: seguí lo que muestran las métricas.",
    "",
    `Proponé exactamente ${n} ideas.`,
  ].join("\n");

  const client = new Anthropic();
  const stream = client.messages.stream({
    model: IDEAS_MODEL,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: zodOutputFormat(IdeasSchema) },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error("El modelo rechazó la consulta.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("La respuesta quedó cortada: pedí menos ideas.");
  }

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  const parsed = IdeasSchema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    console.error("[ideas] respuesta fuera de esquema:", parsed.error.issues);
    throw new Error("La respuesta del modelo no respetó el formato. Probá de nuevo.");
  }

  const byId = new Map(ranked.map((item) => [item.id, item]));
  const sources: ContentIdeaSource[] = ranked.map((item) => ({
    mediaId: item.id,
    caption: item.caption,
    permalink: item.permalink,
    views: item.insights?.views ?? null,
    likes: item.likeCount,
  }));

  return {
    ideas: parsed.data.ideas.map((idea) => ({
      ...idea,
      basado_en: idea.basado_en.filter((id) => byId.has(id)),
    })),
    sources,
    usage: { input: message.usage.input_tokens, output: message.usage.output_tokens },
  };
}

export type ReferencePost = {
  username: string;
  caption: string | null;
  permalink: string | null;
  likeCount: number | null;
  commentsCount: number | null;
  performanceRatio: number | null;
};

const ADAPT_PROMPT = `Sos estratega de contenido para redes sociales de una agencia de diseño y desarrollo web en Argentina. Escribís en español rioplatense, con voseo, directo y sin relleno.

Te van a dar UNA publicación ajena que funcionó (de una cuenta de referencia) y las publicaciones recientes de la cuenta propia con sus métricas. Tenés que adaptar la idea de la referencia a la marca propia: mismo mecanismo (qué la hace funcionar: el gancho, la estructura, la promesa), pero con el tema, el tono y el mecanismo de CTA que la cuenta propia ya usa. Nunca copies frases de la referencia.

El guion es para grabar: frases cortas, hablables, en el orden en que se dicen. El gancho tiene que funcionar solo, en 3 segundos. En "por_que" explicá qué tomaste de la referencia y qué de lo propio. "basado_en" queda vacío.`;

/** Una idea propia a partir de una publicación ajena. */
export async function adaptReferenceIdea({
  reference,
  media,
  accountUsername,
}: {
  reference: ReferencePost;
  media: RankedMedia[];
  accountUsername: string | null;
}): Promise<GeneratedIdea> {
  if (!isConfigured()) throw new Error("Falta ANTHROPIC_API_KEY en el entorno.");

  const ranked = [...media]
    .sort((a, b) => (b.insights?.views ?? b.likeCount ?? -1) - (a.insights?.views ?? a.likeCount ?? -1))
    .slice(0, 15);

  const userPrompt = [
    `Cuenta propia: @${accountUsername ?? "instagram"}.`,
    "",
    `Referencia: @${reference.username}`,
    `- me gusta: ${reference.likeCount ?? "?"} · comentarios: ${reference.commentsCount ?? "?"}` +
      (reference.performanceRatio ? ` · ${reference.performanceRatio.toFixed(1)}x la mediana de su cuenta` : ""),
    `- descripción: ${(reference.caption ?? "(sin descripción)").replace(/\s+/g, " ").trim().slice(0, 1500)}`,
    "",
    `Publicaciones propias recientes (${ranked.length}), de mayor a menor rendimiento:`,
    ...ranked.map(describeMedia),
    "",
    "Proponé exactamente 1 idea.",
  ].join("\n");

  const client = new Anthropic();
  const stream = client.messages.stream({
    model: IDEAS_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: zodOutputFormat(IdeasSchema) },
    system: ADAPT_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("El modelo rechazó la consulta.");

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  const parsed = IdeasSchema.safeParse(JSON.parse(text));
  if (!parsed.success || parsed.data.ideas.length === 0) {
    throw new Error("La respuesta del modelo no respetó el formato. Probá de nuevo.");
  }
  return { ...parsed.data.ideas[0], basado_en: [] };
}
