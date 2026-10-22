"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  FolderPlus,
  LayoutGrid,
  List,
  Search,
  SearchX,
  CalendarClock,
  ListTodo,
} from "lucide-react";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS, statusColor } from "@/lib/proyecto-estados";
import { formatShortDateStr } from "@/lib/date";
import { PORTAL_UNIDAD_SLUG } from "@/lib/portal-config";
import type { ClientProjectStatus } from "@/db/schema";
import {
  AvatarStack,
  EmptyState,
  ProgressBar,
  SectionTitle,
  StatusChip,
} from "./ui";
import { CreateProjectDialog } from "./CreateProjectDialog";
import type { ExistingClient, ProjectRow } from "./types";

type PortalFilter = "todos" | "on" | "off";

/**
 * Proyectos de cliente: buscador, filtros y vista grilla/lista.
 * La lista llega ya resuelta del servidor; el filtrado es en memoria porque son
 * los proyectos de una sola unidad. Arranca vacía hasta que el usuario crea uno.
 */
export function ProjectsSection({
  projects,
  clients,
  people,
  services,
}: {
  projects: ProjectRow[];
  clients: ExistingClient[];
  people: string[];
  services: string[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ClientProjectStatus | "todos">("todos");
  const [service, setService] = useState("todos");
  const [owner, setOwner] = useState("todos");
  const [portal, setPortal] = useState<PortalFilter>("todos");
  const [view, setView] = useState<"grilla" | "lista">("grilla");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return projects.filter((project) => {
      if (needle && !project.name.toLowerCase().includes(needle)) return false;
      if (status !== "todos" && project.status !== status) return false;
      if (service !== "todos" && project.service !== service) return false;
      if (owner !== "todos" && project.ownerName !== owner) return false;
      if (portal === "on" && !project.portalEnabled) return false;
      if (portal === "off" && project.portalEnabled) return false;
      return true;
    });
  }, [projects, query, status, service, owner, portal]);

  const create = (
    <CreateProjectDialog clients={clients} people={people} services={services} />
  );

  return (
    <section className="flex flex-col gap-5">
      <SectionTitle action={create}>Proyectos de clientes</SectionTitle>

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderPlus className="h-6 w-6" />}
          title="Todavía no hay proyectos"
          detail="Creá el primero: se da de alta el cliente en el Portal con el portal apagado y la estructura del proyecto vacía."
          action={create}
        />
      ) : (
        <>
          <div className="sp-card flex flex-col gap-4 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="rounded-co-control flex min-w-[220px] flex-1 items-center gap-2 border border-[var(--sp-line-strong)] px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-[var(--sp-muted)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por nombre"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--sp-muted)]"
                />
              </label>

              <div className="flex items-center gap-1.5">
                <ViewToggle active={view === "grilla"} onClick={() => setView("grilla")} label="Grilla">
                  <LayoutGrid className="h-4 w-4" />
                </ViewToggle>
                <ViewToggle active={view === "lista"} onClick={() => setView("lista")} label="Lista">
                  <List className="h-4 w-4" />
                </ViewToggle>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Select label="Estado" value={status} onChange={(v) => setStatus(v as typeof status)}>
                <option value="todos">Todos</option>
                {PROJECT_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {PROJECT_STATUS_LABELS[value]}
                  </option>
                ))}
              </Select>

              <Select label="Servicio" value={service} onChange={setService}>
                <option value="todos">Todos</option>
                {services.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>

              <Select label="Responsable" value={owner} onChange={setOwner}>
                <option value="todos">Todos</option>
                {people.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>

              <Select label="Portal" value={portal} onChange={(v) => setPortal(v as PortalFilter)}>
                <option value="todos">Todos</option>
                <option value="on">Encendido</option>
                <option value="off">Apagado</option>
              </Select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<SearchX className="h-6 w-6" />}
              title="Sin resultados"
              detail="Ningún proyecto coincide con la búsqueda y los filtros aplicados."
            />
          ) : view === "grilla" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-px bg-[var(--sp-line)]">
              {filtered.map((project) => (
                <ProjectListRow key={project.id} project={project} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function href(project: ProjectRow) {
  return `/unidad/${PORTAL_UNIDAD_SLUG}/proyecto/${project.id}`;
}

function ProjectCard({ project }: { project: ProjectRow }) {
  return (
    <Link
      href={href(project)}
      className="sp-card sp-hover-glow flex flex-col gap-4 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="sp-display text-lg leading-tight">{project.name}</p>
        <StatusChip
          label={PROJECT_STATUS_LABELS[project.status]}
          color={statusColor(project.status)}
        />
      </div>

      <p className="text-xs text-[var(--sp-muted)]">
        {project.service ?? "Sin servicio cargado"}
      </p>

      <ProgressBar value={project.progress} detail={project.progressDetail ?? undefined} />

      <div className="flex flex-col gap-2 text-xs text-[var(--sp-muted)]">
        <span className="flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" />
          {project.nextDue ? (
            <span style={{ color: project.nextDue.overdue ? "var(--sp-crit)" : undefined }}>
              {formatShortDateStr(project.nextDue.date)} · {project.nextDue.label}
            </span>
          ) : (
            "Sin próxima entrega cargada"
          )}
        </span>
        <span className="flex items-center gap-1.5">
          <ListTodo className="h-3.5 w-3.5" />
          {project.openTasks} tarea(s) abierta(s)
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--sp-line)] pt-4">
        <AvatarStack names={project.team} />
        <PortalFlag on={project.portalEnabled} />
      </div>
    </Link>
  );
}

function ProjectListRow({ project }: { project: ProjectRow }) {
  return (
    <Link
      href={href(project)}
      className="flex flex-wrap items-center gap-x-6 gap-y-3 bg-[var(--sp-surface)] px-5 py-4 hover:bg-[color-mix(in_srgb,var(--sp-gold)_7%,var(--sp-surface))]"
    >
      <div className="min-w-[180px] flex-1">
        <p className="sp-display text-base leading-tight">{project.name}</p>
        <p className="mt-1 text-xs text-[var(--sp-muted)]">
          {project.service ?? "Sin servicio cargado"}
        </p>
      </div>

      <StatusChip
        label={PROJECT_STATUS_LABELS[project.status]}
        color={statusColor(project.status)}
      />

      <div className="w-40">
        <ProgressBar value={project.progress} />
      </div>

      <span className="w-40 text-xs text-[var(--sp-muted)]">
        {project.nextDue ? (
          <span style={{ color: project.nextDue.overdue ? "var(--sp-crit)" : undefined }}>
            {formatShortDateStr(project.nextDue.date)} · {project.nextDue.label}
          </span>
        ) : (
          "Sin próxima entrega"
        )}
      </span>

      <span className="w-24 text-xs text-[var(--sp-muted)]">
        {project.openTasks} abierta(s)
      </span>

      <AvatarStack names={project.team} size={24} />
      <PortalFlag on={project.portalEnabled} />
    </Link>
  );
}

function PortalFlag({ on }: { on: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs"
      style={{ color: on ? "var(--sp-pos)" : "var(--sp-muted)" }}
    >
      <span
        className="sp-pill h-1.5 w-1.5"
        style={{ background: on ? "var(--sp-pos)" : "var(--sp-line-strong)" }}
      />
      {on ? "Portal activo" : "Portal apagado"}
    </span>
  );
}

function ViewToggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center border"
      style={
        active
          ? { background: "var(--sp-chip-active)", borderColor: "var(--sp-line-strong)", color: "var(--sp-ink)" }
          : {
              background: "transparent",
              borderColor: "var(--sp-line-strong)",
              color: "var(--sp-muted)",
            }
      }
    >
      {children}
    </button>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="sp-display text-[10px] text-[var(--sp-muted)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-co-control border border-[var(--sp-line-strong)] bg-[var(--sp-bone)] px-3 py-1.5 text-xs text-[var(--sp-ink)]"
      >
        {children}
      </select>
    </label>
  );
}
