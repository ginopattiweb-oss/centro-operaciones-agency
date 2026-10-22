import type { Metadata } from "next";
import { CoTheme } from "@/components/ui/CoTheme";

export const metadata: Metadata = {
  title: "Sistema de diseño — Centro de Operaciones",
};

export default function DesignSystemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CoTheme className="min-h-screen">{children}</CoTheme>;
}
