"use client";

import { useState, useTransition } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { DeleteButton, FormMessage, GhostButton } from "@/components/paneles";
import { formatCompact } from "@/lib/contenido-config";
import { formatDateTime } from "@/lib/date";
import type { InstagramAccountView } from "@/lib/instagram-queries";
import {
  disconnectInstagramAccount,
  syncInstagramAccount,
  type InstagramActionState,
} from "@/lib/actions/instagram";

const STATUS: Record<InstagramAccountView["status"], { label: string; className: string }> = {
  conectada: { label: "Conectada", className: "text-positive border-positive/40" },
  token_vencido: { label: "Reconectar", className: "text-warning border-warning/40" },
  revocada: { label: "Revocada", className: "text-negative border-negative/40" },
  error: { label: "Error", className: "text-negative border-negative/40" },
};

export function InstagramAccountCard({ account }: { account: InstagramAccountView }) {
  const [state, setState] = useState<InstagramActionState>(null);
  const [isPending, startTransition] = useTransition();
  const status = STATUS[account.status];
  const daysLeft = Math.floor((account.accessTokenExpiresAt.getTime() - Date.now()) / 86_400_000);

  return (
    <li className="flex flex-col gap-3 rounded-card border border-border bg-surface px-5 py-4">
      <div className="flex flex-wrap items-center gap-4">
        {account.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={account.avatarUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="h-12 w-12 shrink-0 rounded-full bg-bg" />
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm text-fg">
            <span className="truncate">@{account.username ?? "sin usuario"}</span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${status.className}`}
            >
              {status.label}
            </span>
          </p>
          <p className="text-xs text-fg-muted">
            Instagram · {account.projectName}
            {account.accountType && ` · ${account.accountType === "BUSINESS" ? "Empresa" : "Creador"}`}
            {account.lastProfileSyncAt && ` · sincronizada ${formatDateTime(account.lastProfileSyncAt)}`}
            {daysLeft >= 0 && ` · token vence en ${daysLeft} días`}
          </p>
          {account.lastError && account.status !== "conectada" && (
            <p className="mt-1 text-xs text-negative">{account.lastError}</p>
          )}
        </div>
        <div className="flex gap-4 text-xs tabular-nums text-fg-muted">
          <Stat label="Seguidores" value={account.followerCount} />
          <Stat label="Siguiendo" value={account.followsCount} />
          <Stat label="Publicaciones" value={account.mediaCount} />
        </div>
        {account.username && (
          <a
            href={`https://www.instagram.com/${account.username}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-fg-muted hover:text-fg"
            aria-label="Abrir perfil"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <GhostButton
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => setState(await syncInstagramAccount(account.id)))
          }
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
          Sincronizar ahora
        </GhostButton>
        <DeleteButton
          label="Desconectar"
          onDelete={async () => {
            setState(await disconnectInstagramAccount(account.id));
          }}
        />
        <FormMessage state={state} />
      </div>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="text-right">
      <p className="font-heading text-base text-fg">{value === null ? "—" : formatCompact(value)}</p>
      <p>{label}</p>
    </div>
  );
}
