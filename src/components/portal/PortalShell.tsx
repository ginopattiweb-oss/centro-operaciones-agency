"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  KeyRound,
  ClipboardList,
  FolderDown,
  BarChart3,
  Wallet,
  UserCog,
  LogOut,
} from "lucide-react";
import { portalLogout } from "@/lib/actions/portal";
import { AGENCY_NAME } from "@/lib/marca";

const LINKS = [
  { href: "/portal", label: "Inicio", icon: Home },
  { href: "/portal/accesos", label: "Accesos", icon: KeyRound },
  { href: "/portal/briefing", label: "Briefing", icon: ClipboardList },
  { href: "/portal/entregables", label: "Entregables", icon: FolderDown },
  { href: "/portal/finanzas", label: "Finanzas", icon: Wallet, needs: "finance" },
  { href: "/portal/estadisticas", label: "Estadísticas", icon: BarChart3, needs: "stats" },
  { href: "/portal/cuenta", label: "Mi cuenta", icon: UserCog },
] as const;

export function PortalShell({
  clientName,
  userName,
  showStats,
  showFinance,
  children,
}: {
  clientName: string;
  userName: string;
  showStats: boolean;
  showFinance: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const links = LINKS.filter((link) => {
    if (!("needs" in link)) return true;
    return link.needs === "stats" ? showStats : showFinance;
  });

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-fg-muted">{AGENCY_NAME}</p>
            <h1 className="truncate font-heading text-xl text-fg">{clientName}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-fg-muted sm:block">{userName}</span>
            <form action={portalLogout}>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-fg-muted hover:text-fg"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </form>
          </div>
        </div>

        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2 md:px-6">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm transition ${
                  active
                    ? "border-accent text-accent-ink"
                    : "border-transparent text-fg-muted hover:text-fg"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-8 md:py-10">
        {children}
      </main>

      <footer className="border-t border-border px-4 py-6 text-center text-xs text-fg-muted">
        {AGENCY_NAME} · Portal de clientes
      </footer>
    </div>
  );
}
