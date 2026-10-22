"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronRight, LayoutGrid, List } from "lucide-react";
import { completarTarea, crearTarea, moverTarea, reordenarSeccion } from "@/lib/actions/tasks";
import type { TareasBoard as DatosBoard } from "@/lib/tareas-queries";
import type { TareaRow } from "@/lib/tareas";
import type { Project, TaskLocation, TaskPriority } from "@/db/schema";
import { QuickCapture } from "./QuickCapture";
import { TareasKanban } from "./TareasKanban";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { TaskRow } from "./TaskRow";

type Vista = "lista" | "kanban";

/** Lo que tarda la fila tachada en irse a Hechas. Suficiente para ver el tachado. */
const DEMORA_AL_COMPLETAR = 400;

/** Destino para soltar una tarea en Hoy cuando la sección está vacía. */
const ZONA_HOY_VACIO = "seccion:hoy";

export function TareasBoard({
  board,
  fechaHoy,
  unidades,
}: {
  board: DatosBoard;
  fechaHoy: string;
  unidades: Project[];
}) {
  const [items, setItems] = useState<TareaRow[]>(() => [
    ...board.hoy,
    ...board.bandeja,
    ...board.hechas,
  ]);
  const [tachadas, setTachadas] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [bandejaAbierta, setBandejaAbierta] = useState(true);
  const [hechasAbiertas, setHechasAbiertas] = useState(false);
  const [vista, setVista] = useState<Vista>("lista");
  const [tareaAbiertaId, setTareaAbiertaId] = useState<string | null>(null);
  const [, empezar] = useTransition();

  const itemsRef = useRef(items);
  itemsRef.current = items;

  /**
   * Tareas creadas acá que el servidor todavía no devolvió. Se sostienen hasta
   * que aparecen en los datos de la página, así una creación rápida no parpadea.
   */
  const recientesRef = useRef<Map<string, TareaRow>>(new Map());

  useEffect(() => {
    const delServidor = [...board.hoy, ...board.bandeja, ...board.hechas];
    const idsDelServidor = new Set(delServidor.map((t) => t.id));

    for (const id of [...recientesRef.current.keys()]) {
      if (idsDelServidor.has(id)) recientesRef.current.delete(id);
    }

    setItems([...delServidor, ...recientesRef.current.values()]);
  }, [board]);

  const temporizadores = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  useEffect(() => {
    const pendientes = temporizadores.current;
    return () => pendientes.forEach(clearTimeout);
  }, []);

  const secciones = useMemo(() => {
    const porOrden = (a: TareaRow, b: TareaRow) => a.sortOrder - b.sortOrder;
    return {
      hoy: items.filter((t) => t.location === "hoy").sort(porOrden),
      bandeja: items.filter((t) => t.location === "bandeja").sort(porOrden),
      hechas: items
        .filter((t) => t.location === "hecha")
        .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0)),
    };
  }, [items]);

  /** Un escalón arriba de la primera de la sección, para que entre por el tope. */
  const ordenParaElTope = useCallback((location: TaskLocation) => {
    const enSeccion = itemsRef.current.filter((t) => t.location === location);
    return enSeccion.length === 0 ? 0 : Math.min(...enSeccion.map((t) => t.sortOrder)) - 1;
  }, []);

  /** Aplica un cambio local a la fila, también sobre la copia reciente si existe. */
  const aplicar = useCallback((id: string, cambios: Partial<TareaRow>) => {
    const reciente = recientesRef.current.get(id);
    if (reciente) recientesRef.current.set(id, { ...reciente, ...cambios });
    setItems((previas) => previas.map((t) => (t.id === id ? { ...t, ...cambios } : t)));
  }, []);

  /** Corre la acción y, si falla, devuelve la lista a como estaba. */
  const conReversa = useCallback((accion: () => Promise<void>, mensaje: string) => {
    const previas = itemsRef.current;
    const recientesPrevias = new Map(recientesRef.current);
    setError(null);

    empezar(async () => {
      try {
        await accion();
      } catch {
        recientesRef.current = recientesPrevias;
        setItems(previas);
        setError(mensaje);
      }
    });
  }, []);

  const crear = useCallback(
    ({
      title,
      priority,
      location,
    }: {
      title: string;
      priority: TaskPriority;
      location: TaskLocation;
    }) => {
      const idTemporal = `temporal:${crypto.randomUUID()}`;
      const optimista: TareaRow = {
        id: idTemporal,
        title,
        notes: null,
        location,
        priority,
        projectId: null,
        unidadNombre: null,
        sortOrder: ordenParaElTope(location),
        movedToTodayAt: location === "hoy" ? new Date() : null,
        completedAt: null,
        subtareasTotal: 0,
        subtareasHechas: 0,
      };

      recientesRef.current.set(idTemporal, optimista);
      setItems((previas) => [...previas, optimista]);
      setError(null);

      empezar(async () => {
        try {
          const creada = await crearTarea({ title, priority, location });
          recientesRef.current.delete(idTemporal);
          recientesRef.current.set(creada.id, creada);
          setItems((previas) => previas.map((t) => (t.id === idTemporal ? creada : t)));
        } catch {
          recientesRef.current.delete(idTemporal);
          setItems((previas) => previas.filter((t) => t.id !== idTemporal));
          setError("No pudimos guardar la tarea. Fijate la conexión y probá de nuevo.");
        }
      });
    },
    [ordenParaElTope]
  );

  const completar = useCallback(
    (tarea: TareaRow, hecha: boolean) => {
      if (!hecha) {
        aplicar(tarea.id, {
          location: "bandeja",
          completedAt: null,
          sortOrder: ordenParaElTope("bandeja"),
        });
        conReversa(
          () => completarTarea(tarea.id, false),
          "No pudimos devolver la tarea a la bandeja."
        );
        return;
      }

      // Se tacha primero y recién ahí se va: sin el paso intermedio la fila
      // desaparece de golpe y no se entiende qué pasó.
      setTachadas((previas) => new Set(previas).add(tarea.id));

      const temporizador = setTimeout(() => {
        temporizadores.current.delete(temporizador);
        setTachadas((previas) => {
          const siguiente = new Set(previas);
          siguiente.delete(tarea.id);
          return siguiente;
        });
        aplicar(tarea.id, { location: "hecha", completedAt: new Date(), movedToTodayAt: null });
        conReversa(() => completarTarea(tarea.id, true), "No pudimos completar la tarea.");
      }, DEMORA_AL_COMPLETAR);

      temporizadores.current.add(temporizador);
    },
    [aplicar, conReversa, ordenParaElTope]
  );

  const mover = useCallback(
    (tarea: TareaRow, destinoPedido?: TaskLocation) => {
      // Sin destino explícito, la acción de la fila alterna entre hoy y bandeja.
      const destino = destinoPedido ?? (tarea.location === "hoy" ? "bandeja" : "hoy");
      if (destino === tarea.location) return;
      aplicar(tarea.id, {
        location: destino,
        movedToTodayAt: destino === "hoy" ? new Date() : null,
        completedAt: destino === "hecha" ? new Date() : null,
        sortOrder: ordenParaElTope(destino),
      });
      conReversa(() => moverTarea(tarea.id, destino), "No pudimos mover la tarea.");
    },
    [aplicar, conReversa, ordenParaElTope]
  );

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  /**
   * Soltar una tarea reordena su sección; si cayó en otra, además la mueve. La
   * sección destino se guarda entera con su orden nuevo.
   */
  const alSoltar = useCallback(
    (evento: DragEndEvent) => {
      const { active, over } = evento;
      if (!over) return;

      const arrastrada = itemsRef.current.find((t) => t.id === active.id);
      if (!arrastrada) return;

      const sobre = itemsRef.current.find((t) => t.id === over.id);
      const destino: TaskLocation =
        over.id === ZONA_HOY_VACIO ? "hoy" : (sobre?.location ?? arrastrada.location);
      // Las hechas no se reordenan ni reciben tareas por arrastre.
      if (destino === "hecha") return;

      const enDestino = itemsRef.current
        .filter((t) => t.location === destino && t.id !== arrastrada.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      const posicion = sobre ? enDestino.findIndex((t) => t.id === sobre.id) : enDestino.length;
      const ordenados = [...enDestino];
      ordenados.splice(posicion < 0 ? ordenados.length : posicion, 0, arrastrada);

      if (
        destino === arrastrada.location &&
        ordenados.every((t, i) => t.id === [...enDestino, arrastrada][i]?.id)
      ) {
        return;
      }

      ordenados.forEach((tarea, indice) =>
        aplicar(tarea.id, {
          location: destino,
          sortOrder: indice,
          movedToTodayAt:
            destino === "hoy" ? (tarea.movedToTodayAt ?? new Date()) : null,
        })
      );

      conReversa(
        () => reordenarSeccion(destino, ordenados.map((t) => t.id)),
        "No pudimos guardar el orden nuevo."
      );
    },
    [aplicar, conReversa]
  );

  const eliminarDeLaLista = useCallback((id: string) => {
    recientesRef.current.delete(id);
    setItems((previas) => previas.filter((t) => t.id !== id));
    setTareaAbiertaId(null);
  }, []);

  const hayTareas = items.length > 0;
  const tareaAbierta = tareaAbiertaId
    ? (items.find((t) => t.id === tareaAbiertaId) ?? null)
    : null;

  return (
    <div className="flex w-full max-w-[880px] flex-col gap-6">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="sp-display text-2xl font-bold">TAREAS</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <BotonVista
              activa={vista === "lista"}
              onClick={() => setVista("lista")}
              icono={<List className="h-3.5 w-3.5" />}
              etiqueta="Lista"
            />
            <BotonVista
              activa={vista === "kanban"}
              onClick={() => setVista("kanban")}
              icono={<LayoutGrid className="h-3.5 w-3.5" />}
              etiqueta="Kanban"
            />
          </div>
          <p className="text-xs text-fg-muted first-letter:uppercase">{fechaHoy}</p>
        </div>
      </header>

      <div className="flex flex-col gap-2">
        <QuickCapture onCrear={crear} />
        {error && (
          <p role="alert" className="text-xs text-negative">
            {error}
          </p>
        )}
      </div>

      {hayTareas && vista === "kanban" && (
        <TareasKanban
          secciones={{ hoy: secciones.hoy, bandeja: secciones.bandeja, hecha: secciones.hechas }}
          onMover={mover}
          onAbrir={setTareaAbiertaId}
        />
      )}

      {hayTareas && vista === "lista" && (
        <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={alSoltar}>
          <div className="flex flex-col gap-6">
          <Seccion titulo="Hoy" cantidad={secciones.hoy.length}>
            {secciones.hoy.length === 0 ? (
              <ZonaHoyVacio />
            ) : (
              <Lista
                tareas={secciones.hoy}
                tachadas={tachadas}
                onCompletar={completar}
                onMover={mover}
                onAbrir={setTareaAbiertaId}
              />
            )}
          </Seccion>

          {secciones.bandeja.length > 0 && (
            <Seccion
              titulo="Bandeja"
              cantidad={secciones.bandeja.length}
              abierta={bandejaAbierta}
              onAlternar={() => setBandejaAbierta((v) => !v)}
            >
              <Lista
                tareas={secciones.bandeja}
                tachadas={tachadas}
                onCompletar={completar}
                onMover={mover}
                onAbrir={setTareaAbiertaId}
              />
            </Seccion>
          )}

          {secciones.hechas.length > 0 && (
            <Seccion
              titulo="Hechas"
              cantidad={secciones.hechas.length}
              abierta={hechasAbiertas}
              onAlternar={() => setHechasAbiertas((v) => !v)}
            >
              <Lista
                tareas={secciones.hechas}
                tachadas={tachadas}
                onCompletar={completar}
                onMover={mover}
                onAbrir={setTareaAbiertaId}
              />
            </Seccion>
          )}
          </div>
        </DndContext>
      )}

      {tareaAbierta && (
        <TaskDetailPanel
          tarea={tareaAbierta}
          unidades={unidades}
          onCerrar={() => setTareaAbiertaId(null)}
          onCambio={(cambios) => aplicar(tareaAbierta.id, cambios)}
          onEliminada={() => eliminarDeLaLista(tareaAbierta.id)}
        />
      )}
    </div>
  );
}

/**
 * Hoy vacío sigue siendo un destino: se puede arrastrar algo de la bandeja hasta
 * el mensaje. Una línea de texto, sin ilustración ni card.
 */
function ZonaHoyVacio() {
  const { setNodeRef, isOver } = useDroppable({ id: ZONA_HOY_VACIO });
  return (
    <p
      ref={setNodeRef}
      className={`text-sm ${isOver ? "text-fg" : "text-fg-muted"}`}
    >
      Nada en hoy. Movés algo desde la bandeja cuando quieras.
    </p>
  );
}

function BotonVista({
  activa,
  onClick,
  icono,
  etiqueta,
}: {
  activa: boolean;
  onClick: () => void;
  icono: React.ReactNode;
  etiqueta: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
        activa ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg"
      }`}
    >
      {icono}
      {etiqueta}
    </button>
  );
}

/** Título de sección: 11px, mayúsculas, tracking abierto, con el conteo al lado. */
function Seccion({
  titulo,
  cantidad,
  abierta,
  onAlternar,
  children,
}: {
  titulo: string;
  cantidad: number;
  /** Sin `onAlternar` la sección es fija (Hoy no se colapsa). */
  abierta?: boolean;
  onAlternar?: () => void;
  children: React.ReactNode;
}) {
  const desplegada = onAlternar ? abierta : true;

  const etiqueta = (
    <>
      <span className="uppercase tracking-[0.18em]">{titulo}</span>
      <span className="tabular-nums text-fg-muted/60">{cantidad}</span>
    </>
  );

  return (
    <section className="flex flex-col gap-2">
      {onAlternar ? (
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={desplegada}
          className="flex items-center gap-2 self-start text-[11px] text-fg-muted hover:text-fg"
        >
          <ChevronRight
            className={`h-3 w-3 transition-transform ${desplegada ? "rotate-90" : ""}`}
            aria-hidden="true"
          />
          {etiqueta}
        </button>
      ) : (
        <p className="flex items-center gap-2 pl-5 text-[11px] text-fg-muted">{etiqueta}</p>
      )}

      {desplegada && <div className="pl-5">{children}</div>}
    </section>
  );
}

function Lista({
  tareas,
  tachadas,
  onCompletar,
  onMover,
  onAbrir,
}: {
  tareas: TareaRow[];
  tachadas: Set<string>;
  onCompletar: (tarea: TareaRow, hecha: boolean) => void;
  onMover: (tarea: TareaRow) => void;
  onAbrir: (taskId: string) => void;
}) {
  return (
    <SortableContext items={tareas.map((t) => t.id)} strategy={verticalListSortingStrategy}>
      <ul className="rounded-co-control divide-y divide-border/60 border border-border bg-surface">
        {tareas.map((tarea) => (
          <TaskRow
            key={tarea.id}
            tarea={tarea}
            tachada={tachadas.has(tarea.id)}
            onCompletar={(hecha) => onCompletar(tarea, hecha)}
            onMover={() => onMover(tarea)}
            onAbrir={() => onAbrir(tarea.id)}
          />
        ))}
      </ul>
    </SortableContext>
  );
}
