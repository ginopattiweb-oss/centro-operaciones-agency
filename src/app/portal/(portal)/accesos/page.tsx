import { KeyRound } from "lucide-react";
import { AccessCard, type AccessView } from "@/components/portal/AccessCard";
import { ACCESS_TYPE_LABELS } from "@/lib/access-types";
import { tryDecryptSecret } from "@/lib/crypto";
import { getAccessesForClient, requirePortalContext } from "@/lib/portal-queries";

export const dynamic = "force-dynamic";

export default async function PortalAccesosPage() {
  const { clientProject } = await requirePortalContext();
  const rows = await getAccessesForClient(clientProject.id);

  const accesses: AccessView[] = rows.map((row) => ({
    id: row.id,
    label: row.label,
    type: row.type,
    typeLabel: ACCESS_TYPE_LABELS[row.type] ?? "Otro",
    url: row.url,
    username: row.username,
    secret: tryDecryptSecret(row.secretCipher),
    notes: row.notes,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h2 className="font-heading text-2xl text-fg">Accesos de tu web</h2>
        <p className="text-sm text-fg-muted">
          Estas credenciales son tuyas. Guardalas en un lugar seguro y no las compartas por
          WhatsApp ni por mail.
        </p>
      </header>

      {accesses.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface px-6 py-12 text-center">
          <KeyRound className="h-6 w-6 text-fg-muted" />
          <p className="text-sm text-fg-muted">
            Todavía no cargamos accesos. Los vas a ver acá apenas estén listos.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {accesses.map((access) => (
            <AccessCard key={access.id} access={access} />
          ))}
        </div>
      )}
    </div>
  );
}
