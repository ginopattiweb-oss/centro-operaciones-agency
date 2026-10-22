// Lectura de Google Calendar vía REST, con la misma service account que Analytics.
// El calendario tiene que estar compartido con el email de la service account.
import { formatInTimeZone } from "date-fns-tz";
import { TZ } from "@/lib/date";
import {
  getAccessToken,
  getServiceAccountEmail,
  isGoogleConfigured,
  SCOPE_CALENDAR,
} from "@/lib/google-auth";

export type CalendarEvent = {
  id: string;
  title: string;
  /** null en eventos de día completo. */
  start: Date | null;
  end: Date | null;
  allDay: boolean;
  location: string | null;
  /** Link de Meet o del evento, para entrar a la llamada de un click. */
  meetUrl: string | null;
  htmlLink: string | null;
  calendarId: string;
};

export type CalendarResult =
  | { ok: true; events: CalendarEvent[] }
  | { ok: false; error: string };

/** IDs de calendario a leer. Normalmente tu propio email. */
export function getCalendarIds(): string[] {
  return (process.env.GOOGLE_CALENDAR_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function isCalendarConfigured(): boolean {
  return isGoogleConfigured() && getCalendarIds().length > 0;
}

type ApiEvent = {
  id?: string;
  status?: string;
  summary?: string;
  location?: string;
  hangoutLink?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { self?: boolean; responseStatus?: string }[];
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
};

function extractMeetUrl(event: ApiEvent): string | null {
  if (event.hangoutLink) return event.hangoutLink;
  const video = event.conferenceData?.entryPoints?.find(
    (entry) => entry.entryPointType === "video"
  );
  return video?.uri ?? null;
}

async function fetchCalendar(calendarId: string, from: Date, to: Date): Promise<ApiEvent[]> {
  const token = await getAccessToken(SCOPE_CALENDAR);
  const params = new URLSearchParams({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    // Expande las series repetidas en sus ocurrencias reales del día.
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
    timeZone: TZ,
  });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events?${params}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      // La agenda cambia durante el día: cache corto.
      next: { revalidate: 300 },
    }
  );

  const payload = (await response.json()) as {
    items?: ApiEvent[];
    error?: { message?: string };
  };

  if (!response.ok) {
    // Google devuelve 404 (no 403) cuando no hay acceso, para no revelar si el calendario existe.
    if (response.status === 404 || response.status === 403) {
      const account = getServiceAccountEmail();
      throw new Error(
        `no tenemos acceso a "${calendarId}". Compartilo con ${
          account ?? "la service account"
        } con permiso de ver todos los detalles.`
      );
    }
    throw new Error(payload.error?.message ?? `Calendar respondió ${response.status}.`);
  }
  return payload.items ?? [];
}

/** Eventos de hoy (00:00 a 23:59 en Buenos Aires) de todos los calendarios configurados. */
export async function getTodayEvents(): Promise<CalendarResult> {
  const calendarIds = getCalendarIds();
  if (calendarIds.length === 0) {
    return { ok: false, error: "No hay calendarios configurados." };
  }

  // El día se delimita en la zona de Buenos Aires, no en la del servidor.
  const today = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
  const offset = formatInTimeZone(new Date(), TZ, "XXX");
  const from = new Date(`${today}T00:00:00${offset}`);
  const to = new Date(`${today}T23:59:59${offset}`);

  try {
    const perCalendar = await Promise.all(
      calendarIds.map(async (calendarId) => {
        const items = await fetchCalendar(calendarId, from, to);
        return items
          .filter((event) => event.status !== "cancelled")
          // Si rechazaste la invitación, no es parte de tu día.
          .filter(
            (event) =>
              !event.attendees?.some(
                (attendee) => attendee.self && attendee.responseStatus === "declined"
              )
          )
          .map<CalendarEvent>((event) => {
            const allDay = Boolean(event.start?.date);
            return {
              id: `${calendarId}:${event.id ?? Math.random()}`,
              title: event.summary?.trim() || "(sin título)",
              start: event.start?.dateTime ? new Date(event.start.dateTime) : null,
              end: event.end?.dateTime ? new Date(event.end.dateTime) : null,
              allDay,
              location: event.location?.trim() || null,
              meetUrl: extractMeetUrl(event),
              htmlLink: event.htmlLink ?? null,
              calendarId,
            };
          });
      })
    );

    // Todo el día primero, después por hora de inicio.
    const events = perCalendar.flat().sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0);
    });

    return { ok: true, events };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export function formatEventTime(event: CalendarEvent): string {
  if (event.allDay || !event.start) return "Todo el día";
  const start = formatInTimeZone(event.start, TZ, "HH:mm");
  if (!event.end) return start;
  return `${start} – ${formatInTimeZone(event.end, TZ, "HH:mm")}`;
}

/** true si el evento ya terminó: se muestra atenuado. */
export function isEventPast(event: CalendarEvent): boolean {
  if (event.allDay) return false;
  return Boolean(event.end && event.end.getTime() < Date.now());
}

/** true si está pasando ahora. */
export function isEventNow(event: CalendarEvent): boolean {
  if (event.allDay || !event.start || !event.end) return false;
  const now = Date.now();
  return event.start.getTime() <= now && now <= event.end.getTime();
}
