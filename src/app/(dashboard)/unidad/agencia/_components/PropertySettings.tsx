"use client";

import { useActionState, useState } from "react";
import { Settings2 } from "lucide-react";
import { saveUnidadAnalytics } from "@/lib/actions/unidad";
import { PORTAL_UNIDAD_SLUG } from "@/lib/portal-config";

/**
 * Property GA4 de la web propia: se muestra la real y se puede cambiar.
 * Escribe sobre la misma columna (`projects.ga_property_id`) que lee `getStatsSummary`.
 */
export function PropertySettings({
  gaPropertyId,
  serviceAccountEmail,
}: {
  gaPropertyId: string | null;
  serviceAccountEmail: string | null;
}) {
  const [state, formAction, saving] = useActionState(saveUnidadAnalytics, null);
  // Sin property cargada no hay nada que mostrar: el formulario arranca abierto.
  const [open, setOpen] = useState(!gaPropertyId);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-fit items-center gap-1.5 text-xs text-[var(--sp-muted)] hover:text-[var(--sp-amber)]"
      >
        <Settings2 className="h-3.5 w-3.5" />
        Property {gaPropertyId} · <span className="underline">cambiar</span>
      </button>
    );
  }

  return (
    <form action={formAction} className="sp-card flex flex-col gap-3 p-5 md:p-6">
      <input type="hidden" name="slug" value={PORTAL_UNIDAD_SLUG} />

      <label className="flex flex-col gap-1.5 text-sm">
        GA4 Property ID de tu web
        <span className="text-xs text-[var(--sp-muted)]">
          En Google Analytics: Administrar → Configuración de la propiedad. Es el número, no
          el &quot;G-XXXX&quot;.
        </span>
        <input
          name="gaPropertyId"
          defaultValue={gaPropertyId ?? ""}
          inputMode="numeric"
          className="rounded-co-control w-full max-w-xs border border-[var(--sp-line-strong)] bg-[var(--sp-bone)] px-3 py-2 text-sm text-[var(--sp-ink)]"
          style={{ borderRadius: 0 }}
        />
      </label>

      {serviceAccountEmail && (
        <p className="rounded-co-control border border-[var(--sp-line)] bg-[var(--sp-bone)] px-3 py-2 text-xs text-[var(--sp-muted)]">
          Dale acceso de <strong className="text-[var(--sp-ink)]">Lector</strong> a{" "}
          <code className="text-[var(--sp-ink)]">{serviceAccountEmail}</code> en esa property.
        </p>
      )}

      {state?.error && <p className="text-sm text-[var(--sp-crit)]">{state.error}</p>}
      {state?.success && <p className="text-sm text-[var(--sp-pos)]">{state.success}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="sp-btn-gold inline-flex min-h-11 items-center justify-center px-5 py-2 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
        {gaPropertyId && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="sp-pill inline-flex min-h-11 items-center justify-center border border-[var(--sp-line-strong)] px-5 py-2 text-sm font-medium text-[var(--sp-muted)] hover:border-[var(--sp-gold)] hover:text-[var(--sp-amber)]"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
