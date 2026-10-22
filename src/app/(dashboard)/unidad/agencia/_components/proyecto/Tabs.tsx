import Link from "next/link";

export const PROJECT_TABS = [
  { key: "resumen", label: "Resumen" },
  { key: "briefing", label: "Briefing" },
  { key: "documentos", label: "Documentos" },
  { key: "accesos", label: "Accesos" },
  { key: "finanzas", label: "Finanzas" },
  { key: "analitica", label: "Analítica" },
  { key: "tareas", label: "Tareas" },
] as const;

export type ProjectTab = (typeof PROJECT_TABS)[number]["key"];

export function parseTab(value: string | undefined): ProjectTab {
  return PROJECT_TABS.some((tab) => tab.key === value) ? (value as ProjectTab) : "resumen";
}

/** Pestañas navegables por URL (`?tab=`): el estado vive en el link, no en el cliente. */
export function Tabs({
  basePath,
  active,
  keep,
}: {
  basePath: string;
  active: ProjectTab;
  keep?: Record<string, string>;
}) {
  return (
    <nav className="flex flex-wrap gap-1.5 border-b border-[var(--sp-line)] pb-4">
      {PROJECT_TABS.map((tab) => {
        const on = tab.key === active;
        const query = new URLSearchParams({ ...keep, tab: tab.key });
        return (
          <Link
            key={tab.key}
            href={`${basePath}?${query.toString()}`}
            aria-current={on ? "page" : undefined}
            className="sp-pill inline-flex items-center border px-4 py-1.5 text-xs font-medium"
            style={
              on
                ? {
                    background: "var(--sp-chip-active)",
                    borderColor: "var(--sp-line-strong)",
                    color: "var(--sp-ink)",
                  }
                : {
                    background: "transparent",
                    borderColor: "var(--sp-line-strong)",
                    color: "var(--sp-muted)",
                  }
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
