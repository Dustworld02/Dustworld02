import type { DepotDemo } from "./depotDemo";
import { rolesParDefaut } from "./rolesParDefaut";
import { gabaritNatif } from "../domain/secteurs/gabaritsNatifs";
import { genererZones, selectionParDefaut } from "../domain/secteurs/generation";
import { ROLES_SYSTEME } from "../domain/permissions";
import type { Point2D } from "./types";

export const MOT_DE_PASSE_DEMO = "demo";

export const COMPTES_DEMO: Record<string, { email: string; nom: string }> = {
  admin: { email: "admin@demo.fr", nom: "Camille Admin" },
  qualite: { email: "qualite@demo.fr", nom: "Dominique Qualité" },
  technique: { email: "technique@demo.fr", nom: "Sacha Technique" },
  qualificateur: { email: "qualificateur@demo.fr", nom: "Alex Métrologue" },
  nettoyage: { email: "nettoyage@demo.fr", nom: "Morgan Hygiène" },
  operateur: { email: "operateur@demo.fr", nom: "Charlie Opérateur" },
  lecteur: { email: "lecteur@demo.fr", nom: "Jordan Auditeur" },
};

/** Jeu de données de démonstration : une organisation, un compte par rôle, une salle DM. */
export async function creerJeuDemo(depot: DepotDemo): Promise<void> {
  const ids: Record<string, string> = {};
  for (const role of ROLES_SYSTEME) {
    const c = COMPTES_DEMO[role.cle];
    ids[role.cle] = depot.creerCompte(c.email, c.nom, MOT_DE_PASSE_DEMO);
  }
  depot.ouvrirSession(ids.admin);
  const org = await depot.creerOrganisation("Démo — Contrôle Contamination", rolesParDefaut());
  const roles = await depot.lister("roles", org);
  await depot.creerPlusieurs("membres", ROLES_SYSTEME.filter((r) => r.cle !== "admin").map((r) => ({
    org_id: org, user_id: ids[r.cle], role_id: roles.find((x) => x.cle === r.cle)!.id, sites: null, actif: true,
  })));

  const entreprise = await depot.creer("entreprises", {
    org_id: org, nom: "MedTech Exemple", secteur: "dispositifs_medicaux",
    adresse: "12 rue des Implants, 69000 Lyon", contact: "Responsable qualité — 04 00 00 00 00", notes: "",
  });
  const site = await depot.creer("sites", { org_id: org, entreprise_id: entreprise.id, nom: "Usine de Lyon", adresse: "12 rue des Implants, 69000 Lyon" });
  const dm = gabaritNatif("dispositifs_medicaux")!;
  const salle = await depot.creer("salles_propres", {
    org_id: org, site_id: site.id, nom: "Salle propre assemblage cathéters", batiment: "B2", etage: "RDC",
    secteur: dm.cle, gabarit_cle: dm.cle, gabarit_version: dm.version, description: "Assemblage et emballage primaire.",
  });
  const surfaces: Record<string, [number, number]> = { "SAS personnel": [8, 2.6], "SAS matériel": [6, 2.6], "Salle de production": [60, 2.8], "Zone d'emballage": [30, 2.8] };
  await depot.creerPlusieurs("zones", genererZones(dm, selectionParDefaut(dm)).map((z) => ({
    ...z, org_id: org, salle_id: salle.id, site_id: null,
    surface_m2: surfaces[z.nom]?.[0] ?? null, hauteur_m: surfaces[z.nom]?.[1] ?? null,
  })));

  await planDemo(depot, org, site.id, salle.id);

  const doc = await depot.creer("documents", {
    org_id: org, titre: "Cahier des charges (URS) — salle d'assemblage", type_document: "urs", statut: "brouillon",
    objet_type: "salle_propre", objet_id: salle.id, valide_jusqu_au: null, version_courante: 0,
  });
  const chemin = `${org}/${doc.id}/${crypto.randomUUID()}-urs-salle-assemblage.txt`;
  const fichier = new File(["Cahier des charges de démonstration.\nSalle ISO 7 en activité, cascade de pression 30 / 15 Pa.\n"], "urs-salle-assemblage.txt", { type: "text/plain" });
  await depot.deposerFichier(chemin, fichier);
  await depot.creer("versions_documents", {
    org_id: org, document_id: doc.id, version: 0, chemin_stockage: chemin, nom_fichier: fichier.name,
    taille_octets: fichier.size, type_mime: fichier.type, commentaire: "Version initiale",
  });
  await depot.deconnecter();
}

/** Plan, traitement d'air, équipements et points de la salle de démonstration. */
async function planDemo(depot: DepotDemo, org: string, siteId: string, salleId: string): Promise<void> {
  const zones = await depot.lister("zones", org, { salle_id: salleId });
  const z = (nom: string) => zones.find((x) => x.nom === nom)!;
  const rect = (x1: number, y1: number, x2: number, y2: number): Point2D[] => [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
  const traces: [string, Point2D[]][] = [
    ["SAS personnel", rect(4, 2, 8, 4)],
    ["SAS matériel", rect(5, 6, 8, 8)],
    ["Salle de production", rect(8, 2, 18, 8)],
    ["Zone d'emballage", rect(18, 2, 24, 7)],
  ];
  for (const [nom, geometrie] of traces) await depot.modifier("zones", z(nom).id, { geometrie });

  const base = { org_id: org, salle_id: salleId };
  await depot.creerPlusieurs("portes", [
    { ...base, libelle: "Entrée personnel", type: "porte", x: 4, y: 3, angle: 90, zone_a: z("SAS personnel").id, zone_b: null },
    { ...base, libelle: "SAS → production", type: "porte_sas", x: 8, y: 3, angle: 90, zone_a: z("SAS personnel").id, zone_b: z("Salle de production").id, asservie: true },
    { ...base, libelle: "Entrée matériel", type: "porte", x: 5, y: 7, angle: 90, zone_a: z("SAS matériel").id, zone_b: null },
    { ...base, libelle: "SAS matériel → production", type: "porte_sas", x: 8, y: 7, angle: 90, zone_a: z("SAS matériel").id, zone_b: z("Salle de production").id, asservie: true },
    { ...base, libelle: "Production → emballage", type: "porte", x: 18, y: 4.5, angle: 90, zone_a: z("Salle de production").id, zone_b: z("Zone d'emballage").id },
    { ...base, libelle: "Sortie produits finis", type: "passe_plat", x: 24, y: 5, angle: 90, zone_a: z("Zone d'emballage").id, zone_b: null },
  ]);

  const cta = await depot.creer("ctas", {
    org_id: org, site_id: siteId, nom: "CTA-01 Salle d'assemblage", repere: "CTA-01", localisation: "Local technique, toiture B2",
    debit_nominal_m3h: 10000, debit_reduit_m3h: 5000, air_neuf_pct: 20, puissance_ventilateur_kw: 7.5, heures_nominal_jour: 12, heures_reduit_jour: 12,
    etages: [
      { type: "prefiltre", libelle: "Préfiltre", classe: "G4" }, { type: "filtre", libelle: "Filtre fin", classe: "F9" },
      { type: "batterie_froide", libelle: "Batterie froide", classe: "" }, { type: "batterie_chaude", libelle: "Batterie chaude", classe: "" },
      { type: "humidificateur", libelle: "Humidificateur vapeur", classe: "" }, { type: "ventilateur", libelle: "Ventilateur de soufflage", classe: "" },
    ],
  });
  const bouche = (zone: string, type: "soufflage" | "reprise", repere: string, debit: number, x: number, y: number) =>
    ({ ...base, zone_id: z(zone).id, cta_id: cta.id, type, repere, debit_m3h: debit, x, y });
  const bouches = await depot.creerPlusieurs("bouches", [
    bouche("Salle de production", "soufflage", "S1", 1700, 10.5, 3.5), bouche("Salle de production", "soufflage", "S2", 1700, 15.5, 3.5),
    bouche("Salle de production", "soufflage", "S3", 1700, 10.5, 6.5), bouche("Salle de production", "soufflage", "S4", 1700, 15.5, 6.5),
    bouche("Salle de production", "reprise", "R1", 3000, 8.5, 7.5), bouche("Salle de production", "reprise", "R2", 3000, 17.5, 7.5),
    bouche("Zone d'emballage", "soufflage", "S5", 900, 20, 3.5), bouche("Zone d'emballage", "soufflage", "S6", 900, 22.5, 5.5),
    bouche("Zone d'emballage", "reprise", "R3", 1500, 23.5, 6.5),
    bouche("SAS personnel", "soufflage", "S7", 450, 6, 2.5), bouche("SAS personnel", "reprise", "R4", 300, 7.5, 3.6),
    bouche("SAS matériel", "soufflage", "S8", 350, 6.5, 6.5), bouche("SAS matériel", "reprise", "R5", 250, 7.5, 7.6),
  ]);

  const posePrefiltre = new Date(); posePrefiltre.setMonth(posePrefiltre.getMonth() - 5);
  const poseFin = new Date(); poseFin.setMonth(poseFin.getMonth() - 10);
  const [, f9] = await depot.creerPlusieurs("filtres", [
    { org_id: org, cta_id: cta.id, bouche_id: null, repere: "CTA-01 G4", emplacement: "etage_cta", classe: "G4", norme: "ISO 16890", date_pose: posePrefiltre.toISOString().slice(0, 10), dp_initiale_pa: 50, dp_finale_pa: 150, periodicite_remplacement_mois: 6 },
    { org_id: org, cta_id: cta.id, bouche_id: null, repere: "CTA-01 F9", emplacement: "etage_cta", classe: "F9", norme: "EN 779", date_pose: poseFin.toISOString().slice(0, 10), dp_initiale_pa: 100, dp_finale_pa: 300, periodicite_remplacement_mois: 12 },
    ...bouches.filter((b) => b.type === "soufflage" && b.zone_id === z("Salle de production").id).map((b) => ({
      org_id: org, cta_id: null, bouche_id: b.id, repere: `H14-${b.repere}`, emplacement: "terminal" as const, classe: "H14", norme: "EN 1822" as const,
      date_pose: poseFin.toISOString().slice(0, 10), dp_initiale_pa: 120, dp_finale_pa: 250, periodicite_remplacement_mois: 36, test_integrite: true,
    })),
  ]);
  const releves = [120, 150, 190, 240].map((dp, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - 9 + i * 3);
    return { org_id: org, filtre_id: f9.id, dp_pa: dp, date_releve: d.toISOString(), commentaire: i === 3 ? "Encrassement en hausse, commander le remplacement" : "" };
  });
  await depot.creerPlusieurs("releves_filtres", releves);

  await depot.creerPlusieurs("equipements", [
    { ...base, zone_id: z("Salle de production").id, type: "hotte_flux", libelle: "Hotte à flux laminaire d'assemblage", repere: "HFL-01", marque: "Exemple", modele: "FL-1800", numero_serie: "FL18-2024-117", x: 13, y: 2.6, largeur: 1.8, profondeur: 0.8 },
    { ...base, zone_id: z("Salle de production").id, type: "balance", libelle: "Balance de précision", repere: "BAL-02", x: 16.8, y: 5, largeur: 0.6, profondeur: 0.5 },
  ]);
  await depot.creerPlusieurs("mobilier", [
    { ...base, zone_id: z("Salle de production").id, type: "paillasse", libelle: "Paillasse d'assemblage 1", materiau: "inox", x: 11, y: 5, largeur: 2, profondeur: 0.8 },
    { ...base, zone_id: z("Salle de production").id, type: "paillasse", libelle: "Paillasse d'assemblage 2", materiau: "inox", x: 15, y: 5, largeur: 2, profondeur: 0.8 },
    { ...base, zone_id: z("SAS personnel").id, type: "banc_sas", libelle: "Banc de séparation", materiau: "inox", x: 6, y: 3.3, largeur: 1.6, profondeur: 0.35 },
    { ...base, zone_id: z("SAS matériel").id, type: "chariot", libelle: "Chariot de transfert", materiau: "inox", x: 6.5, y: 7.4, largeur: 0.9, profondeur: 0.6, nettoyabilite: "moyenne" },
  ]);
  await depot.creerPlusieurs("points_prelevement", [
    { ...base, zone_id: z("Salle de production").id, code: "P01", natures: ["particulaire", "microbio_air"], x: 13, y: 3.6, hauteur_m: 1.1, description: "Sous la hotte, hauteur de travail" },
    { ...base, zone_id: z("Salle de production").id, code: "P02", natures: ["particulaire", "surface"], x: 11, y: 5.6, hauteur_m: 0.9, description: "Paillasse 1" },
    { ...base, zone_id: z("Salle de production").id, code: "P03", natures: ["particulaire", "microbio_air", "surface"], x: 15, y: 5.6, hauteur_m: 0.9, description: "Paillasse 2" },
    { ...base, zone_id: z("Zone d'emballage").id, code: "P04", natures: ["particulaire", "surface"], x: 21, y: 4.5, hauteur_m: 1 },
    { ...base, zone_id: z("SAS personnel").id, code: "P05", natures: ["particulaire", "gants"], x: 7, y: 2.5, hauteur_m: 1 },
  ]);
  await depot.creerPlusieurs("flux", [
    { ...base, type: "personnel", libelle: "Entrée du personnel", points: [[2, 3], [4, 3], [6.5, 3], [8, 3], [11, 4]] },
    { ...base, type: "materiel", libelle: "Entrée des composants", points: [[2, 7], [5, 7], [8, 7], [11, 7]] },
    { ...base, type: "produit", libelle: "Sortie des produits finis", points: [[15, 4], [18, 4.5], [22, 5], [26, 5]] },
  ]);
}
