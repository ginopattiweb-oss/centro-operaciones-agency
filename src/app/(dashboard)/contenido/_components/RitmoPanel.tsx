import { Panel } from "@/components/paneles";
import { DAILY_VIDEO_TARGET } from "@/lib/contenido-config";
import {
  addDaysToDateStr,
  dateStringBA,
  startOfWeekUtc,
  todayStringBA,
} from "@/lib/date";

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/**
 * Ritmo de publicación: videos por día contra la meta diaria, sumando todas las
 * plataformas. Semana en curso día por día, más el total contra la semana pasada.
 */
export function RitmoPanel({
  dailyVideos,
}: {
  dailyVideos: Record<string, number>[];
}) {
  const counts: Record<string, number> = {};
  for (const source of dailyVideos) {
    for (const [day, count] of Object.entries(source))
      counts[day] = (counts[day] ?? 0) + count;
  }

  const today = todayStringBA();
  const weekStart = dateStringBA(startOfWeekUtc());
  const week = Array.from({ length: 7 }, (_, index) =>
    addDaysToDateStr(weekStart, index),
  );
  const lastWeek = week.map((day) => addDaysToDateStr(day, -7));

  const sum = (days: string[]) =>
    days.reduce((total, day) => total + (counts[day] ?? 0), 0);
  const todayCount = counts[today] ?? 0;
  const weekCount = sum(week);
  const lastWeekCount = sum(lastWeek);
  const weekTarget = DAILY_VIDEO_TARGET * 7;
  const maxBar = Math.max(
    DAILY_VIDEO_TARGET,
    ...week.map((day) => counts[day] ?? 0),
  );

  return (
    <Panel
      title="Ritmo de publicación"
      hint={`Meta: ${DAILY_VIDEO_TARGET} videos por día, sumando Instagram y TikTok.`}
    >
      <div className="grid gap-6 p-5 lg:grid-cols-[auto_1fr]">
        <div className="flex gap-6">
          <Stat label="Hoy" value={todayCount} target={DAILY_VIDEO_TARGET} />
          <Stat label="Esta semana" value={weekCount} target={weekTarget} />
          <Stat
            label="Semana pasada"
            value={lastWeekCount}
            target={weekTarget}
            muted
          />
        </div>

        <div className="grid grid-cols-7 gap-2">
          {week.map((day, index) => {
            const count = counts[day] ?? 0;
            const future = day > today;
            const reached = count >= DAILY_VIDEO_TARGET;
            return (
              <div key={day} className="flex flex-col items-center gap-1.5">
                <div className="relative flex h-16 w-full items-end overflow-hidden rounded bg-bg">
                  <div
                    className="absolute inset-x-0 border-t border-dashed border-border"
                    style={{
                      bottom: `${(DAILY_VIDEO_TARGET / maxBar) * 100}%`,
                    }}
                    aria-hidden
                  />
                  <div
                    className={`w-full rounded-t ${reached ? "bg-[var(--data-1)]" : "bg-[var(--data-1)]/50"}`}
                    style={{ height: `${(count / maxBar) * 100}%` }}
                  />
                </div>
                <p
                  className={`text-[11px] tabular-nums ${
                    day === today
                      ? "text-fg"
                      : future
                        ? "text-fg-muted/50"
                        : "text-fg-muted"
                  }`}
                >
                  {DAY_LABELS[index]} · {future ? "–" : count}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function Stat({
  label,
  value,
  target,
  muted = false,
}: {
  label: string;
  value: number;
  target: number;
  muted?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-fg-muted">{label}</p>
      <p
        className={`mt-1 font-heading text-2xl tabular-nums ${muted ? "text-fg-muted" : "text-fg"}`}
      >
        {value}
        <span className="text-sm text-fg-muted"> / {target}</span>
      </p>
    </div>
  );
}
