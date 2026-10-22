"use client";

import { useActionState } from "react";
import { changePortalPassword } from "@/lib/actions/portal";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePortalPassword, null);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <Field
        label="Contraseña actual"
        name="currentPassword"
        autoComplete="current-password"
      />
      <Field
        label="Nueva contraseña"
        name="newPassword"
        autoComplete="new-password"
        help="Mínimo 10 caracteres."
      />
      <Field
        label="Repetir nueva contraseña"
        name="confirmPassword"
        autoComplete="new-password"
      />

      {state?.error && <p className="text-sm text-accent-ink">{state.error}</p>}
      {state?.success && <p className="text-sm text-accent-ink">{state.success}</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-accent px-5 py-3 text-sm font-medium text-on-accent hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "Guardando..." : "Cambiar contraseña"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  autoComplete,
  help,
}: {
  label: string;
  name: string;
  autoComplete: string;
  help?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm text-fg">
        {label}
      </label>
      {help && <p className="text-xs text-fg-muted">{help}</p>}
      <input
        id={name}
        name={name}
        type="password"
        required
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent-ink"
      />
    </div>
  );
}
