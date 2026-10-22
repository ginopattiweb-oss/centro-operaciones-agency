/**
 * Normalización de teléfonos a E.164. Única implementación del proyecto: la
 * importan la capa de datos del CRM, el webhook del formulario y el script de
 * migración (scripts/crm-migrar.ts).
 *
 * Por qué E.164 y no "lo que tipeó la persona": es el único formato que acepta
 * la Cloud API de WhatsApp, y la base tiene un CHECK que lo exige
 * (`^\+[1-9][0-9]{7,14}$`). La base de datos vieja tenía tres formatos
 * conviviendo —'+54 9 11 1234-5678', '+5804120000000', '3810000000'— y ninguno
 * servía para mandar un mensaje.
 *
 * Sobre el import: se usa `core` con la metadata pasada a mano y no el entry
 * por defecto `libphonenumber-js`. El entry por defecto carga su JSON con un
 * require interno que bajo tsx vuelve envuelto en `{ default }`, y la librería
 * revienta con "Cannot read properties of undefined (reading 'hasOwnProperty')"
 * sobre un número perfectamente válido. Pasándola explícita no depende del
 * interop ESM/CJS del runtime, y el mismo archivo sirve en Next y en un script.
 *
 * Metadata `max` y no `min` porque es la única que trae el tipo de línea
 * (MOBILE / FIXED_LINE), y eso hace falta para detectar los móviles argentinos
 * a los que les falta el 9.
 */
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/core";
import metadataRaw from "libphonenumber-js/max/metadata";

const METADATA = ((metadataRaw as unknown as { default?: unknown }).default ??
  metadataRaw) as never;

/** País que se asume cuando el número llega sin código internacional. */
export const PAIS_DEFECTO: CountryCode = "AR";

/**
 * Marcas Unicode invisibles que vienen pegadas a los números copiados de
 * WhatsApp: embeds de dirección de texto (LRE/RLE/PDF), marcas de izquierda a
 * derecha y el BOM.
 *
 * No es un caso hipotético: 13 de los 46 teléfonos de `members` las tenían, y
 * sin sacarlas el parseo falla con un número que a ojo se ve perfecto.
 */
const INVISIBLES = /[​-‏‪-‮⁦-⁩﻿]/g;

/** Saca lo invisible y normaliza el guion no separable. No valida nada. */
export function limpiarTelefono(raw: string): string {
  return raw.replace(INVISIBLES, "").replace(/‑/g, "-").trim();
}

export type TelefonoNormalizado = {
  /** E.164 si se pudo normalizar. */
  e164: string | null;
  /** Lo tipeado (ya limpio) si NO se pudo. Exactamente uno de los dos es null. */
  crudo: string | null;
  /** MOBILE, FIXED_LINE, etc. Null si no se pudo determinar. */
  tipo: string | null;
  /** Por qué falló, para los reportes. */
  motivo: string | null;
};

const VACIO: TelefonoNormalizado = { e164: null, crudo: null, tipo: null, motivo: null };

/**
 * Normaliza un teléfono.
 *
 * Nunca descarta el dato: si el número no se puede interpretar, vuelve en
 * `crudo`. Es deliberado — el webhook del formulario no puede perder un lead
 * porque el visitante tipeó mal el teléfono, y hay leads reales cuyo único dato
 * de contacto es un número inválido.
 */
export function normalizarTelefono(
  raw: string | null | undefined,
  pais: CountryCode = PAIS_DEFECTO
): TelefonoNormalizado {
  if (!raw) return VACIO;
  const limpio = limpiarTelefono(raw);
  if (!limpio) return VACIO;

  const parsed = parsePhoneNumberFromString(limpio, { defaultCountry: pais }, METADATA);
  if (!parsed) {
    return { e164: null, crudo: limpio, tipo: null, motivo: "no se pudo interpretar" };
  }
  if (!parsed.isValid()) {
    return {
      e164: null,
      crudo: limpio,
      tipo: null,
      motivo: `inválido para ${parsed.country ?? pais}`,
    };
  }
  return { e164: parsed.number, crudo: null, tipo: parsed.getType() ?? null, motivo: null };
}

/** Sólo el E.164, o null. Para los caminos a los que no les importa el motivo. */
export function aE164(
  raw: string | null | undefined,
  pais: CountryCode = PAIS_DEFECTO
): string | null {
  return normalizarTelefono(raw, pais).e164;
}

/**
 * Un móvil argentino necesita el 9 después del +54 para que WhatsApp lo acepte.
 *
 * El 9 NO se agrega automáticamente en ningún lado: el número también es válido
 * como fijo y agregarlo sería inventar un dígito. Esto sólo marca el número para
 * que alguien lo revise. Hoy aplica a 12 contactos reales.
 */
export function sospechaFaltaNueveAr(e164: string | null, tipo: string | null): boolean {
  if (!e164 || !e164.startsWith("+54") || e164.startsWith("+549")) return false;
  return tipo === "FIXED_LINE" || tipo === null;
}

/** El número listo para un link de WhatsApp: E.164 sin el '+'. */
export function aNumeroWhatsapp(e164: string): string {
  return e164.replace(/^\+/, "");
}
