import type { Zone } from "../../data/types";
import type { TypeZone } from "../secteurs/types";
import { FREQUENCES, MODELES_CONSOMMABLES, MODELES_PRODUITS, SURFACES, TECHNIQUES, type CleFrequence, type CleSurface } from "./referentiel";

/**
 * Génération d'une procédure de nettoyage à partir du secteur d'activité,
 * du type de zone et de sa classe. C'est un POINT DE DÉPART : produits,
 * dilutions et temps de contact se confirment avec les FDS et la
 * validation du nettoyage du site.
 */

export interface FrequenceSurface {
  surface: CleSurface;
  frequence: CleFrequence;
}

export interface EtapeProcedure {
  ordre: number;
  action: string;
  surface: CleSurface | "preparation" | "dechets" | "cloture";
  technique: string | null;
  produit: string | null;
  consommable: string | null;
  temps_contact_min: number | null;
}

export interface ContenuProcedure {
  frequences: FrequenceSurface[];
  etapes: EtapeProcedure[];
  produits: string[];
  consommables: string[];
  rotation: string;
  materiel: string;
  controles: string;
  remarques: string[];
  /** Pour une procédure d'habillage. */
  tenue?: string[];
}

export type NiveauZone = "critique" | "tres_propre" | "propre" | "controle" | "standard";

/** Regroupe classe ISO / grade / zone à risque en un niveau de rigueur. */
export function niveauDeZone(z: Pick<Zone, "iso_repos" | "grade_bpf" | "zone_risque">): NiveauZone {
  if (z.grade_bpf === "A" || z.grade_bpf === "B" || z.zone_risque === 4) return "critique";
  const iso = z.iso_repos;
  if (iso != null && iso <= 5) return "tres_propre";
  if (z.grade_bpf === "C" || z.zone_risque === 3 || (iso != null && iso <= 7)) return "propre";
  if (z.grade_bpf === "D" || z.zone_risque === 2 || (iso != null && iso <= 8)) return "controle";
  return "standard";
}

export const LIBELLES_NIVEAUX: Record<NiveauZone, string> = {
  critique: "Critique (grades A/B, zone 4)",
  tres_propre: "Très propre (ISO ≤ 5)",
  propre: "Propre (ISO 6-7, grade C, zone 3)",
  controle: "Contrôlé (ISO 8, grade D, zone 2)",
  standard: "Standard (ISO 9, non classé)",
};

/** Fréquences de base par niveau (tableau du plan §4.0, exemple dispositifs médicaux). */
const FREQUENCES_BASE: Record<NiveauZone, Record<CleSurface, CleFrequence>> = {
  critique: { points_contact: "entre_operations", surfaces_travail: "entre_operations", equipements_mobilier: "chaque_poste", sols: "chaque_poste", murs_portes: "hebdomadaire", plafonds_grilles: "mensuel", desinfection_complete: "hebdomadaire" },
  tres_propre: { points_contact: "chaque_poste", surfaces_travail: "debut_fin_poste", equipements_mobilier: "chaque_poste", sols: "chaque_poste", murs_portes: "hebdomadaire", plafonds_grilles: "mensuel", desinfection_complete: "mensuel" },
  propre: { points_contact: "chaque_poste", surfaces_travail: "debut_fin_poste", equipements_mobilier: "quotidien", sols: "chaque_poste", murs_portes: "hebdomadaire", plafonds_grilles: "hebdomadaire", desinfection_complete: "mensuel" },
  controle: { points_contact: "quotidien", surfaces_travail: "debut_poste", equipements_mobilier: "hebdomadaire", sols: "quotidien", murs_portes: "mensuel", plafonds_grilles: "mensuel", desinfection_complete: "trimestriel" },
  standard: { points_contact: "quotidien", surfaces_travail: "quotidien", equipements_mobilier: "hebdomadaire", sols: "quotidien", murs_portes: "trimestriel", plafonds_grilles: "semestriel", desinfection_complete: "semestriel" },
};

interface ReglesSecteur {
  /** Produit principal (nettoyage courant), par niveau. */
  produitCourant: (n: NiveauZone) => string;
  /** Produit de la désinfection complète / sporicide, null si sans objet. */
  produitPeriodique: (n: NiveauZone) => string | null;
  produitPointsContact: (n: NiveauZone) => string;
  lingette: (n: NiveauZone, iso: number | null) => string;
  mop: (n: NiveauZone) => string;
  rotation: string;
  remarques: string[];
  aspiration?: boolean;
  /** Ajuste les fréquences de base (ex. bloc opératoire, agroalimentaire). */
  ajuster?: (f: Record<CleSurface, CleFrequence>, n: NiveauZone, type: TypeZone) => void;
  libellePeriodique: string;
  controles: (n: NiveauZone) => string;
}

const lingetteParClasse = (n: NiveauZone, iso: number | null) =>
  n === "critique" ? "lingette_scellee_sterile" : iso != null && iso <= 5 ? "lingette_scellee" : n === "propre" ? "lingette_polyester" : "lingette_polyester_cellulose";

const REGLES: Record<string, ReglesSecteur> = {
  pharma_sterile: {
    produitCourant: (n) => (n === "critique" ? "desinfectant_aq_sterile" : "detergent_desinfectant"),
    produitPeriodique: (n) => (n === "critique" ? "sporicide_sterile" : "sporicide_h2o2_apa"),
    produitPointsContact: (n) => (n === "critique" ? "alcool_70_sterile" : "alcool_70"),
    lingette: (n, iso) => (n === "critique" ? "lingette_scellee_sterile" : lingetteParClasse(n, iso)),
    mop: (n) => (n === "critique" ? "mop_polyester_sterile" : "mop_usage_unique"),
    rotation: "Rotation de deux désinfectants à spectre complémentaire (groupes A et B, changement mensuel) ; sporicide en complément selon la fréquence indiquée (Annexe 1 §4.33). Produits stériles en grades A et B.",
    remarques: ["Annexe 1 : la désinfection doit être efficace contre les spores ; l'efficacité est démontrée par la validation du nettoyage et la surveillance environnementale.", "Les solutions préparées sur place pour les grades A/B sont stérilisées ou filtrées ; date et heure de préparation sur le contenant."],
    libellePeriodique: "Désinfection sporicide",
    controles: (n) => (n === "critique" ? "Surveillance microbiologique en activité (air, surfaces, gants) ; boîtes contact après nettoyage lors de la validation." : "Boîtes contact et ATP lors de la validation, puis selon le plan de surveillance."),
  },
  pharma_non_sterile: {
    produitCourant: () => "detergent_desinfectant",
    produitPeriodique: () => "sporicide_h2o2_apa",
    produitPointsContact: () => "alcool_70",
    lingette: (n, iso) => lingetteParClasse(n, iso),
    mop: () => "mop_microfibre",
    rotation: "Rotation trimestrielle avec le désinfectant de groupe B ; sporicide trimestriel.",
    remarques: ["Prévenir la contamination croisée entre produits : nettoyage de changement de campagne validé (résidus).", "Rincer les surfaces en contact produit si le détergent laisse des résidus."],
    libellePeriodique: "Désinfection complète et sporicide",
    controles: () => "Contrôle visuel, ATP et recherche de résidus (écouvillon) sur les surfaces en contact produit.",
  },
  dispositifs_medicaux: {
    produitCourant: () => "detergent_desinfectant",
    produitPeriodique: () => "sporicide_h2o2_apa",
    produitPointsContact: () => "alcool_70",
    lingette: (n, iso) => (n === "critique" || (iso != null && iso <= 5) ? "lingette_scellee" : n === "propre" ? "lingette_polyester" : "lingette_polyester_cellulose"),
    mop: (n) => (n === "propre" || n === "tres_propre" ? "mop_usage_unique" : "mop_microfibre"),
    rotation: "Détergent-désinfectant sans rinçage, compatible avec les matériaux (inox, PVC, polycarbonate) ; alternance trimestrielle avec le désinfectant de groupe B ; sporicide lors de la désinfection complète.",
    remarques: ["Lingettes polyester non pelucheuses : pas de coton ni de papier en salle ISO 7.", "Traçabilité des lots de produits et de lingettes dans l'enregistrement de l'intervention (ISO 13485 §7.5)."],
    libellePeriodique: "Désinfection complète (avec sporicide)",
    controles: () => "Contrôle visuel ; ATP sur surfaces de travail ; boîtes contact selon le plan de surveillance (bioburden).",
  },
  micro_electronique: {
    produitCourant: () => "ipa_electronique",
    produitPeriodique: () => null,
    produitPointsContact: () => "ipa_electronique",
    lingette: (_n, iso) => (iso != null && iso <= 5 ? "lingette_scellee" : "lingette_polyester"),
    mop: () => "mop_polyester",
    rotation: "Pas de désinfectant ni de sporicide : objectif particulaire et moléculaire (AMC). IPA qualité électronique et eau déionisée uniquement ; matériel antistatique.",
    remarques: ["Aucun produit laissant un résidu ionique ou un film (amines, silicones, tensioactifs).", "Seaux, chariots et manches antistatiques ; ne pas pulvériser à proximité des plaquettes."],
    aspiration: true,
    ajuster: (f) => { f.desinfection_complete = "trimestriel"; },
    libellePeriodique: "Nettoyage complet (plafonds, murs, sols à l'eau DI)",
    controles: () => "Comptage particulaire après nettoyage ; contrôle de propreté de surface (ISO 14644-9) et AMC selon le plan.",
  },
  hopital: {
    produitCourant: () => "detergent_desinfectant",
    produitPeriodique: () => "sporicide_chlore",
    produitPointsContact: () => "detergent_desinfectant",
    lingette: () => "lingette_microfibre",
    mop: () => "mop_microfibre",
    rotation: "Bionettoyage au détergent-désinfectant (EN 13727, EN 13624, EN 14476) ; sporicide chloré en cas de Clostridioides difficile ou d'épidémie.",
    remarques: ["Bloc opératoire : nettoyage entre deux interventions (surfaces proches du patient, sol autour de la table) et bionettoyage complet en fin de programme.", "Microfibre pré-imprégnée : une lavette par chambre / salle, jamais replongée dans la solution."],
    ajuster: (f, n) => { if (n === "critique" || n === "propre") { f.surfaces_travail = "entre_operations"; f.points_contact = "entre_operations"; } },
    libellePeriodique: "Bionettoyage approfondi / sporicide",
    controles: () => "Contrôle visuel ; prélèvements de surface selon le programme du CLIN / EOH.",
  },
  biotech_laboratoire: {
    produitCourant: () => "detergent_desinfectant",
    produitPeriodique: () => "sporicide_h2o2_apa",
    produitPointsContact: () => "alcool_70",
    lingette: (n, iso) => lingetteParClasse(n, iso),
    mop: () => "mop_usage_unique",
    rotation: "Désinfectant actif sur les agents manipulés (virucide si nécessaire) ; sporicide hebdomadaire en zone confinée ; PSM désinfecté à l'alcool 70 % avant et après chaque utilisation.",
    remarques: ["Déchets biologiques évacués par la filière DASRI avant nettoyage.", "En L3, le matériel de nettoyage reste dans le laboratoire."],
    ajuster: (f) => { f.desinfection_complete = "hebdomadaire"; f.surfaces_travail = "entre_operations"; },
    libellePeriodique: "Désinfection sporicide",
    controles: () => "Boîtes contact sur plans de travail et PSM ; contrôle visuel.",
  },
  agroalimentaire: {
    produitCourant: () => "detergent_alcalin",
    produitPeriodique: () => "desinfectant_alimentaire",
    produitPointsContact: () => "alcool_70",
    lingette: () => "lingette_microfibre",
    mop: () => "mop_microfibre",
    rotation: "Nettoyage-désinfection en 5 temps : pré-rinçage, détergent alcalin, rinçage, désinfectant agréé contact alimentaire, rinçage final ; détergent acide en alternance contre le tartre.",
    remarques: ["Plan de nettoyage et désinfection intégré au plan HACCP.", "Rinçage final à l'eau potable obligatoire pour les surfaces au contact des denrées."],
    ajuster: (f) => { f.surfaces_travail = "entre_operations"; f.sols = "chaque_poste"; f.desinfection_complete = "hebdomadaire"; },
    libellePeriodique: "Désinfection approfondie",
    controles: () => "Contrôle visuel, ATP ou boîtes contact sur surfaces au contact des denrées (EN ISO 18593).",
  },
  aerospatial_optique: {
    produitCourant: () => "ipa_electronique",
    produitPeriodique: () => null,
    produitPointsContact: () => "ipa_electronique",
    lingette: (_n, iso) => (iso != null && iso <= 5 ? "lingette_scellee" : "lingette_polyester"),
    mop: () => "mop_polyester",
    rotation: "Pas de désinfectant : objectif particulaire. Aspiration HEPA puis essuyage humide à l'IPA / eau DI ; aucune silicone.",
    remarques: ["Matériel à faible dégazage (ISO 14644-15) ; produits validés pour la compatibilité avec le matériel de vol.", "Plaquettes témoins de dépôt particulaire (ISO 14644-17) relevées après nettoyage."],
    aspiration: true,
    ajuster: (f) => { f.desinfection_complete = "trimestriel"; },
    libellePeriodique: "Nettoyage complet",
    controles: () => "Taux de dépôt particulaire (ISO 14644-17) et propreté de surface (ISO 14644-9).",
  },
};

export function reglesSecteur(secteur: string): ReglesSecteur {
  return REGLES[secteur] ?? REGLES.dispositifs_medicaux;
}

/** Fréquences applicables à une zone (base du niveau + ajustements du secteur et du type). */
export function frequencesZone(secteur: string, z: Pick<Zone, "iso_repos" | "grade_bpf" | "zone_risque" | "type_zone">): FrequenceSurface[] {
  const n = niveauDeZone(z);
  const f = { ...FREQUENCES_BASE[n] };
  reglesSecteur(secteur).ajuster?.(f, n, z.type_zone);
  if (z.type_zone === "sas_personnel" || z.type_zone === "sas_materiel" || z.type_zone === "passe_plat") {
    // SAS : surfaces touchées en permanence (plan §4.0, DM : surfaces quotidiennes)
    f.surfaces_travail = f.points_contact === "entre_operations" ? "chaque_poste" : "quotidien";
    f.points_contact = n === "critique" ? "entre_operations" : "chaque_poste";
  }
  if (z.type_zone === "poste_flux") {
    f.surfaces_travail = "entre_operations";
    f.sols = "chaque_poste";
  }
  return (Object.keys(SURFACES) as CleSurface[]).map((surface) => ({ surface, frequence: f[surface] }));
}

/** Procédure de nettoyage complète pour un groupe de zones de même nature. */
export function genererProcedure(secteur: string, zone: Pick<Zone, "iso_repos" | "grade_bpf" | "zone_risque" | "type_zone">): ContenuProcedure {
  const r = reglesSecteur(secteur);
  const n = niveauDeZone(zone);
  const iso = zone.iso_repos;
  const produit = r.produitCourant(n);
  const periodique = r.produitPeriodique(n);
  const contact = r.produitPointsContact(n);
  const lingette = r.lingette(n, iso);
  const mop = r.mop(n);
  const tc = (cle: string | null) => (cle ? MODELES_PRODUITS[cle].temps_contact_min : null);
  const etapes: Omit<EtapeProcedure, "ordre">[] = [
    { action: "S'habiller selon la procédure de la zone ; préparer les solutions (dilution, date et heure de préparation sur le contenant) ; utiliser le matériel dédié à la zone (code couleur).", surface: "preparation", technique: "double_seau", produit: null, consommable: null, temps_contact_min: null },
    { action: "Évacuer les déchets et le matériel inutile vers le SAS de sortie.", surface: "dechets", technique: null, produit: null, consommable: null, temps_contact_min: null },
  ];
  if (r.aspiration) etapes.push({ action: "Aspirer sols, plinthes et dessous des équipements avec l'aspirateur HEPA dédié.", surface: "sols", technique: "aspiration_hepa", produit: null, consommable: "aspirateur_hepa", temps_contact_min: null });
  etapes.push(
    { action: "Plafonds, luminaires et grilles de reprise (selon fréquence) : essuyage humide avec un mop à manche télescopique.", surface: "plafonds_grilles", technique: "haut_vers_bas", produit, consommable: mop, temps_contact_min: tc(produit) },
    { action: "Murs, portes et vitrages (selon fréquence) : bandes verticales de haut en bas.", surface: "murs_portes", technique: "haut_vers_bas", produit, consommable: mop, temps_contact_min: tc(produit) },
    { action: "Extérieur des équipements et mobilier : du haut vers le bas, sans oublier pieds, roulettes et dessous.", surface: "equipements_mobilier", technique: "pliage_8_faces", produit, consommable: lingette, temps_contact_min: tc(produit) },
    { action: "Surfaces de travail : essuyage en S, du fond vers l'avant, lingette pliée en 8 faces ; respecter le temps de contact.", surface: "surfaces_travail", technique: "essuyage_s", produit: contact, consommable: lingette, temps_contact_min: tc(contact) },
    { action: "Points de contact (poignées, interrupteurs, claviers, passe-plats).", surface: "points_contact", technique: "pliage_8_faces", produit: contact, consommable: n === "critique" ? "lingette_polyester_ipa_sterile" : contact === "alcool_70" ? "lingette_polyester_ipa" : lingette, temps_contact_min: tc(contact) },
    { action: "Sols : bandes parallèles du fond de la salle vers la sortie, bords d'abord ; ne pas marcher sur la partie nettoyée.", surface: "sols", technique: "bandes_paralleles", produit, consommable: mop, temps_contact_min: tc(produit) },
  );
  if (periodique) {
    const mp = MODELES_PRODUITS[periodique];
    etapes.push({ action: `${r.libellePeriodique} : appliquer ${mp.nom.toLowerCase()} sur toutes les surfaces dans le même ordre (haut vers bas, propre vers sale), laisser agir ${mp.temps_contact_min ?? "—"} min.`, surface: "desinfection_complete", technique: "temps_contact", produit: periodique, consommable: lingette, temps_contact_min: mp.temps_contact_min });
    if (mp.rincage) etapes.push({ action: `Rincer les résidus de ${mp.nom.toLowerCase()} ${n === "critique" ? "à l'eau stérile" : "à l'eau"} (surfaces de travail et équipements).`, surface: "desinfection_complete", technique: "rincage", produit: n === "critique" ? "eau_ppi" : null, consommable: lingette, temps_contact_min: null });
  } else {
    etapes.push({ action: `${r.libellePeriodique} : reprendre toutes les surfaces dans l'ordre (haut vers bas), rinçage final à l'eau déionisée.`, surface: "desinfection_complete", technique: "haut_vers_bas", produit: "eau_di", consommable: lingette, temps_contact_min: null });
  }
  etapes.push({ action: "Ranger et nettoyer le matériel ; jeter les consommables à usage unique ; enregistrer l'intervention (lots des produits, anomalies).", surface: "cloture", technique: null, produit: null, consommable: null, temps_contact_min: null });

  const utilises = <K extends "produit" | "consommable">(k: K) => [...new Set(etapes.map((e) => e[k]).filter((x): x is string => !!x))];
  return {
    frequences: frequencesZone(secteur, zone),
    etapes: etapes.map((e, i) => ({ ...e, ordre: i + 1 })),
    produits: utilises("produit"),
    consommables: utilises("consommable"),
    rotation: r.rotation,
    materiel: "Chariot et seaux dédiés à la zone (code couleur), manches et supports en inox ou polymère nettoyable ; aucun matériel ne sort de la zone sans être nettoyé.",
    controles: r.controles(n),
    remarques: [...r.remarques, `Techniques : ${["essuyage_s", "bandes_paralleles", "haut_vers_bas", "propre_vers_sale"].map((t) => TECHNIQUES[t].libelle.toLowerCase()).join(", ")}.`],
  };
}

/** Tenue et étapes d'habillage par niveau et par secteur. */
export function genererHabillage(secteur: string, z: Pick<Zone, "iso_repos" | "grade_bpf" | "zone_risque" | "type_zone">): ContenuProcedure {
  const n = niveauDeZone(z);
  let tenue: string[];
  if (secteur === "micro_electronique") {
    tenue = n === "tres_propre" || n === "critique"
      ? ["Combinaison intégrale ESD (« bunny suit »)", "Cagoule ESD", "Masque facial", "Bottes ESD", "Double paire de gants nitrile", "Lunettes ou visière"]
      : ["Blouse ou combinaison ESD", "Charlotte", "Surchaussures ESD", "Gants nitrile"];
  } else if (secteur === "hopital") {
    tenue = ["Tenue de bloc (tunique et pantalon)", "Calot ou cagoule couvrant les cheveux", "Masque chirurgical", "Chaussures dédiées au bloc", "Gants selon l'acte"];
  } else if (n === "critique") {
    tenue = ["Cagoule stérile", "Masque stérile", "Combinaison stérile", "Bottes stériles", "Lunettes stériles", "Gants stériles (double paire)"];
  } else if (n === "propre" || n === "tres_propre") {
    tenue = ["Charlotte et couvre-barbe", "Masque", "Combinaison ou ensemble deux pièces resserré aux poignets, col montant", "Surchaussures ou chaussures dédiées", "Gants"];
  } else {
    tenue = ["Charlotte et couvre-barbe", "Blouse de protection", "Surchaussures ou chaussures dédiées", "Gants si contact produit"];
  }
  const etapes: Omit<EtapeProcedure, "ordre">[] = [
    { action: "Retirer bijoux, montre et maquillage ; tenue de base propre ; ranger les effets personnels hors zone.", surface: "preparation", technique: null, produit: null, consommable: null, temps_contact_min: null },
    { action: "Lavage des mains, puis friction hydro-alcoolique.", surface: "preparation", technique: null, produit: "alcool_70", consommable: null, temps_contact_min: null },
    { action: `Mettre ${tenue.slice(0, 2).join(" puis ").toLowerCase()}.`, surface: "preparation", technique: null, produit: null, consommable: null, temps_contact_min: null },
    { action: "Franchir le banc de séparation en enfilant surchaussures ou bottes côté propre.", surface: "preparation", technique: null, produit: null, consommable: null, temps_contact_min: null },
    { action: `Revêtir ${tenue.slice(2).join(", ").toLowerCase()} sans que la tenue touche le sol ni les murs.`, surface: "preparation", technique: null, produit: null, consommable: null, temps_contact_min: null },
    { action: "Vérifier la tenue devant le miroir (aucune mèche, peau ou vêtement apparent) ; désinfecter les gants.", surface: "cloture", technique: null, produit: n === "critique" ? "alcool_70_sterile" : "alcool_70", consommable: null, temps_contact_min: null },
  ];
  return {
    frequences: [], etapes: etapes.map((e, i) => ({ ...e, ordre: i + 1 })), produits: [], consommables: [],
    rotation: "", materiel: "Miroir, banc de séparation, distributeur de solution hydro-alcoolique, poubelle à pédale.",
    controles: n === "critique" ? "Qualification de l'habillage (empreintes de gants et de tenue) à l'habilitation puis périodiquement (Annexe 1 §7.5)." : "Contrôle visuel ; empreintes de gants selon le plan de surveillance.",
    remarques: ["Ordre d'habillage du haut vers le bas ; déshabillage dans l'ordre inverse, côté sortie."], tenue,
  };
}

export function libelleFrequence(f: CleFrequence): string {
  return FREQUENCES[f];
}

export { MODELES_CONSOMMABLES, MODELES_PRODUITS, SURFACES, TECHNIQUES };
