"use client";

import { useActionState, useState } from "react";
import { Eye } from "lucide-react";
import { saveFinanceVisibility } from "@/lib/actions/finanzas";
import { PanelShell } from "./ui";

/**
 * Qué ve el cliente de su parte financiera. Proyecto y portal son la misma
 * entidad: lo que se carga acá aparece allá al instante, sin duplicar nada.
 */
export function FinanceVisibility({
  clientProjectId,
  financeVisibleToClient,
  clientCanUploadPayments,
}: {
  clientProjectId: string;
  financeVisibleToClient: boolean;
  clientCanUploadPayments: boolean;
}) {
  const [state, formAction, saving] = useActionState(saveFinanceVisibility, null);
  const [visible, setVisible] = useState(financeVisibleToClient);

  return (
    <PanelShell
      title="Qué ve el cliente"
      hint="Las filas marcadas “solo interno” nunca se muestran, aunque la sección esté visible."
    >
      <form action={formAction} className="flex flex-col gap-4 px-5 py-5">
        <input type="hidden" name="clientProjectId" value={clientProjectId} />

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="financeVisibleToClient"
            checked={visible}
            onChange={(event) => setVisible(event.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            Mostrar “Finanzas” en el portal
            <span className="mt-0.5 block text-xs text-[var(--sp-muted)]">
              Ve sus acuerdos, sus facturas, sus comprobantes y su saldo pendiente.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="clientCanUploadPayments"
            defaultChecked={clientCanUploadPayments}
            disabled={!visible}
            className="mt-0.5 h-4 w-4"
          />
          <span className={visible ? "" : "text-[var(--sp-muted)]"}>
            Dejarlo subir comprobantes de pago
            <span className="mt-0.5 block text-xs text-[var(--sp-muted)]">
              Sin esto, el portal es de solo lectura.
            </span>
          </span>
        </label>

        {state?.error && <p className="text-sm text-[var(--sp-crit)]">{state.error}</p>}
        {state?.success && <p className="text-sm text-[var(--sp-pos)]">{state.success}</p>}

        <div>
          <button
            type="submit"
            disabled={saving}
            className="sp-btn-gold inline-flex min-h-11 items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            <Eye className="h-4 w-4" />
            {saving ? "Guardando..." : "Guardar visibilidad"}
          </button>
        </div>
      </form>
    </PanelShell>
  );
}
