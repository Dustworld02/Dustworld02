/** Fichier CSV lisible par un tableur français : séparateur « ; », virgule décimale, BOM UTF-8. */
export function versCsv(entetes: string[], lignes: (string | number | boolean | null | undefined)[][]): string {
  const cellule = (v: string | number | boolean | null | undefined) => {
    if (v == null) return "";
    const t = typeof v === "number" ? String(v).replace(".", ",") : typeof v === "boolean" ? (v ? "oui" : "non") : v;
    return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return `﻿${[entetes, ...lignes].map((l) => l.map(cellule).join(";")).join("\r\n")}\r\n`;
}
