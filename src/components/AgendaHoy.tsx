import { CalendarDays, MapPin, Video } from "lucide-react";
import {
  formatEventTime,
  getTodayEvents,
  isCalendarConfigured,
  isEventNow,
  isEventPast,
} from "@/lib/calendar";

/** Agenda del día desde Google Calendar. Es lento: envolver en <Suspense>. */
export async function AgendaHoy() {
  if (!isCalendarConfigured()) {
    return (
      <p className="text-sm text-fg-muted">
        Falta configurar <code>GOOGLE_CALENDAR_IDS</code> en el entorno para ver tu agenda.
      </p>
    );
  }

  const result = await getTodayEvents();

  if (!result.ok) {
    return (
      <div className="rounded-card border border-border bg-surface px-5 py-4">
        <p className="text-sm text-fg-muted">
          No pudimos traer tu agenda: <span className="text-fg">{result.error}</span>
        </p>
      </div>
    );
  }

  if (result.events.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-card border border-border bg-surface px-5 py-4">
        <CalendarDays className="h-4 w-4 shrink-0 text-fg-muted" />
        <p className="text-sm text-fg-muted">No tenés eventos hoy.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
      {result.events.map((event) => {
        const past = isEventPast(event);
        const now = isEventNow(event);
        return (
          <div
            key={event.id}
            className={`flex items-start gap-4 px-4 py-3 ${past ? "opacity-45" : ""}`}
          >
            <div className="w-24 shrink-0 pt-0.5">
              <p
                className={`text-xs tabular-nums ${now ? "text-accent-ink" : "text-fg-muted"}`}
              >
                {formatEventTime(event)}
              </p>
              {now && (
                <p className="mt-0.5 text-[10px] uppercase tracking-wider text-accent-ink">
                  Ahora
                </p>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-fg">{event.title}</p>
              {event.location && (
                <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-fg-muted">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {event.location}
                </p>
              )}
            </div>

            {event.meetUrl && !past && (
              <a
                href={event.meetUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-fg-muted hover:border-accent/50 hover:text-accent-ink"
              >
                <Video className="h-3.5 w-3.5" />
                Entrar
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AgendaHoySkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 2 }).map((_, index) => (
        <div
          key={index}
          className="h-14 animate-pulse rounded-card border border-border bg-surface"
        />
      ))}
    </div>
  );
}
