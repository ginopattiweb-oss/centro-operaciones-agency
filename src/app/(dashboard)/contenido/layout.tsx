import { Share2 } from "lucide-react";
import { ContenidoTabs } from "./_components/ContenidoTabs";

export default function ContenidoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 md:p-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-fg-muted">Redes sociales · transversal</p>
          <h1 className="mt-1 flex items-center gap-2 font-heading text-3xl text-fg">
            <Share2 className="h-6 w-6 text-fg-muted" />
            Contenido
          </h1>
        </div>
        <ContenidoTabs />
      </header>
      {children}
    </div>
  );
}
