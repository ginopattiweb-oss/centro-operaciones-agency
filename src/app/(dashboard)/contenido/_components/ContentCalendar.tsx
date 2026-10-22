"use client";

/**
 * Calendario de publicación: los videos con fecha, mes a mes. Se agrega un
 * video nuevo o se agenda una idea ya generada desde cada día, y se cambia de
 * fecha arrastrando. Todo vive en `content_ideas.scheduled_for`: el calendario
 * y la lista de Planificar son dos vistas de las mismas filas.
 */
import { useActionState, useOptimistic, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  Field,
  FormMessage,
  GhostButton,
  Modal,
  PrimaryButton,
  inputClass,
} from "@/components/paneles";
import type { ContentIdeaFormat, ContentIdeaStatus } from "@/db/schema";
import { createCalendarVideo, scheduleIdea, unscheduleIdea, type IdeasFormState } from "@/lib/actions/contenido-ideas";
import type { ContentIdeaView } from "@/lib/contenido-ideas-queries";
import { addDaysToDateStr, formatFullDateStr, todayStringBA } from "@/lib/date";
import { addMonths, formatMonthLong, monthBounds, monthOf } from "@/lib/presupuesto";
import { IdeaCard } from "./IdeaCard";
import { STATUS_STYLE, ScriptFields } from "./ScriptFields";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const FORMAT_SHORT: Record<ContentIdeaFormat, string> = {
  reel: "Reel",
  carrusel: "Carr.",
  post: "Post",
  historia: "Hist.",
};


const DRAG_TYPE = "application/x-content-idea";

/** Semanas completas (lunes a domingo) que cubren el mes. */
function calendarDays(month: string): string[] {
  const { first, last } = monthBounds(month);
  const weekday = new Date(`${first}T12:00:00Z`).getUTCDay();
  let day = addDaysToDateStr(first, -((weekday + 6) % 7));
  const days: string[] = [];
  while (day <= last || days.length % 7 !== 0) {
    days.push(day);
    day = addDaysToDateStr(day, 1);
  }
  return days;
}

export function ContentCalendar({
  ideas,
  accounts,
}: {
  ideas: ContentIdeaView[];
  accounts: { id: string; username: string | null }[];
}) {
  const today = todayStringBA();
  const [month, setMonth] = useState(monthOf(today));
  const [addingOn, setAddingOn] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Mover un video se ve en el acto; la página se revalida detrás.
  const [optimistic, moveOptimistic] = useOptimistic(
    ideas,
    (current, { id, date }: { id: string; date: string }) =>
      current.map((idea) =>
        idea.id === id
          ? { ...idea, scheduledFor: date, status: idea.status === "idea" ? "planificada" : idea.status }
          : idea
      )
  );

  const byDay = new Map<string, ContentIdeaView[]>();
  for (const idea of optimistic) {
    if (!idea.scheduledFor || idea.status === "descartada") continue;
    byDay.set(idea.scheduledFor, [...(byDay.get(idea.scheduledFor) ?? []), idea]);
  }
  const unscheduled = optimistic.filter((idea) => idea.status === "idea" && !idea.scheduledFor);
  const opened = optimistic.find((idea) => idea.id === openId) ?? null;

  function move(id: string, date: string) {
    startTransition(async () => {
      moveOptimistic({ id, date });
      await scheduleIdea(id, date);
    });
  }

  function onDrop(event: React.DragEvent, date: string) {
    event.preventDefault();
    setDragOver(null);
    const id = event.dataTransfer.getData(DRAG_TYPE);
    if (id) move(id, date);
  }

  const days = calendarDays(month);
  const monthCount = optimistic.filter((idea) => idea.scheduledFor && monthOf(idea.scheduledFor) === month).length;

  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="font-heading text-base text-fg">Calendario</h2>
          <p className="text-xs text-fg-muted">
            {monthCount === 0 ? "Nada agendado este mes." : `${monthCount} videos este mes.`} Arrastrá un video para
            cambiarlo de día.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            <button
              type="button"
              onClick={() => setMonth(addMonths(month, -1))}
              className="rounded-md p-1.5 text-fg-muted hover:text-fg"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[8.5rem] text-center text-sm capitalize text-fg">{formatMonthLong(month)}</span>
            <button
              type="button"
              onClick={() => setMonth(addMonths(month, 1))}
              className="rounded-md p-1.5 text-fg-muted hover:text-fg"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {month !== monthOf(today) && (
            <GhostButton type="button" onClick={() => setMonth(monthOf(today))}>
              Hoy
            </GhostButton>
          )}
          <PrimaryButton type="button" onClick={() => setAddingOn(today)}>
            <Plus className="h-3.5 w-3.5" />
            Video
          </PrimaryButton>
        </div>
      </header>

      {unscheduled.length > 0 && (
        <div className="flex flex-col gap-1.5 px-5">
          <p className="text-[11px] uppercase tracking-wide text-fg-muted">
            Ideas sin fecha · arrastralas a un día
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unscheduled.map((idea) => (
              <Chip key={idea.id} idea={idea} onOpen={() => setOpenId(idea.id)} />
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto px-5 pb-5">
        <div className="grid min-w-[44rem] grid-cols-7 overflow-hidden rounded-lg border border-border">
          {WEEKDAYS.map((weekday) => (
            <div
              key={weekday}
              className="border-b border-border bg-bg px-2 py-1.5 text-[11px] uppercase tracking-wide text-fg-muted"
            >
              {weekday}
            </div>
          ))}
          {days.map((day, index) => {
            const inMonth = monthOf(day) === month;
            const items = byDay.get(day) ?? [];
            return (
              <div
                key={day}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(day);
                }}
                onDragLeave={() => setDragOver((current) => (current === day ? null : current))}
                onDrop={(event) => onDrop(event, day)}
                className={`group flex min-h-[6.5rem] flex-col gap-1 border-border p-1.5 ${
                  index % 7 !== 6 ? "border-r" : ""
                } ${index < days.length - 7 ? "border-b" : ""} ${
                  dragOver === day ? "bg-accent/10" : inMonth ? "" : "bg-bg/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs tabular-nums ${
                      day === today
                        ? "bg-accent text-on-accent"
                        : inMonth
                          ? "text-fg"
                          : "text-fg-muted opacity-60"
                    }`}
                  >
                    {Number(day.slice(8, 10))}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAddingOn(day)}
                    className="rounded p-0.5 text-fg-muted opacity-0 transition hover:text-fg focus:opacity-100 group-hover:opacity-100"
                    aria-label={`Agregar video el ${formatFullDateStr(day)}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                {items.map((idea) => (
                  <Chip key={idea.id} idea={idea} onOpen={() => setOpenId(idea.id)} />
                ))}
              </div>
            );
          })}
        </div>
        <p className="mt-2 flex flex-wrap gap-3 text-[11px] text-fg-muted">
          <Legend status="planificada" label="Planificado" />
          <Legend status="grabada" label="Grabado" />
          <Legend status="publicada" label="Publicado" />
        </p>
      </div>

      {addingOn && (
        <AddModal
          date={addingOn}
          accounts={accounts}
          unscheduled={unscheduled}
          onSchedule={(id, date) => {
            move(id, date);
            setAddingOn(null);
          }}
          onClose={() => setAddingOn(null)}
        />
      )}

      {opened && (
        <Modal title={opened.scheduledFor ? formatFullDateStr(opened.scheduledFor) : "Sin fecha"} onClose={() => setOpenId(null)}>
          <div className="flex flex-col gap-3">
            <IdeaCard key={opened.id} idea={opened} defaultOpen />
            {opened.scheduledFor && (
              <GhostButton
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    await unscheduleIdea(opened.id);
                    setOpenId(null);
                  })
                }
              >
                Sacar del calendario
              </GhostButton>
            )}
          </div>
        </Modal>
      )}
    </section>
  );
}

function Chip({ idea, onOpen }: { idea: ContentIdeaView; onOpen: () => void }) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_TYPE, idea.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onClick={onOpen}
      title={idea.title}
      className={`flex w-full min-w-0 cursor-grab items-center gap-1 rounded border px-1.5 py-1 text-left text-[11px] leading-tight active:cursor-grabbing ${
        STATUS_STYLE[idea.status]
      } ${idea.scheduledFor ? "" : "w-auto max-w-[16rem]"}`}
    >
      <span className="shrink-0 opacity-70">{FORMAT_SHORT[idea.format]}</span>
      <span className="truncate">{idea.title}</span>
    </button>
  );
}

function Legend({ status, label }: { status: ContentIdeaStatus; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-sm border ${STATUS_STYLE[status]}`} />
      {label}
    </span>
  );
}

/** Agregar un día: un video nuevo cargado a mano, o una idea que ya existe. */
function AddModal({
  date,
  accounts,
  unscheduled,
  onSchedule,
  onClose,
}: {
  date: string;
  accounts: { id: string; username: string | null }[];
  unscheduled: ContentIdeaView[];
  onSchedule: (id: string, date: string) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"nuevo" | "idea">("nuevo");
  const [day, setDay] = useState(date);
  const [state, action, pending] = useActionState<IdeasFormState, FormData>(async (prev, formData) => {
    const result = await createCalendarVideo(prev, formData);
    if (result?.success) onClose();
    return result;
  }, null);

  return (
    <Modal title="Agendar video" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex gap-1 self-start rounded-lg border border-border p-1">
          {(["nuevo", "idea"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              className={`rounded-md px-3 py-1.5 text-xs transition ${
                mode === option ? "bg-accent/15 text-accent-ink" : "text-fg-muted hover:text-fg"
              }`}
            >
              {option === "nuevo" ? "Video nuevo" : `Elegir una idea (${unscheduled.length})`}
            </button>
          ))}
        </div>

        <Field label="Fecha">
          <input
            type="date"
            value={day}
            onChange={(event) => setDay(event.target.value)}
            className={`${inputClass} w-auto`}
          />
        </Field>

        {mode === "nuevo" ? (
          <form action={action} className="flex flex-col gap-4">
            <input type="hidden" name="date" value={day} />
            <Field label="Título">
              <input name="title" required autoFocus placeholder="De qué trata el video" className={inputClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Formato">
                <select name="format" defaultValue="reel" className={inputClass}>
                  <option value="reel">Reel</option>
                  <option value="carrusel">Carrusel</option>
                  <option value="post">Post</option>
                  <option value="historia">Historia</option>
                </select>
              </Field>
              <Field label="Cuenta">
                <select name="accountId" defaultValue={accounts[0]?.id ?? ""} className={inputClass}>
                  <option value="">Sin cuenta</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      @{account.username ?? "sin usuario"}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <ScriptFields />
            <Field label="Notas (opcional)">
              <textarea name="notes" rows={3} placeholder="Guion, referencias, qué grabar" className={inputClass} />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <PrimaryButton type="submit" disabled={pending || !day}>
                {pending ? "Guardando…" : "Agendar"}
              </PrimaryButton>
              <FormMessage state={state} />
            </div>
          </form>
        ) : unscheduled.length === 0 ? (
          <p className="text-sm text-fg-muted">
            No hay ideas sin fecha. Generá ideas o trial reels más abajo, o cargá un video nuevo.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {unscheduled.map((idea) => (
              <li key={idea.id}>
                <button
                  type="button"
                  disabled={!day}
                  onClick={() => onSchedule(idea.id, day)}
                  className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-accent/10"
                >
                  <span className="text-sm text-fg">{idea.title}</span>
                  {idea.hook && <span className="line-clamp-1 text-xs text-fg-muted">“{idea.hook}”</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
