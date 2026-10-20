/**
 * ISO 14644-1:2015 — classes de propreté particulaire de l'air.
 * Tableau 1 de la norme (concentrations maximales admissibles, particules/m³)
 * et tableau A.1 (nombre minimal de points de prélèvement).
 */

export const TAILLES_PARTICULES = [0.1, 0.2, 0.3, 0.5, 1, 5] as const;
export type TailleParticule = (typeof TAILLES_PARTICULES)[number];

export const CLASSES_ISO = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** Valeurs du tableau 1. Une taille absente signifie « non applicable » pour la classe. */
export const LIMITES_ISO: Record<number, Partial<Record<TailleParticule, number>>> = {
  1: { 0.1: 10 },
  2: { 0.1: 100, 0.2: 24, 0.3: 10 },
  3: { 0.1: 1_000, 0.2: 237, 0.3: 102, 0.5: 35 },
  4: { 0.1: 10_000, 0.2: 2_370, 0.3: 1_020, 0.5: 352, 1: 83 },
  5: { 0.1: 100_000, 0.2: 23_700, 0.3: 10_200, 0.5: 3_520, 1: 832 },
  6: { 0.1: 1_000_000, 0.2: 237_000, 0.3: 102_000, 0.5: 35_200, 1: 8_320, 5: 293 },
  7: { 0.5: 352_000, 1: 83_200, 5: 2_930 },
  8: { 0.5: 3_520_000, 1: 832_000, 5: 29_300 },
  9: { 0.5: 35_200_000, 1: 8_320_000, 5: 293_000 },
};

/** Arrondi à 3 chiffres significatifs, puis à l'entier (règle de la norme). */
function arrondiNorme(valeur: number): number {
  if (valeur <= 0) return 0;
  const puissance = Math.floor(Math.log10(valeur)) - 2;
  const pas = Math.pow(10, Math.max(puissance, 0));
  return Math.round(valeur / pas) * pas;
}

/**
 * Concentration maximale pour une classe (entière ou intermédiaire, par pas de 0,1)
 * et une taille. Retourne null si la taille n'est pas applicable à la classe.
 * Formule de la norme : Cn = 10^N × (0,1 / D)^2,08.
 */
export function limiteIso(classe: number, taille: TailleParticule): number | null {
  if (!(classe >= 1 && classe <= 9)) return null;
  if (Number.isInteger(classe)) return LIMITES_ISO[classe][taille] ?? null;
  // Classe intermédiaire : applicabilité de la classe entière inférieure.
  const inferieure = Math.floor(classe);
  if (LIMITES_ISO[inferieure][taille] === undefined) return null;
  return arrondiNorme(Math.pow(10, classe) * Math.pow(0.1 / taille, 2.08));
}

/** Tableau A.1 : surface maximale (m²) → nombre minimal de points. */
export const POINTS_PRELEVEMENT_A1: ReadonlyArray<readonly [number, number]> = [
  [2, 1], [4, 2], [6, 3], [8, 4], [10, 5], [24, 6], [28, 7], [32, 8], [36, 9],
  [52, 10], [56, 11], [64, 12], [68, 13], [72, 14], [76, 15], [104, 16], [108, 17],
  [116, 18], [148, 19], [156, 20], [192, 21], [232, 22], [276, 23], [352, 24],
  [436, 25], [636, 26], [1000, 27],
];

/**
 * Nombre minimal de points de prélèvement pour une surface (m²).
 * Au-delà de 1000 m² : NL = 27 × (A / 1000), arrondi à l'entier supérieur.
 */
export function pointsMinimaux(surfaceM2: number): number | null {
  if (!(surfaceM2 > 0)) return null;
  for (const [max, points] of POINTS_PRELEVEMENT_A1) {
    if (surfaceM2 <= max) return points;
  }
  return Math.ceil(27 * (surfaceM2 / 1000));
}

export function libelleClasse(classe: number | null | undefined): string {
  if (classe === null || classe === undefined) return "—";
  return `ISO ${String(classe).replace(".", ",")}`;
}
