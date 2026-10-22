"use client";

import { useTransition } from "react";
import { setPortalEnabled } from "@/lib/actions/clientes";

export function PortalToggle({
  clientProjectId,
  enabled,
}: {
  clientProjectId: string;
  enabled: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setPortalEnabled(clientProjectId, !enabled);
        })
      }
      className={`rounded-lg border px-4 py-2 text-sm transition disabled:opacity-50 ${
        enabled
          ? "border-accent/50 bg-accent/15 text-accent-ink"
          : "border-border text-fg-muted hover:text-fg"
      }`}
    >
      {pending ? "Guardando..." : enabled ? "Portal activo" : "Portal apagado"}
    </button>
  );
}
