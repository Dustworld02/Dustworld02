import type { Bouche, Filtre, Porte, ReleveFiltre, Zone } from "../data/types";
import { volumeM3 } from "./exigencesZone";
import { DEFINITIONS_GRADES } from "./referentiels/gradesBpf";

export type Statut = "ok" | "attention" | "alerte" | "inconnu" | "info";

/** Indice de propreté : plus il est petit, plus la zone est propre. L'extérieur vaut 100. */
export function indicePropete(zone: Pick<Zone, "iso_repos" | "grade_bpf" | "zone_risque"> | null): number {
  if (!zone) return 100;
  if (zone.grade_bpf) return DEFINITIONS_GRADES[zone.grade_bpf].isoAuRepos - 0.1 * (4 - "ABCD".indexOf(zone.grade_bpf)) / 4;
  if (zone.iso_repos != null) return zone.iso_repos;
  if (zone.zone_risque != null) return 10 - zone.zone_risque;
  return 50;
}

export interface AnalysePorte {
  porte: Porte;
  zoneHaute: Zone | null;
  zoneBasse: Zone | null;
  /** Différence de pression haute − basse (Pa). */
  deltaPa: number | null;
  statut: Statut;
  message: string;
}

/** Écart minimal recommandé entre zones de propreté différente (Annexe 1 : 10 à 15 Pa). */
export const ECART_MINIMAL_PA = 10;

function nomZone(z: Zone | null): string {
  return z ? `${z.code ? `${z.code} ` : ""}${z.nom}` : "l'extérieur";
}

/**
 * Analyse de la cascade de pression porte par porte. L'air doit aller de la
 * zone la plus propre vers la moins propre ; une zone en dépression
 * (confinement) doit au contraire rester sous la pression de ses voisines.
 */
export function analyserCascade(zones: Zone[], portes: Porte[]): AnalysePorte[] {
  const parId = new Map(zones.map((z) => [z.id, z]));
  return portes.map((porte) => {
    const a = porte.zone_a ? parId.get(porte.zone_a) ?? null : null;
    const b = porte.zone_b ? parId.get(porte.zone_b) ?? null : null;
    if (!a && !b) return { porte, zoneHaute: null, zoneBasse: null, deltaPa: null, statut: "inconnu", message: "Porte non rattachée à des zones." };
    const pa = a ? a.pression_pa : 0;
    const pb = b ? b.pression_pa : 0;
    if (pa == null || pb == null) {
      return { porte, zoneHaute: a, zoneBasse: b, deltaPa: null, statut: "inconnu", message: `Consigne de pression manquante (${nomZone(pa == null ? a : b)}).` };
    }
    const [haute, basse, ph, pbas] = pa >= pb ? [a, b, pa, pb] : [b, a, pb, pa];
    const delta = ph - pbas;
    const base = { porte, zoneHaute: haute, zoneBasse: basse, deltaPa: delta };
    if ((a && (a.pression_pa ?? 0) < 0) || (b && (b.pression_pa ?? 0) < 0)) {
      return { ...base, statut: "info", message: `Confinement : l'air va de ${nomZone(haute)} vers ${nomZone(basse)} (${delta} Pa).` };
    }
    const iHaute = indicePropete(haute);
    const iBasse = indicePropete(basse);
    if (iHaute > iBasse) {
      return { ...base, statut: "alerte", message: `Inversion : l'air passe de ${nomZone(haute)} (moins propre) vers ${nomZone(basse)} (plus propre).` };
    }
    if (iHaute === iBasse) {
      return { ...base, statut: "ok", message: `Même niveau de propreté, ${delta} Pa.` };
    }
    if (delta < ECART_MINIMAL_PA) {
      return { ...base, statut: "attention", message: `Écart de ${delta} Pa entre ${nomZone(haute)} et ${nomZone(basse)} : moins de ${ECART_MINIMAL_PA} Pa recommandés.` };
    }
    return { ...base, statut: "ok", message: `${nomZone(haute)} → ${nomZone(basse)} : ${delta} Pa.` };
  });
}

export interface BilanAeraulique {
  zone: Zone;
  souffleM3h: number;
  repriseM3h: number;
  extractionM3h: number;
  volumeM3: number | null;
  tauxVolH: number | null;
  statut: Statut;
  message: string;
}

/** Débits par zone et taux de renouvellement comparé à la cible. */
export function bilanAeraulique(zones: Zone[], bouches: Bouche[]): BilanAeraulique[] {
  return zones.map((zone) => {
    const liees = bouches.filter((b) => b.zone_id === zone.id);
    const somme = (type: Bouche["type"]) => liees.filter((b) => b.type === type).reduce((t, b) => t + (b.debit_m3h ?? 0), 0);
    const souffle = somme("soufflage");
    const volume = volumeM3(zone);
    const taux = volume && souffle > 0 ? Math.round((souffle / volume) * 10) / 10 : null;
    let statut: Statut = "inconnu";
    let message = "";
    if (taux === null) message = volume ? "Aucun débit de soufflage renseigné." : "Volume inconnu (surface et hauteur).";
    else if (zone.renouvellement_vol_h == null) { statut = "info"; message = "Pas de cible de renouvellement."; }
    else if (taux < zone.renouvellement_vol_h) { statut = "alerte"; message = `${taux} vol/h pour une cible de ${zone.renouvellement_vol_h}.`; }
    else { statut = "ok"; message = `${taux} vol/h (cible ${zone.renouvellement_vol_h}).`; }
    return { zone, souffleM3h: souffle, repriseM3h: somme("reprise"), extractionM3h: somme("extraction"), volumeM3: volume, tauxVolH: taux, statut, message };
  });
}

export interface EtatFiltre {
  dernierReleve: ReleveFiltre | null;
  /** Encrassement entre perte de charge initiale (0 %) et finale (100 %). */
  encrassementPct: number | null;
  echeanceRemplacement: string | null;
  statut: Statut;
  message: string;
}

export function etatFiltre(filtre: Filtre, releves: ReleveFiltre[], aujourdhui = new Date()): EtatFiltre {
  const tries = releves.filter((r) => r.filtre_id === filtre.id).sort((a, b) => b.date_releve.localeCompare(a.date_releve));
  const dernier = tries[0] ?? null;
  let encrassement: number | null = null;
  if (dernier && filtre.dp_finale_pa != null && filtre.dp_initiale_pa != null && filtre.dp_finale_pa > filtre.dp_initiale_pa) {
    encrassement = Math.round(((dernier.dp_pa - filtre.dp_initiale_pa) / (filtre.dp_finale_pa - filtre.dp_initiale_pa)) * 100);
  }
  let echeance: string | null = null;
  if (filtre.date_pose && filtre.periodicite_remplacement_mois) {
    const d = new Date(filtre.date_pose);
    d.setMonth(d.getMonth() + filtre.periodicite_remplacement_mois);
    echeance = d.toISOString().slice(0, 10);
  }
  const depasse = echeance !== null && new Date(echeance) < aujourdhui;
  if (filtre.statut === "remplace") return { dernierReleve: dernier, encrassementPct: encrassement, echeanceRemplacement: echeance, statut: "info", message: "Filtre remplacé (historique)." };
  if (encrassement !== null && encrassement >= 100) return { dernierReleve: dernier, encrassementPct: encrassement, echeanceRemplacement: echeance, statut: "alerte", message: `Colmaté : ${dernier!.dp_pa} Pa pour une perte de charge finale de ${filtre.dp_finale_pa} Pa.` };
  if (depasse) return { dernierReleve: dernier, encrassementPct: encrassement, echeanceRemplacement: echeance, statut: "alerte", message: `Remplacement prévu le ${new Date(echeance!).toLocaleDateString("fr-FR")} dépassé.` };
  if (encrassement !== null && encrassement >= 80) return { dernierReleve: dernier, encrassementPct: encrassement, echeanceRemplacement: echeance, statut: "attention", message: `Encrassé à ${encrassement} % : prévoir le remplacement.` };
  if (!dernier) return { dernierReleve: null, encrassementPct: null, echeanceRemplacement: echeance, statut: "inconnu", message: "Aucun relevé de perte de charge." };
  return { dernierReleve: dernier, encrassementPct: encrassement, echeanceRemplacement: echeance, statut: "ok", message: encrassement !== null ? `Encrassement ${encrassement} %.` : `${dernier.dp_pa} Pa.` };
}
