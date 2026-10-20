import type { Gabarit } from "./types";

/**
 * Bibliothèque de gabarits livrée avec l'outil (version 1.0.0).
 * Ce sont des POINTS DE DÉPART : chaque valeur est modifiable et doit être
 * confirmée par l'analyse de risque et la qualification du site.
 * Phase 1 : zones types et classes. Les procédures de nettoyage, d'habillage
 * et les plans d'échantillonnage s'ajouteront aux gabarits dans les phases
 * suivantes (plan §4.0 et phase transverse « Contenu »).
 */

const T_STD = { temperatureMin: 18, temperatureMax: 24, hrMin: 30, hrMax: 65 };

export const GABARITS_NATIFS: Gabarit[] = [
  {
    cle: "pharma_sterile",
    version: "1.0.0",
    libelle: "Pharmacie — production stérile",
    description: "Fabrication aseptique ou stérilisation terminale de médicaments.",
    referentiels: ["BPF Annexe 1 (2022)", "ISO 14644-1/2/3", "ISO 14698"],
    vocabulaire: "grade",
    specificites: [
      "Grades A à D avec limites particulaires et microbiologiques de l'Annexe 1",
      "Rotation désinfectants et sporicide (phase nettoyage)",
      "Habillage stérile pour l'accès au grade B",
      "Surveillance en activité renforcée",
    ],
    natif: true,
    typesZones: [
      { cle: "remplissage_a", libelle: "Poste de remplissage aseptique (flux unidirectionnel)", type: "poste_flux", isoAuRepos: 5, isoEnActivite: 5, gradeBpf: "A", pressionPa: 45, parDefaut: true, ...T_STD },
      { cle: "salle_b", libelle: "Salle aseptique (environnement du grade A)", type: "salle", isoAuRepos: 5, isoEnActivite: 7, gradeBpf: "B", pressionPa: 45, renouvellementVolH: 60, parDefaut: true, ...T_STD },
      { cle: "sas_habillage_b", libelle: "SAS d'habillage vers grade B", type: "sas_personnel", isoAuRepos: 5, isoEnActivite: 7, gradeBpf: "B", pressionPa: 37, renouvellementVolH: 60, parDefaut: true, ...T_STD },
      { cle: "sas_materiel_b", libelle: "SAS matériel vers grade B", type: "sas_materiel", isoAuRepos: 5, isoEnActivite: 7, gradeBpf: "B", pressionPa: 37, parDefaut: true, ...T_STD },
      { cle: "salle_c", libelle: "Salle de préparation (grade C)", type: "salle", isoAuRepos: 7, isoEnActivite: 8, gradeBpf: "C", pressionPa: 30, renouvellementVolH: 40, parDefaut: true, ...T_STD },
      { cle: "sas_c", libelle: "SAS personnel vers grade C", type: "sas_personnel", isoAuRepos: 7, isoEnActivite: 8, gradeBpf: "C", pressionPa: 22, parDefaut: true, ...T_STD },
      { cle: "laverie_d", libelle: "Laverie / préparation des composants (grade D)", type: "salle", isoAuRepos: 8, isoEnActivite: null, gradeBpf: "D", pressionPa: 15, renouvellementVolH: 20, parDefaut: true, ...T_STD },
      { cle: "passe_plat", libelle: "Passe-plat", type: "passe_plat", isoAuRepos: 7, isoEnActivite: 8, gradeBpf: "C", pressionPa: null, parDefaut: false },
    ],
  },
  {
    cle: "pharma_non_sterile",
    version: "1.0.0",
    libelle: "Pharmacie non stérile / cosmétique",
    description: "Formes sèches, liquides ou semi-solides non stériles ; produits cosmétiques.",
    referentiels: ["BPF partie I", "ISO 22716 (cosmétique)", "ISO 14644-1/2"],
    vocabulaire: "grade",
    specificites: [
      "Zones de grade D / ISO 8",
      "Surveillance microbiologique moins fréquente",
      "Accent sur les résidus de nettoyage et la contamination croisée",
    ],
    natif: true,
    typesZones: [
      { cle: "pesee", libelle: "Salle de pesée", type: "salle", isoAuRepos: 8, isoEnActivite: null, gradeBpf: "D", pressionPa: 15, renouvellementVolH: 20, parDefaut: true, ...T_STD },
      { cle: "fabrication", libelle: "Salle de fabrication", type: "salle", isoAuRepos: 8, isoEnActivite: null, gradeBpf: "D", pressionPa: 15, renouvellementVolH: 20, parDefaut: true, ...T_STD },
      { cle: "conditionnement_primaire", libelle: "Conditionnement primaire", type: "salle", isoAuRepos: 8, isoEnActivite: null, gradeBpf: "D", pressionPa: 15, renouvellementVolH: 20, parDefaut: true, ...T_STD },
      { cle: "sas_personnel", libelle: "SAS personnel", type: "sas_personnel", isoAuRepos: 8, isoEnActivite: null, gradeBpf: "D", pressionPa: 10, parDefaut: true },
      { cle: "sas_materiel", libelle: "SAS matériel", type: "sas_materiel", isoAuRepos: 8, isoEnActivite: null, gradeBpf: "D", pressionPa: 10, parDefaut: true },
      { cle: "couloir", libelle: "Couloir de circulation", type: "couloir", isoAuRepos: null, isoEnActivite: null, gradeBpf: null, pressionPa: 5, parDefaut: false },
    ],
  },
  {
    cle: "dispositifs_medicaux",
    version: "1.0.0",
    libelle: "Dispositifs médicaux",
    description: "Fabrication, assemblage et conditionnement de dispositifs médicaux, stériles ou non.",
    referentiels: ["ISO 13485", "ISO 14644-1/2/3/5", "ISO 14698", "ISO 11737 (bioburden)"],
    vocabulaire: "classe",
    specificites: [
      "Salles ISO 7 / ISO 8",
      "Lingettes polyester non pelucheuses, technique en S, sols en bandes (phase nettoyage)",
      "Bioburden produit et traçabilité des lots de produits de nettoyage",
    ],
    natif: true,
    typesZones: [
      { cle: "sas_personnel", libelle: "SAS personnel", type: "sas_personnel", isoAuRepos: 8, isoEnActivite: 8, pressionPa: 15, renouvellementVolH: 20, parDefaut: true, ...T_STD },
      { cle: "sas_materiel", libelle: "SAS matériel", type: "sas_materiel", isoAuRepos: 8, isoEnActivite: 8, pressionPa: 15, renouvellementVolH: 20, parDefaut: true, ...T_STD },
      { cle: "production", libelle: "Salle de production", type: "salle", isoAuRepos: 7, isoEnActivite: 7, pressionPa: 30, renouvellementVolH: 40, parDefaut: true, ...T_STD },
      { cle: "emballage", libelle: "Zone d'emballage", type: "salle", isoAuRepos: 8, isoEnActivite: 8, pressionPa: 15, renouvellementVolH: 20, parDefaut: true, ...T_STD },
      { cle: "assemblage", libelle: "Salle d'assemblage", type: "salle", isoAuRepos: 7, isoEnActivite: 7, pressionPa: 30, renouvellementVolH: 40, parDefaut: false, ...T_STD },
      { cle: "stockage_composants", libelle: "Stockage des composants propres", type: "stockage", isoAuRepos: 8, isoEnActivite: 8, pressionPa: 15, parDefaut: false, ...T_STD },
    ],
  },
  {
    cle: "micro_electronique",
    version: "1.0.0",
    libelle: "Micro-électronique / semi-conducteurs",
    description: "Fabrication de composants, salles de procédés et de lithographie.",
    referentiels: ["ISO 14644-1/2/8/9", "IEC 61340-5-1 (ESD)", "SEMI"],
    vocabulaire: "classe",
    specificites: [
      "Classes ISO 3 à 6, classification en activité",
      "Contamination moléculaire aéroportée (AMC : COV, acides, bases)",
      "Eau déionisée et IPA, pas de sporicide, matériel antistatique",
      "Température et hygrométrie serrées",
    ],
    natif: true,
    typesZones: [
      { cle: "lithographie", libelle: "Baie de lithographie", type: "salle", isoAuRepos: 4, isoEnActivite: 4, pressionPa: 30, temperatureMin: 21.5, temperatureMax: 22.5, hrMin: 43, hrMax: 47, parDefaut: true },
      { cle: "procedes", libelle: "Salle de procédés", type: "salle", isoAuRepos: 5, isoEnActivite: 5, pressionPa: 25, temperatureMin: 21, temperatureMax: 23, hrMin: 40, hrMax: 50, parDefaut: true },
      { cle: "inspection", libelle: "Zone d'inspection / métrologie", type: "salle", isoAuRepos: 6, isoEnActivite: 6, pressionPa: 20, temperatureMin: 21, temperatureMax: 23, hrMin: 40, hrMax: 50, parDefaut: true },
      { cle: "couloir_service", libelle: "Couloir de service (zone grise)", type: "couloir", isoAuRepos: 7, isoEnActivite: 7, pressionPa: 10, parDefaut: true },
      { cle: "sas_personnel", libelle: "SAS personnel (habillage)", type: "sas_personnel", isoAuRepos: 6, isoEnActivite: 6, pressionPa: 15, parDefaut: true },
      { cle: "sas_materiel", libelle: "SAS matériel", type: "sas_materiel", isoAuRepos: 6, isoEnActivite: 6, pressionPa: 15, parDefaut: true },
    ],
  },
  {
    cle: "hopital",
    version: "1.0.0",
    libelle: "Établissement de santé (bloc, PUI, stérilisation)",
    description: "Blocs opératoires, pharmacie à usage intérieur, stérilisation centrale.",
    referentiels: ["NF S 90-351 (2013)", "BPP (préparations hospitalières)", "ISO 14644-1/3", "FD S 90-351 carnet sanitaire"],
    vocabulaire: "zone_risque",
    specificites: [
      "Zones à risque 2, 3 et 4 de la NF S 90-351",
      "Carnet sanitaire de l'air",
      "Bionettoyage",
    ],
    natif: true,
    typesZones: [
      { cle: "bloc_z4", libelle: "Salle d'opération à très haut risque (zone 4)", type: "salle", isoAuRepos: 5, isoEnActivite: null, zoneRisque: 4, pressionPa: 15, parDefaut: true, ...T_STD },
      { cle: "bloc_z3", libelle: "Salle d'opération (zone 3)", type: "salle", isoAuRepos: 7, isoEnActivite: null, zoneRisque: 3, pressionPa: 15, parDefaut: true, ...T_STD },
      { cle: "reveil_z2", libelle: "Salle de surveillance post-interventionnelle (zone 2)", type: "salle", isoAuRepos: 8, isoEnActivite: null, zoneRisque: 2, pressionPa: 5, parDefaut: false, ...T_STD },
      { cle: "pui_preparation", libelle: "PUI — salle de préparation (ZAC)", type: "salle", isoAuRepos: 7, isoEnActivite: 8, gradeBpf: "C", pressionPa: 15, parDefaut: true, ...T_STD },
      { cle: "sas_personnel", libelle: "SAS personnel", type: "sas_personnel", isoAuRepos: 8, isoEnActivite: null, zoneRisque: 2, pressionPa: 10, parDefaut: true },
      { cle: "sterilisation", libelle: "Stérilisation — zone de conditionnement", type: "salle", isoAuRepos: 8, isoEnActivite: null, zoneRisque: 2, pressionPa: 10, parDefaut: false, ...T_STD },
    ],
  },
  {
    cle: "biotech_laboratoire",
    version: "1.0.0",
    libelle: "Biotechnologies / laboratoire (L2, L3)",
    description: "Culture cellulaire, laboratoires confinés, thérapies innovantes en recherche.",
    referentiels: ["ISO 14644-1/7", "EN 12469 (PSM)", "Arrêté du 16 juillet 2007 (confinement)"],
    vocabulaire: "classe",
    specificites: [
      "Postes de sécurité microbiologique et isolateurs",
      "Pression négative pour les zones confinées",
      "Décontamination et gestion des déchets",
    ],
    natif: true,
    typesZones: [
      { cle: "culture_cellulaire", libelle: "Laboratoire de culture cellulaire", type: "salle", isoAuRepos: 7, isoEnActivite: 8, pressionPa: 15, parDefaut: true, ...T_STD },
      { cle: "labo_l3", libelle: "Laboratoire confiné L3 (dépression)", type: "salle", isoAuRepos: 7, isoEnActivite: 8, pressionPa: -30, parDefaut: false, ...T_STD },
      { cle: "sas_l3", libelle: "SAS d'accès L3", type: "sas_personnel", isoAuRepos: 8, isoEnActivite: null, pressionPa: -15, parDefaut: false },
      { cle: "psm", libelle: "Poste de sécurité microbiologique", type: "poste_flux", isoAuRepos: 5, isoEnActivite: 5, pressionPa: null, parDefaut: true },
      { cle: "sas_personnel", libelle: "SAS personnel", type: "sas_personnel", isoAuRepos: 8, isoEnActivite: null, pressionPa: 10, parDefaut: true },
    ],
  },
  {
    cle: "agroalimentaire",
    version: "1.0.0",
    libelle: "Agroalimentaire (zones ultra-propres)",
    description: "Conditionnement de produits sensibles : produits laitiers, plats cuisinés, nutrition infantile.",
    referentiels: ["ISO 22000 / HACCP", "ISO 14644-1", "NF V01-xxx selon filière"],
    vocabulaire: "classe",
    specificites: [
      "Désinfection alimentaire sans résidu",
      "Fréquences de nettoyage par poste de production",
    ],
    natif: true,
    typesZones: [
      { cle: "conditionnement", libelle: "Zone de conditionnement ultra-propre", type: "salle", isoAuRepos: 7, isoEnActivite: 8, pressionPa: 20, renouvellementVolH: 30, parDefaut: true, temperatureMin: 2, temperatureMax: 12, hrMin: null, hrMax: null },
      { cle: "preparation", libelle: "Salle de préparation", type: "salle", isoAuRepos: 8, isoEnActivite: null, pressionPa: 10, renouvellementVolH: 20, parDefaut: true, temperatureMin: 2, temperatureMax: 12, hrMin: null, hrMax: null },
      { cle: "sas_personnel", libelle: "SAS personnel", type: "sas_personnel", isoAuRepos: 8, isoEnActivite: null, pressionPa: 10, parDefaut: true },
      { cle: "sas_materiel", libelle: "SAS matériel", type: "sas_materiel", isoAuRepos: 8, isoEnActivite: null, pressionPa: 10, parDefaut: true },
    ],
  },
  {
    cle: "aerospatial_optique",
    version: "1.0.0",
    libelle: "Aérospatial / optique / mécanique de précision",
    description: "Intégration de satellites, optiques, assemblages mécaniques sensibles.",
    referentiels: ["ISO 14644-1/9/17", "ECSS-Q-ST-70-01 (propreté)"],
    vocabulaire: "classe",
    specificites: [
      "Propreté particulaire des surfaces et taux de dépôt",
      "Pas de surveillance microbiologique par défaut",
      "Outillage dédié, contrôle de l'électrostatique",
    ],
    natif: true,
    typesZones: [
      { cle: "integration", libelle: "Salle d'intégration", type: "salle", isoAuRepos: 8, isoEnActivite: 8, pressionPa: 15, renouvellementVolH: 20, parDefaut: true, temperatureMin: 20, temperatureMax: 24, hrMin: 40, hrMax: 60 },
      { cle: "integration_optique", libelle: "Poste d'intégration optique sous flux", type: "poste_flux", isoAuRepos: 5, isoEnActivite: 5, pressionPa: null, parDefaut: true },
      { cle: "sas_personnel", libelle: "SAS personnel", type: "sas_personnel", isoAuRepos: 8, isoEnActivite: 8, pressionPa: 10, parDefaut: true },
      { cle: "sas_materiel", libelle: "SAS matériel (déballage)", type: "sas_materiel", isoAuRepos: 8, isoEnActivite: 8, pressionPa: 10, parDefaut: true },
    ],
  },
];

export function gabaritNatif(cle: string): Gabarit | undefined {
  return GABARITS_NATIFS.find((g) => g.cle === cle);
}
