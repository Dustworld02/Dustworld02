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

// ---------------------------------------------------------------------
// Phase 3 — instruments, résultats, qualification
// ---------------------------------------------------------------------

export interface Instrument extends Trace {
  type: string;
  libelle: string;
  marque: string;
  modele: string;
  numero_serie: string;
  plage: string;
  resolution: string;
  incertitude: string;
  periodicite_etalonnage_mois: number;
  proprietaire: "interne" | "prestataire" | "location";
  localisation: string;
  statut: "en_service" | "en_etalonnage" | "hors_service" | "reforme";
  notes: string;
}

export interface Etalonnage extends Trace {
  instrument_id: string;
  date_etalonnage: string;
  prochaine_echeance: string | null;
  organisme: string;
  numero_certificat: string;
  conforme: boolean;
  document_id: string | null;
  commentaire: string;
}

export type StatutCampagne = "brouillon" | "protocole_approuve" | "en_execution" | "rapport_redige" | "cloturee" | "annulee";
export type VerdictCampagne = "qualifie" | "qualifie_reserves" | "non_qualifie";

export interface CampagneQualification extends Trace {
  salle_id: string;
  site_id: string | null;
  numero: string | null;
  titre: string;
  type_campagne: "initiale" | "periodique" | "modification";
  etapes: string[];
  objectif: string;
  responsable: string;
  prestataire: string;
  date_debut: string | null;
  date_fin: string | null;
  statut: StatutCampagne;
  verdict: VerdictCampagne | null;
  conclusion: string;
  version: number;
}

export type EtatOccupation = "construction" | "repos" | "activite";

export interface MesureEssai {
  point: string;
  valeur: number | null;
  commentaire?: string;
}

export interface Essai extends Trace {
  campagne_id: string;
  site_id: string | null;
  ordre: number;
  cle_essai: string;
  libelle: string;
  reference: string;
  cible_type: "zone" | "cta" | "equipement" | "filtre" | "salle";
  cible_id: string | null;
  cible_libelle: string;
  etat_occupation: EtatOccupation | null;
  critere: string;
  critere_min: number | null;
  critere_max: number | null;
  unite: string;
  instrument_id: string | null;
  date_realisation: string | null;
  realise_par: string;
  statut: "a_faire" | "realise" | "non_applicable";
  verdict: "conforme" | "non_conforme" | "sans_objet" | null;
  mesures: MesureEssai[];
  commentaire: string;
}

export type Milieu = "air" | "surface" | "gants" | "liquide";
export type NatureContamination = "particulaire" | "microbiologique" | "chimique";
export type OrigineResultat = "qualification" | "surveillance" | "nettoyage" | "investigation" | "autre";
export type VerdictResultat = "conforme" | "alerte" | "action" | "non_evalue";

export interface Resultat extends Trace {
  salle_id: string;
  site_id: string | null;
  zone_id: string | null;
  point_id: string | null;
  point_libre: string;
  origine: OrigineResultat;
  essai_id: string | null;
  milieu: Milieu;
  nature: NatureContamination;
  methode: string;
  parametre: string;
  taille_um: number | null;
  unite: string;
  valeur: number;
  etat_occupation: EtatOccupation | null;
  instrument_id: string | null;
  date_prelevement: string;
  operateur: string;
  lot_milieu: string;
  germe: string;
  limite_alerte: number | null;
  limite_action: number | null;
  verdict: VerdictResultat;
  commentaire: string;
  validation_id: string | null;
}

// ---------------------------------------------------------------------
// Phase 4 — écarts, CAPA, tâches, discussions
// ---------------------------------------------------------------------

export type StatutEcart = "ouvert" | "en_analyse" | "capa_en_cours" | "a_verifier" | "cloture" | "annule";

export interface AnalyseCauses {
  pourquoi?: string[];
  ishikawa?: Partial<Record<"methode" | "milieu" | "main_oeuvre" | "materiel" | "matiere" | "mesure", string>>;
  cause_racine?: string;
}

export interface Ecart extends Trace {
  numero: string | null;
  titre: string;
  description: string;
  origine: "qualification" | "surveillance" | "nettoyage" | "audit" | "etalonnage" | "reclamation" | "maintenance" | "autre";
  gravite: "mineure" | "majeure" | "critique";
  salle_id: string | null;
  objet_type: string | null;
  objet_id: string | null;
  lien: string;
  date_detection: string;
  detecte_par: string;
  impact: string;
  analyse_causes: AnalyseCauses;
  statut: StatutEcart;
  conclusion: string;
  cloture_le: string | null;
  automatique: boolean;
}

export interface Capa extends Trace {
  numero: string | null;
  ecart_id: string | null;
  type: "corrective" | "preventive";
  action: string;
  proprietaire: string | null;
  echeance: string | null;
  statut: "a_faire" | "en_cours" | "realisee" | "efficace" | "non_efficace" | "annulee";
  realisee_le: string | null;
  preuve: string;
  verification_prevue: string | null;
  verification_resultat: string;
  verifie_le: string | null;
}

export interface ColonneKanban extends Trace {
  libelle: string;
  ordre: number;
  terminale: boolean;
}

export interface ElementChecklist {
  texte: string;
  fait: boolean;
}

export interface Tache extends Trace {
  colonne_id: string;
  titre: string;
  description: string;
  ordre: number;
  proprietaire: string | null;
  echeance: string | null;
  priorite: "basse" | "normale" | "haute" | "urgente";
  etiquettes: string[];
  checklist: ElementChecklist[];
  salle_id: string | null;
  objet_type: string | null;
  objet_id: string | null;
  lien: string;
  source_cle: string | null;
  termine_le: string | null;
}

export interface Message extends Trace {
  objet_type: string;
  objet_id: string | null;
  objet_libelle: string;
  lien: string;
  auteur: string;
  contenu: string;
  mentions: string[];
  reponse_a: string | null;
  archive: boolean;
}

// ---------------------------------------------------------------------
// Phase 5 — nettoyage et personnel
// ---------------------------------------------------------------------

export interface ProduitNettoyage extends Trace {
  nom: string;
  famille: string;
  fournisseur: string;
  reference: string;
  substance_active: string;
  dilution: string;
  temps_contact_min: number | null;
  spectre: string;
  rincage: boolean;
  sterile: boolean;
  compatibilites: string;
  groupe_rotation: string;
  peremption_solution_h: number | null;
  fds_document_id: string | null;
  modele_cle: string | null;
  a_completer: boolean;
  actif: boolean;
}

export interface Consommable extends Trace {
  nom: string;
  type: "lingette" | "mop" | "gant" | "tenue" | "autre";
  matiere: string;
  sterile: boolean;
  preimpregne: string;
  classe_iso_min: number | null;
  fournisseur: string;
  reference: string;
  unite: string;
  stock: number;
  seuil_alerte: number;
  modele_cle: string | null;
  a_completer: boolean;
  actif: boolean;
}

export interface ProcedureNettoyage extends Trace {
  salle_id: string;
  site_id: string | null;
  categorie: "nettoyage" | "habillage";
  titre: string;
  zones: string[];
  version: number;
  statut: "brouillon" | "approuvee" | "perimee";
  contenu: import("../domain/nettoyage/generation").ContenuProcedure;
  gabarit_ref: { secteur: string; niveau: string } | null;
}

export interface Personne extends Trace {
  nom: string;
  prenom: string;
  fonction: string;
  employeur: "interne" | "prestataire" | "interimaire";
  entreprise: string;
  user_id: string | null;
  actif: boolean;
  notes: string;
}

export interface Habilitation extends Trace {
  personne_id: string;
  type: "acces_zone" | "habillage" | "nettoyage";
  classe_iso_max: number | null;
  grade_bpf: "A" | "B" | "C" | "D" | null;
  date_obtention: string;
  date_expiration: string | null;
  evaluateur: string;
  resultat: string;
  document_id: string | null;
}

export interface Formation extends Trace {
  personne_id: string;
  intitule: string;
  theme: string;
  organisme: string;
  date_formation: string;
  duree_h: number | null;
  date_recyclage: string | null;
  document_id: string | null;
}

export interface LotUtilise {
  produit: string;
  lot: string;
  preparation?: string;
}

export interface InterventionNettoyage extends Trace {
  salle_id: string;
  site_id: string | null;
  zone_id: string;
  procedure_id: string;
  titre: string;
  date_prevue: string;
  moment: "debut_poste" | "fin_poste" | "journee";
  surfaces: string[];
  personne_id: string | null;
  statut: "a_faire" | "realisee" | "non_realisee" | "reportee";
  realise_le: string | null;
  duree_min: number | null;
  etapes_faites: number[];
  lots: LotUtilise[];
  anomalies: string;
}

export interface ValidationNettoyage extends Trace {
  salle_id: string;
  site_id: string | null;
  procedure_id: string | null;
  titre: string;
  date_validation: string;
  criteres: string;
  statut: "planifiee" | "en_cours" | "conforme" | "non_conforme";
  conclusion: string;
}

export interface MaterielNettoyage extends Trace {
  salle_id: string | null;
  libelle: string;
  type: string;
  couleur: string;
  zones_dediees: string;
  etat: "bon" | "use" | "hors_service";
  date_mise_service: string | null;
  date_remplacement_prevue: string | null;
  notes: string;
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
  instruments: Instrument;
  etalonnages: Etalonnage;
  campagnes_qualification: CampagneQualification;
  essais: Essai;
  resultats: Resultat;
  ecarts: Ecart;
  capa: Capa;
  colonnes_kanban: ColonneKanban;
  taches: Tache;
  messages: Message;
  produits_nettoyage: ProduitNettoyage;
  consommables: Consommable;
  procedures_nettoyage: ProcedureNettoyage;
  personnes: Personne;
  habilitations: Habilitation;
  formations: Formation;
  interventions_nettoyage: InterventionNettoyage;
  validations_nettoyage: ValidationNettoyage;
  materiel_nettoyage: MaterielNettoyage;
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
  instruments: "marque" | "modele" | "numero_serie" | "plage" | "resolution" | "incertitude" | "periodicite_etalonnage_mois" | "proprietaire" | "localisation" | "statut" | "notes";
  etalonnages: "prochaine_echeance" | "organisme" | "numero_certificat" | "conforme" | "document_id" | "commentaire";
  campagnes_qualification: "numero" | "type_campagne" | "etapes" | "objectif" | "responsable" | "prestataire" | "date_debut" | "date_fin" | "statut" | "verdict" | "conclusion" | "version";
  essais: "ordre" | "reference" | "cible_type" | "cible_id" | "cible_libelle" | "etat_occupation" | "critere" | "critere_min" | "critere_max" | "unite" | "instrument_id" | "date_realisation" | "realise_par" | "statut" | "verdict" | "mesures" | "commentaire";
  ecarts: "numero" | "description" | "origine" | "gravite" | "salle_id" | "objet_type" | "objet_id" | "lien" | "date_detection" | "detecte_par" | "impact" | "analyse_causes" | "statut" | "conclusion" | "cloture_le" | "automatique";
  capa: "numero" | "ecart_id" | "type" | "proprietaire" | "echeance" | "statut" | "realisee_le" | "preuve" | "verification_prevue" | "verification_resultat" | "verifie_le";
  colonnes_kanban: "ordre" | "terminale";
  taches: "description" | "ordre" | "proprietaire" | "echeance" | "priorite" | "etiquettes" | "checklist" | "salle_id" | "objet_type" | "objet_id" | "lien" | "source_cle" | "termine_le";
  messages: "objet_type" | "objet_id" | "objet_libelle" | "lien" | "auteur" | "mentions" | "reponse_a" | "archive";
  produits_nettoyage: "famille" | "fournisseur" | "reference" | "substance_active" | "dilution" | "temps_contact_min" | "spectre" | "rincage" | "sterile" | "compatibilites" | "groupe_rotation" | "peremption_solution_h" | "fds_document_id" | "modele_cle" | "a_completer" | "actif";
  consommables: "type" | "matiere" | "sterile" | "preimpregne" | "classe_iso_min" | "fournisseur" | "reference" | "unite" | "stock" | "seuil_alerte" | "modele_cle" | "a_completer" | "actif";
  procedures_nettoyage: "categorie" | "zones" | "version" | "statut" | "contenu" | "gabarit_ref";
  personnes: "prenom" | "fonction" | "employeur" | "entreprise" | "user_id" | "actif" | "notes";
  habilitations: "type" | "classe_iso_max" | "grade_bpf" | "date_obtention" | "date_expiration" | "evaluateur" | "resultat" | "document_id";
  formations: "theme" | "organisme" | "date_formation" | "duree_h" | "date_recyclage" | "document_id";
  interventions_nettoyage: "titre" | "moment" | "surfaces" | "personne_id" | "statut" | "realise_le" | "duree_min" | "etapes_faites" | "lots" | "anomalies";
  validations_nettoyage: "procedure_id" | "date_validation" | "criteres" | "statut" | "conclusion";
  materiel_nettoyage: "salle_id" | "type" | "couleur" | "zones_dediees" | "etat" | "date_mise_service" | "date_remplacement_prevue" | "notes";
  resultats: "validation_id" | "zone_id" | "point_id" | "point_libre" | "origine" | "essai_id" | "methode" | "parametre" | "taille_um" | "unite" | "etat_occupation" | "instrument_id" | "date_prelevement" | "operateur" | "lot_milieu" | "germe" | "limite_alerte" | "limite_action" | "verdict" | "commentaire";
}
type DefautsDe<T> = T extends keyof ColonnesParDefaut ? ColonnesParDefaut[T] : never;
export type Modification<T extends NomTable> = Partial<Omit<Tables[T], keyof Trace>>;


