import { ChangePasswordForm } from "@/components/portal/ChangePasswordForm";
import { formatDateTime } from "@/lib/date";
import { requirePortalContext } from "@/lib/portal-queries";

export const dynamic = "force-dynamic";

export default async function PortalCuentaPage() {
  const { user, clientProject } = await requirePortalContext();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h2 className="font-heading text-2xl text-fg">Mi cuenta</h2>
        <p className="text-sm text-fg-muted">Tus datos de acceso al portal.</p>
      </header>

      <section className="rounded-card border border-border bg-surface p-5 md:p-6">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Row label="Nombre" value={user.name} />
          <Row label="Email" value={user.email} />
          <Row label="Proyecto" value={clientProject.name} />
          <Row
            label="Último ingreso"
            value={user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—"}
          />
        </dl>
      </section>

      <section className="rounded-card border border-border bg-surface p-5 md:p-6">
        <h3 className="mb-5 font-heading text-lg text-fg">Cambiar contraseña</h3>
        <ChangePasswordForm />
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-fg-muted">{label}</dt>
      <dd className="mt-1 text-sm text-fg">{value}</dd>
    </div>
  );
}
