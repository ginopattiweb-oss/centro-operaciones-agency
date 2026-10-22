"use client";

import { useState, useTransition } from "react";
import { crearTarea } from "@/lib/actions/tasks";
import { QuickCapture } from "./QuickCapture";

/**
 * La captura rápida conectada a la base, para usarla fuera de /tareas. Enter
 * manda a la bandeja, Cmd/Ctrl + Enter a hoy; sin campos extra, igual que en
 * la sección de Tareas.
 */
export function CapturaRapida({ focoAlEntrar = false }: { focoAlEntrar?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <QuickCapture
        focoAlEntrar={focoAlEntrar}
        onCrear={(input) =>
          empezar(async () => {
            setError(null);
            try {
              await crearTarea(input);
            } catch {
              setError("No pudimos guardar la tarea. Fijate la conexión y probá de nuevo.");
            }
          })
        }
      />
      {error && (
        <p role="alert" className="text-xs text-negative">
          {error}
        </p>
      )}
    </div>
  );
}
