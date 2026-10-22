"use client";

import { useActionState } from "react";
import { login } from "./actions";
import { Lock } from "lucide-react";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-card border border-border bg-surface p-8">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-bg">
            <Lock className="h-5 w-5 text-accent-ink" />
          </div>
          <h1 className="text-2xl font-heading text-fg">Centro de Operaciones</h1>
          <p className="text-sm text-fg-muted">Ingresá la contraseña para continuar</p>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          <input
            type="password"
            name="password"
            autoFocus
            required
            placeholder="Contraseña"
            className="w-full rounded-lg border border-border bg-bg px-4 py-3 text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent-ink"
          />

          {state?.error && (
            <p className="text-sm text-accent-ink">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-accent px-4 py-3 font-medium text-on-accent transition hover:brightness-110 disabled:opacity-50"
          >
            {pending ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
