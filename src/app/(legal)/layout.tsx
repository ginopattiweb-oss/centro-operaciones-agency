import Link from "next/link";
import { AGENCY_NAME } from "@/lib/marca";

/** Páginas públicas (sin sesión): las piden Meta y TikTok para aprobar las apps. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 md:py-16">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-wider text-fg-muted">{AGENCY_NAME}</p>
        <p className="font-heading text-lg text-fg">Centro de Operaciones</p>
      </header>
      <main className="prose-legal flex flex-1 flex-col gap-6 text-sm leading-relaxed text-fg-muted [&_h1]:font-heading [&_h1]:text-3xl [&_h1]:text-fg [&_h2]:mt-4 [&_h2]:font-heading [&_h2]:text-lg [&_h2]:text-fg [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
        {children}
      </main>
      <footer className="mt-12 flex flex-wrap gap-4 border-t border-border pt-6 text-xs text-fg-muted">
        <Link href="/privacidad" className="hover:text-fg">
          Política de privacidad
        </Link>
        <Link href="/terminos" className="hover:text-fg">
          Términos de servicio
        </Link>
      </footer>
    </div>
  );
}
