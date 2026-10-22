"use client";

import { addDaysToDateStr, addMonthsToDateStr } from "@/lib/date";

/**
 * Accesos rápidos para agendar el próximo seguimiento.
 *
 * Usa los tokens globales a propósito: dentro del scope `.sp` de la agencia
 * quedan repintados con la paleta "Sol de Mayo", así que el mismo componente
 * sirve para el drawer del módulo y para el dashboard sin duplicarse.
 */
export function FollowUpQuickPicks({
  today,
  value,
  onPick,
  disabled = false,
  allowClear = false,
}: {
  /** Hoy en Buenos Aires, resuelto en el servidor. */
  today: string;
  value: string | null;
  onPick: (date: string | null) => void;
  disabled?: boolean;
  allowClear?: boolean;
}) {
  const options: { label: string; date: string }[] = [
    { label: "+3 días", date: addDaysToDateStr(today, 3) },
    { label: "+1 semana", date: addDaysToDateStr(today, 7) },
    { label: "+2 semanas", date: addDaysToDateStr(today, 14) },
    { label: "+1 mes", date: addMonthsToDateStr(today, 1) },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            disabled={disabled}
            onClick={() => onPick(option.date)}
            aria-pressed={value === option.date}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
              value === option.date
                ? "border-accent bg-accent text-on-accent"
                : "border-border text-fg-muted hover:border-accent hover:text-accent-ink"
            }`}
          >
            {option.label}
          </button>
        ))}
        {allowClear && value && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPick(null)}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-fg-muted hover:border-accent hover:text-accent-ink disabled:opacity-50"
          >
            Sin fecha
          </button>
        )}
      </div>

      <label className="flex items-center gap-2">
        <span className="text-[11px] text-fg-muted">O elegí la fecha</span>
        <input
          type="date"
          value={value ?? ""}
          min={today}
          disabled={disabled}
          onChange={(event) => onPick(event.target.value || null)}
          className="rounded-co-control border border-border bg-surface px-2 py-1 text-xs text-fg disabled:opacity-50"
        />
      </label>
    </div>
  );
}
