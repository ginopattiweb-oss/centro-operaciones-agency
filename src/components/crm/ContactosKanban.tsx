"use client";

/**
 * Kanban del pipeline de una unidad.
 *
 * Sirve para cualquier unidad: las columnas salen de `estadosDe(unidad)`, que es
 * el único lugar donde se editan las etapas. Agregar una etapa agrega su
 * columna sin tocar este archivo.
 *
 * Mover una tarjeta llama a `cambiarEstado`, la misma action que usa el select
 * de la ficha. Eso importa porque esa action es la que mantiene en sintonía
 * `leads.status` en agencia.
 *
 * Arrastrar es para mouse y touch. Por teclado cada tarjeta se mueve con ← y →,
 * igual que en el kanban de Leads: emular el arrastre con flechas obliga a
 * decenas de pulsaciones en columnas anchas.
 */
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AlertCircle, X } from "lucide-react";
import { cambiarEstado } from "@/lib/actions/crm";
import { nombreVisible, type CrmContactoRow } from "@/lib/crm/contactos";
import type { ColumnaKanban } from "@/lib/crm/queries";
import { estadosDe, etiquetaEstado, type UnidadClave } from "@/lib/crm/unidades";
import { TagChip } from "./ui";

/** Color de la etapa: avanza por la paleta de datos, como el kanban de Leads. */
function colorEtapa(unidad: UnidadClave, estado: string): string {
  const estados = estadosDe(unidad);
  const i = estados.indexOf(estado);
  const paleta = ["var(--data-2)", "var(--data-4)", "var(--data-1)", "var(--warning)"];
  // Las dos últimas etapas son las cerradas en las tres unidades.
  if (i === estados.length - 1) return "var(--sp-line-strong)";
  if (i === estados.length - 2 && estados.length > 3) return "var(--positive)";
  return paleta[i % paleta.length];
}

export function ContactosKanban({
  unidad,
  columnas,
  onOpen,
}: {
  unidad: UnidadClave;
  columnas: ColumnaKanban[];
  onOpen: (id: string) => void;
}) {
  const router = useRouter();
  const [arrastrando, setArrastrando] = useState<CrmContactoRow | null>(null);
  const [etapaMobile, setEtapaMobile] = useState<string>(columnas[0]?.estado ?? "");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Un umbral chico deja que el click siga abriendo la ficha.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const porId = useMemo(() => {
    const map = new Map<string, { row: CrmContactoRow; estado: string }>();
    for (const col of columnas) for (const row of col.rows) map.set(row.id, { row, estado: col.estado });
    return map;
  }, [columnas]);

  function mover(id: string, destino: string) {
    const actual = porId.get(id);
    if (!actual || actual.estado === destino) return;

    setError(null);
    startTransition(async () => {
      const r = await cambiarEstado(id, unidad, destino);
      // Si la action rechaza el cambio, se muestra el motivo en vez de fallar callado.
      if (r && !r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  function moverPorPaso(id: string, paso: number) {
    const actual = porId.get(id);
    if (!actual) return;
    const estados = estadosDe(unidad);
    const i = estados.indexOf(actual.estado) + paso;
    if (i < 0 || i >= estados.length) return;
    mover(id, estados[i]);
  }

  function onDragStart(event: DragStartEvent) {
    setArrastrando(porId.get(String(event.active.id))?.row ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    const row = arrastrando;
    setArrastrando(null);
    const destino = event.over?.id;
    if (!row || typeof destino !== "string") return;
    mover(row.id, destino);
  }

  const deEtapaMobile = columnas.find((c) => c.estado === etapaMobile);

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="sp-card flex items-start justify-between gap-3 px-4 py-3">
          <span className="flex items-start gap-2 text-sm text-[var(--sp-ink)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sp-crit)]" />
            {error}
          </span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Cerrar aviso"
            className="text-[var(--sp-muted)] hover:text-[var(--sp-ink)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Escritorio: todas las columnas, con scroll horizontal si no entran. */}
      <div className="hidden md:block">
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setArrastrando(null)}
        >
          <div className="flex gap-3 overflow-x-auto pb-2">
            {columnas.map((col) => (
              <Columna
                key={col.estado}
                unidad={unidad}
                columna={col}
                onOpen={onOpen}
                onPaso={moverPorPaso}
              />
            ))}
          </div>

          <DragOverlay>{arrastrando && <Cuerpo row={arrastrando} arrastrando />}</DragOverlay>
        </DndContext>
      </div>

      {/* Mobile: sin arrastre. Se elige la etapa y se scrollea esa columna. */}
      <div className="flex flex-col gap-4 md:hidden">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {columnas.map((col) => (
            <button
              key={col.estado}
              type="button"
              onClick={() => setEtapaMobile(col.estado)}
              aria-pressed={col.estado === etapaMobile}
              className={`sp-pill inline-flex shrink-0 items-center gap-1.5 border px-3 py-1.5 text-xs font-medium ${
                col.estado === etapaMobile
                  ? "border-[var(--sp-gold)] text-[var(--sp-ink)]"
                  : "border-[var(--sp-line-strong)] text-[var(--sp-muted)]"
              }`}
            >
              {etiquetaEstado(unidad, col.estado)}
              <span className="tabular-nums">{col.total}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {!deEtapaMobile || deEtapaMobile.rows.length === 0 ? (
            <p className="text-sm text-[var(--sp-muted)]">Nadie en esta etapa.</p>
          ) : (
            <>
              {deEtapaMobile.rows.map((row) => (
                <Tarjeta
                  key={row.id}
                  row={row}
                  onOpen={onOpen}
                  onPaso={moverPorPaso}
                  arrastrable={false}
                />
              ))}
              <Recorte columna={deEtapaMobile} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Columna({
  unidad,
  columna,
  onOpen,
  onPaso,
}: {
  unidad: UnidadClave;
  columna: ColumnaKanban;
  onOpen: (id: string) => void;
  onPaso: (id: string, paso: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columna.estado });
  const etiqueta = etiquetaEstado(unidad, columna.estado);

  return (
    <section
      ref={setNodeRef}
      aria-label={`${etiqueta}: ${columna.total} contacto(s)`}
      className="flex w-64 shrink-0 flex-col gap-2 border p-2"
      style={{
        borderColor: isOver ? "var(--sp-gold)" : "var(--sp-line)",
        background: isOver
          ? "color-mix(in srgb, var(--sp-gold) 8%, var(--sp-bone))"
          : "var(--sp-bone)",
      }}
    >
      <header className="flex items-center justify-between gap-2 px-1 py-1">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="sp-pill h-1.5 w-1.5"
            style={{ background: colorEtapa(unidad, columna.estado) }}
          />
          <span className="sp-display text-[11px]">{etiqueta}</span>
        </span>
        {/* El total real, no la cantidad de tarjetas cargadas. */}
        <span className="text-[11px] tabular-nums text-[var(--sp-muted)]">{columna.total}</span>
      </header>

      {columna.rows.length === 0 ? (
        <p className="px-1 py-3 text-[11px] text-[var(--sp-muted)]">Vacío</p>
      ) : (
        <>
          {columna.rows.map((row) => (
            <Tarjeta key={row.id} row={row} onOpen={onOpen} onPaso={onPaso} />
          ))}
          <Recorte columna={columna} />
        </>
      )}
    </section>
  );
}

/**
 * Cuando la columna está recortada lo dice, con el número de los que no se ven.
 * Callarlo haría que el encabezado y las tarjetas no cierren, y el usuario
 * creería que faltan personas.
 */
function Recorte({ columna }: { columna: ColumnaKanban }) {
  const ocultos = columna.total - columna.rows.length;
  if (ocultos <= 0) return null;
  return (
    <p className="px-1 py-2 text-[11px] text-[var(--sp-muted)]">
      +{ocultos.toLocaleString("es-AR")} más. Usá la vista de tabla para verlos todos.
    </p>
  );
}

function Tarjeta({
  row,
  onOpen,
  onPaso,
  arrastrable = true,
}: {
  row: CrmContactoRow;
  onOpen: (id: string) => void;
  onPaso: (id: string, paso: number) => void;
  arrastrable?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: row.id,
    disabled: !arrastrable,
  });

  return (
    <div
      ref={arrastrable ? setNodeRef : undefined}
      {...(arrastrable ? attributes : {})}
      {...(arrastrable ? listeners : {})}
      role="button"
      tabIndex={0}
      aria-label={`${nombreVisible(row)}. Flechas izquierda y derecha para cambiar de etapa, Enter para abrir la ficha.`}
      onClick={() => onOpen(row.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onOpen(row.id);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          onPaso(row.id, -1);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          onPaso(row.id, 1);
        }
      }}
      className="sp-card cursor-grab p-3 text-left active:cursor-grabbing"
      style={{ opacity: isDragging ? 0.35 : 1 }}
    >
      <Cuerpo row={row} />
    </div>
  );
}

function Cuerpo({ row, arrastrando = false }: { row: CrmContactoRow; arrastrando?: boolean }) {
  /** El canal por el que de verdad se puede contactar a esta persona. */
  const contacto =
    row.telefonoE164 ?? row.email ?? (row.instagram ? `@${row.instagram}` : null) ?? row.sitioWeb;

  return (
    <div
      className={arrastrando ? "sp-card flex w-64 flex-col gap-2 p-3" : "flex flex-col gap-2"}
      style={arrastrando ? { boxShadow: "0 10px 30px -12px var(--sp-glow)" } : undefined}
    >
      <p className="sp-display text-sm leading-tight break-words">{nombreVisible(row)}</p>
      {contacto && (
        <p className="text-[11px] break-all text-[var(--sp-muted)]">{contacto}</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Las otras unidades de la persona, si el CRM tiene más de una. */}
        <span className="flex flex-wrap gap-1">
          {row.tags.slice(0, 2).map((t) => (
            <TagChip key={t}>{t}</TagChip>
          ))}
        </span>
        {!row.suscripto && (
          <span className="text-[11px] text-[var(--sp-crit)]">Baja de mails</span>
        )}
      </div>
    </div>
  );
}
