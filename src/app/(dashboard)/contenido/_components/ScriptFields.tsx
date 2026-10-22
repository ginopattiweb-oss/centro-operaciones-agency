import { Field, inputClass } from "@/components/paneles";
import type { ContentIdeaScript, ContentIdeaStatus } from "@/db/schema";

export const STATUS_LABEL: Record<ContentIdeaStatus, string> = {
  idea: "Idea",
  planificada: "Planificada",
  grabada: "Grabada",
  publicada: "Publicada",
  descartada: "Descartada",
};

/** Color de cada estado, igual en el calendario y en las tarjetas. Publicada es la meta: verde. */
export const STATUS_STYLE: Record<ContentIdeaStatus, string> = {
  idea: "border-border text-fg-muted",
  planificada: "border-accent/40 bg-accent/10 text-accent-ink",
  grabada: "border-warning/40 bg-warning/10 text-warning",
  publicada: "border-positive/40 bg-positive/10 text-positive",
  descartada: "border-border text-fg-muted opacity-50",
};

/**
 * Hook + guion en bullets + CTA + link del lead magnet. Los mismos campos al
 * cargar un video en el calendario y al editar el guion de cualquier idea.
 */
export function ScriptFields({ script }: { script?: ContentIdeaScript }) {
  return (
    <>
      <Field label="Hook" hint="La primera frase, lo que frena el scroll.">
        <input name="hook" defaultValue={script?.gancho ?? ""} placeholder="Ej.: Así hago las páginas legales en 5 minutos" className={inputClass} />
      </Field>
      <Field label="Guion" hint="Un bullet por línea, en el orden en que se dicen.">
        <textarea
          name="bullets"
          rows={6}
          defaultValue={script?.desarrollo.join("\n") ?? ""}
          placeholder={"El problema: …\nPor qué pasa: …\nLa solución: …"}
          className={inputClass}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="CTA">
          <input name="cta" defaultValue={script?.cta ?? ""} placeholder="Comentá 'LEGALES' y te paso…" className={inputClass} />
        </Field>
        <Field label="Link del lead magnet">
          <input
            name="leadMagnetUrl"
            type="text"
            inputMode="url"
            defaultValue={script?.leadMagnetUrl ?? ""}
            placeholder="https://…"
            className={inputClass}
          />
        </Field>
      </div>
    </>
  );
}
