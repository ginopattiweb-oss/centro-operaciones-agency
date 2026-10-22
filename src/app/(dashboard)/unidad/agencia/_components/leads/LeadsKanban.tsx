"use client";

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
import { setLeadStatus } from "@/lib/actions/leads";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  leadStatusColor,
} from "@/lib/leads-config";
import { formatLeadMoney, type LeadRow } from "@/lib/leads";
import type { LeadStatus } from "@/db/schema";
import { FollowUpChip } from "./ui";

/**
 * Kanban del pipeline.
 *
 * Arrastrar es para mouse y touch. Por teclado, cada tarjeta es focusable y se
 * mueve con ← y → entre estados: es más directo y confiable que emular el drag
 * con flechas, que en columnas anchas obliga a decenas de pulsaciones.
 *
 * Soltar en Ganado o Perdido no guarda directo: delega en el flujo que
 * corresponde (vincular cliente, o pedir el motivo).
 */
export function LeadsKanban({
  leads,
  onOpen,
  onWin,
  onLose,
}: {
  leads: LeadRow[];
  onOpen: (id: string) => void;
  onWin: (lead: LeadRow) => void;
  onLose: (lead: LeadRow) => void;
}) {
  const [dragging, setDragging] = useState<LeadRow | null>(null);
  const [mobileStatus, setMobileStatus] = useState<LeadStatus>("nuevo");
  const [, startTransition] = useTransition();
  const router = useRouter();

  // Un umbral de arrastre chico deja que el click siga abriendo el detalle.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byStatus = useMemo(() => {
    const map = new Map<LeadStatus, LeadRow[]>(LEAD_STATUSES.map((status) => [status, []]));
    for (const lead of leads) map.get(lead.status)?.push(lead);
    return map;
  }, [leads]);

  function move(lead: LeadRow, status: LeadStatus) {
    if (status === lead.status) return;
    if (status === "ganado") return onWin(lead);
    if (status === "perdido") return onLose(lead);

    startTransition(async () => {
      await setLeadStatus(lead.id, status, null);
      router.refresh();
    });
  }

  /** ← y → mueven la tarjeta enfocada al estado anterior o siguiente. */
  function moveByStep(lead: LeadRow, step: number) {
    const index = LEAD_STATUSES.indexOf(lead.status) + step;
    if (index < 0 || index >= LEAD_STATUSES.length) return;
    move(lead, LEAD_STATUSES[index]);
  }

  function onDragStart(event: DragStartEvent) {
    setDragging(leads.find((lead) => lead.id === event.active.id) ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    const lead = dragging;
    setDragging(null);
    const target = event.over?.id;
    if (!lead || typeof target !== "string") return;
    move(lead, target as LeadStatus);
  }

  return (
    <>
      {/* Escritorio: las seis columnas, con scroll horizontal si no entran. */}
      <div className="hidden md:block">
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDragging(null)}
        >
          <div className="flex gap-3 overflow-x-auto pb-2">
            {LEAD_STATUSES.map((status) => (
              <Column
                key={status}
                status={status}
                leads={byStatus.get(status) ?? []}
                onOpen={onOpen}
                onStep={moveByStep}
              />
            ))}
          </div>

          <DragOverlay>
            {dragging && <CardBody lead={dragging} dragging />}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Mobile: sin arrastre. Se elige el estado y se scrollea esa columna. */}
      <div className="flex flex-col gap-4 md:hidden">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {LEAD_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setMobileStatus(status)}
              aria-pressed={status === mobileStatus}
              className="sp-pill inline-flex shrink-0 items-center gap-1.5 border px-3 py-1.5 text-xs font-medium"
              style={
                status === mobileStatus
                  ? {
                      background: "var(--sp-chip-active)",
                      borderColor: "var(--sp-line-strong)",
                      color: "var(--sp-ink)",
                    }
                  : {
                      background: "transparent",
                      borderColor: "var(--sp-line-strong)",
                      color: "var(--sp-muted)",
                    }
              }
            >
              {LEAD_STATUS_LABELS[status]}
              <span className="tabular-nums">{byStatus.get(status)?.length ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {(byStatus.get(mobileStatus) ?? []).length === 0 ? (
            <p className="text-sm text-[var(--sp-muted)]">Ningún lead en este estado.</p>
          ) : (
            (byStatus.get(mobileStatus) ?? []).map((lead) => (
              <Card key={lead.id} lead={lead} onOpen={onOpen} onStep={moveByStep} draggable={false} />
            ))
          )}
        </div>
      </div>
    </>
  );
}

function Column({
  status,
  leads,
  onOpen,
  onStep,
}: {
  status: LeadStatus;
  leads: LeadRow[];
  onOpen: (id: string) => void;
  onStep: (lead: LeadRow, step: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      aria-label={`${LEAD_STATUS_LABELS[status]}: ${leads.length} lead(s)`}
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
          <span className="sp-pill h-1.5 w-1.5" style={{ background: leadStatusColor(status) }} />
          <span className="sp-display text-[11px]">{LEAD_STATUS_LABELS[status]}</span>
        </span>
        <span className="text-[11px] tabular-nums text-[var(--sp-muted)]">{leads.length}</span>
      </header>

      {leads.length === 0 ? (
        <p className="px-1 py-3 text-[11px] text-[var(--sp-muted)]">Vacío</p>
      ) : (
        leads.map((lead) => <Card key={lead.id} lead={lead} onOpen={onOpen} onStep={onStep} />)
      )}
    </section>
  );
}

function Card({
  lead,
  onOpen,
  onStep,
  draggable = true,
}: {
  lead: LeadRow;
  onOpen: (id: string) => void;
  onStep: (lead: LeadRow, step: number) => void;
  draggable?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    disabled: !draggable,
  });

  return (
    <div
      ref={draggable ? setNodeRef : undefined}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
      role="button"
      tabIndex={0}
      aria-label={`${lead.contactName}, ${LEAD_STATUS_LABELS[lead.status]}. Flechas izquierda y derecha para cambiar de estado, Enter para abrir.`}
      onClick={() => onOpen(lead.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onOpen(lead.id);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          onStep(lead, -1);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          onStep(lead, 1);
        }
      }}
      className="sp-card cursor-grab p-3 text-left active:cursor-grabbing"
      style={{ opacity: isDragging ? 0.35 : 1 }}
    >
      <CardBody lead={lead} />
    </div>
  );
}

function CardBody({ lead, dragging = false }: { lead: LeadRow; dragging?: boolean }) {
  return (
    <div
      className={
        dragging ? "sp-card flex w-64 flex-col gap-2 p-3" : "flex flex-col gap-2"
      }
      style={dragging ? { boxShadow: "0 10px 30px -12px var(--sp-glow)" } : undefined}
    >
      <p className="sp-display text-sm leading-tight break-words">{lead.contactName}</p>
      <p className="text-[11px] text-[var(--sp-muted)]">{lead.business ?? "Sin negocio"}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FollowUpChip state={lead.followUp} date={lead.nextFollowUpAt} showLabel={false} />
        <span className="text-[11px] tabular-nums text-[var(--sp-muted)]">
          {lead.estimatedValueCents === null
            ? "Sin cotizar"
            : formatLeadMoney(lead.estimatedValueCents, lead.currency)}
        </span>
      </div>
    </div>
  );
}
