/**
 * Métricas del pipeline. Todo se deriva de las filas ya cargadas: no hay
 * agregados guardados que puedan quedar desfasados.
 *
 * Los archivados entran en el histórico (conversión, motivos, tiempo a cierre)
 * porque archivar es sacar de las vistas del día, no borrar. Lo único que los
 * excluye es el pipeline abierto: ahí sólo cuenta lo que se está laburando.
 */
import type { LeadCurrency, LeadLostReason, LeadSource, LeadStatus } from "@/db/schema";
import { isActiveLeadStatus, LEAD_STATUSES } from "@/lib/leads-config";
import type { LeadRow } from "@/lib/leads";

export type SourceConversion = {
  source: LeadSource;
  total: number;
  won: number;
  lost: number;
  /** Ganados sobre cerrados. null si el canal todavía no cerró ninguno. */
  rate: number | null;
};

export type PipelineTotal = { currency: LeadCurrency; cents: number; leads: number };

export type LeadMetrics = {
  total: number;
  active: number;
  byStatus: Record<LeadStatus, number>;
  bySource: SourceConversion[];
  lostReasons: { reason: LeadLostReason; count: number }[];
  /** Días promedio de primer contacto a cierre. null si no cerró ninguno con fechas. */
  avgDaysToClose: number | null;
  avgDaysToWin: number | null;
  /** Valor estimado del pipeline abierto, por moneda: no hay tipo de cambio. */
  pipeline: PipelineTotal[];
};

function daysBetween(from: string, to: string): number {
  const toUtc = (value: string) => {
    const [y, m, d] = value.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/** Días de primer contacto a cierre, descartando fechas incoherentes. */
function daysToClose(lead: LeadRow): number | null {
  if (!lead.closedAt) return null;
  const days = daysBetween(lead.firstContactAt, lead.closedAt);
  return days >= 0 ? days : null;
}

export function computeLeadMetrics(leads: LeadRow[]): LeadMetrics {
  const byStatus = Object.fromEntries(
    LEAD_STATUSES.map((status) => [status, 0])
  ) as Record<LeadStatus, number>;

  const bySource = new Map<LeadSource, SourceConversion>();
  const lostReasons = new Map<LeadLostReason, number>();
  const pipeline = new Map<LeadCurrency, PipelineTotal>();
  const closedDays: number[] = [];
  const wonDays: number[] = [];
  let active = 0;

  for (const lead of leads) {
    byStatus[lead.status] += 1;

    const source = bySource.get(lead.source) ?? {
      source: lead.source,
      total: 0,
      won: 0,
      lost: 0,
      rate: null,
    };
    source.total += 1;
    if (lead.status === "ganado") source.won += 1;
    if (lead.status === "perdido") source.lost += 1;
    bySource.set(lead.source, source);

    if (lead.status === "perdido" && lead.lostReason) {
      lostReasons.set(lead.lostReason, (lostReasons.get(lead.lostReason) ?? 0) + 1);
    }

    const days = daysToClose(lead);
    if (days !== null) {
      closedDays.push(days);
      if (lead.status === "ganado") wonDays.push(days);
    }

    if (isActiveLeadStatus(lead.status) && !lead.archived) {
      active += 1;
      if (lead.estimatedValueCents !== null) {
        const bucket = pipeline.get(lead.currency) ?? {
          currency: lead.currency,
          cents: 0,
          leads: 0,
        };
        bucket.cents += lead.estimatedValueCents;
        bucket.leads += 1;
        pipeline.set(lead.currency, bucket);
      }
    }
  }

  return {
    total: leads.length,
    active,
    byStatus,
    bySource: [...bySource.values()]
      .map((row) => ({
        ...row,
        rate: row.won + row.lost === 0 ? null : row.won / (row.won + row.lost),
      }))
      .sort((a, b) => b.total - a.total),
    lostReasons: [...lostReasons.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    avgDaysToClose: average(closedDays),
    avgDaysToWin: average(wonDays),
    pipeline: [...pipeline.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
  };
}
