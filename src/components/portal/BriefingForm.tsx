"use client";

import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { BRIEFING_SECTIONS } from "@/lib/briefing";
import { savePortalBriefing } from "@/lib/actions/portal";

export function BriefingForm({
  initialData,
  status,
  submittedAt,
}: {
  initialData: Record<string, string>;
  status: "borrador" | "enviado";
  submittedAt: string | null;
}) {
  const [state, formAction, pending] = useActionState(savePortalBriefing, null);
  const [intent, setIntent] = useState<"guardar" | "enviar">("guardar");
  const sent = status === "enviado";

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="intent" value={intent} />

      {sent && (
        <div className="flex items-start gap-3 rounded-card border border-accent/40 bg-accent/10 px-5 py-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink" />
          <div className="text-sm text-fg">
            Ya enviaste el briefing{submittedAt ? ` el ${submittedAt}` : ""}. Podés seguir
            editándolo y volver a enviarlo si algo cambió.
          </div>
        </div>
      )}

      {BRIEFING_SECTIONS.map((section) => (
        <section key={section.key} className="rounded-card border border-border bg-surface p-5 md:p-6">
          <h3 className="mb-5 font-heading text-lg text-fg">{section.title}</h3>
          <div className="flex flex-col gap-5">
            {section.fields.map((field) => (
              <div key={field.key} className="flex flex-col gap-1.5">
                <label htmlFor={field.key} className="text-sm text-fg">
                  {field.label}
                  {field.required && <span className="ml-1 text-accent-ink">*</span>}
                </label>
                {field.help && <p className="text-xs text-fg-muted">{field.help}</p>}
                {field.type === "textarea" ? (
                  <textarea
                    id={field.key}
                    name={field.key}
                    rows={4}
                    defaultValue={initialData[field.key] ?? ""}
                    className="w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent-ink"
                  />
                ) : (
                  <input
                    id={field.key}
                    name={field.key}
                    type={field.type === "url" ? "url" : "text"}
                    defaultValue={initialData[field.key] ?? ""}
                    className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent-ink"
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      {state?.error && <p className="text-sm text-accent-ink">{state.error}</p>}
      {state?.success && <p className="text-sm text-accent-ink">{state.success}</p>}

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t border-border bg-bg/95 px-4 py-4 backdrop-blur sm:flex-row sm:justify-end md:-mx-8 md:px-8">
        <button
          type="submit"
          name="submit-draft"
          disabled={pending}
          onClick={() => setIntent("guardar")}
          className="rounded-lg border border-border px-5 py-3 text-sm font-medium text-fg hover:border-accent/60 disabled:opacity-50"
        >
          {pending && intent === "guardar" ? "Guardando..." : "Guardar borrador"}
        </button>
        <button
          type="submit"
          name="submit-final"
          disabled={pending}
          onClick={() => setIntent("enviar")}
          className="rounded-lg bg-accent px-5 py-3 text-sm font-medium text-on-accent hover:brightness-110 disabled:opacity-50"
        >
          {pending && intent === "enviar"
            ? "Enviando..."
            : sent
              ? "Reenviar briefing"
              : "Enviar briefing"}
        </button>
      </div>
    </form>
  );
}
