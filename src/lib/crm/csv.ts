/**
 * Armado y lectura de CSV del CRM. Funciones puras: no tocan la base.
 *
 * La salida usa CRLF y comillas dobles, que es lo que Excel espera, y el BOM va
 * adelante para que los acentos no se rompan al abrirlo en Windows. Mismo
 * criterio que el exportador de la base de contactos vieja.
 */
import { CONTACT_SOURCE_LABELS } from "@/lib/contactos/config";
import type { CrmContactoRow } from "./contactos";
import { chipDerivacion } from "./unidades";

const BOM = "﻿";

/** Escapa un valor: comillas dobladas, y entrecomillado si hay separadores. */
function celda(valor: unknown): string {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  if (!/[",\r\n]/.test(texto)) return texto;
  return `"${texto.replace(/"/g, '""')}"`;
}

export function aCsv(encabezados: string[], filas: unknown[][]): string {
  const lineas = [
    encabezados.map(celda).join(","),
    ...filas.map((fila) => fila.map(celda).join(",")),
  ];
  return BOM + lineas.join("\r\n");
}

const ENCABEZADOS = [
  "Email",
  "Teléfono",
  "Teléfono sin normalizar",
  "Nombre",
  "Instagram",
  "Sitio web",
  "Unidades",
  "Origen",
  "Detalle de origen",
  "Tags",
  "Suscrito a mails",
  "Fecha de baja",
  "Motivo de baja",
  "Consentimiento",
  "Origen del consentimiento",
  "Opt-in WhatsApp",
  "Fecha opt-in WhatsApp",
  "Fuente opt-in WhatsApp",
  "Fecha de alta",
];

/** Sólo la fecha: la hora no aporta nada en una planilla. */
function dia(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export function contactosACsv(filas: CrmContactoRow[]): string {
  return aCsv(
    ENCABEZADOS,
    filas.map((f) => [
      f.email ?? "",
      f.telefonoE164 ?? "",
      f.telefonoCrudo ?? "",
      f.nombre ?? "",
      f.instagram ?? "",
      f.sitioWeb ?? "",
      // "Comunidad · Alumno; 1:1 · Propuesta enviada". Una columna y no una por
      // unidad: la cantidad de unidades cambia y una planilla con columnas
      // variables no se puede volver a importar.
      f.derivaciones.map((d) => chipDerivacion(d.unidad, d.estado)).join("; "),
      CONTACT_SOURCE_LABELS[f.origen] ?? f.origen,
      f.origenDetalle ?? "",
      f.tags.join(", "),
      f.suscripto ? "Sí" : "No",
      dia(f.bajaAt),
      f.bajaMotivo ?? "",
      dia(f.consentimientoAt),
      f.consentimientoFuente ?? "",
      f.whatsappOptIn ? "Sí" : "No",
      dia(f.whatsappOptInAt),
      f.whatsappOptInFuente ?? "",
      dia(f.createdAt),
    ])
  );
}

/** Una fila que el importador no pudo procesar, con el motivo. */
export type FilaRechazada = { fila: number; valor: string; motivo: string };

export function rechazadasACsv(filas: FilaRechazada[]): string {
  return aCsv(
    ["Fila", "Valor", "Motivo"],
    filas.map((f) => [f.fila, f.valor, f.motivo])
  );
}

/**
 * Fecha de una celda del CSV a Date, o null.
 *
 * Acepta ISO (`2025-03-14`, con o sin hora) y el formato de planilla local
 * (`14/03/2025`). Lo que no se entiende se descarta en silencio: la fecha de
 * consentimiento es un dato deseable, no una razón para rechazar la fila.
 */
export function parsearFechaCsv(raw: string | null | undefined): Date | null {
  const valor = String(raw ?? "").trim();
  if (!valor) return null;

  const local = valor.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (local) {
    const [, d, m, y] = local;
    const fecha = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;
  // Una fecha absurda casi siempre es una columna mal mapeada.
  const anio = fecha.getFullYear();
  return anio >= 2000 && anio <= 2100 ? fecha : null;
}
