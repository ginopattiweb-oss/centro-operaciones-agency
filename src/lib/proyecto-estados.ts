/**
 * Etiquetas y tono de los estados de proyecto.
 * Sin nada de servidor: lo importan también los componentes de cliente.
 */
import type { ClientProjectStatus } from "@/db/schema";

export const PROJECT_STATUS_LABELS: Record<ClientProjectStatus, string> = {
  briefing: "Briefing",
  diseno: "En diseño",
  desarrollo: "En desarrollo",
  revision: "En revisión",
  publicado: "Publicado",
  mantenimiento: "Mantenimiento",
};

export const PROJECT_STATUSES = Object.keys(PROJECT_STATUS_LABELS) as ClientProjectStatus[];

export function isProjectStatus(value: unknown): value is ClientProjectStatus {
  return typeof value === "string" && value in PROJECT_STATUS_LABELS;
}

type Tone = "neutro" | "activo" | "alerta" | "ok";

const TONES: Record<ClientProjectStatus, Tone> = {
  briefing: "neutro",
  diseno: "activo",
  desarrollo: "activo",
  revision: "alerta",
  publicado: "ok",
  mantenimiento: "neutro",
};

/** Color del chip de estado, en tokens del sistema. */
export function statusColor(status: ClientProjectStatus): string {
  switch (TONES[status]) {
    case "ok":
      return "var(--positive)";
    case "alerta":
      return "var(--warning)";
    case "activo":
      return "var(--data-1)";
    default:
      return "var(--sp-muted)";
  }
}

export type BriefingState = "sin" | "incompleto" | "completo";

export const BRIEFING_STATE_LABELS: Record<BriefingState, string> = {
  sin: "Sin briefing",
  incompleto: "Briefing incompleto",
  completo: "Briefing completo",
};
