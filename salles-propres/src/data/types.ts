import type { GradeBpf } from "../domain/referentiels/gradesBpf";
import type { TypeZone } from "../domain/secteurs/types";
import type { ReferenceGabarit } from "../domain/secteurs/generation";
import type { Signification } from "../domain/permissions";

/** Colonnes communes posées par la base (ou par le mode démo). */
export interface Trace {
  id: string;
  org_id: string;
  cree_le: string;
  cree_par: string | null;
  modifie_le: string;
  modifie_par: string | null;
}

export interface Organisation {
  id: string;
  nom: string;
  cree_le: string;
  cree_par: string | null;
  modifie_le: string;
  modifie_par: string | null;
}

export interface Profil {
  id: string;
  email: string;
  nom_complet: string;
}

export interface Role extends Trace {
  cle: string;
  libelle: string;
  description: string;
  systeme: boolean;
}

export interface DroitRole extends Trace {
  role_id: string;
  module: string;
  niveau: number;
}

export interface Membre extends Trace {
  user_id: string;
  role_id: string;
  sites: string[] | null;
  actif: boolean;
}

export interface Invitation extends Trace {
  email: string;
  nom_complet: string;
  role_id: string;
  sites: string[] | null;
  acceptee_le: string | null;
}

export interface ReferentielOrg extends Trace {
  cle: string;
  donnees: unknown;
}

export interface GabaritOrg extends Trace {
  cle: string;
  version: string;
  libelle: string;
  donnees: unknown;
}

export interface Entreprise extends Trace {
  nom: string;
  secteur: string | null;
  adresse: string;
  contact: string;
  notes: string;
}

export interface Site extends Trace {
  entreprise_id: string;
  nom: string;
  adresse: string;
}

export interface SallePropre extends Trace {
  site_id: string;
  nom: string;
  batiment: string;
  etage: string;
  secteur: string;
  gabarit_cle: string | null;
  gabarit_version: string | null;
  description: string;
}

export interface Zone extends Trace {
  salle_id: string;
  site_id: string | null;
  code: string;
  nom: string;
  type_zone: TypeZone;
  iso_repos: number | null;
  iso_activite: number | null;
  grade_bpf: GradeBpf | null;
  zone_risque: number | null;
  surface_m2: number | null;
  hauteur_m: number | null;
  pression_pa: number | null;
  tolerance_pression_pa: number | null;
  renouvellement_vol_h: number | null;
  temperature_min: number | null;
  temperature_max: number | null;
  hr_min: number | null;
  hr_max: number | null;
  gabarit_ref: ReferenceGabarit | null;
  notes: string;
}

export type StatutDocument = "brouillon" | "en_revue" | "approuve" | "perime";

export interface DocumentGed extends Trace {
  titre: string;
  type_document: string;
  statut: StatutDocument;
  objet_type: string | null;
  objet_id: string | null;
  valide_jusqu_au: string | null;
  version_courante: number;
}

export interface VersionDocument extends Trace {
  document_id: string;
  version: number;
  chemin_stockage: string;
  nom_fichier: string;
  taille_octets: number;
  type_mime: string;
  commentaire: string;
}

export interface Signature {
  id: string;
  org_id: string;
  objet_type: string;
  objet_id: string;
  version_objet: number;
  signification: Signification;
  signataire: string;
  nom_signataire: string;
  commentaire: string;
  signe_le: string;
}

export interface EntreeJournal {
  id: number;
  org_id: string | null;
  table_nom: string;
  enregistrement_id: string | null;
  action: "insert" | "update" | "delete";
  anciennes: Record<string, unknown> | null;
  nouvelles: Record<string, unknown> | null;
  auteur: string | null;
  horodatage: string;
}

/** Tables accessibles par l'interface générique du dépôt. */
export interface Tables {
  roles: Role;
  droits_roles: DroitRole;
  membres: Membre;
  invitations: Invitation;
  referentiels_org: ReferentielOrg;
  gabarits_org: GabaritOrg;
  entreprises: Entreprise;
  sites: Site;
  salles_propres: SallePropre;
  zones: Zone;
  documents: DocumentGed;
  versions_documents: VersionDocument;
}

export type NomTable = keyof Tables;

/** Données à fournir pour créer un enregistrement (le reste est posé par la base). */
export type Nouveau<T extends NomTable> = Omit<Tables[T], keyof Trace> & { org_id: string };
export type Modification<T extends NomTable> = Partial<Omit<Tables[T], keyof Trace>>;

export const TABLES_EXPORTEES: NomTable[] = [
  "roles", "droits_roles", "membres", "invitations", "referentiels_org", "gabarits_org",
  "entreprises", "sites", "salles_propres", "zones", "documents", "versions_documents",
];
