import { BRIEFING_SECTIONS, briefingProgress } from "@/lib/briefing";

export function BriefingReadOnly({
  data,
  status,
  submittedAt,
  updatedAt,
}: {
  data: Record<string, string>;
  status: "borrador" | "enviado" | null;
  submittedAt: string | null;
  updatedAt: string | null;
}) {
  const progress = briefingProgress(data);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg text-fg">Briefing</h2>
        <span
          className={`rounded-full px-3 py-1 text-xs ${
            status === "enviado" ? "bg-accent/15 text-accent-ink" : "bg-bg text-fg-muted"
          }`}
        >
          {status === "enviado"
            ? `Enviado${submittedAt ? ` · ${submittedAt}` : ""}`
            : status === "borrador"
              ? `Borrador · ${progress}%`
              : "Sin empezar"}
        </span>
      </div>

      {status === null ? (
        <p className="text-sm text-fg-muted">El cliente todavía no cargó nada.</p>
      ) : (
        <div className="flex flex-col gap-6 rounded-card border border-border bg-surface p-5 md:p-6">
          {updatedAt && (
            <p className="text-xs text-fg-muted">Última edición: {updatedAt}</p>
          )}
          {BRIEFING_SECTIONS.map((section) => {
            const filled = section.fields.filter((field) => data[field.key]);
            if (filled.length === 0) return null;
            return (
              <div key={section.key}>
                <h3 className="mb-3 text-xs uppercase tracking-wider text-fg-muted">
                  {section.title}
                </h3>
                <dl className="flex flex-col gap-3">
                  {filled.map((field) => (
                    <div key={field.key}>
                      <dt className="text-sm text-fg-muted">{field.label}</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-fg">
                        {data[field.key]}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
