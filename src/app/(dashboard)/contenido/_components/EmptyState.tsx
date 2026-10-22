import Link from "next/link";

export function EmptyState({
  title,
  children,
  cta,
}: {
  title: string;
  children: React.ReactNode;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="rounded-card border border-dashed border-border bg-surface/50 px-6 py-10 text-center">
      <p className="font-heading text-base text-fg">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">{children}</p>
      {cta && (
        <Link
          href={cta.href}
          className="mt-4 inline-flex rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-on-accent hover:brightness-110"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
