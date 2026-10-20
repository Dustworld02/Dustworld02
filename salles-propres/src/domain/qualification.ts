import type { Cta, Equipement, Essai, EtatOccupation, Filtre, Bouche, Resultat, Zone } from "../data/types";
import { CATALOGUE_ESSAIS } from "./referentiels/essais";
import { limiteIso, pointsMinimaux, type TailleParticule } from "./referentiels/classesIso";
import { limitesParticulaires, volumeM3, formatNombre } from "./exigencesZone";
import type { Periodicite } from "./referentiels/periodicites";
import { periodiciteMois } from "./referentiels/periodicites";
import { ajouterMois } from "./mesures";

export const LIBELLES_ETATS: Record<EtatOccupation, string> = { construction: "Après construction", repos: "Au repos", activite: "En activité" };

export const LIBELLES_STATUTS_CAMPAGNE: Record<string, string> = {
  brouillon: "Protocole en rédaction",
  protocole_approuve: "Protocole approuvé",
  en_execution: "En exécution",
  rapport_redige: "Rapport rédigé",
  cloturee: "Clôturée",
  annulee: "Annulée",
};

export const LIBELLES_VERDICTS_CAMPAGNE: Record<string, string> = {
  qualifie: "Qualifié",
  qualifie_reserves: "Qualifié avec réserves",
  non_qualifie: "Non qualifié",
};

/** Brouillon d'essai proposé par l'assistant. */
export type EssaiPropose = Pick<Essai,
  "cle_essai" | "libelle" | "reference" | "cible_type" | "cible_id" | "cible_libelle" | "etat_occupation" | "critere" | "critere_min" | "critere_max" | "unite" | "mesures">;

function definition(cle: string) {
  return CATALOGUE_ESSAIS.find((e) => e.cle === cle)!;
}

function essai(cle: string, cible: Pick<EssaiPropose, "cible_type" | "cible_id" | "cible_libelle">, extra: Partial<EssaiPropose>): EssaiPropose {
  const d = definition(cle);
  return {
    cle_essai: cle, libelle: d.libelle, reference: d.reference, etat_occupation: null, critere: "",
    critere_min: null, critere_max: null, unite: "", mesures: [], ...cible, ...extra,
  };
}

function critereClassification(zone: Zone, etat: EtatOccupation): string {
  const lignes = limitesParticulaires(zone)
    .map((l) => ({ taille: l.taille, limite: etat === "activite" ? l.enActivite : l.auRepos }))
    .filter((l) => l.limite != null)
    .map((l) => `≥ ${String(l.taille).replace(".", ",")} µm ≤ ${formatNombre(l.limite)} /m³`);
  const points = zone.surface_m2 != null ? pointsMinimaux(zone.surface_m2) : null;
  return `${lignes.join(" ; ")}${points ? ` ; au moins ${points} points` : ""}`;
}

export interface ObjetsQualification {
  zones: Zone[];
  ctas: Cta[];
  equipements: Equipement[];
  bouches: Bouche[];
  filtres: Filtre[];
  etats: EtatOccupation[];
  /** Inclure les essais optionnels du catalogue. */
  optionnels: boolean;
}

/**
 * Essais proposés pour les objets retenus, avec critères d'acceptation
 * déduits des exigences (classe, consignes, débits, normes d'équipement).
 */
export function proposerEssais(o: ObjetsQualification): EssaiPropose[] {
  const liste: EssaiPropose[] = [];
  for (const z of o.zones) {
    const cible = { cible_type: "zone" as const, cible_id: z.id, cible_libelle: `${z.code} ${z.nom}` };
    for (const etat of o.etats) {
      const iso = etat === "activite" ? z.iso_activite : z.iso_repos;
      if (iso == null && !z.grade_bpf) continue;
      liste.push(essai("classification_particulaire", cible, { etat_occupation: etat, critere: critereClassification(z, etat), unite: "particules/m³" }));
    }
    if (z.pression_pa != null) {
      const tol = z.tolerance_pression_pa ?? 0;
      liste.push(essai("pression_differentielle", cible, { critere: `${z.pression_pa} Pa ± ${tol} Pa`, critere_min: z.pression_pa - tol, critere_max: z.pression_pa + tol, unite: "Pa" }));
    }
    if (z.renouvellement_vol_h != null) {
      const bouches = o.bouches.filter((b) => b.zone_id === z.id && b.type === "soufflage");
      liste.push(essai("debit_vitesse", cible, {
        critere: `Taux de renouvellement ≥ ${z.renouvellement_vol_h} vol/h${volumeM3(z) ? ` (volume ${volumeM3(z)} m³)` : ""}`,
        critere_min: z.renouvellement_vol_h, unite: "vol/h",
        mesures: bouches.map((b) => ({ point: b.repere || "bouche", valeur: null })),
      }));
    }
    const terminaux = o.filtres.filter((f) => f.emplacement === "terminal" && f.test_integrite && f.statut === "en_place" && o.bouches.some((b) => b.id === f.bouche_id && b.zone_id === z.id));
    if (terminaux.length > 0) {
      liste.push(essai("integrite_filtres", cible, { critere: "Pénétration locale ≤ 0,01 % de la concentration amont", critere_max: 0.01, unite: "%", mesures: terminaux.map((f) => ({ point: f.repere || f.classe, valeur: null })) }));
    }
    if (o.optionnels) {
      liste.push(essai("visualisation_flux", cible, { critere: "Flux sans turbulence ni retour vers les zones critiques (vidéo jointe)" }));
      if ((z.iso_repos ?? 9) <= 8) liste.push(essai("temps_recuperation", cible, { critere: "Récupération 100:1 en moins de 20 min", critere_max: 20, unite: "min", etat_occupation: "repos" }));
      if (z.temperature_min != null || z.temperature_max != null) {
        liste.push(essai("temperature", cible, { critere: `${z.temperature_min ?? "—"} à ${z.temperature_max ?? "—"} °C`, critere_min: z.temperature_min, critere_max: z.temperature_max, unite: "°C" }));
      }
      if (z.hr_min != null || z.hr_max != null) {
        liste.push(essai("humidite", cible, { critere: `${z.hr_min ?? "—"} à ${z.hr_max ?? "—"} % HR`, critere_min: z.hr_min, critere_max: z.hr_max, unite: "%" }));
      }
    }
  }
  for (const c of o.ctas) {
    const cible = { cible_type: "cta" as const, cible_id: c.id, cible_libelle: c.nom };
    if (c.debit_nominal_m3h != null) {
      liste.push(essai("debit_vitesse", cible, {
        libelle: "Débit de soufflage de la CTA", critere: `${formatNombre(c.debit_nominal_m3h)} m³/h ± 10 %`,
        critere_min: Math.round(c.debit_nominal_m3h * 0.9), critere_max: Math.round(c.debit_nominal_m3h * 1.1), unite: "m³/h",
      }));
    }
  }
  for (const q of o.equipements) {
    const cible = { cible_type: "equipement" as const, cible_id: q.id, cible_libelle: q.libelle };
    const classeIso5 = { critere: `ISO 5 : ≥ 0,5 µm ≤ ${formatNombre(limiteIso(5, 0.5))} /m³`, unite: "particules/m³", etat_occupation: "repos" as const };
    if (q.type === "psm") {
      liste.push(essai("psm_vitesse_frontale", cible, { critere: "Vitesse d'entrée ≥ 0,40 m/s", critere_min: 0.4, unite: "m/s" }));
      liste.push(essai("psm_flux_descendant", cible, { critere: "Flux descendant entre 0,25 et 0,50 m/s", critere_min: 0.25, critere_max: 0.5, unite: "m/s" }));
      liste.push(essai("psm_ki_discus", cible, { critere: "Facteur de protection ≥ 1 × 10⁵", critere_min: 100000, unite: "" }));
      liste.push(essai("classification_particulaire", cible, classeIso5));
    } else if (q.type === "hotte_flux") {
      liste.push(essai("debit_vitesse", cible, { libelle: "Vitesse du flux unidirectionnel", critere: "0,36 à 0,54 m/s", critere_min: 0.36, critere_max: 0.54, unite: "m/s" }));
      liste.push(essai("classification_particulaire", cible, classeIso5));
      liste.push(essai("integrite_filtres", cible, { critere: "Pénétration locale ≤ 0,01 %", critere_max: 0.01, unite: "%" }));
      if (o.optionnels) liste.push(essai("visualisation_flux", cible, { critere: "Flux unidirectionnel sans turbulence sur le plan de travail" }));
    } else if (q.type === "isolateur") {
      liste.push(essai("isolateur_fuite", cible, { critere: "Taux de fuite conforme à la classe d'étanchéité (ISO 10648-2)" }));
      liste.push(essai("isolateur_gants", cible, { critere: "Intégrité des gants et manchettes" }));
      liste.push(essai("isolateur_decontamination", cible, { critere: "Réduction ≥ 6 log (indicateurs biologiques)" }));
      liste.push(essai("classification_particulaire", cible, classeIso5));
    }
  }
  return liste;
}

export interface DetailPoint {
  point: string;
  moyennes: { taille: number; moyenne: number; limite: number | null; conforme: boolean }[];
  conforme: boolean;
}

export interface VerdictClassification {
  conforme: boolean;
  points: DetailPoint[];
  pointsRequis: number | null;
  messages: string[];
}

export function cleDePoint(r: Pick<Resultat, "point_id" | "point_libre">, codes: Map<string, string>): string {
  return r.point_id ? codes.get(r.point_id) ?? r.point_libre ?? "?" : r.point_libre || "?";
}

/** Limites particulaires applicables à un essai de classification. */
export function limitesEssai(essai: Pick<Essai, "cible_type" | "etat_occupation">, zone: Zone | null): Map<number, number> {
  const limites = new Map<number, number>();
  if (essai.cible_type === "equipement" || !zone) {
    for (const t of [0.5, 5] as TailleParticule[]) { const l = limiteIso(5, t); if (l != null) limites.set(t, l); }
    return limites;
  }
  for (const l of limitesParticulaires(zone)) {
    const v = essai.etat_occupation === "activite" ? l.enActivite : l.auRepos;
    if (v != null) limites.set(l.taille, v);
  }
  return limites;
}

/**
 * Classification ISO 14644-1 : pour chaque point, la moyenne des
 * concentrations à chaque taille doit être ≤ limite ; le nombre de points
 * doit atteindre le minimum du tableau A.1.
 */
export function verdictClassification(essai: Pick<Essai, "cible_type" | "etat_occupation">, zone: Zone | null, resultats: Resultat[], codes: Map<string, string>): VerdictClassification {
  const limites = limitesEssai(essai, zone);
  const parPoint = new Map<string, Resultat[]>();
  for (const r of resultats.filter((x) => x.nature === "particulaire" && x.taille_um != null)) {
    const cle = cleDePoint(r, codes);
    parPoint.set(cle, [...(parPoint.get(cle) ?? []), r]);
  }
  const points: DetailPoint[] = [...parPoint.entries()].sort(([a], [b]) => a.localeCompare(b, "fr", { numeric: true })).map(([point, rs]) => {
    const tailles = [...new Set(rs.map((r) => r.taille_um!))].sort((a, b) => a - b);
    const moyennes = tailles.map((taille) => {
      const v = rs.filter((r) => r.taille_um === taille).map((r) => r.valeur);
      const moyenne = Math.round((v.reduce((t, x) => t + x, 0) / v.length) * 10) / 10;
      const limite = limites.get(taille) ?? null;
      return { taille, moyenne, limite, conforme: limite === null || moyenne <= limite };
    });
    return { point, moyennes, conforme: moyennes.every((m) => m.conforme) };
  });
  const requis = essai.cible_type === "zone" && zone?.surface_m2 != null ? pointsMinimaux(zone.surface_m2) : null;
  const messages: string[] = [];
  if (points.length === 0) messages.push("Aucune mesure saisie.");
  if (requis != null && points.length < requis) messages.push(`${points.length} point(s) mesuré(s) pour ${requis} requis (ISO 14644-1, tableau A.1).`);
  const horsLimite = points.filter((p) => !p.conforme).map((p) => p.point);
  if (horsLimite.length) messages.push(`Dépassement aux points : ${horsLimite.join(", ")}.`);
  // Tailles retenues : celles mesurées ; chacune doit l'être à tous les points et avoir une limite.
  const retenues = [...new Set(points.flatMap((p) => p.moyennes.map((m) => m.taille)))];
  const incompletes = retenues.filter((t) => points.some((p) => !p.moyennes.some((m) => m.taille === t)));
  for (const t of incompletes) messages.push(`Taille ${String(t).replace(".", ",")} µm non mesurée à tous les points.`);
  const sansLimite = retenues.filter((t) => !limites.has(t));
  for (const t of sansLimite) messages.push(`Taille ${String(t).replace(".", ",")} µm sans limite pour cette classe : non prise en compte.`);
  const evaluees = retenues.filter((t) => limites.has(t));
  if (points.length > 0 && evaluees.length === 0) messages.push("Aucune taille mesurée n'a de limite pour cette classe.");
  const conforme = points.length > 0 && horsLimite.length === 0 && (requis == null || points.length >= requis)
    && incompletes.length === 0 && evaluees.length > 0;
  return { conforme, points, pointsRequis: requis, messages };
}

/**
 * Verdict d'un essai à mesures simples : chaque valeur (ou la valeur
 * calculée pour un taux de renouvellement) doit respecter min / max.
 */
export function verdictMesures(essai: Pick<Essai, "cle_essai" | "cible_type" | "critere_min" | "critere_max" | "mesures">, zone: Zone | null): { conforme: boolean | null; valeurCalculee: number | null; message: string } {
  const valeurs = essai.mesures.map((m) => m.valeur).filter((v): v is number => v != null);
  if (valeurs.length === 0) return { conforme: null, valeurCalculee: null, message: "Aucune mesure saisie." };
  if (essai.cle_essai === "debit_vitesse" && essai.cible_type === "zone") {
    const volume = zone ? volumeM3(zone) : null;
    if (!volume) return { conforme: null, valeurCalculee: null, message: "Volume de la zone inconnu : taux non calculable." };
    const taux = Math.round((valeurs.reduce((t, v) => t + v, 0) / volume) * 10) / 10;
    const ok = (essai.critere_min == null || taux >= essai.critere_min) && (essai.critere_max == null || taux <= essai.critere_max);
    return { conforme: ok, valeurCalculee: taux, message: `Débit total ${formatNombre(valeurs.reduce((t, v) => t + v, 0))} m³/h, soit ${taux} vol/h.` };
  }
  const hors = valeurs.filter((v) => (essai.critere_min != null && v < essai.critere_min) || (essai.critere_max != null && v > essai.critere_max));
  return {
    conforme: hors.length === 0,
    valeurCalculee: null,
    message: hors.length ? `${hors.length} mesure(s) hors critère.` : `${valeurs.length} mesure(s) conforme(s).`,
  };
}

/** L'essai se juge-t-il sur une appréciation (sans valeur numérique) ? */
export function essaiQualitatif(e: Pick<Essai, "critere_min" | "critere_max" | "cle_essai">): boolean {
  return e.cle_essai !== "classification_particulaire" && e.critere_min == null && e.critere_max == null;
}

export type StatutEcheance = "a_jour" | "a_echeance" | "en_retard" | "jamais";

export interface LigneEcheancier {
  zone: Zone;
  essai: Periodicite;
  dernier: string | null;
  prochaine: string | null;
  statut: StatutEcheance;
}

/** Échéancier de requalification : dernier essai conforme + périodicité selon la classe. */
export function echeancier(zones: Zone[], essais: Essai[], periodicites: Periodicite[], aujourdhui = new Date(), horizonJours = 60): LigneEcheancier[] {
  const lignes: LigneEcheancier[] = [];
  const jour = aujourdhui.toISOString().slice(0, 10);
  const horizon = new Date(aujourdhui.getTime() + horizonJours * 86400000).toISOString().slice(0, 10);
  for (const zone of zones) {
    if (zone.iso_repos == null && !zone.grade_bpf) continue;
    for (const p of periodicites.filter((x) => x.obligatoire)) {
      if (p.essai === "pression_differentielle" && zone.pression_pa == null) continue;
      if (p.essai === "debit_vitesse" && zone.renouvellement_vol_h == null) continue;
      const faits = essais
        .filter((e) => e.cible_type === "zone" && e.cible_id === zone.id && e.cle_essai === p.essai && e.statut === "realise" && e.verdict === "conforme" && e.date_realisation)
        .map((e) => e.date_realisation!.slice(0, 10))
        .sort();
      const dernier = faits[faits.length - 1] ?? null;
      const prochaine = dernier ? ajouterMois(dernier, periodiciteMois(p, zone.iso_repos ?? 5)) : null;
      const statut: StatutEcheance = !prochaine ? "jamais" : prochaine < jour ? "en_retard" : prochaine <= horizon ? "a_echeance" : "a_jour";
      lignes.push({ zone, essai: p, dernier, prochaine, statut });
    }
  }
  return lignes;
}

/** Verdict global proposé pour la campagne. */
export function verdictCampagnePropose(essais: Essai[]): "qualifie" | "qualifie_reserves" | "non_qualifie" | null {
  const utiles = essais.filter((e) => e.statut !== "non_applicable");
  if (utiles.length === 0 || utiles.some((e) => e.statut === "a_faire")) return null;
  const nc = utiles.filter((e) => e.verdict === "non_conforme");
  if (nc.length === 0) return "qualifie";
  return nc.some((e) => ["classification_particulaire", "pression_differentielle", "integrite_filtres"].includes(e.cle_essai)) ? "non_qualifie" : "qualifie_reserves";
}
