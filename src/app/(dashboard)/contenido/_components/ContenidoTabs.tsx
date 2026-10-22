"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Clapperboard, CircleDashed, CalendarRange, AtSign, Lightbulb } from "lucide-react";
import { CONTENIDO_TABS } from "@/lib/contenido-config";

const ICONS = {
  "/contenido": LayoutDashboard,
  "/contenido/videos": Clapperboard,
  "/contenido/historias": CircleDashed,
  "/contenido/planificar": CalendarRange,
  "/contenido/inspiracion": Lightbulb,
  "/contenido/cuentas": AtSign,
} as const;

export function ContenidoTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1">
      {CONTENIDO_TABS.map((tab) => {
        const Icon = ICONS[tab.href];
        const active =
          tab.href === "/contenido" ? pathname === "/contenido" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition ${
              active ? "bg-accent/15 text-accent-ink" : "text-fg-muted hover:text-fg"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
