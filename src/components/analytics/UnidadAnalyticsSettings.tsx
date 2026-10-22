"use client";

import { useActionState, useState } from "react";
import { Settings2 } from "lucide-react";
import { saveUnidadAnalytics } from "@/lib/actions/unidad";

export function UnidadAnalyticsSettings({
  slug,
  gaPropertyId,
  serviceAccountEmail,
  /** Sin property cargada el formulario arranca abierto: no hay nada que mostrar todavía. */
  defaultOpen,
}: {
  slug: string;
  gaPropertyId: string | null;
  serviceAccountEmail: string | null;
  defaultOpen: boolean;
}) {
  const [state, formAction, saving] = useActionState(saveUnidadAnalytics, null);
  const [open, setOpen] = useState(defaultOpen);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-fit items-center gap-1.5 text-xs text-fg-muted hover:text-fg"
      >
        <Settings2 className="h-3.5 w-3.5" />
        Property {gaPropertyId} · cambiar
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5"
    >
      <input type="hidden" name="slug" value={slug} />

      <label className="flex flex-col gap-1.5 text-sm text-fg">
        GA4 Property ID de tu web
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

      {serviceAccountEmail && (
        <p className="rounded-lg border border-border bg-bg px-3 py-2 text-xs text-fg-muted">
          Dale acceso de <strong className="text-fg">Lector</strong> a{" "}
          <code className="text-fg">{serviceAccountEmail}</code> en esa property.
        </p>
      )}

      {state?.error && <p className="text-sm text-accent-ink">{state.error}</p>}
      {state?.success && <p className="text-sm text-accent-ink">{state.success}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:brightness-110 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
        {gaPropertyId && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-border px-4 py-2 text-sm text-fg-muted hover:text-fg"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
