/**
 * BPF — Annexe 1 (2022) : grades A à D.
 * Tableau 1 (particules) et tableau 6 (limites microbiologiques en activité).
 * null = non spécifié / non prédéterminé par l'Annexe 1.
 */

export type GradeBpf = "A" | "B" | "C" | "D";
export const GRADES_BPF: GradeBpf[] = ["A", "B", "C", "D"];

export interface LimitesParticulesBpf {
  "0.5": number | null;
  "5": number | null;
}

export interface DefinitionGrade {
  grade: GradeBpf;
  isoAuRepos: number;
  isoEnActivite: number | null;
  particulesAuRepos: LimitesParticulesBpf;
  particulesEnActivite: LimitesParticulesBpf;
  /** Limites microbiologiques en activité. 0 = « pas de croissance ». */
  microbio: {
    airUfcM3: number | null;
    sedimentationUfc4h: number | null;
    contactUfcBoite: number | null;
    gantsUfcGant: number | null;
  };
  usage: string;
}

export const DEFINITIONS_GRADES: Record<GradeBpf, DefinitionGrade> = {
  A: {
    grade: "A",
    isoAuRepos: 5,
    isoEnActivite: 5,
    particulesAuRepos: { "0.5": 3_520, "5": null },
    particulesEnActivite: { "0.5": 3_520, "5": null },
    microbio: { airUfcM3: 0, sedimentationUfc4h: 0, contactUfcBoite: 0, gantsUfcGant: 0 },
    usage: "Opérations à haut risque : remplissage aseptique, connexions aseptiques",
  },
  B: {
    grade: "B",
    isoAuRepos: 5,
    isoEnActivite: 7,
    particulesAuRepos: { "0.5": 3_520, "5": null },
    particulesEnActivite: { "0.5": 352_000, "5": 2_930 },
    microbio: { airUfcM3: 10, sedimentationUfc4h: 5, contactUfcBoite: 5, gantsUfcGant: 5 },
    usage: "Environnement immédiat du grade A",
  },
  C: {
    grade: "C",
    isoAuRepos: 7,
    isoEnActivite: 8,
    particulesAuRepos: { "0.5": 352_000, "5": 2_930 },
    particulesEnActivite: { "0.5": 3_520_000, "5": 29_300 },
    microbio: { airUfcM3: 100, sedimentationUfc4h: 50, contactUfcBoite: 25, gantsUfcGant: null },
    usage: "Étapes moins critiques de la fabrication stérile",
  },
  D: {
    grade: "D",
    isoAuRepos: 8,
    isoEnActivite: null,
    particulesAuRepos: { "0.5": 3_520_000, "5": 29_300 },
    particulesEnActivite: { "0.5": null, "5": null },
    microbio: { airUfcM3: 200, sedimentationUfc4h: 100, contactUfcBoite: 50, gantsUfcGant: null },
    usage: "Étapes les moins critiques, préparation des composants",
  },
};
