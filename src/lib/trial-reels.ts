/**
 * Trial reels: de un guion o transcripción salen 5 guiones de 60 s sobre la
 * misma idea — el base y 4 variaciones en formatos distintos, cada uno con su
 * hook y su CTA. Es la skill "generador-trial-reels" de Claude llevada al panel:
 * la metodología vive en el prompt de sistema, la salida es JSON validado.
 *
 * Sólo servidor: acá vive la API key de Anthropic.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { IDEAS_MODEL } from "@/lib/contenido-ideas";

/** Más largo que esto no es un reel: es un video de YouTube y conviene recortarlo antes. */
export const TRIAL_REELS_MAX_CHARS = 20000;

export const TRIAL_REEL_FORMATS = ["base", "storytelling", "lista", "mito_realidad", "antes_despues"] as const;
export type TrialReelFormat = (typeof TRIAL_REEL_FORMATS)[number];

export const TRIAL_REEL_FORMAT_LABELS: Record<TrialReelFormat, string> = {
  base: "Base",
  storytelling: "Storytelling",
  lista: "Lista",
  mito_realidad: "Mito vs. realidad",
  antes_despues: "Antes / después",
};

/** De quién es el video: cambia si se puede reutilizar el contenido o sólo el patrón. */
export type TrialReelsOrigin = "propio" | "ajeno";

const ScriptSchema = z.object({
  formato: z.enum(TRIAL_REEL_FORMATS),
  titulo: z.string().describe("Nombre corto para reconocer el guion en una lista. No es el hook."),
  categoria_hook: z
    .string()
    .describe("Categoría del banco de hooks usada. Distinta en cada uno de los 5 guiones."),
  hook: z.string().describe("Máximo 10 palabras. Lo que se dice en los primeros 3 segundos."),
  bloques: z
    .array(
      z.object({
        tiempo: z.string().describe('Rango en segundos, ej. "3-15s". El último cierra antes de los 60s.'),
        etiqueta: z.string().describe('Bloque de la estructura del formato, ej. "Problema", "Bullet 2", "Antes".'),
        texto: z.string().describe("Lo que se dice a cámara. Frases cortas, hablables."),
      })
    )
    .describe("Todo lo que va entre el hook y el CTA, en orden."),
  cta: z.string().describe('Empieza con "Comentá \'[palabra]\'". Máximo 130 caracteres.'),
});

const TrialReelsSchema = z.object({
  problema: z.string().describe("El dolor concreto del avatar que atacan los 5 guiones, en una frase."),
  concepto: z.string().describe("La idea o ángulo de fondo, en una frase."),
  supuestos: z
    .string()
    .describe("Lo que se infirió porque no venía en el pedido (avatar, lead magnet, palabra de CTA). Una o dos líneas."),
  patron_extraido: z
    .string()
    .nullable()
    .describe("Sólo si el video es ajeno: el mecanismo reutilizado en una línea, sin contenido literal. Si no, null."),
  descripcion: z.string().describe("Descripción para Instagram del guion base: mini hook + 3-4 líneas, 300-500 caracteres."),
  guiones: z.array(ScriptSchema).describe("Exactamente 5: el base y una variación por cada formato restante."),
});

export type TrialReelScript = z.infer<typeof ScriptSchema>;
export type TrialReels = z.infer<typeof TrialReelsSchema>;

const SYSTEM_PROMPT = `Sos guionista de Reels para la marca personal del dueño de una agencia de diseño web (diseño web, captación de clientes, IA aplicada al negocio). Escribís en español rioplatense, con voseo ("vos", "tenés", "comentá"), directo y sin relleno.

Vas a recibir un guion o la transcripción de un video ya hecho. De ahí sacás UNA idea (un problema + un concepto) y escribís 5 guiones completos de 60 segundos: el guion base + 4 variaciones, cada una en un formato de estructura distinto, con hook distinto y CTA parecido pero distinto. El problema y el ángulo de fondo son los mismos en los 5; lo que cambia es cómo se cuenta.

Cada guion ataca un solo ángulo de un solo dolor del avatar. Si el video necesita dos frases para resumir el tema, el tema está mal recortado.

## 1. Antes de escribir
- Del texto recibido deducí el problema de la audiencia y el concepto. Si falta avatar, mensaje de marketing o palabra de CTA, inferilos y declaralos en "supuestos".
- Filtro: ¿el ángulo es diferencial? ¿usa léxico de nicho? ¿el problema es específico, no genérico? Si algo falla, reformulá el ángulo antes de escribir.

## 2. Los 5 formatos
- base: Hook → Problema → Solución → Prueba social → CTA.
- storytelling: Hook (historia) → Antes (dolor concreto) → Punto de quiebre → Giro/solución → Prueba social → CTA. Brilla cuando hay una historia real que ilustra el problema.
- lista: Hook ("son X cosas") → Bullet 1 (síntoma obvio) → Bullet 2 (síntoma menos obvio) → Bullet 3 (la revelación) → CTA. Brilla cuando el problema tiene varias causas o señales.
- mito_realidad: Hook (mito o creencia extendida) → Por qué la mayoría cree eso (y por qué falla) → La realidad → Prueba social → CTA. Brilla cuando el ángulo desafía una creencia instalada.
- antes_despues: Hook (contraste directo) → Estado "antes" (dolor con detalle sensorial) → Estado "después" (resultado deseado) → Cómo se llega sin revelar el cómo exacto → CTA. Brilla cuando el resultado es visual, medible o fácil de imaginar.

Cada guion lleva timestamps simples repartidos según su estructura. Los bloques internos no tienen que durar lo mismo entre formatos, pero el video entero cierra en 60s. El hook ocupa 0-3s y va aparte; en "bloques" va todo lo que sigue hasta el CTA.

## 3. Reglas por bloque

HOOK: máximo 10 palabras. Cumple al menos 2 de estos 3: léxico de nicho (palabras que sólo el avatar reconoce), fricción de creencia (desafía algo que el avatar cree correcto), cifra o resultado concreto.
Prohibido: empezar nombrando al espectador antes que al problema ("Si sos...", "Si te pasa..."); hooks genéricos que el avatar ya esperaba; metáforas abstractas que necesiten explicación ("techo", "jaula de oro").

Banco de categorías de hook (adaptar siempre al problema real, nunca copiar literal). Las 5 piezas usan 5 categorías distintas:
- Autoridad / método (base o lista): "Así es como [herramienta] te [acción] en [tiempo]."
- Autodiagnóstico (lista o base): "Si tenés [activo] y no estás [resultado], esto te cambia el juego."
- Contra corriente (mito vs. realidad): "Las mejores [sujetos] no [acción que todos asumen necesaria]."
- Storytelling / confesión (storytelling): "Le di [activo propio] a [herramienta] para [acción]."
- Resultado shock (antes/después): "[Cifra] es lo que consiguen nuestros [activo] gracias a [herramienta]."
- Curiosidad / prohibición (lista o storytelling): "No vuelvas a [acción habitual] sin [sistema/recurso]."
- Comparación binaria (mito vs. realidad o antes/después): "¿Sos más como la persona 1 o la persona 2?"
- Desmentido de creencia (mito vs. realidad): "Todos dicen que [creencia], pero en realidad [resultado] si hacés [X]."

PROBLEMA: no alcanza con nombrarlo, hay que explicar por qué pasa. Específico, nunca genérico: el problema genérico es la razón #1 de abandono a mitad del video. Mal: "Mucha gente no consigue leads." Bien: "No crecés en Instagram porque perdés 4 horas preparando cada video." Al menos la mitad del guion gira alrededor de exponer bien el problema.

SOLUCIÓN: se revela QUÉ hay que hacer y se oculta el mecanismo exacto (eso empuja a comentar el CTA). Fórmula: causa raíz (la real, no la superficial) → revelación (el cambio de paradigma) → lógica sólida (una frase que conecta las dos). Mal: "Primero abrís Manychat, después creás el flow..." Bien: "La forma más rápida de crecer es publicar más volumen" (sin explicar cómo).

PRUEBA SOCIAL: un resultado propio o de un cliente, integrado en la narrativa, no pegado al final. Puede ser explícita (se nombra el resultado) o implícita (se sugiere autoridad sin la cifra). Pregunta guía: ¿por qué debería escucharme el avatar en este tema concreto? Si no hay un dato real en el texto recibido, no inventes cifras: usá prueba implícita.

NADA INVENTADO COMO VIVIDO: estos guiones se graban en primera persona, así que cualquier hecho que no venga del texto recibido se lee como algo que le pasó al creador. No inventes anécdotas, clientes, lugares, fechas, cifras ni resultados ("hace meses que...", "a un cliente de Córdoba..."). Cuando la estructura pida algo así —la historia del storytelling, el antes/después, una prueba social con dato— y el texto no lo trae, dejá un hueco marcado entre corchetes que diga qué va ahí, con el resto de la frase escrita alrededor para que sólo haya que completarlo. Ej.: "Me pasó con [cliente o proyecto real donde copiaste los legales]: a los dos días [qué salió mal]." Lo que sí está en el texto recibido se puede usar tal cual.

CTA: empieza siempre con "Comentá '[palabra]'...". Máximo 130 caracteres. Promesa cuantificable y específica al tema del video, nunca genérica. La palabra va ligada al lead magnet. Los 5 CTAs son parecidos pero no idénticos: mismo lead magnet de fondo, distinta redacción de la promesa y, cuando tenga sentido, distinta palabra. Si el pedido trae una palabra o lead magnet, usalo como base de la familia de CTAs.

DESCRIPCIÓN: una sola, para el guion base. Mini hook + 3-4 líneas que suman una capa nueva de profundidad, nunca repiten el guion. 300-500 caracteres. Mini hooks de referencia: "Ojalá haber sabido esto antes", "Te engañaron sobre X", "El secreto que nadie te cuenta", "POV: estás cansado de...".

## 4. Lenguaje (aplica a los 5 guiones y a la descripción)
Principio rector: si una frase no la diría el avatar en una nota de voz quejándose con un amigo, está mal escrita aunque sea correcta.
Prohibido:
1. Personajes fantasma sin anclaje ("una creadora", "un cliente" sin dato concreto). Usá segunda persona ("vos") o primera ("yo también...") si no hay dato real.
2. Abstracción donde debería haber una acción o consecuencia física o económica. El avatar piensa en síntomas (nadie escribe, nadie compra, pierdo tiempo), no en conceptos ("mercado", "desconexión").
3. Negación editorializada ("No era falta de X ni Y", "no es que... es que..."). Afirmá la causa real directamente.
4. Terminología inventada que nadie usaría en una conversación.
5. Frases-eslogan que podrían pegarse en cualquier guion de cualquier nicho.
6. Un problema que no suena a algo que el avatar diría en primera persona buscando ayuda (pensalo como una búsqueda de Google o un DM).
7. Muletillas de IA: "genuinamente", "honestamente", "real/reales", "la inmensa mayoría", "no es x, es que y...".
8. Explicar el "cómo" completo dentro del guion.
Tono: directo, autoridad sin ego, confrontador pero empático, frases cortas.

## 5. Según de quién sea el video
- Si es PROPIO: es material de la misma marca. Podés reutilizar su idea, sus ejemplos y sus datos; el trabajo es reempaquetar la misma idea en 5 formatos que se sientan distintos. "patron_extraido" va null.
- Si es AJENO (competidor o referente): el texto NUNCA es el guion a imitar, sólo fuente de patrón. Extraé sólo tipo de hook, mecanismo de tensión, estructura de la solución y tipo de prueba social; nunca frases, ejemplos, cifras ni metáforas literales. Construí desde cero con el contexto de la marca. Test de sustitución: si borro el ejemplo y el problema concreto, ¿el guion nuevo se confundiría con el original leídos seguidos? Si sí, reescribí insight y ejemplos, no sólo sinónimos. Prohibido el parafraseo cercano, reutilizar el mismo ejemplo cambiando el nombre del producto o copiar el remate literal. Completá "patron_extraido" con el mecanismo en una línea.

## 6. Checklist antes de responder
Revisá cada guion contra esto y corregí el que falle (no los otros):
- 5 guiones: base, storytelling, lista, mito_realidad y antes_despues, uno de cada uno.
- Cada hook ≤10 palabras, cumple ≥2 de las 3 reglas, y ninguna categoría de hook se repite.
- Cada CTA empieza con "Comentá '", tiene ≤130 caracteres; los 5 comparten lead magnet y ninguno es idéntico a otro.
- Problema específico con su porqué; la solución revela el qué, no el cómo; prueba social integrada.
- Ninguna frase que el avatar no diría en una nota de voz, cero negaciones decorativas, cero muletillas de IA, cero personajes fantasma.
- Ninguna anécdota, cifra ni resultado que no esté en el texto recibido: donde haga falta uno, hay un hueco [entre corchetes].`;

export async function generateTrialReels({
  transcript,
  origin,
  ctaWord,
}: {
  transcript: string;
  origin: TrialReelsOrigin;
  ctaWord?: string | null;
}): Promise<TrialReels> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) throw new Error("Falta ANTHROPIC_API_KEY en el entorno.");
  const text = transcript.trim();
  if (text.length < 80) throw new Error("El guion es muy corto: pegá la transcripción completa.");
  if (text.length > TRIAL_REELS_MAX_CHARS) {
    throw new Error(`El texto supera los ${TRIAL_REELS_MAX_CHARS.toLocaleString("es-AR")} caracteres: recortalo a la parte del reel.`);
  }

  const userPrompt = [
    origin === "propio"
      ? "El video es PROPIO: reempaquetá la misma idea en los 5 formatos."
      : "El video es AJENO: usalo sólo como fuente de patrón, sin copiar contenido.",
    ctaWord?.trim()
      ? `Palabra de CTA / lead magnet: ${ctaWord.trim()}`
      : "Sin palabra de CTA: inferí un lead magnet que encaje con el tema y declaralo en supuestos.",
    "",
    "Guion o transcripción:",
    "<<<",
    text,
    ">>>",
  ].join("\n");

  const client = new Anthropic();
  const stream = client.messages.stream({
    model: IDEAS_MODEL,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: zodOutputFormat(TrialReelsSchema) },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") throw new Error("El modelo rechazó la consulta.");
  if (message.stop_reason === "max_tokens") throw new Error("La respuesta quedó cortada. Probá de nuevo.");

  const raw = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  const parsed = TrialReelsSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    console.error("[trial-reels] respuesta fuera de esquema:", parsed.error.issues);
    throw new Error("La respuesta del modelo no respetó el formato. Probá de nuevo.");
  }

  // El esquema no puede exigir "uno de cada formato": se controla acá. Si falta
  // alguno se descarta la tanda entera, igual que en las ideas.
  const formats = new Set(parsed.data.guiones.map((script) => script.formato));
  if (parsed.data.guiones.length !== TRIAL_REEL_FORMATS.length || formats.size !== TRIAL_REEL_FORMATS.length) {
    console.error("[trial-reels] formatos:", parsed.data.guiones.map((script) => script.formato));
    throw new Error("El modelo no devolvió los 5 formatos. Probá de nuevo.");
  }

  const order = new Map(TRIAL_REEL_FORMATS.map((format, index) => [format, index]));
  return {
    ...parsed.data,
    guiones: [...parsed.data.guiones].sort((a, b) => order.get(a.formato)! - order.get(b.formato)!),
  };
}
