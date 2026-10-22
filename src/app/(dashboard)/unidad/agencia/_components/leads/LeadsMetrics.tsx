import {
  LEAD_LOST_REASON_LABELS,
  LEAD_SOURCE_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  leadStatusColor,
} from "@/lib/leads-config";
import { formatLeadMoney } from "@/lib/leads";
import type { LeadMetrics } from "@/lib/leads-metrics";
import { SectionTitle } from "../ui";

/**
 * Panel de métricas del pipeline. Todo sale de las filas cargadas, incluidos los
 * archivados: la conversión y los motivos de pérdida son histórico, y el
 * histórico no se archiva. Lo único que mira sólo el presente es el pipeline.
 */
export function LeadsMetrics({ metrics }: { metrics: LeadMetrics }) {
  if (metrics.total === 0) return null;

  const closed = metrics.byStatus.ganado + metrics.byStatus.perdido;
  const globalRate = closed === 0 ? null : metrics.byStatus.ganado / closed;

  return (
    <section className="flex flex-col gap-5">
      <SectionTitle>Métricas</SectionTitle>

      <div className="grid grid-cols-1 gap-px bg-[var(--sp-line)] sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Pipeline abierto">
          {metrics.pipeline.length === 0 ? (
            <Muted>Sin valores estimados cargados</Muted>
          ) : (
            <div className="flex flex-col gap-1">
              {metrics.pipeline.map((total) => (
                <p
                  key={total.currency}
                  className="sp-display text-2xl leading-none tabular-nums"
                >
                  {formatLeadMoney(total.cents, total.currency)}
                  <span className="ml-2 text-[11px] text-[var(--sp-muted)]">
                    {total.leads} lead(s)
                  </span>
                </p>
              ))}
            </div>
          )}
        </Tile>

        <Tile label="Leads activos">
          <p className="sp-display text-[2.25rem] leading-none tabular-nums">{metrics.active}</p>
          <Muted>de {metrics.total} cargados</Muted>
        </Tile>

        <Tile label="Conversión">
          {globalRate === null ? (
            <Muted>Todavía no se cerró ningún lead</Muted>
          ) : (
            <>
              <p className="sp-display text-[2.25rem] leading-none tabular-nums">
                {Math.round(globalRate * 100)}%
              </p>
              <Muted>
                {metrics.byStatus.ganado} ganados de {closed} cerrados
              </Muted>
            </>
          )}
        </Tile>

        <Tile label="Tiempo hasta el cierre">
          {metrics.avgDaysToClose === null ? (
            <Muted>Sin cierres con fecha para medir</Muted>
          ) : (
            <>
              <p className="sp-display text-[2.25rem] leading-none tabular-nums">
                {metrics.avgDaysToClose}
                <span className="ml-2 text-sm text-[var(--sp-muted)]">días</span>
              </p>
              <Muted>
                {metrics.avgDaysToWin === null
                  ? "Ninguno ganado todavía"
                  : `${metrics.avgDaysToWin} días los ganados`}
              </Muted>
            </>
          )}
        </Tile>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Leads por estado">
          <ul className="flex flex-col gap-2.5">
            {LEAD_STATUSES.map((status) => (
              <Bar
                key={status}
                label={LEAD_STATUS_LABELS[status]}
                value={metrics.byStatus[status]}
                max={metrics.total}
                color={leadStatusColor(status)}
              />
            ))}
          </ul>
        </Panel>

        <Panel title="Conversión por canal">
          {metrics.bySource.length === 0 ? (
            <Muted>Sin datos.</Muted>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {metrics.bySource.map((row) => (
                <li key={row.source} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <span>{LEAD_SOURCE_LABELS[row.source]}</span>
                    <span className="tabular-nums text-[var(--sp-muted)]">
                      {row.rate === null
                        ? `${row.total} sin cerrar`
                        : `${Math.round(row.rate * 100)}% · ${row.won}/${row.won + row.lost}`}
                    </span>
                  </div>
                  <Track
                    ratio={row.rate ?? 0}
                    color={row.rate === null ? "var(--sp-line-strong)" : "var(--sp-pos)"}
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Por qué se pierden">
          {metrics.lostReasons.length === 0 ? (
            <Muted>Todavía no se perdió ningún lead.</Muted>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {metrics.lostReasons.map((row) => (
                <Bar
                  key={row.reason}
                  label={LEAD_LOST_REASON_LABELS[row.reason]}
                  value={row.count}
                  max={metrics.byStatus.perdido}
                  color="var(--sp-crit)"
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </section>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 bg-[var(--sp-surface)] p-5">
      <p className="sp-display text-[11px] text-[var(--sp-muted)]">{label}</p>
      {children}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sp-card flex flex-col gap-4 p-5">
      <p className="sp-display text-[11px] text-[var(--sp-muted)]">{title}</p>
      {children}
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-[var(--sp-muted)]">{children}</p>;
}

function Bar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span>{label}</span>
        <span className="tabular-nums text-[var(--sp-muted)]">{value}</span>
      </div>
      <Track ratio={max === 0 ? 0 : value / max} color={color} />
    </li>
  );
}

function Track({ ratio, color }: { ratio: number; color: string }) {
  return (
    <div className="co-track">
      <div
        className="co-fill"
        style={{
          width: `${Math.min(100, Math.round(ratio * 100))}%`,
          background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 55%, var(--data-4)))`,
        }}
      />
    </div>
  );
}
