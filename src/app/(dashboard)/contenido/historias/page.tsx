import { EmptyState } from "../_components/EmptyState";

export const metadata = { title: "Historias · Contenido" };

export default function HistoriasPage() {
  return (
    <EmptyState title="Historias">
      Las historias necesitan una cuenta de Instagram conectada. Por ahora la única fuente es
      TikTok, que no expone historias por API.
    </EmptyState>
  );
}
