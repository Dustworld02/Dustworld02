/**
 * Référentiel générique du nettoyage en salle propre : familles de produits,
 * consommables, techniques et fréquences. Contenu de départ, à adapter aux
 * fiches techniques et FDS des produits réellement utilisés et à confirmer
 * par la validation du nettoyage du site.
 */

export type CleFrequence =
  | "entre_operations" | "chaque_poste" | "debut_fin_poste" | "debut_poste" | "fin_poste" | "quotidien"
  | "hebdomadaire" | "mensuel" | "trimestriel" | "semestriel" | "apres_intervention";

export const FREQUENCES: Record<CleFrequence, string> = {
  entre_operations: "Entre chaque opération / lot",
  chaque_poste: "À chaque poste (fin de poste)",
  debut_fin_poste: "En début et en fin de poste",
  debut_poste: "En début de poste",
  fin_poste: "En fin de poste",
  quotidien: "Quotidien",
  hebdomadaire: "Hebdomadaire",
  mensuel: "Mensuel",
  trimestriel: "Trimestriel",
  semestriel: "Semestriel",
  apres_intervention: "Après chaque intervention (maintenance, travaux)",
};

/** Ordre de rigueur : plus l'indice est faible, plus la fréquence est élevée. */
export const RIGUEUR_FREQUENCE: CleFrequence[] = [
  "entre_operations", "debut_fin_poste", "chaque_poste", "debut_poste", "fin_poste", "quotidien", "hebdomadaire", "mensuel", "trimestriel", "semestriel", "apres_intervention",
];

export type CleSurface = "points_contact" | "surfaces_travail" | "equipements_mobilier" | "sols" | "murs_portes" | "plafonds_grilles" | "desinfection_complete";

export const SURFACES: Record<CleSurface, string> = {
  points_contact: "Points de contact (poignées, interrupteurs, claviers, passe-plats)",
  surfaces_travail: "Surfaces de travail (paillasses, plans, hottes)",
  equipements_mobilier: "Extérieur des équipements et mobilier",
  sols: "Sols",
  murs_portes: "Murs, portes et vitrages",
  plafonds_grilles: "Plafonds, luminaires et grilles de reprise",
  desinfection_complete: "Désinfection complète / sporicide (toutes surfaces)",
};

export interface ModeleProduit {
  cle: string;
  nom: string;
  famille: "detergent" | "detergent_desinfectant" | "desinfectant" | "alcool" | "sporicide" | "eau";
  spectre: string;
  dilution: string;
  temps_contact_min: number | null;
  rincage: boolean;
  sterile: boolean;
  groupe_rotation: string;
  peremption_solution_h: number | null;
}

export const MODELES_PRODUITS: Record<string, ModeleProduit> = {
  detergent_neutre: { cle: "detergent_neutre", nom: "Détergent neutre", famille: "detergent", spectre: "Élimination des souillures et résidus", dilution: "Selon fiche technique (ex. 0,5 %)", temps_contact_min: null, rincage: false, sterile: false, groupe_rotation: "", peremption_solution_h: 24 },
  detergent_alcalin: { cle: "detergent_alcalin", nom: "Détergent alcalin moussant", famille: "detergent", spectre: "Graisses, protéines (agroalimentaire)", dilution: "Selon fiche technique (ex. 2 %)", temps_contact_min: 10, rincage: true, sterile: false, groupe_rotation: "", peremption_solution_h: 8 },
  detergent_desinfectant: { cle: "detergent_desinfectant", nom: "Détergent-désinfectant", famille: "detergent_desinfectant", spectre: "Bactéricide (EN 13727), levuricide (EN 13624), virucide selon produit (EN 14476)", dilution: "Selon fiche technique (ex. 0,25 %)", temps_contact_min: 5, rincage: false, sterile: false, groupe_rotation: "A", peremption_solution_h: 24 },
  desinfectant_aq: { cle: "desinfectant_aq", nom: "Désinfectant (ammonium quaternaire)", famille: "desinfectant", spectre: "Bactéricide, fongicide (EN 13697)", dilution: "Selon fiche technique", temps_contact_min: 5, rincage: false, sterile: false, groupe_rotation: "A", peremption_solution_h: 24 },
  desinfectant_aq_sterile: { cle: "desinfectant_aq_sterile", nom: "Désinfectant stérile prêt à l'emploi (ammonium quaternaire)", famille: "desinfectant", spectre: "Bactéricide, fongicide (EN 13697)", dilution: "Prêt à l'emploi", temps_contact_min: 5, rincage: false, sterile: true, groupe_rotation: "A", peremption_solution_h: null },
  desinfectant_alterne: { cle: "desinfectant_alterne", nom: "Désinfectant de rotation (amphotère / biguanide)", famille: "desinfectant", spectre: "Bactéricide, fongicide — alterné avec le désinfectant principal", dilution: "Selon fiche technique", temps_contact_min: 10, rincage: false, sterile: false, groupe_rotation: "B", peremption_solution_h: 24 },
  alcool_70: { cle: "alcool_70", nom: "Alcool isopropylique 70 %", famille: "alcool", spectre: "Bactéricide, levuricide — action rapide, sans résidu ; inactif sur les spores", dilution: "Prêt à l'emploi", temps_contact_min: 1, rincage: false, sterile: false, groupe_rotation: "", peremption_solution_h: null },
  alcool_70_sterile: { cle: "alcool_70_sterile", nom: "Alcool isopropylique 70 % stérile (filtré 0,2 µm, irradié)", famille: "alcool", spectre: "Bactéricide, levuricide ; inactif sur les spores", dilution: "Prêt à l'emploi", temps_contact_min: 1, rincage: false, sterile: true, groupe_rotation: "", peremption_solution_h: null },
  ipa_electronique: { cle: "ipa_electronique", nom: "Isopropanol qualité électronique (IPA 99,9 %) / mélange IPA-eau DI", famille: "alcool", spectre: "Dégraissage sans résidu ionique ; pas d'action désinfectante revendiquée", dilution: "Pur ou 70/30 avec eau DI", temps_contact_min: null, rincage: false, sterile: false, groupe_rotation: "", peremption_solution_h: null },
  sporicide_h2o2_apa: { cle: "sporicide_h2o2_apa", nom: "Sporicide peroxyde d'hydrogène / acide peracétique", famille: "sporicide", spectre: "Sporicide (EN 17126 / EN 13704), large spectre", dilution: "Selon fiche technique", temps_contact_min: 15, rincage: true, sterile: false, groupe_rotation: "S", peremption_solution_h: 24 },
  sporicide_sterile: { cle: "sporicide_sterile", nom: "Sporicide stérile prêt à l'emploi (H₂O₂ / APA)", famille: "sporicide", spectre: "Sporicide (EN 17126)", dilution: "Prêt à l'emploi", temps_contact_min: 15, rincage: true, sterile: true, groupe_rotation: "S", peremption_solution_h: null },
  sporicide_chlore: { cle: "sporicide_chlore", nom: "Sporicide chloré (hypochlorite de sodium)", famille: "sporicide", spectre: "Sporicide (C. difficile) ; corrosif pour l'inox, rinçage obligatoire", dilution: "Selon protocole (ex. 0,5 % de chlore actif)", temps_contact_min: 10, rincage: true, sterile: false, groupe_rotation: "S", peremption_solution_h: 24 },
  desinfectant_alimentaire: { cle: "desinfectant_alimentaire", nom: "Désinfectant agréé contact alimentaire", famille: "desinfectant", spectre: "Bactéricide (EN 1276), fongicide (EN 1650)", dilution: "Selon fiche technique", temps_contact_min: 5, rincage: true, sterile: false, groupe_rotation: "A", peremption_solution_h: 24 },
  eau_di: { cle: "eau_di", nom: "Eau déionisée", famille: "eau", spectre: "Rinçage, élimination des résidus ioniques", dilution: "—", temps_contact_min: null, rincage: false, sterile: false, groupe_rotation: "", peremption_solution_h: 24 },
  eau_ppi: { cle: "eau_ppi", nom: "Eau stérile (pour rinçage)", famille: "eau", spectre: "Rinçage des résidus de sporicide en zone stérile", dilution: "—", temps_contact_min: null, rincage: false, sterile: true, groupe_rotation: "", peremption_solution_h: null },
};

export interface ModeleConsommable {
  cle: string;
  nom: string;
  type: "lingette" | "mop" | "autre";
  matiere: string;
  sterile: boolean;
  preimpregne: string;
  /** Classe ISO la plus propre pour laquelle il convient. */
  classe_iso_min: number;
  usage: string;
}

export const MODELES_CONSOMMABLES: Record<string, ModeleConsommable> = {
  lingette_scellee_sterile: { cle: "lingette_scellee_sterile", nom: "Lingette polyester tricoté, bords scellés, stérile (irradiée), double emballage", type: "lingette", matiere: "Polyester 100 % tricoté, bords scellés laser", sterile: true, preimpregne: "", classe_iso_min: 3, usage: "Grades A/B, ISO ≤ 5 : très faible relargage particulaire" },
  lingette_scellee: { cle: "lingette_scellee", nom: "Lingette polyester tricoté, bords scellés", type: "lingette", matiere: "Polyester 100 % tricoté, bords scellés", sterile: false, preimpregne: "", classe_iso_min: 3, usage: "ISO 3 à 5 (micro-électronique, optique)" },
  lingette_polyester: { cle: "lingette_polyester", nom: "Lingette polyester tricoté non pelucheuse", type: "lingette", matiere: "Polyester tricoté", sterile: false, preimpregne: "", classe_iso_min: 5, usage: "ISO 5 à 7 : surfaces de travail, équipements" },
  lingette_polyester_ipa: { cle: "lingette_polyester_ipa", nom: "Lingette polyester pré-imprégnée IPA 70 %", type: "lingette", matiere: "Polyester tricoté", sterile: false, preimpregne: "IPA 70 %", classe_iso_min: 5, usage: "Désinfection rapide des points de contact et surfaces, sans préparation" },
  lingette_polyester_ipa_sterile: { cle: "lingette_polyester_ipa_sterile", nom: "Lingette polyester pré-imprégnée IPA 70 % stérile", type: "lingette", matiere: "Polyester tricoté", sterile: true, preimpregne: "IPA 70 %", classe_iso_min: 4, usage: "Grades A/B : surfaces et gants" },
  lingette_polyester_cellulose: { cle: "lingette_polyester_cellulose", nom: "Lingette polyester-cellulose", type: "lingette", matiere: "Non-tissé polyester / cellulose", sterile: false, preimpregne: "", classe_iso_min: 7, usage: "ISO 7 à 8 : bonne absorption, coût réduit" },
  lingette_microfibre: { cle: "lingette_microfibre", nom: "Lavette microfibre (code couleur par zone)", type: "lingette", matiere: "Microfibre polyester / polyamide", sterile: false, preimpregne: "", classe_iso_min: 7, usage: "ISO 7 à 9, bionettoyage hospitalier : capte les salissures sans produit en excès" },
  mop_polyester_sterile: { cle: "mop_polyester_sterile", nom: "Frange de sol polyester à usage unique, stérile", type: "mop", matiere: "Polyester", sterile: true, preimpregne: "", classe_iso_min: 4, usage: "Sols et murs des grades A/B" },
  mop_polyester: { cle: "mop_polyester", nom: "Frange de sol polyester non pelucheuse", type: "mop", matiere: "Polyester", sterile: false, preimpregne: "", classe_iso_min: 4, usage: "Sols ISO 4 à 7, système de mop plat" },
  mop_microfibre: { cle: "mop_microfibre", nom: "Frange microfibre (pré-imprégnation en bac)", type: "mop", matiere: "Microfibre", sterile: false, preimpregne: "", classe_iso_min: 7, usage: "Sols ISO 7 à 9 ; une frange par zone, lavée en machine validée" },
  mop_usage_unique: { cle: "mop_usage_unique", nom: "Frange de sol à usage unique", type: "mop", matiere: "Non-tissé", sterile: false, preimpregne: "", classe_iso_min: 6, usage: "Évite le lavage des franges ; recommandée en ISO 6-7" },
  aspirateur_hepa: { cle: "aspirateur_hepa", nom: "Aspirateur à filtration HEPA H14, dédié salle propre", type: "autre", matiere: "", sterile: false, preimpregne: "", classe_iso_min: 5, usage: "Retrait des particules avant essuyage (micro-électronique, aérospatial)" },
};

export interface Technique {
  cle: string;
  libelle: string;
  description: string;
}

export const TECHNIQUES: Record<string, Technique> = {
  essuyage_s: { cle: "essuyage_s", libelle: "Essuyage en S unidirectionnel", description: "Lignes parallèles se chevauchant de 10 à 20 %, en S, sans jamais repasser sur une surface déjà nettoyée, du plus propre vers le plus sale et du fond vers la sortie." },
  pliage_8_faces: { cle: "pliage_8_faces", libelle: "Lingette pliée en quatre (8 faces)", description: "Plier la lingette en quatre ; changer de face à chaque passage ; jeter la lingette une fois les 8 faces utilisées. Ne jamais tremper une lingette usagée dans la solution propre." },
  bandes_paralleles: { cle: "bandes_paralleles", libelle: "Sols en bandes parallèles", description: "Mop plat : bandes parallèles chevauchantes, du fond de la salle vers la sortie, sans revenir en arrière ; tracer d'abord les bords (plinthes) puis le centre." },
  haut_vers_bas: { cle: "haut_vers_bas", libelle: "Du haut vers le bas", description: "Plafonds, puis murs en bandes verticales de haut en bas, puis équipements, puis surfaces de travail, puis sols en dernier." },
  propre_vers_sale: { cle: "propre_vers_sale", libelle: "Du plus propre vers le plus sale", description: "Commencer par les zones de classe la plus exigeante et finir par les SAS et couloirs ; dans une salle, commencer loin de la porte." },
  double_seau: { cle: "double_seau", libelle: "Double seau / pré-imprégnation", description: "Solution propre et eau de rinçage séparées, ou franges pré-imprégnées en bac : la solution propre n'est jamais recontaminée." },
  temps_contact: { cle: "temps_contact", libelle: "Temps de contact respecté", description: "Laisser la surface humide pendant le temps de contact du produit (voir fiche technique) avant tout essuyage ou rinçage." },
  rincage: { cle: "rincage", libelle: "Rinçage des résidus", description: "Rincer à l'eau (eau stérile en zone stérile, eau DI en micro-électronique) pour éliminer les résidus de sporicide ou de détergent." },
  aspiration_hepa: { cle: "aspiration_hepa", libelle: "Aspiration HEPA préalable", description: "Aspirer les particules avec un aspirateur HEPA dédié avant l'essuyage humide ; ne jamais balayer à sec." },
  bionettoyage: { cle: "bionettoyage", libelle: "Bionettoyage", description: "Nettoyage et désinfection en une opération (détergent-désinfectant) ou en deux temps, avec microfibre pré-imprégnée, du plus propre au plus sale, du haut vers le bas." },
};
