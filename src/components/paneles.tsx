"use client";

/** Primitivas compartidas por los paneles de Finanzas (paleta del panel interno). */

import { useEffect, useState, useTransition } from "react";
import { Trash2, X } from "lucide-react";

export const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none";

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-medium uppercase tracking-wider text-fg-muted">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-fg-muted">{hint}</span>}
    </label>
  );
}

export function Panel({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-card border border-border bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="font-heading text-base text-fg">{title}</h2>
          {hint && <p className="mt-1 text-xs text-fg-muted">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-6 text-sm text-fg-muted">{children}</p>;
}

export function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-on-accent hover:brightness-110 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-fg-muted hover:text-fg disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/** Modal simple: mismo patrón que la carga rápida de tareas. */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="co-scrim fixed inset-0 z-50 flex items-end justify-center px-4 pb-24 md:items-center md:pb-4"
      onClick={onClose}
    >
      <div
        className="co-glass max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-card p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-lg text-fg">{title}</h3>
          <button onClick={onClose} className="text-fg-muted hover:text-fg">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function FormMessage({ state }: { state: { error?: string; success?: string } | null }) {
  if (!state?.error && !state?.success) return null;
  return (
    <p className={`text-xs ${state.error ? "text-negative" : "text-positive"}`}>
      {state.error ?? state.success}
    </p>
  );
}

/**
 * Borrar en dos pasos: el primer click pide confirmación, el segundo borra.
 * Evita el diálogo del navegador sin dejar el borrado a un solo click.
 */
export function DeleteButton({
  onDelete,
  label = "Borrar",
}: {
  onDelete: () => Promise<void>;
  label?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        startTransition(async () => {
          await onDelete();
          setArmed(false);
        });
      }}
      title={label}
      className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] transition disabled:opacity-50 ${
        armed
          ? "border-negative text-negative"
          : "border-transparent text-fg-muted hover:border-border hover:text-fg"
      }`}
    >
      <Trash2 className="h-3.5 w-3.5" />
      {armed ? "Confirmar" : ""}
    </button>
  );
}
