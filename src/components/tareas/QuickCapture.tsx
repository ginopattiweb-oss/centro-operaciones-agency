"use client";

import { useEffect, useRef } from "react";
import type { TaskLocation, TaskPriority } from "@/db/schema";
import { parsearCaptura } from "@/lib/tareas";

/** Evento que dispara el atajo global `N` cuando ya estás parado en /tareas. */
export const EVENTO_FOCO_CAPTURA = "tareas:foco-captura";

/**
 * Anotar al vuelo: una línea, Enter y seguís. El input nunca pierde el foco ni se
 * limpia la pantalla, así se pueden tirar cinco tareas seguidas sin tocar el mouse.
 * Enter manda a la bandeja; Cmd/Ctrl + Enter manda directo a hoy.
 */
export function QuickCapture({
  onCrear,
  /** En /tareas el foco es automático; donde la captura es secundaria, no. */
  focoAlEntrar = true,
}: {
  onCrear: (input: { title: string; priority: TaskPriority; location: TaskLocation }) => void;
  focoAlEntrar?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focoAlEntrar) inputRef.current?.focus();

    const enfocar = () => inputRef.current?.focus();
    window.addEventListener(EVENTO_FOCO_CAPTURA, enfocar);
    return () => window.removeEventListener(EVENTO_FOCO_CAPTURA, enfocar);
  }, [focoAlEntrar]);

  function alApretarTecla(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key !== "Enter") return;
    evento.preventDefault();

    const input = evento.currentTarget;
    const { title, priority } = parsearCaptura(input.value);
    if (!title) return;

    onCrear({
      title,
      priority,
      location: evento.metaKey || evento.ctrlKey ? "hoy" : "bandeja",
    });

    input.value = "";
  }

  return (
    <input
      ref={inputRef}
      type="text"
      onKeyDown={alApretarTecla}
      placeholder="Escribí una tarea y apretá Enter"
      aria-label="Nueva tarea"
      className="rounded-co-control w-full border border-border bg-surface px-4 py-3 text-sm text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none"
    />
  );
}
