import { PanelTheme } from "@/components/PanelTheme";
import { Skeleton } from "../../_components/Skeletons";

export default function Loading() {
  return (
    <PanelTheme>
      <div className="mx-auto flex max-w-[1240px] flex-col gap-8 p-6 md:p-10">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-10 w-80 max-w-full" />
        <div className="grid grid-cols-1 gap-px bg-[var(--sp-line)] sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-3 bg-[var(--sp-surface)] p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-32" />
            </div>
          ))}
        </div>
        <Skeleton className="h-8 w-full max-w-md" />
        <Skeleton className="h-80 w-full" />
      </div>
    </PanelTheme>
  );
}
