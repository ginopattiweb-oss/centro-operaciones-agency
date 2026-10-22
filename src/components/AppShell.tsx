"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListTodo, Menu, Wallet, X } from "lucide-react";
import { SidebarNav } from "./SidebarNav";
import { AtajoNuevaTarea } from "./tareas/AtajoNuevaTarea";
import type { Project } from "@/db/schema";

export function AppShell({
  unidades,
  children,
}: {
  unidades: Project[];
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-screen md:flex">
      <AtajoNuevaTarea />

      <aside className="hidden md:flex md:w-64 md:flex-shrink-0 md:flex-col md:border-r md:border-border md:bg-surface/70 md:backdrop-blur-xl">
        <SidebarNav unidades={unidades} />
      </aside>

      <main className="flex-1 min-w-0 pb-20 md:pb-0">{children}</main>

      <nav className="co-glass fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-x-0 border-b-0 px-2 py-2 md:hidden">
        <BottomLink
          href="/"
          active={pathname === "/"}
          icon={<LayoutDashboard className="h-5 w-5" />}
          label="Inicio"
        />
        <BottomLink
          href="/tareas"
          active={pathname === "/tareas"}
          icon={<ListTodo className="h-5 w-5" />}
          label="Tareas"
        />
        <BottomLink
          href="/finanzas"
          active={pathname.startsWith("/finanzas")}
          icon={<Wallet className="h-5 w-5" />}
          label="Finanzas"
        />
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex flex-col items-center gap-1 px-3 py-1 text-fg-muted"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[11px]">Menú</span>
        </button>
      </nav>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="co-scrim absolute inset-0"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="co-glass absolute left-0 top-0 h-full w-72 border-y-0 border-l-0">
            <div className="flex justify-end px-3 pt-3">
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-fg-muted hover:text-fg p-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarNav unidades={unidades} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function BottomLink({
  href,
  active,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-1 px-3 py-1 ${
        active ? "text-accent-ink" : "text-fg-muted"
      }`}
    >
      {icon}
      <span className="text-[11px]">{label}</span>
    </Link>
  );
}
