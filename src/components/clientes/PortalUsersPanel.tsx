"use client";

import { useActionState, useState, useTransition } from "react";
import { Copy, Check, RotateCcw, Trash2, UserPlus } from "lucide-react";
import {
  createPortalUser,
  deletePortalUser,
  resetPortalPassword,
  setPortalUserActive,
} from "@/lib/actions/clientes";

export type PortalUserView = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLogin: string | null;
};

export function PortalUsersPanel({
  clientProjectId,
  users,
}: {
  clientProjectId: string;
  users: PortalUserView[];
}) {
  const [createState, createAction, creating] = useActionState(createPortalUser, null);
  const [resetState, resetAction, resetting] = useActionState(resetPortalPassword, null);
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();

  const result = createState?.ok ? createState : resetState?.ok ? resetState : null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-heading text-lg text-fg">Usuarios del portal</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-fg-muted hover:text-fg"
        >
          <UserPlus className="h-4 w-4" /> Nuevo usuario
        </button>
      </div>

      {showForm && (
        <form
          action={createAction}
          className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5 sm:flex-row sm:items-end"
        >
          <input type="hidden" name="clientProjectId" value={clientProjectId} />
          <label className="flex flex-1 flex-col gap-1.5 text-sm text-fg">
            Nombre
            <input
              name="name"
              required
              className="rounded-lg border border-border bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-ink"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm text-fg">
            Email
            <input
              name="email"
              type="email"
              required
              className="rounded-lg border border-border bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-ink"
            />
          </label>
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:brightness-110 disabled:opacity-50"
          >
            {creating ? "Creando..." : "Crear"}
          </button>
        </form>
      )}

      {createState?.ok === false && <p className="text-sm text-accent-ink">{createState.error}</p>}
      {resetState?.ok === false && <p className="text-sm text-accent-ink">{resetState.error}</p>}

      {result?.tempPassword && (
        <TempPasswordBanner message={result.message} password={result.tempPassword} />
      )}

      {users.length === 0 ? (
        <p className="text-sm text-fg-muted">
          Todavía no hay usuarios. Creá uno y pasale la contraseña inicial al cliente.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg">
                  {user.name}
                  {!user.isActive && (
                    <span className="ml-2 rounded-full bg-bg px-2 py-0.5 text-xs text-fg-muted">
                      desactivado
                    </span>
                  )}
                  {user.mustChangePassword && (
                    <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent-ink">
                      contraseña inicial
                    </span>
                  )}
                </p>
                <p className="mt-1 truncate text-xs text-fg-muted">
                  {user.email} · último ingreso: {user.lastLogin ?? "nunca"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <form action={resetAction}>
                  <input type="hidden" name="userId" value={user.id} />
                  <button
                    type="submit"
                    disabled={resetting}
                    title="Resetear contraseña"
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-fg-muted hover:text-fg disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Resetear
                  </button>
                </form>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await setPortalUserActive(user.id, !user.isActive);
                    })
                  }
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-fg-muted hover:text-fg disabled:opacity-50"
                >
                  {user.isActive ? "Desactivar" : "Activar"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(`¿Eliminar el usuario ${user.email}?`)) return;
                    startTransition(async () => {
                      await deletePortalUser(user.id);
                    });
                  }}
                  title="Eliminar usuario"
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-fg-muted hover:text-accent-ink disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TempPasswordBanner({ message, password }: { message: string; password: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-card border border-accent/40 bg-accent/10 p-5">
      <p className="text-sm text-fg">{message}</p>
      <p className="mt-1 text-xs text-fg-muted">
        Se muestra una sola vez: copiala y pasásela al cliente por un canal seguro.
      </p>
      <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2">
        <code className="flex-1 truncate font-mono text-sm text-fg">{password}</code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(password);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              // Sin portapapeles: se puede seleccionar a mano.
            }
          }}
          className="text-fg-muted hover:text-accent-ink"
          aria-label="Copiar contraseña"
        >
          {copied ? <Check className="h-4 w-4 text-accent-ink" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
