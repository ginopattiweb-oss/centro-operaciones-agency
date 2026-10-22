"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { EVENTO_FOCO_CAPTURA } from "./QuickCapture";

/**
 * `N` desde cualquier pantalla del panel: va a Tareas y deja el cursor en la
 * captura rápida. No se dispara si estás escribiendo en un campo.
 */
export function AtajoNuevaTarea() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function estaEscribiendo(destino: EventTarget | null): boolean {
      if (!(destino instanceof HTMLElement)) return false;
      if (destino.isContentEditable) return true;
      return ["INPUT", "TEXTAREA", "SELECT"].includes(destino.tagName);
    }

    function alApretarTecla(evento: KeyboardEvent) {
      if (evento.key !== "n" && evento.key !== "N") return;
      if (evento.metaKey || evento.ctrlKey || evento.altKey) return;
      if (estaEscribiendo(evento.target)) return;

      evento.preventDefault();

      if (pathname === "/tareas") {
        window.dispatchEvent(new Event(EVENTO_FOCO_CAPTURA));
      } else {
        router.push("/tareas");
      }
    }

    window.addEventListener("keydown", alApretarTecla);
    return () => window.removeEventListener("keydown", alApretarTecla);
  }, [pathname, router]);

  return null;
}
