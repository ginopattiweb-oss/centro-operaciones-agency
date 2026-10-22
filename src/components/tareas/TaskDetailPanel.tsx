"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Trash2, X } from "lucide-react";
import {
  actualizarSubtarea,
  actualizarTarea,
  crearSubtarea,
  eliminarSubtarea,
  eliminarTarea,
  listarSubtareas,
} from "@/lib/actions/tasks";
import type { Project, Subtask, TaskPriority } from "@/db/schema";
import type { TareaRow } from "@/lib/tareas";
import { useOverlay } from "@/components/overlay";
import { Casilla } from "./controles";

/** Lo que se espera de tipear antes de guardar las notas. */
const DEMORA_AUTOGUARDADO = 800;

/** Textarea que crece con el contenido: no hay scroll interno ni resize manual. */
function ajustarAlto(elemento: HTMLTextAreaElement | null) {
  if (!elemento) return;
  elemento.style.height = "auto";
  elemento.style.height = `${elemento.scrollHeight}px`;
}

/**
 * Detalle de la tarea: panel lateral sobre la lista, no un modal. Todo autoguarda
 * — el título y la subtarea al perder foco, las notas con demora — así que no hay
 * botón de guardar. `Esc` cierra.
 */
export function TaskDetailPanel({
  tarea,
  unidades,
  onCerrar,
  onCambio,
  onEliminada,
}: {
  tarea: TareaRow;
  unidades: Project[];
  onCerrar: () => void;
  /** Refleja el cambio en la fila de la lista, que queda visible detrás. */
  onCambio: (cambios: Partial<TareaRow>) => void;
  onEliminada: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cerrar = useCallback(() => onCerrar(), [onCerrar]);
  useOverlay(panelRef, cerrar);

  const [subtareas, setSubtareas] = useState<Subtask[] | null>(null);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();

  const notasRef = useRef<HTMLTextAreaElement>(null);
  const tituloRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let vigente = true;
    listarSubtareas(tarea.id)
      .then((filas) => {
        if (vigente) setSubtareas(filas);
      })
      .catch(() => {
        if (vigente) setError("No pudimos traer las subtareas.");
      });
    return () => {
      vigente = false;
    };
  }, [tarea.id]);

  useEffect(() => {
    ajustarAlto(tituloRef.current);
    ajustarAlto(notasRef.current);
  }, [tarea.id]);

  /** Cuenta lo que ve la fila de la lista mientras el panel está abierto. */
  const avisarConteo = useCallback(
    (filas: Subtask[]) =>
      onCambio({
        subtareasTotal: filas.length,
        subtareasHechas: filas.filter((s) => s.done).length,
      }),
    [onCambio]
  );

  function guardarTitulo(valor: string) {
    const limpio = valor.trim();
    if (!limpio || limpio === tarea.title) {
      if (tituloRef.current) tituloRef.current.value = tarea.title;
      return;
    }
    onCambio({ title: limpio });
    empezar(async () => {
      try {
        await actualizarTarea(tarea.id, { title: limpio });
      } catch {
        setError("No pudimos guardar el título.");
      }
    });
  }

  // Las notas se guardan solas mientras escribís; el temporizador se reinicia con
  // cada tecla y se dispara al cerrar el panel para no perder lo último tipeado.
  const temporizadorNotas = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notasPendientes = useRef<string | null>(null);

  const guardarNotas = useCallback(
    (valor: string) => {
      notasPendientes.current = null;
      onCambio({ notes: valor });
      empezar(async () => {
        try {
          await actualizarTarea(tarea.id, { notes: valor || null });
        } catch {
          setError("No pudimos guardar las notas.");
        }
      });
    },
    [onCambio, tarea.id]
  );

  useEffect(() => {
    return () => {
      if (temporizadorNotas.current) clearTimeout(temporizadorNotas.current);
      if (notasPendientes.current !== null) guardarNotas(notasPendientes.current);
    };
  }, [guardarNotas]);

  function alEscribirNotas(valor: string) {
    notasPendientes.current = valor;
    if (temporizadorNotas.current) clearTimeout(temporizadorNotas.current);
    temporizadorNotas.current = setTimeout(() => guardarNotas(valor), DEMORA_AUTOGUARDADO);
  }

  function cambiarPrioridad(priority: TaskPriority) {
    if (priority === tarea.priority) return;
    onCambio({ priority });
    empezar(async () => {
      try {
        await actualizarTarea(tarea.id, { priority });
      } catch {
        setError("No pudimos cambiar la prioridad.");
      }
    });
  }

  function cambiarUnidad(projectId: string) {
    const unidad = unidades.find((u) => u.id === projectId) ?? null;
    onCambio({ projectId: unidad?.id ?? null, unidadNombre: unidad?.name ?? null });
    empezar(async () => {
      try {
        await actualizarTarea(tarea.id, { projectId: unidad?.id ?? null });
      } catch {
        setError("No pudimos cambiar la unidad.");
      }
    });
  }

  function agregarSubtarea(titulo: string) {
    const limpio = titulo.trim();
    if (!limpio) return;

    empezar(async () => {
      try {
        const creada = await crearSubtarea(tarea.id, limpio);
        setSubtareas((previas) => {
          const siguientes = [...(previas ?? []), creada];
          avisarConteo(siguientes);
          return siguientes;
        });
      } catch {
        setError("No pudimos agregar la subtarea.");
      }
    });
  }

  function cambiarSubtarea(id: string, cambios: Partial<Subtask>) {
    setSubtareas((previas) => {
      const siguientes = (previas ?? []).map((s) => (s.id === id ? { ...s, ...cambios } : s));
      avisarConteo(siguientes);
      return siguientes;
    });
    empezar(async () => {
      try {
        await actualizarSubtarea(id, cambios);
      } catch {
        setError("No pudimos guardar la subtarea.");
      }
    });
  }

  function borrarSubtarea(id: string) {
    setSubtareas((previas) => {
      const siguientes = (previas ?? []).filter((s) => s.id !== id);
      avisarConteo(siguientes);
      return siguientes;
    });
    empezar(async () => {
      try {
        await eliminarSubtarea(id);
      } catch {
        setError("No pudimos borrar la subtarea.");
      }
    });
  }

  function borrarTarea() {
    empezar(async () => {
      try {
        await eliminarTarea(tarea.id);
        onEliminada();
      } catch {
        setError("No pudimos eliminar la tarea.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* El fondo se oscurece apenas: la lista tiene que seguir leyéndose atrás. */}
      <div className="co-scrim absolute inset-0" onClick={onCerrar} aria-hidden="true" />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de "${tarea.title}"`}
        className="co-glass relative flex h-full w-full max-w-[420px] flex-col overflow-y-auto border-l"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <textarea
            ref={tituloRef}
            defaultValue={tarea.title}
            rows={1}
            onInput={(evento) => ajustarAlto(evento.currentTarget)}
            onBlur={(evento) => guardarTitulo(evento.currentTarget.value)}
            aria-label="Título de la tarea"
            className="flex-1 resize-none overflow-hidden border-0 bg-transparent p-0 text-base leading-6 text-fg focus:outline-none"
          />
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="shrink-0 text-fg-muted hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 pt-5">
          <div className="flex items-center gap-1">
            {(["alta", "normal"] as const).map((nivel) => (
              <button
                key={nivel}
                type="button"
                onClick={() => cambiarPrioridad(nivel)}
                aria-pressed={tarea.priority === nivel}
                className={`rounded-full border px-3 py-1 text-xs ${
                  tarea.priority === nivel
                    ? "border-accent bg-accent text-on-accent"
                    : "border-border text-fg-muted hover:text-fg"
                }`}
              >
                {nivel === "alta" ? "Alta" : "Normal"}
              </button>
            ))}
          </div>

          <select
            value={tarea.projectId ?? ""}
            onChange={(evento) => cambiarUnidad(evento.target.value)}
            aria-label="Unidad de negocio"
            className="rounded-co-control border border-border bg-surface px-2 py-1 text-xs text-fg"
          >
            <option value="">Sin unidad</option>
            {unidades.map((unidad) => (
              <option key={unidad.id} value={unidad.id}>
                {unidad.name}
              </option>
            ))}
          </select>
        </div>

        <div className="px-5 pt-5">
          <textarea
            ref={notasRef}
            defaultValue={tarea.notes ?? ""}
            rows={3}
            placeholder="Contexto, links, lo que necesites"
            onInput={(evento) => {
              ajustarAlto(evento.currentTarget);
              alEscribirNotas(evento.currentTarget.value);
            }}
            aria-label="Notas"
            className="rounded-co-control w-full resize-none overflow-hidden border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1 px-5 pt-6">
          <p className="text-[11px] uppercase tracking-[0.18em] text-fg-muted">Subtareas</p>

          {subtareas?.map((subtarea) => (
            <FilaSubtarea
              key={subtarea.id}
              subtarea={subtarea}
              onCambiar={(cambios) => cambiarSubtarea(subtarea.id, cambios)}
              onBorrar={() => borrarSubtarea(subtarea.id)}
            />
          ))}

          <AltaSubtarea onAgregar={agregarSubtarea} />
        </div>

        {error && (
          <p role="alert" className="px-5 pt-4 text-xs text-negative">
            {error}
          </p>
        )}

        <div className="mt-auto px-5 py-5">
          {confirmandoBorrado ? (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-fg-muted">¿Eliminar esta tarea?</span>
              <button type="button" onClick={borrarTarea} className="text-negative hover:underline">
                Sí, eliminar
              </button>
              <button
                type="button"
                onClick={() => setConfirmandoBorrado(false)}
                className="text-fg-muted hover:text-fg"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmandoBorrado(true)}
              className="text-xs text-negative hover:underline"
            >
              Eliminar tarea
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FilaSubtarea({
  subtarea,
  onCambiar,
  onBorrar,
}: {
  subtarea: Subtask;
  onCambiar: (cambios: Partial<Subtask>) => void;
  onBorrar: () => void;
}) {
  return (
    <div className="group flex items-center gap-2 py-1">
      <Casilla
        tildada={subtarea.done}
        onChange={(valor) => onCambiar({ done: valor })}
        etiqueta={`Completar "${subtarea.title}"`}
      />
      <input
        defaultValue={subtarea.title}
        onBlur={(evento) => {
          const limpio = evento.currentTarget.value.trim();
          if (!limpio) {
            evento.currentTarget.value = subtarea.title;
            return;
          }
          if (limpio !== subtarea.title) onCambiar({ title: limpio });
        }}
        aria-label="Título de la subtarea"
        className={`min-w-0 flex-1 border-0 bg-transparent p-0 text-sm focus:outline-none ${
          subtarea.done ? "text-fg-muted line-through" : "text-fg"
        }`}
      />
      <button
        type="button"
        onClick={onBorrar}
        aria-label={`Borrar "${subtarea.title}"`}
        className="shrink-0 text-fg-muted opacity-0 transition-opacity hover:text-negative focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

/** Mismo patrón que la captura principal: Enter agrega y deja el cursor listo. */
function AltaSubtarea({ onAgregar }: { onAgregar: (titulo: string) => void }) {
  return (
    <input
      type="text"
      placeholder="Agregar subtarea"
      aria-label="Nueva subtarea"
      onKeyDown={(evento) => {
        if (evento.key !== "Enter") return;
        evento.preventDefault();
        onAgregar(evento.currentTarget.value);
        evento.currentTarget.value = "";
      }}
      className="mt-1 w-full border-0 border-b border-border bg-transparent px-0 py-1 text-sm text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none"
    />
  );
}
