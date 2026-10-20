import type { Trace, EtatOccupation, FrequencePrelevement, GrandeurAmbiance, PlanEchantillonnage, PointPrelevement, Resultat, Zone } from "../data/types";
import { ajouterMois } from "./mesures";
import { PARAMETRES, limitesSuggerees } from "./contamination";
import { niveauDeZone, type NiveauZone } from "./nettoyage/generation";
import { DEFINITIONS_GRADES, type GradeBpf } from "./referentiels/gradesBpf";

export const FREQUENCES_PRELEVEMENT: Record<FrequencePrelevement, string> = {
  quotidien: "Quotidien", hebdomadaire: "Hebdomadaire", bimensuel: "Toutes les deux semaines", mensuel: "Mensuel",
  trimestriel: "Trimestriel", semestriel: "Semestriel", annuel: "Annuel",
};

const PAS: Record<FrequencePrelevement, { jours?: number; mois?: number }> = {
  quotidien: { jours: 1 }, hebdomadaire: { jours: 7 }, bimensuel: { jours: 14 }, mensuel: { mois: 1 },
  trimestriel: { mois: 3 }, semestriel: { mois: 6 }, annuel: { mois: 12 },
};

const jourIso = (d: Date) => d.toISOString().slice(0, 10);

export function dateSuivante(date: string, f: FrequencePrelevement): string {
  const p = PAS[f];
  if (p.mois) return ajouterMois(date, p.mois);
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (p.jours ?? 0));
  return jourIso(d);
}

/** Les résultats rattachés à une ligne du plan, ou à défaut au même point et paramètre. */
export function resultatsDuPlan(plan: PlanEchantillonnage, resultats: Resultat[]): Resultat[] {
  return resultats.filter((r) => r.plan_id === plan.id || (!r.plan_id && plan.point_id && r.point_id === plan.point_id && r.parametre === plan.parametre && r.origine === "surveillance"));
}

export interface PrelevementDu {
  plan: PlanEchantillonnage;
  dernier: string | null;
  prochain: string;
  statut: "en_retard" | "aujourdhui" | "a_venir";
}

/** Prochain prélèvement de chaque ligne active du plan d'échantillonnage. */
export function prelevementsDus(plans: PlanEchantillonnage[], resultats: Resultat[], aujourdhui = new Date()): PrelevementDu[] {
  const jour = jourIso(aujourdhui);
  return plans.filter((p) => p.actif).map((plan) => {
    const dates = resultatsDuPlan(plan, resultats).map((r) => r.date_prelevement.slice(0, 10)).sort();
    const dernier = dates.at(-1) ?? null;
    const prochain = dernier ? dateSuivante(dernier, plan.frequence) : plan.date_debut;
    const statut = prochain < jour ? "en_retard" : prochain === jour ? "aujourdhui" : "a_venir";
    return { plan, dernier, prochain, statut } as PrelevementDu;
  }).sort((a, b) => a.prochain.localeCompare(b.prochain));
}

export interface SignalTendance {
  cle: string;
  regle: "consecutifs" | "croissance" | "frequence";
  libelle: string;
  serie: string;
  point_id: string | null;
  parametre: string;
  salle_id: string;
  date: string;
}

export const REGLES_TENDANCE = {
  consecutifs: "3 résultats consécutifs au-delà de la limite d'alerte (écart ouvert automatiquement)",
  croissance: "6 résultats consécutifs en hausse",
  frequence: "au moins 2 dépassements de la limite d'alerte sur les 5 derniers résultats",
} as const;

const horsAlerte = (r: Resultat) => r.verdict === "alerte" || r.verdict === "action";

/**
 * Règles de dérive appliquées par série (point ou lieu libre × paramètre),
 * sur les résultats de surveillance. Seule la première règle ouvre un écart
 * automatiquement ; les deux autres sont des signaux à examiner.
 */
export function signauxTendance(resultats: Resultat[], libellePoint: (r: Resultat) => string): SignalTendance[] {
  const series = new Map<string, Resultat[]>();
  for (const r of resultats) {
    if (r.origine !== "surveillance") continue;
    const cle = `${r.point_id ?? r.point_libre}|${r.parametre}`;
    series.set(cle, [...(series.get(cle) ?? []), r]);
  }
  const signaux: SignalTendance[] = [];
  for (const [cle, liste] of series) {
    const tri = [...liste].sort((a, b) => a.date_prelevement.localeCompare(b.date_prelevement));
    const derniers = (n: number) => tri.slice(-n);
    const base = { serie: `${libellePoint(tri[0])} — ${tri[0].parametre}`, point_id: tri[0].point_id, parametre: tri[0].parametre, salle_id: tri[0].salle_id, date: tri.at(-1)!.date_prelevement };
    const trois = derniers(3);
    if (trois.length === 3 && trois.every(horsAlerte)) signaux.push({ ...base, cle: `${cle}|consecutifs`, regle: "consecutifs", libelle: REGLES_TENDANCE.consecutifs });
    const six = derniers(6);
    if (six.length === 6 && six.every((r, i) => i === 0 || r.valeur > six[i - 1].valeur)) signaux.push({ ...base, cle: `${cle}|croissance`, regle: "croissance", libelle: REGLES_TENDANCE.croissance });
    const cinq = derniers(5);
    if (cinq.filter(horsAlerte).length >= 2 && !(trois.length === 3 && trois.every(horsAlerte))) signaux.push({ ...base, cle: `${cle}|frequence`, regle: "frequence", libelle: REGLES_TENDANCE.frequence });
  }
  return signaux.sort((a, b) => b.date.localeCompare(a.date));
}

export interface Statistique {
  parametre: string;
  unite: string;
  n: number;
  conformes: number;
  alertes: number;
  actions: number;
  max: number | null;
  moyenne: number | null;
  /** Part des résultats sans dépassement, en %. */
  tauxConformite: number | null;
}

export function statistiques(resultats: Resultat[]): Statistique[] {
  const parParametre = new Map<string, Resultat[]>();
  for (const r of resultats) parParametre.set(`${r.parametre}|${r.unite}`, [...(parParametre.get(`${r.parametre}|${r.unite}`) ?? []), r]);
  return [...parParametre.entries()].map(([cle, l]) => {
    const [parametre, unite] = cle.split("|");
    const valeurs = l.map((r) => r.valeur);
    const alertes = l.filter((r) => r.verdict === "alerte").length;
    const actions = l.filter((r) => r.verdict === "action").length;
    const evalues = l.filter((r) => r.verdict !== "non_evalue").length;
    return {
      parametre, unite, n: l.length, conformes: l.filter((r) => r.verdict === "conforme").length, alertes, actions,
      max: valeurs.length ? Math.max(...valeurs) : null,
      moyenne: valeurs.length ? Math.round((valeurs.reduce((s, v) => s + v, 0) / valeurs.length) * 100) / 100 : null,
      tauxConformite: evalues ? Math.round(((evalues - alertes - actions) / evalues) * 1000) / 10 : null,
    };
  }).sort((a, b) => a.parametre.localeCompare(b.parametre));
}

/** Pire verdict d'un ensemble de résultats (pour la cartographie). */
export function pireVerdict(resultats: Resultat[]): Resultat["verdict"] | null {
  if (!resultats.length) return null;
  for (const v of ["action", "alerte", "conforme"] as const) if (resultats.some((r) => r.verdict === v)) return v;
  return "non_evalue";
}

// ---------------------------------------------------------------------
// Ambiance : pression différentielle, température, humidité relative
// ---------------------------------------------------------------------

export const GRANDEURS: Record<GrandeurAmbiance, { libelle: string; unite: string }> = {
  pression: { libelle: "Pression différentielle", unite: "Pa" },
  temperature: { libelle: "Température", unite: "°C" },
  hr: { libelle: "Humidité relative", unite: "%" },
};

export function limitesAmbiance(zone: Zone, g: GrandeurAmbiance): { min: number | null; max: number | null } {
  if (g === "pression") {
    if (zone.pression_pa == null) return { min: null, max: null };
    const t = zone.tolerance_pression_pa ?? 0;
    return { min: zone.pression_pa - t, max: t ? zone.pression_pa + t : null };
  }
  if (g === "temperature") return { min: zone.temperature_min, max: zone.temperature_max };
  return { min: zone.hr_min, max: zone.hr_max };
}

export function horsLimites(zone: Zone, g: GrandeurAmbiance, valeur: number): boolean {
  const { min, max } = limitesAmbiance(zone, g);
  return (min != null && valeur < min) || (max != null && valeur > max);
}

/** Correspondance des libellés usuels des exports GTC vers les grandeurs suivies. */
export function grandeurDepuisTexte(t: string): GrandeurAmbiance | null {
  const s = t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/(pression|dp|delta|pa\b)/.test(s)) return "pression";
  if (/(temp|°c|degc)/.test(s)) return "temperature";
  if (/(hr|humid|rh)/.test(s)) return "hr";
  return null;
}

// ---------------------------------------------------------------------
// Plan d'échantillonnage type
// ---------------------------------------------------------------------

type CleNature = "particulaire" | "microbio_air" | "surface" | "gants" | "chimique";

/** Fréquences de routine proposées par niveau de zone (point de départ à justifier par l'analyse de risque). */
const FREQUENCES_ROUTINE: Record<NiveauZone, Partial<Record<CleNature, FrequencePrelevement>>> = {
  critique: { particulaire: "quotidien", microbio_air: "quotidien", surface: "quotidien", gants: "quotidien" },
  tres_propre: { particulaire: "quotidien", microbio_air: "hebdomadaire", surface: "hebdomadaire", gants: "hebdomadaire" },
  propre: { particulaire: "hebdomadaire", microbio_air: "mensuel", surface: "hebdomadaire", gants: "mensuel", chimique: "mensuel" },
  controle: { particulaire: "mensuel", microbio_air: "mensuel", surface: "mensuel", gants: "trimestriel", chimique: "trimestriel" },
  standard: { particulaire: "trimestriel", microbio_air: "trimestriel", surface: "trimestriel" },
};

const PARAMETRES_NATURE: Record<CleNature, string[]> = {
  particulaire: ["air_p05", "air_p5"],
  microbio_air: ["air_bio"],
  surface: ["surf_contact"],
  gants: ["gants_empreinte"],
  chimique: ["surf_atp"],
};

/** Limite d'alerte proposée quand le référentiel ne donne qu'une limite d'action. */
function alerteProposee(action: number | null): number | null {
  if (action == null) return null;
  if (action <= 1) return null;
  return Math.max(1, Math.round(action * 0.6));
}

export type LignePlanProposee = Omit<PlanEchantillonnage, keyof Trace | "site_id">;

/** Grade BPF équivalent d'une zone seulement classée ISO (pour emprunter les limites microbiologiques). */
function gradeEquivalent(zone: Zone | null): GradeBpf | null {
  if (!zone || zone.grade_bpf || zone.iso_repos == null) return null;
  return zone.iso_repos <= 5 ? "B" : zone.iso_repos <= 7 ? "C" : zone.iso_repos <= 8 ? "D" : null;
}

/**
 * Propose les lignes du plan d'échantillonnage d'une salle à partir de ses
 * points de prélèvement (natures déclarées) et du niveau de chaque zone.
 * Limites : celles des derniers résultats du point s'il y en a, sinon la
 * classe ou le grade de la zone, sinon (zone ISO sans grade) le grade BPF
 * équivalent, signalé comme à confirmer.
 */
export function proposerPlan(salleId: string, zones: Zone[], points: PointPrelevement[], debut: string, resultats: Resultat[] = []): LignePlanProposee[] {
  const lignes: LignePlanProposee[] = [];
  for (const pt of points.filter((p) => p.salle_id === salleId && p.actif)) {
    const zone = zones.find((z) => z.id === pt.zone_id) ?? null;
    const niveau = zone ? niveauDeZone(zone) : "standard";
    for (const nature of pt.natures as CleNature[]) {
      const frequence = FREQUENCES_ROUTINE[niveau][nature];
      if (!frequence) continue;
      for (const cle of PARAMETRES_NATURE[nature]) {
        const p = PARAMETRES.find((x) => x.cle === cle)!;
        if (cle === "air_p5" && !zone?.grade_bpf) continue;
        const etat: EtatOccupation = "activite";
        const historique = resultats
          .filter((r) => r.point_id === pt.id && r.parametre === p.libelle && (r.limite_alerte != null || r.limite_action != null))
          .sort((a, b) => b.date_prelevement.localeCompare(a.date_prelevement))[0];
        let alerte: number | null;
        let action: number | null;
        let note = "Proposé automatiquement : fréquence et limites à confirmer par l'analyse de risque.";
        if (historique) {
          alerte = historique.limite_alerte;
          action = historique.limite_action;
          note = "Proposé automatiquement : limites reprises des derniers résultats du point, fréquence à confirmer.";
        } else {
          const sug = cle === "surf_atp" ? { alerte: 150, action: 300 } : limitesSuggerees(p, zone, etat);
          action = sug.action;
          const equivalent = gradeEquivalent(zone);
          if (action == null && p.limiteBpf && equivalent) {
            action = DEFINITIONS_GRADES[equivalent].microbio[p.limiteBpf];
            if (action != null) note = `Proposé automatiquement : limite d'action empruntée au grade ${equivalent} de l'Annexe 1 (équivalence ISO ${zone!.iso_repos}), à confirmer — l'ISO 14644 ne fixe pas de limite microbiologique.`;
          }
          alerte = sug.alerte ?? alerteProposee(action);
        }
        lignes.push({
          salle_id: salleId, zone_id: zone?.id ?? null, point_id: pt.id, parametre: p.libelle, milieu: p.milieu, nature: p.nature, methode: p.methode, unite: p.unite,
          taille_um: p.taille_um ?? null, etat_occupation: etat, frequence, limite_alerte: alerte, limite_action: action, date_debut: debut, actif: true, notes: note,
        });
      }
    }
  }
  return lignes;
}
