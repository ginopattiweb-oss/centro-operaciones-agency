import { db } from "@/db";
import { projects, tasks, people, clientProjects } from "@/db/schema";
import { and, asc, eq, gte, isNotNull, ne } from "drizzle-orm";

const taskRelationsSelect = {
  task: tasks,
  project: projects,
  clientProject: clientProjects,
};

function baseTaskQuery() {
  return db
    .select(taskRelationsSelect)
    .from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .leftJoin(clientProjects, eq(tasks.clientProjectId, clientProjects.id));
}

export async function getAllProjects() {
  return db.select().from(projects).orderBy(asc(projects.createdAt));
}

export async function getProjectBySlug(slug: string) {
  const rows = await db.select().from(projects).where(eq(projects.slug, slug));
  return rows[0] ?? null;
}

export async function getUnidades() {
  return db.select().from(projects).where(eq(projects.type, "unidad")).orderBy(asc(projects.createdAt));
}

export async function getAllPeople() {
  return db.select().from(people).orderBy(asc(people.createdAt));
}

export async function getClientProjectsForUnidad(projectId: string) {
  return db
    .select()
    .from(clientProjects)
    .where(eq(clientProjects.projectId, projectId))
    .orderBy(asc(clientProjects.createdAt));
}

export async function getPendingTasksForProject(projectId: string) {
  return baseTaskQuery()
    .where(and(eq(tasks.projectId, projectId), ne(tasks.location, "hecha")))
    .orderBy(asc(tasks.sortOrder));
}

export async function getTasksForProject(projectId: string) {
  return baseTaskQuery().where(eq(tasks.projectId, projectId)).orderBy(asc(tasks.sortOrder));
}

export async function getTasksForClientProject(clientProjectId: string) {
  return baseTaskQuery()
    .where(eq(tasks.clientProjectId, clientProjectId))
    .orderBy(asc(tasks.sortOrder));
}

export async function getAllTasksWithRelations() {
  return baseTaskQuery().orderBy(asc(tasks.sortOrder));
}

export async function getCompletedThisWeek(projectId: string, weekStart: Date) {
  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        eq(tasks.location, "hecha"),
        isNotNull(tasks.completedAt),
        gte(tasks.completedAt, weekStart)
      )
    );
}
