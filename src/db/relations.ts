// Tipos compuestos reutilizados por queries y componentes.
import type { Task, Project, ClientProject } from "./schema";

export type TaskWithRelations = {
  task: Task;
  /** La unidad de negocio de la tarea. */
  project: Project | null;
  /** El proyecto del Portal, cuando la tarea nace del detalle de un cliente. */
  clientProject: ClientProject | null;
};
