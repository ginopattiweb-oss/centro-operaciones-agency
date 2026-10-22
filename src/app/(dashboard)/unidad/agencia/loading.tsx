import { PanelTheme } from "@/components/PanelTheme";
import { Skeleton, StatsPanelSkeleton } from "./_components/Skeletons";

export default function Loading() {
  return (
    <PanelTheme>
      <div className="mx-auto flex max-w-[1240px] flex-col gap-12 p-6 md:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <Skeleton className="h-11 w-72 max-w-full" />
          <Skeleton className="h-9 w-64 max-w-full" />
        </div>
        <StatsPanelSkeleton />
      </div>
    </PanelTheme>
  );
}
