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
  plan_largeur_m: number;
  plan_hauteur_m: number;
  plan_fond: string | null;
  plan_fond_largeur_m: number | null;
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
  geometrie: Point2D[] | null;
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
  portee: string;
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

export type Point2D = [number, number];

// ---------------------------------------------------------------------
// Phase 2 — modélisation
// ---------------------------------------------------------------------

export type TypePorte = "porte" | "porte_sas" | "passe_plat" | "porte_secours";

export interface Porte extends Trace {
  salle_id: string;
  site_id: string | null;
  libelle: string;
  type: TypePorte;
  zone_a: string | null;
  zone_b: string | null;
  x: number;
  y: number;
  angle: number;
  asservie: boolean;
  notes: string;
}

export interface EtageCta {
  type: "prefiltre" | "filtre" | "batterie_chaude" | "batterie_froide" | "humidificateur" | "ventilateur" | "recuperateur" | "autre";
  libelle: string;
  classe: string;
}

export interface Cta extends Trace {
  site_id: string;
  nom: string;
  repere: string;
  localisation: string;
  debit_nominal_m3h: number | null;
  debit_reduit_m3h: number | null;
  air_neuf_pct: number | null;
  etages: EtageCta[];
  puissance_ventilateur_kw: number | null;
  heures_nominal_jour: number | null;
  heures_reduit_jour: number | null;
  statut: "en_service" | "maintenance" | "arret";
  notes: string;
}

export type TypeBouche = "soufflage" | "reprise" | "extraction";

export interface Bouche extends Trace {
  salle_id: string;
  site_id: string | null;
  zone_id: string | null;
  cta_id: string | null;
  type: TypeBouche;
  repere: string;
  debit_m3h: number | null;
  x: number;
  y: number;
  notes: string;
}

export interface Filtre extends Trace {
  site_id: string | null;
  cta_id: string | null;
  bouche_id: string | null;
  repere: string;
  emplacement: "etage_cta" | "terminal";
  classe: string;
  norme: "" | "ISO 16890" | "EN 779" | "EN 1822" | "ISO 29463";
  reference_fabricant: string;
  dimensions: string;
  date_pose: string | null;
  dp_initiale_pa: number | null;
  dp_finale_pa: number | null;
  periodicite_remplacement_mois: number | null;
  test_integrite: boolean;
  statut: "en_place" | "remplace";
  notes: string;
}

export interface ReleveFiltre extends Trace {
  site_id: string | null;
  filtre_id: string;
  date_releve: string;
  dp_pa: number;
  commentaire: string;
}

export interface Equipement extends Trace {
  salle_id: string;
  site_id: string | null;
  zone_id: string | null;
  type: string;
  libelle: string;
  repere: string;
  marque: string;
  modele: string;
  numero_serie: string;
  date_mise_service: string | null;
  statut: "en_service" | "en_qualification" | "hors_service";
  x: number | null;
  y: number | null;
  largeur: number;
  profondeur: number;
  notes: string;
}

export interface Mobilier extends Trace {
  salle_id: string;
  site_id: string | null;
  zone_id: string | null;
  type: string;
  libelle: string;
  materiau: string;
  nettoyabilite: "bonne" | "moyenne" | "faible";
  x: number;
  y: number;
  largeur: number;
  profondeur: number;
  angle: number;
  notes: string;
}

export type NaturePrelevement = "particulaire" | "microbio_air" | "surface" | "gants" | "chimique";

export interface PointPrelevement extends Trace {
  salle_id: string;
  site_id: string | null;
  zone_id: string | null;
  code: string;
  natures: NaturePrelevement[];
  x: number;
  y: number;
  hauteur_m: number | null;
  description: string;
  actif: boolean;
}

export interface Flux extends Trace {
  salle_id: string;
  site_id: string | null;
  type: "personnel" | "materiel" | "produit" | "dechets";
  libelle: string;
  points: Point2D[];
}

export interface Notification extends Trace {
  destinataire: string;
  type: string;
  texte: string;
  lien: string;
  lue: boolean;
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
  portes: Porte;
  ctas: Cta;
  bouches: Bouche;
  filtres: Filtre;
  releves_filtres: ReleveFiltre;
  equipements: Equipement;
  mobilier: Mobilier;
  points_prelevement: PointPrelevement;
  flux: Flux;
  notifications: Notification;
}

export type NomTable = keyof Tables;

type SiteFacultatif<T> = "site_id" extends keyof T ? Omit<T, "site_id"> & { site_id?: T["site_id" & keyof T] | null } : T;

/**
 * Données à fournir pour créer un enregistrement (le reste est posé par la base).
 * site_id est facultatif : la base le déduit du rattachement (salle, zone, filtre…).
 */
export type Nouveau<T extends NomTable> =
  SiteFacultatif<Omit<Tables[T], keyof Trace | DefautsDe<T>>> & Partial<Pick<Tables[T], DefautsDe<T> & keyof Tables[T]>> & { org_id: string };

/** Colonnes qui ont une valeur par défaut en base (facultatives à la création ; voir META[t].defauts). */
export interface ColonnesParDefaut {
  salles_propres: "plan_largeur_m" | "plan_hauteur_m" | "plan_fond" | "plan_fond_largeur_m";
  zones: "geometrie";
  portes: "libelle" | "asservie" | "notes" | "angle";
  ctas: "repere" | "localisation" | "etages" | "statut" | "notes" | "debit_reduit_m3h" | "air_neuf_pct" | "puissance_ventilateur_kw" | "heures_nominal_jour" | "heures_reduit_jour";
  bouches: "repere" | "notes";
  filtres: "repere" | "reference_fabricant" | "dimensions" | "notes" | "statut" | "test_integrite" | "norme";
  releves_filtres: "commentaire";
  equipements: "repere" | "marque" | "modele" | "numero_serie" | "notes" | "statut" | "date_mise_service" | "largeur" | "profondeur";
  mobilier: "libelle" | "materiau" | "notes" | "angle" | "nettoyabilite";
  points_prelevement: "description" | "hauteur_m" | "actif";
  flux: "libelle";
}
type DefautsDe<T> = T extends keyof ColonnesParDefaut ? ColonnesParDefaut[T] : never;
export type Modification<T extends NomTable> = Partial<Omit<Tables[T], keyof Trace>>;


