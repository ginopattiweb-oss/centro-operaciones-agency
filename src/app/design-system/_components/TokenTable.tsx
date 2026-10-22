"use client";

import { useEffect, useState } from "react";

type Token = { name: string; use: string };

/** Resuelve un color CSS (#hex de 3/6 dígitos o rgb/rgba) a [r,g,b,a]. */
function parseColor(input: string): [number, number, number, number] | null {
  const value = input.trim();
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    const full =
      hex.length === 3
        ? hex
            .split("")
            .map((c) => c + c)
            .join("")
        : hex;
    if (full.length !== 6) return null;
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
      1,
    ];
  }
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) return null;
  const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.some(Number.isNaN)) return null;
  return [parts[0], parts[1], parts[2], parts[3] ?? 1];
}

/** Compone un color con alfa sobre un fondo opaco. */
function flatten(
  fg: [number, number, number, number],
  bg: [number, number, number, number]
): [number, number, number] {
  const a = fg[3];
  return [
    fg[0] * a + bg[0] * (1 - a),
    fg[1] * a + bg[1] * (1 - a),
    fg[2] * a + bg[2] * (1 - a),
  ];
}

function luminance([r, g, b]: [number, number, number]) {
  const lin = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** Ratio de contraste WCAG 2.1 entre dos colores ya resueltos. */
function contrast(fg: string, bg: string): number | null {
  const f = parseColor(fg);
  const b = parseColor(bg);
  if (!f || !b) return null;
  const l1 = luminance(flatten(f, b));
  const l2 = luminance([b[0], b[1], b[2]]);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Lee los valores reales de las variables CSS del documento. */
function useTokenValues(names: string[]) {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    const next: Record<string, string> = {};
    for (const name of names) {
      next[name] = styles.getPropertyValue(name).trim();
    }
    setValues(next);
  }, [names.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  return values;
}

/**
 * Tabla de swatches. El valor mostrado no está hardcodeado: se lee de la
 * variable CSS en el navegador, así que la página no puede desincronizarse
 * de globals.css.
 */
export function TokenTable({
  tokens,
  contrastAgainst,
}: {
  tokens: Token[];
  /** Si viene, muestra el contraste del token contra estas superficies. */
  contrastAgainst?: string[];
}) {
  const names = [...tokens.map((t) => t.name), ...(contrastAgainst ?? [])];
  const values = useTokenValues(names);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-left">
        <thead>
          <tr className="border-b border-co-subtle">
            <th className="co-microlabel py-2 pr-4 font-medium">Swatch</th>
            <th className="co-microlabel py-2 pr-4 font-medium">Token</th>
            <th className="co-microlabel py-2 pr-4 font-medium">Valor</th>
            {contrastAgainst?.map((surface) => (
              <th key={surface} className="co-microlabel py-2 pr-4 font-medium">
                vs {surface.replace("--", "")}
              </th>
            ))}
            <th className="co-microlabel py-2 font-medium">Uso</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token) => (
            <tr key={token.name} className="border-b border-co-subtle/60">
              <td className="py-3 pr-4">
                <span
                  className="block h-8 w-14 rounded-co-control border border-co-subtle"
                  style={{ background: `var(${token.name})` }}
                />
              </td>
              <td className="py-3 pr-4 font-mono text-[12px] text-co-primary">
                {token.name}
              </td>
              <td className="py-3 pr-4 font-mono text-[12px] tabular-nums text-co-secondary">
                {values[token.name] || "—"}
              </td>
              {contrastAgainst?.map((surface) => {
                const ratio =
                  values[token.name] && values[surface]
                    ? contrast(values[token.name], values[surface])
                    : null;
                return (
                  <td
                    key={surface}
                    className="py-3 pr-4 font-mono text-[12px] tabular-nums"
                    style={{
                      color:
                        ratio === null
                          ? "var(--text-tertiary)"
                          : ratio >= 4.5
                            ? "var(--positive)"
                            : ratio >= 3
                              ? "var(--accent)"
                              : "var(--negative)",
                    }}
                  >
                    {ratio === null ? "—" : `${ratio.toFixed(2)}:1`}
                  </td>
                );
              })}
              <td className="py-3 co-delta">{token.use}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
