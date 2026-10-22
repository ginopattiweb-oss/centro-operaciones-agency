"use client";

import { useActionState, useState, useTransition } from "react";
import { ExternalLink, Plus, RefreshCw, Sparkles, X } from "lucide-react";
import { DeleteButton, FormMessage, GhostButton, inputClass, PrimaryButton } from "@/components/paneles";
import type { InspirationAccount } from "@/db/schema";
import { formatCompact } from "@/lib/contenido-config";
import { formatDateTime, formatShortDateStr } from "@/lib/date";
import type { HookMedia } from "@/lib/inspiracion-queries";
import {
  adaptToBrandAction,
  addReferenceAction,
  disconnectMetaAction,
  removeReferenceAction,
  rescanAllAction,
  type InspiracionState,
} from "@/lib/actions/inspiracion";

export function ReferencesPanel({ accounts }: { accounts: InspirationAccount[] }) {
  const [state, action, pending] = useActionState<InspiracionState, FormData>(addReferenceAction, null);
  const [scanState, setScanState] = useState<InspiracionState>(null);
  const [isScanning, startScan] = useTransition();

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input
            name="username"
            placeholder="@usuario o link del perfil"
            required
            className={`${inputClass} w-64`}
          />
          <PrimaryButton type="submit" disabled={pending}>
            <Plus className="h-3.5 w-3.5" />
            {pending ? "Escaneando…" : "Agregar"}
          </PrimaryButton>
          <FormMessage state={state} />
        </form>
        {accounts.length > 0 && (
          <div className="flex items-center gap-2">
            <GhostButton
              type="button"
              disabled={isScanning}
              onClick={() => startScan(async () => setScanState(await rescanAllAction()))}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isScanning ? "animate-spin" : ""}`} />
              Escanear referentes
            </GhostButton>
            <FormMessage state={scanState} />
          </div>
        )}
      </div>

      {accounts.length === 0 ? (
        <p className="text-sm text-fg-muted">
          Todavía no hay referentes. Agregá cuentas profesionales de Instagram (empresa o creador); las
          personales no se pueden leer.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <ReferenceCard key={account.id} account={account} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReferenceCard({ account }: { account: InspirationAccount }) {
  return (
    <li className="flex items-center gap-3 rounded-card border border-border bg-bg px-4 py-3">
      {account.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={account.avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
      ) : (
        <div className="h-10 w-10 shrink-0 rounded-full bg-surface" />
      )}
      <div className="min-w-0 flex-1">
        <a
          href={`https://www.instagram.com/${account.username}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-sm text-fg hover:underline"
        >
          @{account.username}
        </a>
        <p className="text-xs text-fg-muted">
          {account.followersCount != null && `${formatCompact(account.followersCount)} seguidores`}
          {account.medianLikes != null && ` · mediana ${formatCompact(account.medianLikes)} ♡`}
        </p>
        <p className="text-[11px] text-fg-muted">
          {account.lastError
            ? <span className="text-negative">{account.lastError}</span>
            : account.lastScannedAt && `escaneada ${formatDateTime(account.lastScannedAt)}`}
        </p>
      </div>
      <DeleteButton
        label=""
        onDelete={async () => {
          await removeReferenceAction(account.id);
        }}
      />
    </li>
  );
}

export function HooksGrid({ hooks, canAdapt }: { hooks: HookMedia[]; canAdapt: boolean }) {
  if (hooks.length === 0) {
    return (
      <p className="px-5 py-6 text-sm text-fg-muted">
        Nada por encima de la mediana todavía. Se llena al escanear referentes.
      </p>
    );
  }
  return (
    <ul className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
      {hooks.map((hook) => (
        <HookCard key={hook.id} hook={hook} canAdapt={canAdapt} />
      ))}
    </ul>
  );
}

function HookCard({ hook, canAdapt }: { hook: HookMedia; canAdapt: boolean }) {
  const [state, setState] = useState<InspiracionState>(null);
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const kind = hook.productType === "REELS" ? "Reel" : hook.mediaType === "CAROUSEL_ALBUM" ? "Carrusel" : "Post";

  return (
    <li className="flex flex-col overflow-hidden rounded-card border border-border bg-bg">
      <div className="flex gap-3 p-3">
        {hook.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hook.thumbnailUrl} alt="" className="h-24 w-[4.5rem] shrink-0 rounded object-cover" />
        ) : (
          <div className="h-24 w-[4.5rem] shrink-0 rounded bg-surface" />
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs text-fg-muted">
            <span className="truncate">@{hook.username}</span>
            <span className="rounded-full border border-positive/40 px-1.5 py-0.5 text-[10px] text-positive">
              {hook.performanceRatio?.toFixed(1)}x su mediana
            </span>
          </p>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className={`mt-1 text-left text-sm text-fg ${open ? "" : "line-clamp-3"}`}
          >
            {hook.caption?.trim() || "(sin descripción)"}
          </button>
          <p className="mt-1 text-[11px] text-fg-muted">
            {kind} · {formatShortDateStr(hook.publishedAt.toISOString().slice(0, 10))} ·{" "}
            {formatCompact(hook.likeCount ?? 0)} ♡ · {formatCompact(hook.commentsCount ?? 0)} 💬
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2">
        <GhostButton
          type="button"
          disabled={isPending || !canAdapt}
          title={canAdapt ? undefined : "Falta ANTHROPIC_API_KEY"}
          onClick={() => startTransition(async () => setState(await adaptToBrandAction(hook.id)))}
        >
          <Sparkles className={`h-3.5 w-3.5 ${isPending ? "animate-pulse" : ""}`} />
          {isPending ? "Adaptando…" : "Adaptar a mi marca"}
        </GhostButton>
        {hook.permalink && (
          <a
            href={hook.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-fg"
          >
            Ver <ExternalLink className="h-3 w-3" />
          </a>
        )}
        <FormMessage state={state} />
      </div>
    </li>
  );
}

export function DisconnectMetaButton() {
  const [isPending, startTransition] = useTransition();
  return (
    <GhostButton
      type="button"
      disabled={isPending}
      onClick={() => startTransition(async () => { await disconnectMetaAction(); })}
    >
      <X className="h-3.5 w-3.5" /> Desconectar
    </GhostButton>
  );
}
