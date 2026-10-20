import type { Changement, Cta, GammeMaintenance, InterventionMaintenance, PlanEchantillonnage, Resultat } from "../data/types";
import type { EcheanceAPlanifier } from "./echeances";
import { ajouterMois } from "./mesures";
import { prelevementsDus } from "./surveillance";

export const CATEGORIES_CHANGEMENT: Record<Changement["categorie"], string> = {
  installation: "Installation, locaux", traitement_air: "Traitement d'air", procede: "Procédé, équipement", nettoyage: "Nettoyage, produits",
  implantation: "Implantation du mobilier", documentation: "Documentation", fournisseur: "Fournisseur, prestataire", autre: "Autre",
};

export const STATUTS_CHANGEMENT: Record<Changement["statut"], string> = {
  brouillon: "Brouillon", en_evaluation: "En évaluation", approuve: "Approuvé", realise: "Réalisé", cloture: "Clôturé", refuse: "Refusé",
};

/** Domaines à évaluer pour tout changement (ISO 14644-2 §5, Annexe 1 §4.x, ISO 13485 §7.3.9). */
export const IMPACTS_CHANGEMENT = {
  qualification: "État qualifié (classification, débits, pressions, récupération)",
  nettoyage: "Procédures et validation du nettoyage",
  surveillance: "Plan d'échantillonnage et limites",
  documents: "Documents (procédures, plans, URS)",
  formation: "Formation et habilitations du personnel",
  maintenance: "Gammes de maintenance",
} as const;

/** Changements qui imposent de proposer une requalification. */
export function requalificationSuggeree(c: Pick<Changement, "categorie" | "type" | "evaluation">): boolean {
  return !!c.evaluation.qualification || c.type === "majeur" || c.categorie === "traitement_air" || c.categorie === "installation";
}

export interface EtatGamme {
  gamme: GammeMaintenance;
  derniere: string | null;
  prochaine: string;
  statut: "en_retard" | "a_echeance" | "a_jour";
}

/** Prochaine échéance d'une gamme : dernière intervention réalisée + périodicité. */
export function etatGamme(g: GammeMaintenance, interventions: InterventionMaintenance[], aujourdhui = new Date(), horizonJours = 30): EtatGamme {
  const dates = interventions.filter((i) => i.gamme_id === g.id && i.statut === "realisee" && i.date_realisation).map((i) => i.date_realisation!).sort();
  const derniere = dates.at(-1) ?? null;
  const prochaine = derniere ? ajouterMois(derniere, g.periodicite_mois) : g.date_debut;
  const jour = aujourdhui.toISOString().slice(0, 10);
  const horizon = new Date(aujourdhui.getTime() + horizonJours * 86400000).toISOString().slice(0, 10);
  return { gamme: g, derniere, prochaine, statut: prochaine < jour ? "en_retard" : prochaine <= horizon ? "a_echeance" : "a_jour" };
}

/** Échéances de la phase 6 à proposer au tableau de tâches. */
export function echeancesPhase6(src: {
  gammes: GammeMaintenance[];
  interventions: InterventionMaintenance[];
  plans: PlanEchantillonnage[];
  resultats: Resultat[];
  changements: Changement[];
  libelleObjet: (g: Pick<GammeMaintenance, "cta_id" | "salle_id" | "equipement_id">) => string;
}, aujourdhui = new Date()): EcheanceAPlanifier[] {
  const liste: EcheanceAPlanifier[] = [];
  const jour = aujourdhui.toISOString().slice(0, 10);
  for (const g of src.gammes.filter((x) => x.actif)) {
    const e = etatGamme(g, src.interventions, aujourdhui);
    if (e.statut === "a_jour") continue;
    const planifiee = src.interventions.some((i) => i.gamme_id === g.id && i.statut === "planifiee");
    if (planifiee) continue;
    liste.push({
      source_cle: `maintenance:${g.id}:${e.prochaine}`, titre: `Maintenance : ${g.libelle} — ${src.libelleObjet(g)}`,
      description: g.operations.map((o) => `• ${o}`).join("\n"), echeance: e.prochaine, lien: "/maintenance", objet_type: "gamme_maintenance", objet_id: g.id,
      salle_id: g.salle_id, priorite: e.statut === "en_retard" ? "haute" : "normale", proprietaire: null, etiquettes: ["maintenance"],
    });
  }
  const dus = prelevementsDus(src.plans, src.resultats, aujourdhui).filter((p) => p.statut !== "a_venir");
  const parSalle = new Map<string, typeof dus>();
  for (const p of dus) parSalle.set(p.plan.salle_id, [...(parSalle.get(p.plan.salle_id) ?? []), p]);
  for (const [salleId, l] of parSalle) {
    liste.push({
      source_cle: `prelevements:${salleId}:${l[0].prochain}`, titre: `Prélèvements de surveillance à réaliser (${l.length})`,
      description: l.map((p) => `• ${p.plan.parametre} — prévu le ${p.prochain}`).join("\n"), echeance: l[0].prochain, lien: "/contaminations?onglet=plan",
      objet_type: "salle", objet_id: salleId, salle_id: salleId, priorite: l.some((p) => p.statut === "en_retard") ? "haute" : "normale", proprietaire: null, etiquettes: ["surveillance"],
    });
  }
  for (const c of src.changements.filter((x) => x.statut === "approuve")) {
    liste.push({
      source_cle: `changement:${c.id}`, titre: `${c.numero ?? "CC"} à réaliser : ${c.titre}`, description: c.plan_actions, echeance: c.date_cible,
      lien: `/maintenance?onglet=changements&id=${c.id}`, objet_type: "changement", objet_id: c.id, salle_id: c.salle_id,
      priorite: c.date_cible && c.date_cible < jour ? "haute" : "normale", proprietaire: null, etiquettes: ["change control"],
    });
  }
  return liste;
}

// ---------------------------------------------------------------------
// Énergie de ventilation
// ---------------------------------------------------------------------

export interface BilanEnergie {
  kwhAn: number;
  kwhAnSansReduit: number;
  economieKwh: number;
  coutAn: number | null;
  economieCout: number | null;
}

/**
 * Estimation de l'énergie des ventilateurs d'une CTA. Au débit réduit, la
 * puissance suit la loi de similitude (P ∝ Q³), plafonnée à 20 % minimum
 * pour tenir compte des pertes du moteur et du variateur.
 */
export function energieCta(cta: Pick<Cta, "puissance_ventilateur_kw" | "debit_nominal_m3h" | "debit_reduit_m3h" | "heures_nominal_jour" | "heures_reduit_jour">, prixKwh: number | null = null, joursAn = 365): BilanEnergie | null {
  const p = cta.puissance_ventilateur_kw;
  if (p == null || cta.heures_nominal_jour == null) return null;
  const hNom = cta.heures_nominal_jour;
  const hRed = cta.heures_reduit_jour ?? 0;
  const ratio = cta.debit_reduit_m3h && cta.debit_nominal_m3h ? cta.debit_reduit_m3h / cta.debit_nominal_m3h : 1;
  const pRed = p * Math.max(ratio ** 3, 0.2);
  const kwhAn = Math.round((p * hNom + pRed * hRed) * joursAn);
  const kwhAnSansReduit = Math.round(p * (hNom + hRed) * joursAn);
  const economieKwh = kwhAnSansReduit - kwhAn;
  return {
    kwhAn, kwhAnSansReduit, economieKwh,
    coutAn: prixKwh != null ? Math.round(kwhAn * prixKwh) : null,
    economieCout: prixKwh != null ? Math.round(economieKwh * prixKwh) : null,
  };
}
