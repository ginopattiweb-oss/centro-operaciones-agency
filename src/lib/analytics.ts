// Cliente mínimo de la GA4 Data API (runReport) vía REST.
// Autentica con una service account firmando un JWT: sin dependencias extra.
import { addDays, differenceInCalendarDays, subDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { TZ } from "@/lib/date";
import {
  rangeDays,
  type DailyPoint,
  type StatsResult,
  type StatsRange,
  type StatsSummary,
} from "@/lib/analytics-format";
import { getAccessToken, isGoogleConfigured, SCOPE_ANALYTICS } from "@/lib/google-auth";

// Reexportado para que el codigo de servidor siga importando todo desde "@/lib/analytics".
export * from "@/lib/analytics-format";

export function isAnalyticsConfigured(): boolean {
  return isGoogleConfigured();
}

// --- runReport ---

const METRICS = [
  "totalUsers",
  "sessions",
  "screenPageViews",
  "bounceRate",
  "averageSessionDuration",
] as const;

type RunReportResponse = {
  rows?: {
    dimensionValues?: { value?: string }[];
    metricValues?: { value?: string }[];
  }[];
  error?: { message?: string };
};

async function callRunReport(
  propertyId: string,
  body: Record<string, unknown>
): Promise<RunReportResponse> {
  const token = await getAccessToken(SCOPE_ANALYTICS);
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(
      propertyId
    )}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      // Las métricas cambian poco: media hora de cache alcanza y evita pegarle a GA en cada render.
      next: { revalidate: 1800 },
    }
  );

  const payload = (await response.json()) as RunReportResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Google Analytics respondió ${response.status}.`);
  }
  return payload;
}

function toSummary(values: { value?: string }[] = []): StatsSummary {
  const num = (index: number) => Number(values[index]?.value ?? 0) || 0;
  return {
    users: num(0),
    sessions: num(1),
    pageViews: num(2),
    bounceRate: num(3),
    avgSessionDuration: num(4),
  };
}

/** Totales del período. Las tasas (rebote, duración) hay que pedirlas así: no se promedian por día. */
async function runTotals(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<StatsSummary> {
  const payload = await callRunReport(propertyId, {
    dateRanges: [{ startDate, endDate }],
    metrics: METRICS.map((name) => ({ name })),
  });
  return toSummary(payload.rows?.[0]?.metricValues);
}

/** Serie día por día, con los días sin tráfico rellenados en cero (GA los omite). */
async function runDailySeries(
  propertyId: string,
  start: Date,
  end: Date
): Promise<DailyPoint[]> {
  const payload = await callRunReport(propertyId, {
    dateRanges: [{ startDate: dayString(start), endDate: dayString(end) }],
    dimensions: [{ name: "date" }],
    metrics: METRICS.map((name) => ({ name })),
    orderBys: [{ dimension: { dimensionName: "date" } }],
    limit: 400,
  });

  const byDate = new Map<string, StatsSummary>();
  for (const row of payload.rows ?? []) {
    // GA devuelve la fecha como 'YYYYMMDD'.
    const raw = row.dimensionValues?.[0]?.value ?? "";
    if (raw.length !== 8) continue;
    const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    byDate.set(date, toSummary(row.metricValues));
  }

  const points: DailyPoint[] = [];
  const days = differenceInCalendarDays(end, start);
  for (let offset = 0; offset <= days; offset++) {
    const date = dayString(addDays(start, offset));
    points.push({
      date,
      ...(byDate.get(date) ?? {
        users: 0,
        sessions: 0,
        pageViews: 0,
        bounceRate: 0,
        avgSessionDuration: 0,
      }),
    });
  }
  return points;
}

function dayString(date: Date): string {
  return formatInTimeZone(date, TZ, "yyyy-MM-dd");
}

/** Resumen del período, del período anterior (para comparar) y la serie diaria. */
export async function getStatsSummary(
  propertyId: string,
  range: StatsRange
): Promise<StatsResult> {
  const days = rangeDays(range);
  // GA todavía no cerró el día de hoy: el período termina ayer.
  const end = subDays(new Date(), 1);
  const start = subDays(end, days - 1);
  const prevEnd = subDays(start, 1);
  const prevStart = subDays(prevEnd, days - 1);

  try {
    const [current, previous, series] = await Promise.all([
      runTotals(propertyId, dayString(start), dayString(end)),
      runTotals(propertyId, dayString(prevStart), dayString(prevEnd)),
      runDailySeries(propertyId, start, end),
    ]);
    return {
      ok: true,
      current,
      previous,
      series,
      from: dayString(start),
      to: dayString(end),
    };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
