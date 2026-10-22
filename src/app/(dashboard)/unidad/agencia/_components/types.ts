import type { ClientProjectStatus } from "@/db/schema";
import type { BriefingState } from "@/lib/proyecto-estados";

/** Fila de proyecto tal como viaja al cliente: sólo datos ya derivados en el servidor. */
export type ProjectRow = {
  id: string;
  name: string;
  status: ClientProjectStatus;
  service: string | null;
  ownerName: string | null;
  team: string[];
  portalEnabled: boolean;
  openTasks: number;
  progress: number | null;
  progressDetail: string | null;
  nextDue: { label: string; date: string; overdue: boolean } | null;
  briefingState: BriefingState;
  hasAnalytics: boolean;
};

/** Cliente ya existente en el Portal, para vincularle un proyecto. */
export type ExistingClient = { id: string; name: string };
