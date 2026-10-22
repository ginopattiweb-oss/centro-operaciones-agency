"use client";

import { useState } from "react";
import { Eye, EyeOff, Copy, Check, ExternalLink } from "lucide-react";

export type AccessView = {
  id: string;
  label: string;
  type: string;
  typeLabel: string;
  url: string | null;
  username: string | null;
  secret: string | null;
  notes: string | null;
};

export function AccessCard({ access }: { access: AccessView }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading text-base text-fg">{access.label}</p>
          <p className="mt-1 text-xs uppercase tracking-wider text-fg-muted">
            {access.typeLabel}
          </p>
        </div>
        {access.url && (
          <a
            href={access.url}
            target="_blank"
            rel="noreferrer noopener"
            className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-fg-muted hover:text-accent-ink"
          >
            Abrir <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {access.url && <Field label="URL" value={access.url} />}
        {access.username && <Field label="Usuario" value={access.username} />}
        {access.secret && (
          <Field
            label="Contraseña"
            value={access.secret}
            masked={!revealed}
            onToggle={() => setRevealed((v) => !v)}
            revealed={revealed}
          />
        )}
      </div>

      {access.notes && (
        <p className="mt-4 whitespace-pre-wrap border-t border-border pt-4 text-sm text-fg-muted">
          {access.notes}
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  masked = false,
  revealed,
  onToggle,
}: {
  label: string;
  value: string;
  masked?: boolean;
  revealed?: boolean;
  onToggle?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Sin permiso de portapapeles: el valor igual se puede seleccionar a mano.
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2">
      <span className="w-20 shrink-0 text-xs uppercase tracking-wider text-fg-muted">
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-sm text-fg">
        {masked ? "••••••••••••" : value}
      </span>
      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={revealed ? "Ocultar" : "Mostrar"}
          className="shrink-0 text-fg-muted hover:text-accent-ink"
        >
          {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
      <button
        type="button"
        onClick={copy}
        aria-label="Copiar"
        className="shrink-0 text-fg-muted hover:text-accent-ink"
      >
        {copied ? <Check className="h-4 w-4 text-accent-ink" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}
