"use client";

import { useActionState, useState, useTransition } from "react";
import { CalendarCheck, ChevronDown, ChevronUp, Clapperboard, ExternalLink, Link2, Pencil, Trash2 } from "lucide-react";
import { FormMessage, GhostButton, PrimaryButton, inputClass } from "@/components/paneles";
import type { ContentIdeaStatus } from "@/db/schema";
import type { ContentIdeaView } from "@/lib/contenido-ideas-queries";
import { setIdeaStatus, updateIdeaScript, type IdeasFormState } from "@/lib/actions/contenido-ideas";
import { formatShortDateStr, todayStringBA } from "@/lib/date";
import { STATUS_LABEL, STATUS_STYLE, ScriptFields } from "./ScriptFields";

const FORMAT_LABEL: Record<ContentIdeaView["format"], string> = {
  reel: "Reel",
  carrusel: "Carrusel",
  post: "Post",
  historia: "Historia",
};

/** A qué estado se puede pasar desde cada uno. */
const NEXT: Record<ContentIdeaStatus, ContentIdeaStatus[]> = {
  idea: ["planificada", "descartada"],
  planificada: ["grabada", "idea", "descartada"],
  grabada: ["publicada", "planificada"],
  publicada: [],
  descartada: ["idea"],
};

export function IdeaCard({ idea, defaultOpen = false }: { idea: ContentIdeaView; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [scheduling, setScheduling] = useState(false);
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(idea.scheduledFor ?? todayStringBA());
  const [isPending, startTransition] = useTransition();

  const move = (status: ContentIdeaStatus, scheduledFor?: string | null) =>
    startTransition(async () => {
      await setIdeaStatus(idea.id, status, scheduledFor);
      setScheduling(false);
    });

  return (
    <article className="flex flex-col rounded-card border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-3 px-5 py-4 text-left"
      >
        <span className="mt-0.5 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-fg-muted">
          {FORMAT_LABEL[idea.format]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-base text-fg">{idea.title}</span>
          {idea.hook && <span className="mt-1 block text-sm text-fg-muted">“{idea.hook}”</span>}
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-fg-muted">
            <span className={`rounded-full border px-2 py-0.5 ${STATUS_STYLE[idea.status]}`}>
              {STATUS_LABEL[idea.status]}
            </span>
            {idea.accountUsername && `@${idea.accountUsername}`}
            {idea.scheduledFor && ` · ${formatShortDateStr(idea.scheduledFor)}`}
          </span>
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-fg-muted" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-fg-muted" />
        )}
      </button>

      {open && (
        <div className="flex flex-col gap-5 border-t border-border px-5 py-4 text-sm">
          {idea.rationale && (
            <Section title="Por qué debería funcionar">
              <p className="whitespace-pre-line text-fg-muted">{idea.rationale}</p>
              {idea.sources.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {idea.sources.map((source) => (
                    <li key={source.mediaId} className="flex items-center gap-2 text-xs text-fg-muted">
                      <Clapperboard className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {source.caption?.split("\n")[0] || source.mediaId}
                        {source.views != null && ` · ${source.views} vistas`}
                      </span>
                      {source.permalink && (
                        <a href={source.permalink} target="_blank" rel="noopener noreferrer" className="hover:text-fg">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          {editing ? (
            <ScriptEditor idea={idea} onDone={() => setEditing(false)} />
          ) : (idea.script.gancho || idea.script.desarrollo.length > 0 || idea.script.cta || idea.script.leadMagnetUrl) ? (
            <Section title="Guion">
              <ol className="flex flex-col gap-2">
                <Line label="Gancho" text={idea.script.gancho} onScreen={idea.script.textoEnPantalla?.[0]} />
                {idea.script.desarrollo.map((block, index) => (
                  <Line
                    key={index}
                    label={`${index + 1}`}
                    text={block}
                    onScreen={idea.script.textoEnPantalla?.[index + 1]}
                  />
                ))}
                {idea.script.cierre && <Line label="Cierre" text={idea.script.cierre} />}
                {idea.script.cta && <Line label="CTA" text={idea.script.cta} />}
              </ol>
              {idea.script.leadMagnetUrl && (
                <a
                  href={idea.script.leadMagnetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex max-w-full items-center gap-1.5 text-xs text-fg-muted hover:text-fg"
                >
                  <Link2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Lead magnet: {idea.script.leadMagnetUrl}</span>
                </a>
              )}
            </Section>
          ) : null}

          {idea.notes && (
            <Section title="Notas">
              <p className="whitespace-pre-wrap text-fg-muted">{idea.notes}</p>
            </Section>
          )}

          {idea.caption && (
            <Section title="Caption">
              <p className="whitespace-pre-wrap text-fg-muted">{idea.caption}</p>
              {idea.hashtags && idea.hashtags.length > 0 && (
                <p className="mt-1 text-xs text-fg-muted">{idea.hashtags.map((tag) => `#${tag}`).join(" ")}</p>
              )}
            </Section>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            {!editing && !scheduling && (
              <GhostButton type="button" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />
                {idea.script.gancho || idea.script.desarrollo.length > 0 ? "Editar guion" : "Escribir guion"}
              </GhostButton>
            )}
            {scheduling ? (
              <>
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className={`${inputClass} w-auto`}
                />
                <GhostButton type="button" disabled={isPending || !date} onClick={() => move("planificada", date)}>
                  <CalendarCheck className="h-3.5 w-3.5" /> Confirmar
                </GhostButton>
                <GhostButton type="button" onClick={() => setScheduling(false)}>
                  Cancelar
                </GhostButton>
              </>
            ) : (
              NEXT[idea.status].map((status) =>
                status === "planificada" ? (
                  <GhostButton key={status} type="button" disabled={isPending} onClick={() => setScheduling(true)}>
                    <CalendarCheck className="h-3.5 w-3.5" />
                    {idea.status === "grabada" ? "Volver a planificada" : "Planificar"}
                  </GhostButton>
                ) : (
                  <GhostButton key={status} type="button" disabled={isPending} onClick={() => move(status)}>
                    {status === "descartada" && <Trash2 className="h-3.5 w-3.5" />}
                    {status === "descartada" ? "Descartar" : `Marcar ${STATUS_LABEL[status].toLowerCase()}`}
                  </GhostButton>
                )
              )
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function ScriptEditor({ idea, onDone }: { idea: ContentIdeaView; onDone: () => void }) {
  const [state, action, pending] = useActionState<IdeasFormState, FormData>(async (prev, formData) => {
    const result = await updateIdeaScript(prev, formData);
    if (result?.success) onDone();
    return result;
  }, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={idea.id} />
      <ScriptFields script={idea.script} />
      <div className="flex flex-wrap items-center gap-2">
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar guion"}
        </PrimaryButton>
        <GhostButton type="button" onClick={onDone}>
          Cancelar
        </GhostButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-fg-muted">{title}</h3>
      {children}
    </section>
  );
}

function Line({ label, text, onScreen }: { label: string; text: string; onScreen?: string }) {
  return (
    <li className="grid grid-cols-[3.5rem_1fr] gap-2">
      <span className="text-xs uppercase tracking-wide text-fg-muted">{label}</span>
      <span>
        <span className="text-fg">{text}</span>
        {onScreen && <span className="mt-0.5 block text-xs text-fg-muted">Texto en pantalla: {onScreen}</span>}
      </span>
    </li>
  );
}
