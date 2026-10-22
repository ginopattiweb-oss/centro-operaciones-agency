"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { portalLogin } from "@/lib/actions/portal";
import { AGENCY_NAME } from "@/lib/marca";

export default function PortalLoginPage() {
  const [state, formAction, pending] = useActionState(portalLogin, null);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-card border border-border bg-surface p-8">
        <div className="flex flex-col items-center gap-3 mb-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-bg">
            <KeyRound className="h-5 w-5 text-accent-ink" />
          </div>
          <h1 className="text-2xl font-heading text-fg">Portal de clientes</h1>
          <p className="text-sm text-fg-muted">{AGENCY_NAME}</p>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          <input
            type="email"
            name="email"
            autoFocus
            required
            autoComplete="email"
            placeholder="Tu email"
            className="w-full rounded-lg border border-border bg-bg px-4 py-3 text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent-ink"
          />
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            placeholder="Contraseña"
            className="w-full rounded-lg border border-border bg-bg px-4 py-3 text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent-ink"
          />

          {state?.error && <p className="text-sm text-accent-ink">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-accent px-4 py-3 font-medium text-on-accent transition hover:brightness-110 disabled:opacity-50"
          >
            {pending ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-fg-muted">
          ¿Problemas para entrar? Escribinos y te reseteamos el acceso.
        </p>
      </div>
    </div>
  );
}
