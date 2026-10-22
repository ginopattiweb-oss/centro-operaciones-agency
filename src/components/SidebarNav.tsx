"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  ListTodo,
  Users,
  LogOut,
  ExternalLink,
  Wallet,
  Contact,
  Target,
  Share2,
  Inbox,
  ContactRound,
} from "lucide-react";
import { logout } from "@/app/login/actions";
import { PORTAL_UNIDAD_SLUG } from "@/lib/portal-config";
import { LEADS_UNIDAD_SLUG } from "@/lib/leads-config";
import {
  claveDeSlug,
  CRM_BANDEJA_PATH,
  CRM_TODOS_PATH,
  unidadContactosPath,
} from "@/lib/crm/unidades";
import { unidadExternalUrl, unidadHref } from "@/lib/unidad-links";
import type { Project } from "@/db/schema";


export function SidebarNav({
  unidades,
  onNavigate,
}: {
  unidades: Project[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-6 pb-4">
        <h1 className="font-heading text-lg text-fg leading-tight">
          Centro de<br />Operaciones
        </h1>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4 flex flex-col gap-6">
        <NavLink
          href="/"
          active={pathname === "/"}
          icon={<LayoutDashboard className="h-4 w-4" />}
          label="Dashboard"
          onNavigate={onNavigate}
        />

        <div>
          <p className="px-2 mb-2 text-xs font-medium uppercase tracking-wider text-fg-muted">
            Unidades de negocio
          </p>
          <div className="flex flex-col gap-1">
            {unidades.map((project) => (
              <div key={project.id} className="flex flex-col gap-1">
                <NavLink
                  href={unidadHref(project.slug)}
                  external={unidadExternalUrl(project.slug) !== null}
                  active={pathname === `/unidad/${project.slug}`}
                  icon={<Building2 className="h-4 w-4" />}
                  label={project.name}
                  onNavigate={onNavigate}
                />
                {project.slug === PORTAL_UNIDAD_SLUG && (
                  <div className="ml-4 border-l border-border pl-2">
                    <NavLink
                      href={`/unidad/${project.slug}/clientes`}
                      active={pathname.startsWith(`/unidad/${project.slug}/clientes`)}
                      icon={<Users className="h-4 w-4" />}
                      label="Portal de clientes"
                      onNavigate={onNavigate}
                    />
                  </div>
                )}
                {project.slug === LEADS_UNIDAD_SLUG && (
                  <div className="ml-4 border-l border-border pl-2">
                    <NavLink
                      href={`/unidad/${project.slug}/leads`}
                      active={pathname.startsWith(`/unidad/${project.slug}/leads`)}
                      icon={<Target className="h-4 w-4" />}
                      label="Leads"
                      onNavigate={onNavigate}
                    />
                  </div>
                )}
                {/* Las tres unidades del CRM tienen su vista de contactos: lee
                    el CRM filtrado por la derivación a esa unidad. */}
                {claveDeSlug(project.slug) !== null && (
                  <div className="ml-4 border-l border-border pl-2">
                    <NavLink
                      href={unidadContactosPath(claveDeSlug(project.slug)!)}
                      active={pathname.startsWith(`/unidad/${project.slug}/contactos`)}
                      icon={<Contact className="h-4 w-4" />}
                      label="Contactos"
                      onNavigate={onNavigate}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="px-2 mb-2 text-xs font-medium uppercase tracking-wider text-fg-muted">
            Transversales
          </p>
          <div className="flex flex-col gap-1">
            <NavLink
              href="/tareas"
              active={pathname === "/tareas"}
              icon={<ListTodo className="h-4 w-4" />}
              label="Tareas"
              onNavigate={onNavigate}
            />
            <NavLink
              href="/finanzas"
              active={pathname.startsWith("/finanzas")}
              icon={<Wallet className="h-4 w-4" />}
              label="Finanzas"
              onNavigate={onNavigate}
            />
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-fg-muted select-none">
                <ContactRound className="h-4 w-4" />
                CRM
              </div>
              <div className="ml-4 border-l border-border pl-2 flex flex-col gap-1">
                <NavLink
                  href={CRM_BANDEJA_PATH}
                  active={pathname.startsWith(CRM_BANDEJA_PATH)}
                  icon={<Inbox className="h-4 w-4" />}
                  label="Bandeja"
                  onNavigate={onNavigate}
                />
                <NavLink
                  href={CRM_TODOS_PATH}
                  active={pathname.startsWith(CRM_TODOS_PATH)}
                  icon={<Users className="h-4 w-4" />}
                  label="Todos"
                  onNavigate={onNavigate}
                />
              </div>
            </div>
            <NavLink
              href="/contenido"
              active={pathname.startsWith("/contenido")}
              icon={<Share2 className="h-4 w-4" />}
              label="Contenido"
              onNavigate={onNavigate}
            />
          </div>
        </div>
      </nav>

      <div className="border-t border-border px-3 py-4">
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-fg-muted hover:text-fg hover:bg-bg transition"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}

function NavLink({
  href,
  active,
  icon,
  label,
  onNavigate,
  external = false,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onNavigate?: () => void;
  external?: boolean;
}) {
  const className = `flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
    active
      ? "border-accent/40 bg-accent/10 text-accent-ink"
      : "border-transparent text-fg-muted hover:text-fg hover:bg-surface"
  }`;

  const content = (
    <>
      {icon}
      <span className="truncate">{label}</span>
      {external && <ExternalLink className="ml-auto h-3 w-3 shrink-0" />}
    </>
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        className={className}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={href} onClick={onNavigate} className={className}>
      {content}
    </Link>
  );
}
