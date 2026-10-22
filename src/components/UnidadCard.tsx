import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import type { Project } from "@/db/schema";
import type { TaskWithRelations } from "@/db/relations";
import { unidadExternalUrl, unidadHref } from "@/lib/unidad-links";

export function UnidadCard({
  project,
  pending,
  overdueLeads = 0,
}: {
  project: Project;
  pending: TaskWithRelations[];
  /** Leads con seguimiento vencido en la unidad. También es trabajo pendiente. */
  overdueLeads?: number;
}) {
  const upcoming = pending.slice(0, 3);
  const isExternal = unidadExternalUrl(project.slug) !== null;
  const cardClass =
    "group rounded-card border border-border bg-surface p-6 flex flex-col gap-4 hover:border-accent/40 transition";

  const header = (
    <div className="flex items-start justify-between">
      <h3 className="font-heading text-base text-fg">{project.name}</h3>
      {isExternal ? (
        <ExternalLink className="h-4 w-4 text-fg-muted group-hover:text-accent-ink transition" />
      ) : (
        <ArrowRight className="h-4 w-4 text-fg-muted group-hover:text-accent-ink transition" />
      )}
    </div>
  );

  const Wrapper = isExternal
    ? ({ children }: { children: React.ReactNode }) => (
        <a
          href={unidadHref(project.slug)}
          target="_blank"
          rel="noopener noreferrer"
          className={cardClass}
        >
          {children}
        </a>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <Link href={unidadHref(project.slug)} className={cardClass}>
          {children}
        </Link>
      );

  return (
    <Wrapper>
      {header}

      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-heading text-accent-ink">
          {pending.length + overdueLeads}
        </span>
        <span className="text-fg-muted text-sm">pendientes</span>
      </div>

      <div className="flex flex-col gap-1.5 min-h-[4.5rem]">
        {overdueLeads > 0 && (
          <p className="text-sm text-negative">
            {overdueLeads} lead(s) con seguimiento vencido
          </p>
        )}
        {upcoming.length === 0 && overdueLeads === 0 && (
          <p className="text-sm text-fg-muted">Sin tareas pendientes.</p>
        )}
        {upcoming.map(({ task }) => (
          <div key={task.id} className="flex items-center gap-2 text-sm">
            {/* El punto ocupa lugar siempre, así los títulos quedan alineados. */}
            <span className="flex h-1.5 w-1.5 shrink-0 items-center justify-center">
              {task.priority === "alta" && (
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-label="Prioridad alta" />
              )}
            </span>
            <span className="truncate text-fg">{task.title}</span>
          </div>
        ))}
      </div>
    </Wrapper>
  );
}
