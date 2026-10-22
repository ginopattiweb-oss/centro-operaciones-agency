"use client";

import { useActionState } from "react";
import { saveClientAnalytics } from "@/lib/actions/clientes";

export function AnalyticsSettings({
  clientProjectId,
  gaPropertyId,
  statsVisibleToClient,
  serviceAccountEmail,
}: {
  clientProjectId: string;
  gaPropertyId: string | null;
  statsVisibleToClient: boolean;
  serviceAccountEmail: string | null;
}) {
  const [state, formAction, saving] = useActionState(saveClientAnalytics, null);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 md:p-6"
    >
      <input type="hidden" name="clientProjectId" value={clientProjectId} />

      <label className="flex flex-col gap-1.5 text-sm text-fg">
        GA4 Property ID
        <span className="text-xs text-fg-muted">
          En Google Analytics: Administrar → Configuración de la propiedad. Es el número, no
          el &quot;G-XXXX&quot;.
        </span>
        <input
          name="gaPropertyId"
          defaultValue={gaPropertyId ?? ""}
          placeholder="493827160"
          inputMode="numeric"
          className="w-full max-w-xs rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent-ink"
        />
      </label>

      <label className="flex items-center gap-3 text-sm text-fg">
        <input
          type="checkbox"
          name="statsVisibleToClient"
          defaultChecked={statsVisibleToClient}
          className="h-4 w-4 accent-[var(--color-accent)]"
        />
        Mostrarle las estadísticas al cliente en su portal
      </label>

      {serviceAccountEmail && (
        <p className="rounded-lg border border-border bg-bg px-3 py-2 text-xs text-fg-muted">
          Acordate de dar acceso de <strong className="text-fg">Lector</strong> a{" "}
          <code className="text-fg">{serviceAccountEmail}</code> en esa property de GA.
        </p>
      )}

      {state?.error && <p className="text-sm text-accent-ink">{state.error}</p>}
      {state?.success && <p className="text-sm text-accent-ink">{state.success}</p>}

      <button
        type="submit"
        disabled={saving}
        className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:brightness-110 disabled:opacity-50"
      >
        {saving ? "Guardando..." : "Guardar"}
      </button>
    </form>
  );
}
