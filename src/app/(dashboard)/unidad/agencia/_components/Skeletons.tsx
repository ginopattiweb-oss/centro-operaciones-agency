/** Estados de carga del dashboard. Radio 0, shimmer sobre la hairline. */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`sp-skeleton ${className}`} />;
}

export function StatsPanelSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-px bg-[var(--sp-line)] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col gap-4 bg-[var(--sp-surface)] p-5 md:p-6"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-[30px] w-full" />
          </div>
        ))}
      </div>
      <div className="sp-card p-4 md:p-6">
        <Skeleton className="h-[300px] w-full" />
      </div>
    </div>
  );
}

export function KpiRowSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-px bg-[var(--sp-line)] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex flex-col gap-4 bg-[var(--sp-surface)] p-5 md:p-6">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-3 w-14" />
        </div>
      ))}
    </div>
  );
}
