/**
 * Lectura de los proyectos de cliente de la agencia.
 *
 * Proyecto ≡ cliente ≡ portal: todo vive en `client_projects`. Acá sólo se
 * agregan los derivados (progreso, próxima entrega, equipo, contadores), que
 * salen de datos reales: hitos, tareas, usuarios de portal y briefing.
 */
import { asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  briefings,
  people,
  portalUsers,
  projectMilestones,
  tasks,
  type ClientProject,
  type Person,
  type ProjectMilestone,
  type Task,
} from "@/db/schema";
import { getPortalClientProjects, getPortalClientProject } from "@/lib/portal-queries";
import { missingRequiredFields } from "@/lib/briefing";
import { todayStringBA } from "@/lib/date";
import type { BriefingState } from "@/lib/proyecto-estados";

export type NextDue = {
  label: string;
  date: string;
  overdue: boolean;
  kind: "hito" | "tarea";
};

export type ProjectSummary = {
  project: ClientProject;
  owner: Person | null;
  /** Responsable + toda persona con una tarea en el proyecto. */
  team: Person[];
  openTasks: number;
  totalTasks: number;
  milestonesDone: number;
  milestonesTotal: number;
  /** null cuando todavía no hay hitos ni tareas de los que derivarlo. */
  progress: number | null;
  nextDue: NextDue | null;
  portalUserCount: number;
  briefingState: BriefingState;
};

function briefingStateOf(row: { data: Record<string, string> } | undefined): BriefingState {
  if (!row || Object.keys(row.data).length === 0) return "sin";
  return missingRequiredFields(row.data).length > 0 ? "incompleto" : "completo";
}

function progressOf(
  milestones: ProjectMilestone[],
  projectTasks: Task[]
): number | null {
  if (milestones.length > 0) {
    const done = milestones.filter((milestone) => milestone.done).length;
    return Math.round((done / milestones.length) * 100);
  }
  if (projectTasks.length > 0) {
    const done = projectTasks.filter((task) => task.location === "hecha").length;
    return Math.round((done / projectTasks.length) * 100);
  }
  return null;
}

/**
 * El hito pendiente con fecha más cercana. Las tareas ya no participan: dejaron de
 * tener vencimiento cuando pasaron al modelo de hoy / bandeja / hechas.
 */
function nextDueOf(milestones: ProjectMilestone[]): NextDue | null {
  const today = todayStringBA();
  const candidates: NextDue[] = [];

  for (const milestone of milestones) {
    if (milestone.done || !milestone.dueDate) continue;
    candidates.push({
      label: milestone.title,
      date: milestone.dueDate,
      overdue: milestone.dueDate < today,
      kind: "hito",
    });
  }

  candidates.sort((a, b) => a.date.localeCompare(b.date));
  return candidates[0] ?? null;
}

/**
 * El equipo del proyecto es su responsable. Las tareas ya no llevan asignado: se
 * sacó el campo porque nunca se usó.
 */
function teamOf(owner: Person | null): Person[] {
  return owner ? [owner] : [];
}

/** Todos los proyectos de la unidad con sus derivados. Arranca vacío si no hay ninguno. */
export async function getProjectSummaries(): Promise<ProjectSummary[]> {
  const rows = await getPortalClientProjects();
  if (rows.length === 0) return [];

  const ids = rows.map(({ clientProject }) => clientProject.id);
  const [allTasks, allMilestones, allPeople, allUsers, allBriefings] = await Promise.all([
    db.select().from(tasks).where(inArray(tasks.clientProjectId, ids)),
    db
      .select()
      .from(projectMilestones)
      .where(inArray(projectMilestones.clientProjectId, ids))
      .orderBy(asc(projectMilestones.sortOrder), asc(projectMilestones.createdAt)),
    db.select().from(people),
    db.select().from(portalUsers).where(inArray(portalUsers.clientProjectId, ids)),
    db.select().from(briefings).where(inArray(briefings.clientProjectId, ids)),
  ]);

  const peopleById = new Map(allPeople.map((person) => [person.id, person]));
  const tasksByProject = groupBy(allTasks, (task) => task.clientProjectId);
  const milestonesByProject = groupBy(allMilestones, (milestone) => milestone.clientProjectId);
  const usersByProject = groupBy(allUsers, (user) => user.clientProjectId);
  const briefingByProject = new Map(allBriefings.map((row) => [row.clientProjectId, row]));

  return rows.map(({ clientProject }) => {
    const projectTasks = tasksByProject.get(clientProject.id) ?? [];
    const milestones = milestonesByProject.get(clientProject.id) ?? [];
    const owner = clientProject.ownerPersonId
      ? (peopleById.get(clientProject.ownerPersonId) ?? null)
      : null;

    return {
      project: clientProject,
      owner,
      team: teamOf(owner),
      openTasks: projectTasks.filter((task) => task.location !== "hecha").length,
      totalTasks: projectTasks.length,
      milestonesDone: milestones.filter((milestone) => milestone.done).length,
      milestonesTotal: milestones.length,
      progress: progressOf(milestones, projectTasks),
      nextDue: nextDueOf(milestones),
      portalUserCount: (usersByProject.get(clientProject.id) ?? []).length,
      briefingState: briefingStateOf(briefingByProject.get(clientProject.id)),
    };
  });
}

export type ProjectDetail = ProjectSummary & {
  milestones: ProjectMilestone[];
  tasks: Task[];
  peopleById: Map<string, Person>;
};

export async function getProjectDetail(id: string): Promise<ProjectDetail | null> {
  const row = await getPortalClientProject(id);
  if (!row) return null;

  const [projectTasks, milestones, allPeople, users, briefingRows] = await Promise.all([
    db.select().from(tasks).where(inArray(tasks.clientProjectId, [id])).orderBy(asc(tasks.sortOrder)),
    db
      .select()
      .from(projectMilestones)
      .where(inArray(projectMilestones.clientProjectId, [id]))
      .orderBy(asc(projectMilestones.sortOrder), asc(projectMilestones.createdAt)),
    db.select().from(people),
    db.select().from(portalUsers).where(inArray(portalUsers.clientProjectId, [id])),
    db.select().from(briefings).where(inArray(briefings.clientProjectId, [id])),
  ]);

  const peopleById = new Map(allPeople.map((person) => [person.id, person]));
  const owner = row.clientProject.ownerPersonId
    ? (peopleById.get(row.clientProject.ownerPersonId) ?? null)
    : null;

  return {
    project: row.clientProject,
    owner,
    team: teamOf(owner),
    openTasks: projectTasks.filter((task) => task.location !== "hecha").length,
    totalTasks: projectTasks.length,
    milestonesDone: milestones.filter((milestone) => milestone.done).length,
    milestonesTotal: milestones.length,
    progress: progressOf(milestones, projectTasks),
    nextDue: nextDueOf(milestones),
    portalUserCount: users.length,
    briefingState: briefingStateOf(briefingRows[0]),
    milestones,
    tasks: projectTasks,
    peopleById,
  };
}

function groupBy<T>(items: T[], key: (item: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const id = key(item);
    if (!id) continue;
    const list = map.get(id) ?? [];
    list.push(item);
    map.set(id, list);
  }
  return map;
}
