import type { NomTable } from "./types";
import type { Signification } from "../domain/permissions";

/**
 * Registre des tables : la même description que les migrations SQL
 * (module de droits, portée, rattachements, suppressions). Le mode démo
 * s'en sert pour appliquer les mêmes règles que la base ; les tests
 * vérifient la cohérence des deux.
 */

export type Portee = "org" | "site" | "membre" | "personnel" | "soi";

export interface Rattachement {
  colonne: string;
  table: NomTable;
  /** Comportement quand le parent est supprimé (on delete …). */
  suppression: "cascade" | "restreint" | "null";
  /** La table hérite du site de ce parent. */
  site?: boolean;
}

export interface ExigenceSignature {
  statut: string;
  signification: Signification;
  portee: string;
}

export interface MetaTable {
  module: string;
  portee: Portee;
  ecriture?: number;
  suppression?: number;
  rattachements?: Rattachement[];
  /** Numérotation PREFIXE-AAAA-NNN dans la colonne numero. */
  numero?: string;
  /** Pas de modification ni de suppression depuis l'application. */
  immuable?: boolean;
  signatures?: { objetType: string; colonneVersion: string | null; exigences: ExigenceSignature[] };
  /** Valeurs par défaut des colonnes (identiques aux default de la base). */
  defauts?: Record<string, unknown>;
}

const salle = (site = true): Rattachement => ({ colonne: "salle_id", table: "salles_propres", suppression: "cascade", site });
const zoneNull: Rattachement = { colonne: "zone_id", table: "zones", suppression: "null" };

export const META: Record<NomTable, MetaTable> = {
  roles: { module: "configuration", portee: "membre", ecriture: 4, suppression: 4 },
  droits_roles: { module: "configuration", portee: "membre", ecriture: 4, suppression: 4, rattachements: [{ colonne: "role_id", table: "roles", suppression: "cascade" }] },
  membres: { module: "configuration", portee: "membre", ecriture: 4, suppression: 4, rattachements: [{ colonne: "role_id", table: "roles", suppression: "restreint" }] },
  invitations: { module: "configuration", portee: "membre", ecriture: 4, suppression: 4, rattachements: [{ colonne: "role_id", table: "roles", suppression: "cascade" }] },
  referentiels_org: { module: "referentiels", portee: "membre", ecriture: 3, suppression: 3 },
  gabarits_org: { module: "gabarits", portee: "membre" },
  entreprises: { module: "installations", portee: "org" },
  sites: { module: "installations", portee: "soi", rattachements: [{ colonne: "entreprise_id", table: "entreprises", suppression: "restreint" }] },
  salles_propres: {
    module: "installations", portee: "site", rattachements: [{ colonne: "site_id", table: "sites", suppression: "restreint" }],
    defauts: { plan_largeur_m: 30, plan_hauteur_m: 20, plan_fond: null, plan_fond_largeur_m: null },
  },
  zones: { module: "installations", portee: "site", rattachements: [salle()], defauts: { geometrie: null } },
  documents: {
    module: "documents", portee: "org",
    signatures: { objetType: "document", colonneVersion: "version_courante", exigences: [{ statut: "approuve", signification: "approuve", portee: "" }] },
  },
  versions_documents: { module: "documents", portee: "org", immuable: true, rattachements: [{ colonne: "document_id", table: "documents", suppression: "cascade" }] },

  portes: {
    module: "installations", portee: "site", defauts: { libelle: "", asservie: false, notes: "", angle: 0 },
    rattachements: [salle(), { colonne: "zone_a", table: "zones", suppression: "null" }, { colonne: "zone_b", table: "zones", suppression: "null" }],
  },
  ctas: {
    module: "cta", portee: "site",
    defauts: { repere: "", localisation: "", etages: [], statut: "en_service", notes: "", debit_reduit_m3h: null, air_neuf_pct: null, puissance_ventilateur_kw: null, heures_nominal_jour: null, heures_reduit_jour: null },
    rattachements: [{ colonne: "site_id", table: "sites", suppression: "restreint" }] },
  bouches: { module: "cta", portee: "site", defauts: { repere: "", notes: "" }, rattachements: [salle(), zoneNull, { colonne: "cta_id", table: "ctas", suppression: "null" }] },
  filtres: {
    module: "cta", portee: "site", defauts: { repere: "", reference_fabricant: "", dimensions: "", notes: "", statut: "en_place", test_integrite: false, norme: "" },
    rattachements: [{ colonne: "cta_id", table: "ctas", suppression: "cascade", site: true }, { colonne: "bouche_id", table: "bouches", suppression: "cascade", site: true }],
  },
  releves_filtres: { module: "cta", portee: "site", defauts: { commentaire: "" }, rattachements: [{ colonne: "filtre_id", table: "filtres", suppression: "cascade", site: true }] },
  equipements: { module: "installations", portee: "site", defauts: { repere: "", marque: "", modele: "", numero_serie: "", notes: "", statut: "en_service", date_mise_service: null, largeur: 1.2, profondeur: 0.8 }, rattachements: [salle(), zoneNull] },
  mobilier: { module: "installations", portee: "site", defauts: { libelle: "", materiau: "", notes: "", angle: 0, nettoyabilite: "bonne" }, rattachements: [salle(), zoneNull] },
  points_prelevement: { module: "installations", portee: "site", defauts: { description: "", hauteur_m: null, actif: true }, rattachements: [salle(), { colonne: "zone_id", table: "zones", suppression: "cascade" }] },
  flux: { module: "installations", portee: "site", defauts: { libelle: "" }, rattachements: [salle()] },
  notifications: { module: "", portee: "personnel" },

  instruments: {
    module: "instruments", portee: "org",
    defauts: { marque: "", modele: "", numero_serie: "", plage: "", resolution: "", incertitude: "", periodicite_etalonnage_mois: 12, proprietaire: "interne", localisation: "", statut: "en_service", notes: "" },
  },
  etalonnages: {
    module: "instruments", portee: "org",
    defauts: { prochaine_echeance: null, organisme: "", numero_certificat: "", conforme: true, document_id: null, commentaire: "" },
    rattachements: [{ colonne: "instrument_id", table: "instruments", suppression: "cascade" }, { colonne: "document_id", table: "documents", suppression: "null" }],
  },
  campagnes_qualification: {
    module: "qualification_protocoles", portee: "site", numero: "QUAL",
    defauts: { numero: null, type_campagne: "initiale", etapes: ["QO"], objectif: "", responsable: "", prestataire: "", date_debut: null, date_fin: null, statut: "brouillon", verdict: null, conclusion: "", version: 1 },
    rattachements: [{ colonne: "salle_id", table: "salles_propres", suppression: "restreint", site: true }],
    signatures: {
      objetType: "campagne", colonneVersion: "version",
      exigences: [{ statut: "protocole_approuve", signification: "approuve", portee: "protocole" }, { statut: "cloturee", signification: "approuve", portee: "rapport" }],
    },
  },
  essais: {
    module: "qualification_execution", portee: "site",
    defauts: {
      ordre: 0, reference: "", cible_type: "zone", cible_id: null, cible_libelle: "", etat_occupation: null, critere: "", critere_min: null, critere_max: null,
      unite: "", instrument_id: null, date_realisation: null, realise_par: "", statut: "a_faire", verdict: null, mesures: [], commentaire: "",
    },
    rattachements: [{ colonne: "campagne_id", table: "campagnes_qualification", suppression: "cascade", site: true }, { colonne: "instrument_id", table: "instruments", suppression: "null" }],
  },
  resultats: {
    module: "contamination_resultats", portee: "site",
    defauts: {
      zone_id: null, point_id: null, point_libre: "", origine: "surveillance", essai_id: null, methode: "", parametre: "", taille_um: null, unite: "",
      etat_occupation: null, instrument_id: null, operateur: "", lot_milieu: "", germe: "", limite_alerte: null, limite_action: null, verdict: "non_evalue", commentaire: "",
    },
    rattachements: [
      salle(), zoneNull, { colonne: "point_id", table: "points_prelevement", suppression: "null" },
      { colonne: "essai_id", table: "essais", suppression: "cascade" }, { colonne: "instrument_id", table: "instruments", suppression: "null" },
    ],
  },

  ecarts: {
    module: "ecarts_capa", portee: "org", numero: "EC",
    defauts: {
      numero: null, description: "", origine: "autre", gravite: "mineure", salle_id: null, objet_type: null, objet_id: null, lien: "",
      detecte_par: "", impact: "", analyse_causes: {}, statut: "ouvert", conclusion: "", cloture_le: null, automatique: false,
    },
    rattachements: [{ colonne: "salle_id", table: "salles_propres", suppression: "null" }],
    signatures: { objetType: "ecart", colonneVersion: null, exigences: [{ statut: "cloture", signification: "approuve", portee: "cloture" }] },
  },
  capa: {
    module: "ecarts_capa", portee: "org", numero: "CAPA",
    defauts: { numero: null, ecart_id: null, type: "corrective", proprietaire: null, echeance: null, statut: "a_faire", realisee_le: null, preuve: "", verification_prevue: null, verification_resultat: "", verifie_le: null },
    rattachements: [{ colonne: "ecart_id", table: "ecarts", suppression: "cascade" }],
  },
  colonnes_kanban: { module: "kanban", portee: "membre", ecriture: 3, suppression: 3, defauts: { ordre: 0, terminale: false } },
  taches: {
    module: "kanban", portee: "org",
    defauts: { description: "", ordre: 0, proprietaire: null, echeance: null, priorite: "normale", etiquettes: [], checklist: [], salle_id: null, objet_type: null, objet_id: null, lien: "", source_cle: null, termine_le: null },
    rattachements: [{ colonne: "colonne_id", table: "colonnes_kanban", suppression: "restreint" }, { colonne: "salle_id", table: "salles_propres", suppression: "null" }],
  },
  messages: {
    module: "discussions", portee: "org", suppression: 4,
    defauts: { objet_type: "general", objet_id: null, objet_libelle: "", lien: "", mentions: [], reponse_a: null, archive: false },
    rattachements: [{ colonne: "reponse_a", table: "messages", suppression: "null" }],
  },
};

/** Objets signables : table, colonne de version, module dont le niveau conditionne la signature. */
export const OBJETS_SIGNABLES: Record<string, { table: NomTable; colonneVersion: string | null; module: string }> = {};
for (const [table, meta] of Object.entries(META) as [NomTable, MetaTable][]) {
  if (meta.signatures) OBJETS_SIGNABLES[meta.signatures.objetType] = { table, colonneVersion: meta.signatures.colonneVersion, module: meta.module };
}

export function niveauEcritureTable(table: NomTable): number {
  return META[table].ecriture ?? 2;
}

export function niveauSuppressionTable(table: NomTable): number {
  return META[table].suppression ?? 3;
}

/** Tables enregistrées dans l'export de sauvegarde. */
export const TABLES_EXPORTEES = (Object.keys(META) as NomTable[]).filter((t) => META[t].portee !== "personnel");
