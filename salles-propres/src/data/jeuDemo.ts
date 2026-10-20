import type { DepotDemo } from "./depotDemo";
import { rolesParDefaut } from "./rolesParDefaut";
import { gabaritNatif } from "../domain/secteurs/gabaritsNatifs";
import { genererZones, selectionParDefaut } from "../domain/secteurs/generation";
import { ROLES_SYSTEME } from "../domain/permissions";
import type { Nouveau, Point2D, Zone } from "./types";
import { proposerEssais } from "../domain/qualification";
import { limitesEssai } from "../domain/qualification";
import { groupesDeZones } from "../domain/nettoyage/groupes";
import { planifier } from "../domain/nettoyage/planning";
import { completerCatalogue } from "./catalogueNettoyage";
import { proposerPlan } from "../domain/surveillance";

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
  await qualificationDemo(depot, org, salle.id);
  await pilotageDemo(depot, org, salle.id, ids);
  await nettoyageDemo(depot, org, salle.id, ids);
  await surveillanceMaintenanceDemo(depot, org, salle.id);

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

function ilYA(mois: number, jours = 0, heure = 10): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - mois);
  d.setDate(d.getDate() - jours);
  d.setHours(heure, 0, 0, 0);
  return d;
}
const jourIso = (d: Date) => d.toISOString().slice(0, 10);

/** Pseudo-aléa reproductible pour des données de démonstration stables. */
function generateur(graine: number) {
  let x = graine;
  return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
}

/** Instruments, qualification initiale clôturée et six mois de surveillance. */
async function qualificationDemo(depot: DepotDemo, org: string, salleId: string): Promise<void> {
  const alea = generateur(42);
  const [compteur, biocollecteur, anemometre, manometre, luminometre] = await depot.creerPlusieurs("instruments", [
    { org_id: org, type: "compteur_particules", libelle: "Compteur de particules portable", marque: "Exemple", modele: "CP-28", numero_serie: "CP28-0193", plage: "0,3 à 10 µm, 28,3 L/min", periodicite_etalonnage_mois: 12 },
    { org_id: org, type: "biocollecteur", libelle: "Biocollecteur d'air", marque: "Exemple", modele: "BIO-100", numero_serie: "BIO-5521", periodicite_etalonnage_mois: 12 },
    { org_id: org, type: "anemometre", libelle: "Anémomètre à fil chaud", marque: "Exemple", modele: "AN-3", numero_serie: "AN3-778", periodicite_etalonnage_mois: 12 },
    { org_id: org, type: "manometre", libelle: "Micromanomètre", marque: "Exemple", modele: "MP-200", numero_serie: "MP-2031", periodicite_etalonnage_mois: 12 },
    { org_id: org, type: "luminometre", libelle: "Luminomètre ATP", marque: "Exemple", modele: "LUM-1", numero_serie: "L1-0042", periodicite_etalonnage_mois: 12 },
  ]);
  await depot.creerPlusieurs("etalonnages", [
    { org_id: org, instrument_id: compteur.id, date_etalonnage: jourIso(ilYA(14)), organisme: "Laboratoire accrédité", numero_certificat: "C-2025-0412", conforme: true },
    { org_id: org, instrument_id: compteur.id, date_etalonnage: jourIso(ilYA(2)), organisme: "Laboratoire accrédité", numero_certificat: "C-2026-0388", conforme: true },
    { org_id: org, instrument_id: biocollecteur.id, date_etalonnage: jourIso(ilYA(7)), organisme: "Fabricant", numero_certificat: "B-26-114", conforme: true },
    { org_id: org, instrument_id: anemometre.id, date_etalonnage: jourIso(ilYA(13)), organisme: "Laboratoire accrédité", numero_certificat: "A-25-090", conforme: true },
    { org_id: org, instrument_id: manometre.id, date_etalonnage: jourIso(ilYA(13)), organisme: "Laboratoire accrédité", numero_certificat: "M-25-077", conforme: true },
    { org_id: org, instrument_id: manometre.id, date_etalonnage: jourIso(ilYA(0, 7)), organisme: "Laboratoire accrédité", numero_certificat: "M-26-102", conforme: false, commentaire: "Dérive de +4 Pa constatée sur la plage 0-50 Pa." },
    { org_id: org, instrument_id: luminometre.id, date_etalonnage: jourIso(ilYA(7)), organisme: "Fabricant", numero_certificat: "L-26-031", conforme: true },
  ]);

  // Qualification initiale, réalisée il y a onze mois.
  const zones = await depot.lister("zones", org, { salle_id: salleId });
  const points = await depot.lister("points_prelevement", org, { salle_id: salleId });
  const bouches = await depot.lister("bouches", org, { salle_id: salleId });
  const filtres = await depot.lister("filtres", org);
  const quand = ilYA(11);
  const campagne = await depot.creer("campagnes_qualification", {
    org_id: org, salle_id: salleId, titre: "Qualification initiale — salle d'assemblage", type_campagne: "initiale", etapes: ["QI", "QO"],
    objectif: "Démontrer la conformité des locaux et du traitement d'air aux exigences de l'URS et à la classe ISO 7 au repos avant mise en production.",
    responsable: "Alex Métrologue", prestataire: "", date_debut: jourIso(quand),
  });
  const propositions = proposerEssais({ zones, ctas: [], equipements: [], bouches, filtres, etats: ["repos"], optionnels: false });
  const essais = await depot.creerPlusieurs("essais", propositions.map((e, i) => ({ ...e, org_id: org, campagne_id: campagne.id, ordre: i + 1 })));
  await depot.signer("campagne", campagne.id, "approuve", "Protocole conforme à l'URS", "protocole");
  await depot.modifier("campagnes_qualification", campagne.id, { statut: "protocole_approuve" });
  await depot.modifier("campagnes_qualification", campagne.id, { statut: "en_execution" });
  const parZone = (id: string | null) => zones.find((z) => z.id === id) ?? null;
  for (const e of essais) {
    const zone = parZone(e.cible_id) as Zone;
    const date = new Date(quand.getTime() + e.ordre * 3600000).toISOString();
    if (e.cle_essai === "classification_particulaire") {
      const pts = points.filter((p) => p.zone_id === zone.id);
      const requis = Math.max(1, Math.ceil((zone.surface_m2 ?? 10) / 5.5));
      const codes = [...pts.map((p) => p.code), ...Array.from({ length: Math.max(0, requis - pts.length) }, (_, i) => `${zone.code}-${i + 1}`)];
      const limites = limitesEssai(e, zone);
      const lignes: Nouveau<"resultats">[] = codes.flatMap((code) => [...limites.entries()].filter(([t]) => t === 0.5 || t === 5).map(([taille, limite]) => {
        const point = pts.find((p) => p.code === code);
        return {
          org_id: org, salle_id: salleId, zone_id: zone.id, point_id: point?.id ?? null, point_libre: point ? "" : code, origine: "qualification" as const,
          essai_id: e.id, milieu: "air" as const, nature: "particulaire" as const, methode: "Compteur optique (ISO 14644-1)", parametre: `Particules ≥ ${String(taille).replace(".", ",")} µm`,
          taille_um: taille, unite: "particules/m³", valeur: Math.round(limite * (0.02 + alea() * 0.15)), etat_occupation: "repos" as const,
          instrument_id: compteur.id, date_prelevement: date, operateur: "Alex Métrologue", limite_action: limite,
        };
      }));
      await depot.creerPlusieurs("resultats", lignes);
      await depot.modifier("essais", e.id, { statut: "realise", verdict: "conforme", date_realisation: date, instrument_id: compteur.id, realise_par: "Alex Métrologue" });
    } else if (e.cle_essai === "pression_differentielle") {
      await depot.modifier("essais", e.id, { statut: "realise", verdict: "conforme", date_realisation: date, instrument_id: manometre.id, realise_par: "Alex Métrologue", mesures: [{ point: zone.code, valeur: (zone.pression_pa ?? 0) + 1 }] });
    } else if (e.cle_essai === "debit_vitesse") {
      const mesures = bouches.filter((b) => b.zone_id === zone.id && b.type === "soufflage").map((b) => ({ point: b.repere, valeur: Math.round((b.debit_m3h ?? 0) * (1 + (alea() - 0.4) * 0.1)) }));
      await depot.modifier("essais", e.id, { statut: "realise", verdict: "conforme", date_realisation: date, instrument_id: anemometre.id, realise_par: "Alex Métrologue", mesures });
    } else if (e.cle_essai === "integrite_filtres") {
      await depot.modifier("essais", e.id, { statut: "realise", verdict: "conforme", date_realisation: date, realise_par: "Alex Métrologue", mesures: e.mesures.map((m) => ({ ...m, valeur: Math.round(alea() * 40) / 10000 })) });
    } else {
      await depot.modifier("essais", e.id, { statut: "realise", verdict: "conforme", date_realisation: date, realise_par: "Alex Métrologue", commentaire: "Conforme." });
    }
  }
  await depot.modifier("campagnes_qualification", campagne.id, {
    statut: "rapport_redige", verdict: "qualifie",
    conclusion: "Tous les essais sont conformes. La salle d'assemblage est qualifiée ISO 7 au repos (production) et ISO 8 (SAS, emballage). Prochaine requalification à 12 mois.",
  });
  await depot.signer("campagne", campagne.id, "approuve", "", "rapport");
  await depot.modifier("campagnes_qualification", campagne.id, { statut: "cloturee", date_fin: jourIso(new Date(quand.getTime() + 2 * 86400000)) });

  // Six mois de surveillance hebdomadaire.
  const pt = (code: string) => points.find((p) => p.code === code)!;
  const surveillance: Nouveau<"resultats">[] = [];
  for (let semaine = 26; semaine >= 0; semaine--) {
    const date = ilYA(0, semaine * 7, 9 + (semaine % 3));
    const base = { org_id: org, salle_id: salleId, origine: "surveillance" as const, etat_occupation: "activite" as const, date_prelevement: date.toISOString(), operateur: "Morgan Hygiène" };
    for (const code of ["P01", "P02", "P03"]) {
      surveillance.push({ ...base, zone_id: pt(code).zone_id, point_id: pt(code).id, milieu: "air", nature: "particulaire", methode: "Compteur optique", parametre: "Particules ≥ 0,5 µm", taille_um: 0.5, unite: "particules/m³", valeur: Math.round(30000 + alea() * 90000), limite_alerte: 200000, limite_action: 352000, instrument_id: compteur.id });
    }
    surveillance.push({ ...base, zone_id: pt("P01").zone_id, point_id: pt("P01").id, milieu: "air", nature: "microbiologique", methode: "Impaction", parametre: "Air — biocollecteur", unite: "UFC/m³", valeur: Math.floor(alea() * 9), limite_alerte: 50, limite_action: 100, instrument_id: biocollecteur.id, lot_milieu: `TSA-${2600 + semaine}` });
    surveillance.push({ ...base, zone_id: pt("P02").zone_id, point_id: pt("P02").id, milieu: "surface", nature: "microbiologique", methode: "Gélose contact", parametre: "Boîte contact Ø 55 mm", unite: "UFC/boîte", valeur: Math.floor(alea() * 6), limite_alerte: 15, limite_action: 25, lot_milieu: `TSA-${2600 + semaine}` });
    const derive = semaine <= 3 ? [19, 17, 12, 8][semaine] : Math.floor(alea() * 7);
    surveillance.push({ ...base, zone_id: pt("P03").zone_id, point_id: pt("P03").id, milieu: "surface", nature: "microbiologique", methode: "Gélose contact", parametre: "Boîte contact Ø 55 mm", unite: "UFC/boîte", valeur: derive, limite_alerte: 15, limite_action: 25, lot_milieu: `TSA-${2600 + semaine}`, germe: semaine <= 1 ? "Micrococcus luteus" : "" });
    surveillance.push({ ...base, zone_id: pt("P05").zone_id, point_id: pt("P05").id, milieu: "gants", nature: "microbiologique", methode: "Gélose contact", parametre: "Empreinte de gants (5 doigts)", unite: "UFC/gant", valeur: semaine === 9 ? 7 : Math.floor(alea() * 3), limite_alerte: 3, limite_action: 5, lot_milieu: `TSA-${2600 + semaine}`, germe: semaine === 9 ? "Staphylococcus epidermidis" : "" });
    surveillance.push({ ...base, zone_id: pt("P02").zone_id, point_id: pt("P02").id, milieu: "surface", nature: "chimique", methode: "Luminomètre", parametre: "ATP-métrie", unite: "RLU", valeur: Math.round(40 + alea() * 120), limite_alerte: 150, limite_action: 300, instrument_id: luminometre.id });
  }
  await depot.creerPlusieurs("resultats", surveillance);
}

/** Tableau de tâches, écart en cours d'analyse, discussions. */
async function pilotageDemo(depot: DepotDemo, org: string, salleId: string, ids: Record<string, string>): Promise<void> {
  const colonnes = await depot.creerPlusieurs("colonnes_kanban", [
    { org_id: org, libelle: "À faire", ordre: 1 }, { org_id: org, libelle: "En cours", ordre: 2 }, { org_id: org, libelle: "En attente", ordre: 3 },
    { org_id: org, libelle: "À vérifier", ordre: 4 }, { org_id: org, libelle: "Terminé", ordre: 5, terminale: true },
  ]);
  const col = (l: string) => colonnes.find((c) => c.libelle === l)!.id;
  const dans = (jours: number) => { const d = new Date(); d.setDate(d.getDate() + jours); return d.toISOString().slice(0, 10); };
  await depot.creerPlusieurs("taches", [
    { org_id: org, colonne_id: col("En cours"), titre: "Commander les filtres F9 de rechange (CTA-01)", ordre: 1000, proprietaire: ids.technique, echeance: dans(10), priorite: "haute", etiquettes: ["traitement d'air"], salle_id: salleId, lien: "/traitement-air",
      checklist: [{ texte: "Demander le devis", fait: true }, { texte: "Valider la référence (classe F9, dimensions)", fait: true }, { texte: "Passer la commande", fait: false }] },
    { org_id: org, colonne_id: col("À faire"), titre: "Former les nouveaux opérateurs à l'habillage ISO 7", ordre: 1000, proprietaire: ids.nettoyage, echeance: dans(21), priorite: "normale", etiquettes: ["formation"], salle_id: salleId },
    { org_id: org, colonne_id: col("À faire"), titre: "Préparer la requalification annuelle", ordre: 2000, proprietaire: ids.qualificateur, echeance: dans(25), priorite: "haute", etiquettes: ["qualification"], salle_id: salleId, lien: `/qualification/nouvelle?salle=${salleId}` },
    { org_id: org, colonne_id: col("À vérifier"), titre: "Mettre à jour le plan de nettoyage après ajout de la paillasse 2", ordre: 1000, proprietaire: ids.qualite, echeance: dans(3), priorite: "normale", etiquettes: ["nettoyage"], salle_id: salleId },
    { org_id: org, colonne_id: col("Terminé"), titre: "Installer les compteurs de pression différentielle des SAS", ordre: 1000, proprietaire: ids.technique, echeance: dans(-20), priorite: "normale", etiquettes: ["traitement d'air"], salle_id: salleId },
  ]);

  const ecart = await depot.creer("ecarts", {
    org_id: org, titre: "Dérive des boîtes contact au point P03 (paillasse 2)", origine: "surveillance", gravite: "majeure", salle_id: salleId,
    description: "Hausse continue des dénombrements sur boîtes contact au point P03 depuis quatre semaines, avec deux résultats au-delà de la limite d'alerte (15 UFC).",
    impact: "Pas de dépassement de la limite d'action. Lots assemblés sur la paillasse 2 sur la période : bioburden produit conforme. Impact produit jugé faible.",
    detecte_par: "Morgan Hygiène", lien: "/contaminations", statut: "en_analyse",
    analyse_causes: {
      pourquoi: ["Contamination croissante de la paillasse 2", "Nettoyage de fin de poste incomplet sur l'angle arrière", "Angle masqué par la balance déplacée récemment", "Le plan de nettoyage n'a pas été mis à jour après le déplacement", ""],
      ishikawa: { methode: "Plan de nettoyage non mis à jour", materiel: "Balance déplacée contre la paillasse", main_oeuvre: "Nouvel opérateur en cours de formation" },
      cause_racine: "Changement d'implantation (balance) sans mise à jour du plan de nettoyage ni de la zone essuyée.",
    },
  });
  await depot.creerPlusieurs("capa", [
    { org_id: org, ecart_id: ecart.id, type: "corrective", action: "Nettoyage renforcé de la paillasse 2 (sporicide) et éloignement de la balance de 30 cm.", proprietaire: ids.nettoyage, echeance: dans(2), verification_prevue: dans(30) },
    { org_id: org, ecart_id: ecart.id, type: "preventive", action: "Intégrer au change control toute modification d'implantation du mobilier, avec revue du plan de nettoyage.", proprietaire: ids.qualite, echeance: dans(30), verification_prevue: dans(90) },
  ]);

  await depot.creerPlusieurs("messages", [
    { org_id: org, objet_type: "general", contenu: "Bienvenue dans l'espace d'échange de l'équipe salle propre. Utilisez @ pour mentionner un collègue.", objet_libelle: "Espace général", lien: "/discussions" },
    { org_id: org, objet_type: "salle", objet_id: salleId, objet_libelle: "Salle propre assemblage cathéters", lien: `/salles/${salleId}`,
      contenu: "@Dominique Qualité les boîtes contact de P03 remontent depuis un mois, j'ai ouvert un écart. Peux-tu valider l'analyse ?", mentions: [ids.qualite] },
    { org_id: org, objet_type: "ecart", objet_id: ecart.id, objet_libelle: `${ecart.numero} ${ecart.titre}`, lien: `/ecarts/${ecart.id}`,
      contenu: "La balance a été déplacée le mois dernier pour libérer la hotte : c'est cohérent avec le début de la dérive." },
  ]);
}

/** Catalogue, procédures approuvées, personnel habilité, planning et une validation de nettoyage. */
async function nettoyageDemo(depot: DepotDemo, org: string, salleId: string, ids: Record<string, string>): Promise<void> {
  const salle = (await depot.lister("salles_propres", org)).find((x) => x.id === salleId)!;
  const zones = await depot.lister("zones", org, { salle_id: salleId });
  const groupes = groupesDeZones(salle.secteur, zones);
  await completerCatalogue(depot, org, groupes.flatMap((g) => g.contenu.produits), groupes.flatMap((g) => g.contenu.consommables), [], []);
  // Une partie du catalogue est déjà complétée par le service qualité, le reste reste « à compléter ».
  const [produits, consommables] = await Promise.all([depot.lister("produits_nettoyage", org), depot.lister("consommables", org)]);
  if (produits[0]) await depot.modifier("produits_nettoyage", produits[0].id, { fournisseur: "Fournisseur Exemple", reference: "DET-500", a_completer: false });
  for (const c of consommables.filter((x) => x.type === "lingette")) {
    await depot.modifier("consommables", c.id, { fournisseur: "Fournisseur Exemple", reference: `LP-${c.modele_cle?.slice(0, 6).toUpperCase()}`, unite: "sachet", stock: 14, seuil_alerte: 20, a_completer: false });
  }

  const procedures = await depot.creerPlusieurs("procedures_nettoyage", groupes.map((g) => ({
    org_id: org, salle_id: salleId, categorie: g.categorie, titre: g.titre, zones: g.zones.map((z) => z.id), contenu: g.contenu,
    gabarit_ref: { secteur: salle.secteur, niveau: g.niveau },
  })));
  for (const p of procedures) {
    await depot.signer("procedure", p.id, "approuve", "Procédure revue avec l'équipe de nettoyage");
    await depot.modifier("procedures_nettoyage", p.id, { statut: "approuvee" });
  }

  const [morgan, sam, alex, camille] = await depot.creerPlusieurs("personnes", [
    { org_id: org, prenom: "Morgan", nom: "Hygiène", fonction: "Responsable nettoyage", user_id: ids.nettoyage },
    { org_id: org, prenom: "Sam", nom: "Martin", fonction: "Agent de nettoyage", employeur: "prestataire", entreprise: "Net'Pro Services" },
    { org_id: org, prenom: "Alex", nom: "Bernard", fonction: "Opérateur de production" },
    { org_id: org, prenom: "Camille", nom: "Robert", fonction: "Opératrice", employeur: "interimaire", entreprise: "Intérim Exemple" },
  ]);
  const dans = (jours: number) => { const d = new Date(); d.setDate(d.getDate() + jours); return jourIso(d); };
  await depot.creerPlusieurs("habilitations", [
    { org_id: org, personne_id: morgan.id, type: "acces_zone", classe_iso_max: 5, date_obtention: dans(-400), date_expiration: dans(330), evaluateur: "Dominique Qualité", resultat: "Habillage et boîtes contact gants conformes" },
    { org_id: org, personne_id: morgan.id, type: "nettoyage", classe_iso_max: 5, date_obtention: dans(-400), date_expiration: dans(330), evaluateur: "Dominique Qualité", resultat: "Observation au poste conforme" },
    { org_id: org, personne_id: sam.id, type: "nettoyage", classe_iso_max: 7, date_obtention: dans(-335), date_expiration: dans(30), evaluateur: "Morgan Hygiène", resultat: "Observation au poste conforme" },
    { org_id: org, personne_id: alex.id, type: "acces_zone", classe_iso_max: 8, date_obtention: dans(-60), date_expiration: dans(305), evaluateur: "Morgan Hygiène", resultat: "Accès limité à l'ISO 8 en attente de la qualification d'habillage" },
    { org_id: org, personne_id: camille.id, type: "acces_zone", classe_iso_max: 7, date_obtention: dans(-400), date_expiration: dans(-35), evaluateur: "Morgan Hygiène", resultat: "Conforme" },
  ]);
  await depot.creerPlusieurs("formations", [
    { org_id: org, personne_id: morgan.id, intitule: "Nettoyage et désinfection des salles propres", theme: "nettoyage_desinfection", organisme: "Organisme de formation", date_formation: dans(-420), duree_h: 14, date_recyclage: dans(310) },
    { org_id: org, personne_id: morgan.id, intitule: "Biocontamination : maîtrise et surveillance", theme: "biocontamination", organisme: "Organisme de formation", date_formation: dans(-700), duree_h: 14, date_recyclage: dans(-5) },
    { org_id: org, personne_id: sam.id, intitule: "L'essentiel de la salle propre", theme: "essentiel_salle_propre", organisme: "Formation interne", date_formation: dans(-340), duree_h: 3.5, date_recyclage: dans(25) },
    { org_id: org, personne_id: alex.id, intitule: "L'essentiel de la salle propre", theme: "essentiel_salle_propre", organisme: "Formation interne", date_formation: dans(-62), duree_h: 3.5, date_recyclage: dans(303) },
    { org_id: org, personne_id: camille.id, intitule: "Habillage ISO 7", theme: "habillage", organisme: "Formation interne", date_formation: dans(-401), duree_h: 2, date_recyclage: dans(-36) },
  ]);

  // Planning : trois semaines passées (réalisées sauf deux oublis) et deux semaines à venir.
  const debut = new Date(); debut.setDate(debut.getDate() - 21); debut.setHours(12, 0, 0, 0);
  const aujourdhui = jourIso(new Date());
  const lots = (contenu: { produits: string[] }) => contenu.produits.slice(0, 2).map((c, i) => ({ produit: produits.find((x) => x.modele_cle === c)?.nom ?? c, lot: `L${2600 + i}-${c.length}` }));
  const interventions: Nouveau<"interventions_nettoyage">[] = [];
  let n = 0;
  for (const p of procedures) {
    for (const zoneId of p.zones) {
      const z = zones.find((x) => x.id === zoneId)!;
      for (const o of planifier(p.contenu, debut, 35)) {
        const passe = o.date < aujourdhui;
        const personne = (n++ % 3 === 0 && (z.iso_repos ?? 9) >= 7) ? sam.id : morgan.id;
        interventions.push({
          org_id: org, salle_id: salleId, zone_id: zoneId, procedure_id: p.id, date_prevue: o.date, moment: o.moment, surfaces: o.surfaces, titre: `${z.code} ${z.nom}`,
          personne_id: personne,
          ...(passe ? {
            statut: "realisee" as const, realise_le: `${o.date}T${o.moment === "debut_poste" ? "07:20" : o.moment === "fin_poste" ? "17:40" : "12:30"}:00.000Z`,
            duree_min: 15 + (n % 4) * 5, etapes_faites: p.contenu.etapes.map((e) => e.ordre), lots: lots(p.contenu),
            anomalies: n % 23 === 0 ? "Sachet de lingettes entamé trouvé ouvert : jeté." : "",
          } : {}),
        });
      }
    }
  }
  // Deux oublis : le plus ancien reste « non réalisé », le plus récent est encore à faire (en retard).
  const passees = interventions.filter((i) => i.statut === "realisee");
  const aRemettre = (i: Nouveau<"interventions_nettoyage">) => Object.assign(i, { realise_le: null, duree_min: null, etapes_faites: [], lots: [], anomalies: "" });
  if (passees.length > 10) {
    aRemettre(Object.assign(passees[7], { statut: "non_realisee" as const }));
    passees[7].anomalies = "Équipe réduite : nettoyage reporté au poste suivant.";
    aRemettre(Object.assign(passees[passees.length - 2], { statut: "a_faire" as const }));
  }
  await depot.creerPlusieurs("interventions_nettoyage", interventions);

  await depot.creerPlusieurs("materiel_nettoyage", [
    { org_id: org, salle_id: salleId, libelle: "Chariot double seau inox", type: "chariot", couleur: "bleu", zones_dediees: "Salle de production, emballage", etat: "bon", date_mise_service: dans(-500) },
    { org_id: org, salle_id: salleId, libelle: "Support de mop à plat", type: "support_mop", couleur: "bleu", zones_dediees: "Toutes zones ISO 7", etat: "use", date_mise_service: dans(-700), date_remplacement_prevue: dans(20) },
    { org_id: org, salle_id: salleId, libelle: "Pulvérisateur SAS", type: "pulverisateur", couleur: "vert", zones_dediees: "SAS personnel et matériel", etat: "bon", date_mise_service: dans(-90) },
  ]);

  // Validation de l'efficacité du nettoyage de la salle de production (ATP avant / après).
  const production = zones.find((z) => z.type_zone === "salle") ?? zones[0];
  const procProd = procedures.find((p) => p.zones.includes(production.id) && p.categorie === "nettoyage")!;
  const validation = await depot.creer("validations_nettoyage", {
    org_id: org, salle_id: salleId, procedure_id: procProd.id, titre: `Validation du nettoyage — ${production.nom}`, date_validation: dans(-14),
    criteres: "ATP après nettoyage < 150 RLU sur chaque surface ; réduction d'au moins 80 % par rapport à l'état avant nettoyage.", statut: "conforme",
    conclusion: "Les trois essais consécutifs respectent les critères : la procédure est validée pour la salle de production.",
  });
  const luminometre = (await depot.lister("instruments", org)).find((i) => i.type === "luminometre");
  const surfacesAtp: [string, number, number][] = [["Paillasse 1", 1840, 62], ["Paillasse 2", 2210, 95], ["Poignée de porte", 960, 41], ["Sol devant paillasse", 3120, 128]];
  await depot.creerPlusieurs("resultats", surfacesAtp.flatMap(([lieu, avant, apres]) => (["avant", "après"] as const).map((moment) => ({
    org_id: org, salle_id: salleId, zone_id: production.id, point_libre: `${lieu} — ${moment} nettoyage`, origine: "nettoyage" as const, milieu: "surface" as const, nature: "chimique" as const,
    methode: "Luminomètre", parametre: "ATP-métrie", unite: "RLU", valeur: moment === "avant" ? avant : apres, limite_alerte: moment === "avant" ? null : 150, limite_action: moment === "avant" ? null : 300,
    instrument_id: luminometre?.id ?? null, date_prelevement: `${dans(-14)}T10:00:00.000Z`, operateur: "Morgan Hygiène", validation_id: validation.id,
  }))));
}

/** Plan d'échantillonnage, relevés d'ambiance, maintenance et change control. */
async function surveillanceMaintenanceDemo(depot: DepotDemo, org: string, salleId: string): Promise<void> {
  const [zones, points, ctas, equipements, resultats] = await Promise.all([
    depot.lister("zones", org, { salle_id: salleId }), depot.lister("points_prelevement", org, { salle_id: salleId }), depot.lister("ctas", org), depot.lister("equipements", org, { salle_id: salleId }),
    depot.lister("resultats", org, { salle_id: salleId }),
  ]);
  const dans = (jours: number) => { const d = new Date(); d.setDate(d.getDate() + jours); return jourIso(d); };
  // Lignes déjà suivies : historique de six mois ; nouvelles lignes : premier prélèvement dans quelques jours.
  await depot.creerPlusieurs("plans_echantillonnage", proposerPlan(salleId, zones, points, dans(-182), resultats).map((l) => ({
    ...l, org_id: org, date_debut: resultats.some((r) => r.point_id === l.point_id && r.parametre === l.parametre) ? l.date_debut : dans(3),
  })));

  // Un mois de relevés d'ambiance (pression toutes les 6 h, température et humidité quotidiennes),
  // avec une baisse de pression de deux jours dans le SAS matériel.
  const alea = generateur(7);
  const releves: Nouveau<"releves_ambiance">[] = [];
  for (let h = 30 * 24; h >= 0; h -= 6) {
    const date = new Date(Date.now() - h * 3600000);
    date.setMinutes(0, 0, 0);
    for (const z of zones) {
      const consigne = z.pression_pa ?? 15;
      const excursion = z.type_zone === "sas_materiel" && h <= 12 * 24 && h > 10 * 24;
      releves.push({ org_id: org, zone_id: z.id, grandeur: "pression", valeur: Math.round((excursion ? consigne - 9 : consigne + (alea() - 0.5) * 4) * 10) / 10, date_mesure: date.toISOString(), source: "gtc" });
      if (h % 24 === 0) {
        releves.push({ org_id: org, zone_id: z.id, grandeur: "temperature", valeur: Math.round((20.5 + alea() * 2) * 10) / 10, date_mesure: date.toISOString(), source: "gtc" });
        releves.push({ org_id: org, zone_id: z.id, grandeur: "hr", valeur: Math.round(42 + alea() * 12), date_mesure: date.toISOString(), source: "gtc" });
      }
    }
  }
  await depot.creerPlusieurs("releves_ambiance", releves);

  const cta = ctas[0];
  const hotte = equipements.find((e) => e.type === "hotte_flux");
  const [visite, prefiltres, portes, psm] = await depot.creerPlusieurs("gammes_maintenance", [
    { org_id: org, cta_id: cta.id, libelle: "Visite semestrielle de la CTA", periodicite_mois: 6, date_debut: dans(-400), prestataire: "Clim Services", duree_h: 4, impact_requalification: true,
      operations: ["Contrôle des courroies et paliers du ventilateur", "Nettoyage des batteries et du bac de condensats", "Contrôle de l'humidificateur", "Relevé des pertes de charge des filtres", "Vérification des consignes de débit et de pression"] },
    { org_id: org, cta_id: cta.id, libelle: "Remplacement des préfiltres G4", periodicite_mois: 3, date_debut: dans(-200), prestataire: "Clim Services", duree_h: 1,
      operations: ["Remplacer les préfiltres", "Noter la perte de charge du filtre neuf", "Éliminer les filtres usagés en sac fermé"] },
    { org_id: org, salle_id: salleId, libelle: "Contrôle des portes asservies des SAS", periodicite_mois: 6, date_debut: dans(-150), prestataire: "Service technique", duree_h: 1,
      operations: ["Vérifier l'interverrouillage", "Contrôler les joints", "Tester l'alarme de porte ouverte"] },
    ...(hotte ? [{ org_id: org, salle_id: salleId, equipement_id: hotte.id, libelle: "Contrôle annuel de la hotte à flux laminaire", periodicite_mois: 12, date_debut: dans(20), prestataire: "Prestataire agréé", duree_h: 3, impact_requalification: true,
      operations: ["Vitesse et uniformité du flux", "Test d'intégrité du filtre HEPA", "Comptage particulaire"] }] : []),
  ]);
  await depot.creerPlusieurs("interventions_maintenance", [
    { org_id: org, gamme_id: visite.id, cta_id: cta.id, titre: visite.libelle, date_prevue: dans(-190), statut: "realisee", date_realisation: dans(-188), intervenant: "Clim Services",
      compte_rendu: "Courroie retendue, bac de condensats nettoyé, humidificateur détartré. Pertes de charge conformes.", remise_en_service: "Pressions des zones vérifiées après redémarrage : conformes." },
    { org_id: org, gamme_id: prefiltres.id, cta_id: cta.id, titre: prefiltres.libelle, date_prevue: dans(-110), statut: "realisee", date_realisation: dans(-110), intervenant: "Clim Services", compte_rendu: "4 préfiltres G4 remplacés, Δp neuf 45 Pa." },
    { org_id: org, gamme_id: portes.id, salle_id: salleId, titre: portes.libelle, date_prevue: dans(9), intervenant: "Service technique" },
    { org_id: org, cta_id: cta.id, type: "corrective", titre: "Alarme pression SAS matériel", date_prevue: dans(-11), statut: "realisee", date_realisation: dans(-10), intervenant: "Service technique",
      compte_rendu: "Registre de reprise du SAS matériel bloqué en position ouverte : moteur de registre remplacé.", remise_en_service: "Pression revenue à la consigne (15 Pa) en 20 min, surveillée 24 h." },
  ]);
  void psm;

  const balance = await depot.creer("changements", {
    org_id: org, titre: "Ajout d'une seconde paillasse d'assemblage et déplacement de la balance", categorie: "implantation", type: "mineur", salle_id: salleId, demandeur: "Responsable production",
    description: "Installation de la paillasse 2 en salle de production ; la balance est déplacée contre la paillasse.", justification: "Augmentation de capacité de la ligne d'assemblage.",
    evaluation: { nettoyage: true, surveillance: true, documents: true, commentaire: "Mettre à jour le plan de nettoyage et ajouter un point de prélèvement de surface sur la paillasse 2." },
    plan_actions: "1. Installer la paillasse.\n2. Mettre à jour la procédure de nettoyage de la salle.\n3. Ajouter le point P03 au plan d'échantillonnage.", date_cible: dans(-60), statut: "en_evaluation",
  });
  await depot.signer("changement", balance.id, "approuve", "Impact limité au nettoyage et à la surveillance", "approbation");
  await depot.modifier("changements", balance.id, { statut: "approuve" });
  await depot.modifier("changements", balance.id, { statut: "realise", realise_le: dans(-55) });
  await depot.creer("changements", {
    org_id: org, titre: "Remplacement des filtres terminaux H14 de la salle de production", categorie: "traitement_air", type: "majeur", salle_id: salleId, demandeur: "Responsable technique",
    description: "Filtres terminaux en place depuis 6 ans ; perte de charge en hausse.", justification: "Fin de vie des filtres, risque de fuite.",
    evaluation: { qualification: true, maintenance: true, commentaire: "Test d'intégrité des filtres neufs, mesure des débits et classification particulaire à refaire." },
    requalification_requise: true, date_cible: dans(45), statut: "en_evaluation",
  });
}
