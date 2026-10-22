import { FolderDown, FileText, LinkIcon } from "lucide-react";
import { formatDateTime } from "@/lib/date";
import { getDeliverablesForClient, requirePortalContext } from "@/lib/portal-queries";

export const dynamic = "force-dynamic";

export default async function PortalEntregablesPage() {
  const { clientProject } = await requirePortalContext();
  const items = await getDeliverablesForClient(clientProject.id);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h2 className="font-heading text-2xl text-fg">Archivos y entregables</h2>
        <p className="text-sm text-fg-muted">
          Todo lo que te vamos entregando: diseños, documentos, manuales y links útiles.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface px-6 py-12 text-center">
          <FolderDown className="h-6 w-6 text-fg-muted" />
          <p className="text-sm text-fg-muted">Todavía no hay entregables publicados.</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          {items.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-start gap-4 px-5 py-4 hover:bg-bg/60"
            >
              <div className="mt-0.5 shrink-0 text-accent-ink">
                {item.kind === "archivo" ? (
                  <FileText className="h-5 w-5" />
                ) : (
                  <LinkIcon className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{item.title}</p>
                {item.description && (
                  <p className="mt-1 text-sm text-fg-muted">{item.description}</p>
                )}
                <p className="mt-1 text-xs text-fg-muted">{formatDateTime(item.createdAt)}</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
