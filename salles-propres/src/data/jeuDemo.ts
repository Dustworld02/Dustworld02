import type { DepotDemo } from "./depotDemo";
import { rolesParDefaut } from "./rolesParDefaut";
import { gabaritNatif } from "../domain/secteurs/gabaritsNatifs";
import { genererZones, selectionParDefaut } from "../domain/secteurs/generation";
import { ROLES_SYSTEME } from "../domain/permissions";

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
