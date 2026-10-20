/**
 * Modules, niveaux de droits et matrice par défaut (plan §8.2).
 * La même logique est appliquée côté base par les politiques RLS
 * (supabase/migrations) : l'interface ne fait que refléter ces droits.
 */

export const NIVEAUX = {
  aucun: 0,
  lecture: 1,
  ecriture: 2,
  validation: 3,
  administration: 4,
} as const;
export type Niveau = (typeof NIVEAUX)[keyof typeof NIVEAUX];

export const LIBELLES_NIVEAUX: Record<Niveau, { court: string; long: string }> = {
  0: { court: "—", long: "Aucun accès" },
  1: { court: "L", long: "Lecture" },
  2: { court: "E", long: "Écriture" },
  3: { court: "V", long: "Validation / approbation" },
  4: { court: "A", long: "Administration" },
};

export interface DefinitionModule {
  cle: string;
  libelle: string;
  /** Phase du plan où le module devient utilisable. */
  phase: number;
}

export const MODULES: DefinitionModule[] = [
  { cle: "configuration", libelle: "Configuration, utilisateurs", phase: 1 },
  { cle: "referentiels", libelle: "Référentiels normatifs", phase: 1 },
  { cle: "gabarits", libelle: "Secteurs et gabarits", phase: 1 },
  { cle: "installations", libelle: "Entreprises, sites, salles, zones", phase: 1 },
  { cle: "documents", libelle: "Documents", phase: 1 },
  { cle: "audit", libelle: "Journal d'audit", phase: 1 },
  { cle: "cta", libelle: "CTA, filtres", phase: 2 },
  { cle: "instruments", libelle: "Instruments, étalonnage", phase: 3 },
  { cle: "qualification_protocoles", libelle: "Qualification : protocoles", phase: 3 },
  { cle: "qualification_execution", libelle: "Qualification : exécution, résultats", phase: 3 },
  { cle: "contamination_resultats", libelle: "Contaminations : résultats, plans", phase: 3 },
  { cle: "contamination_tendances", libelle: "Contaminations : tendances, rapports", phase: 6 },
  { cle: "ecarts_capa", libelle: "Écarts et CAPA", phase: 4 },
  { cle: "kanban", libelle: "Tâches (Kanban)", phase: 4 },
  { cle: "discussions", libelle: "Discussions", phase: 4 },
  { cle: "nettoyage_procedures", libelle: "Nettoyage : produits, procédures", phase: 5 },
  { cle: "nettoyage_execution", libelle: "Nettoyage : planning, enregistrements", phase: 5 },
  { cle: "personnel", libelle: "Personnel, habilitations", phase: 5 },
  { cle: "maintenance", libelle: "Maintenance, change control", phase: 6 },
];

export type CleModule = string;

export interface DefinitionRole {
  cle: string;
  libelle: string;
  description: string;
}

export const ROLES_SYSTEME: DefinitionRole[] = [
  { cle: "admin", libelle: "Administrateur", description: "Configuration, utilisateurs, droits, référentiels" },
  { cle: "qualite", libelle: "Responsable Assurance Qualité", description: "Approuve protocoles et rapports, pilote les CAPA" },
  { cle: "technique", libelle: "Responsable technique / maintenance", description: "CTA, filtres, instruments, maintenance" },
  { cle: "qualificateur", libelle: "Qualificateur / métrologue", description: "Exécute les essais, saisit les résultats" },
  { cle: "nettoyage", libelle: "Responsable nettoyage / hygiène", description: "Plans de nettoyage, produits, planning" },
  { cle: "operateur", libelle: "Opérateur", description: "Exécute, enregistre, remonte des anomalies" },
  { cle: "lecteur", libelle: "Lecteur / auditeur", description: "Lecture seule, exports" },
];

const L = 1, E = 2, V = 3, A = 4, _ = 0;

/** Matrice par défaut : module → [admin, qualite, technique, qualificateur, nettoyage, operateur, lecteur]. */
const MATRICE: Record<string, [number, number, number, number, number, number, number]> = {
  configuration: [A, L, _, _, _, _, _],
  referentiels: [A, V, L, L, L, L, L],
  gabarits: [A, V, L, L, E, _, L],
  installations: [A, V, E, L, L, L, L],
  documents: [A, V, E, E, E, L, L],
  audit: [A, L, _, _, _, _, _],
  cta: [A, L, E, E, _, _, L],
  instruments: [A, L, E, E, L, _, L],
  qualification_protocoles: [A, V, E, E, _, _, L],
  qualification_execution: [A, V, L, E, _, _, L],
  contamination_resultats: [A, V, L, E, E, E, L],
  contamination_tendances: [A, V, L, L, L, _, L],
  ecarts_capa: [A, V, E, E, E, E, L],
  kanban: [A, E, E, E, E, E, L],
  discussions: [A, E, E, E, E, E, L],
  nettoyage_procedures: [A, V, L, _, E, L, L],
  nettoyage_execution: [A, L, L, _, E, E, L],
  personnel: [A, V, L, _, E, L, _],
  maintenance: [A, V, E, L, _, _, L],
};

export function matriceParDefaut(): Record<string, Record<string, Niveau>> {
  const resultat: Record<string, Record<string, Niveau>> = {};
  ROLES_SYSTEME.forEach((role, index) => {
    resultat[role.cle] = {};
    for (const module of MODULES) {
      resultat[role.cle][module.cle] = (MATRICE[module.cle]?.[index] ?? 0) as Niveau;
    }
  });
  return resultat;
}

/**
 * Module de rattachement de chaque table (utilisé par le mode démo pour
 * émuler les politiques RLS ; la correspondance est la même en SQL).
 */
export const MODULE_DES_TABLES: Record<string, CleModule> = {
  organisations: "configuration",
  roles: "configuration",
  droits_roles: "configuration",
  membres: "configuration",
  invitations: "configuration",
  referentiels_org: "referentiels",
  gabarits_org: "gabarits",
  entreprises: "installations",
  sites: "installations",
  salles_propres: "installations",
  zones: "installations",
  documents: "documents",
  versions_documents: "documents",
  signatures: "documents",
  journal_audit: "audit",
};

/** Niveau requis pour écrire dans une table (création / modification). */
export function niveauEcriture(table: string): Niveau {
  const module = MODULE_DES_TABLES[table];
  if (module === "configuration") return 4;
  if (module === "referentiels") return 3;
  return 2;
}

/** Niveau requis pour supprimer. */
export function niveauSuppression(table: string): Niveau {
  const module = MODULE_DES_TABLES[table];
  if (module === "configuration") return 4;
  return 3;
}

export type Signification = "redige" | "verifie" | "approuve";

export const LIBELLES_SIGNIFICATIONS: Record<Signification, string> = {
  redige: "Rédigé par",
  verifie: "Vérifié par",
  approuve: "Approuvé par",
};

export function niveauSignature(signification: Signification): Niveau {
  return signification === "approuve" ? 3 : 2;
}
