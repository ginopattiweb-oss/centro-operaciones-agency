import type { Metadata } from "next";
import { Geist, Poppins } from "next/font/google";
import "./globals.css";

/**
 * Fuentes del sistema oscuro: Geist para display y números,
 * Poppins para cuerpo. Se exponen como --font-*-co y globals.css
 * las alias a --font-heading / --font-sans.
 */
const geist = Geist({
  variable: "--font-geist-co",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins-co",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Centro de Operaciones",
  description: "Centro de operaciones de la agencia",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geist.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-bg text-fg font-sans">{children}</body>
    </html>
  );
}
