import type { Ecart, Essai, InterventionNettoyage, ReleveAmbiance, Resultat, SallePropre, Zone } from "../data/types";
import type { Periodicite } from "./referentiels/periodicites";
import { echeancier, type StatutEcheance } from "./qualification";
import { horsLimites } from "./surveillance";

export interface SyntheseSalle {
  salle: SallePropre;
  /** État de l'échéancier de requalification des zones. */
  qualification: EtatQualification | null;
  prochaineRequalification: string | null;
  resultats: number;
  excursions: number;
  /** Part des résultats évalués sans dépassement sur la période, en %. */
  conformite: number | null;
  nettoyagesPrevus: number;
  nettoyagesFaits: number;
  ecartsOuverts: number;
  ambianceHorsLimites: number;
}

/** « incomplete » : salle qualifiée, mais au moins un essai périodique jamais réalisé sur une zone. */
export type EtatQualification = StatutEcheance | "incomplete";

function etatQualification(statuts: StatutEcheance[]): EtatQualification | null {
  if (!statuts.length) return null;
  if (statuts.every((x) => x === "jamais")) return "jamais";
  if (statuts.includes("en_retard")) return "en_retard";
  if (statuts.includes("a_echeance")) return "a_echeance";
  return statuts.includes("jamais") ? "incomplete" : "a_jour";
}

const jourIso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Synthèse par salle pour le tableau de bord : état de qualification,
 * conformité de la surveillance, réalisation du nettoyage, écarts ouverts
 * et dépassements d'ambiance sur une période glissante.
 */
export function syntheseSalles(src: {
  salles: SallePropre[];
  zones: Zone[];
  essais: Essai[];
  periodicites: Periodicite[];
  resultats: Resultat[];
  interventions: InterventionNettoyage[];
  ecarts: Ecart[];
  releves: ReleveAmbiance[];
}, jours = 30, aujourdhui = new Date()): SyntheseSalle[] {
  const debut = new Date(aujourdhui.getTime() - jours * 86400000).toISOString();
  const jour = jourIso(aujourdhui);
  return src.salles.map((salle) => {
    const zones = src.zones.filter((z) => z.salle_id === salle.id);
    const lignes = echeancier(zones, src.essais, src.periodicites, aujourdhui);
    const qualification = etatQualification(lignes.map((l) => l.statut));
    const prochaineRequalification = lignes.map((l) => l.prochaine).filter((x): x is string => !!x).sort()[0] ?? null;
    const resultats = src.resultats.filter((r) => r.salle_id === salle.id && r.origine !== "qualification" && r.date_prelevement >= debut);
    const evalues = resultats.filter((r) => r.verdict !== "non_evalue");
    const excursions = evalues.filter((r) => r.verdict === "alerte" || r.verdict === "action").length;
    const interventions = src.interventions.filter((i) => i.salle_id === salle.id && i.date_prevue >= debut.slice(0, 10) && i.date_prevue < jour);
    const idsZones = new Set(zones.map((z) => z.id));
    const ambianceHorsLimites = src.releves.filter((r) => idsZones.has(r.zone_id) && r.date_mesure >= debut && horsLimites(zones.find((z) => z.id === r.zone_id)!, r.grandeur, r.valeur)).length;
    return {
      salle, qualification, prochaineRequalification,
      resultats: resultats.length, excursions,
      conformite: evalues.length ? Math.round(((evalues.length - excursions) / evalues.length) * 1000) / 10 : null,
      nettoyagesPrevus: interventions.length, nettoyagesFaits: interventions.filter((i) => i.statut === "realisee").length,
      ecartsOuverts: src.ecarts.filter((e) => e.salle_id === salle.id && !["cloture", "annule"].includes(e.statut)).length,
      ambianceHorsLimites,
    };
  });
}
