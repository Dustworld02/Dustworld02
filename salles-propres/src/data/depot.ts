import type {
  EntreeJournal, Modification, NomTable, Nouveau, Organisation, Profil, Signature, Tables,
} from "./types";
import type { Signification } from "../domain/permissions";

export interface Utilisateur {
  id: string;
  email: string;
  nom_complet: string;
}

export interface DefinitionRoleAvecDroits {
  cle: string;
  libelle: string;
  description: string;
  droits: Record<string, number>;
}

export interface FiltreJournal {
  table?: string;
  enregistrementId?: string;
  limite?: number;
}

/**
 * Interface unique d'accès aux données. Deux implémentations :
 * - DepotSupabase : base PostgreSQL hébergée, droits vérifiés par RLS ;
 * - DepotDemo : données dans le navigateur, droits émulés (démonstration).
 */
export interface Depot {
  readonly mode: "demo" | "supabase";

  // Authentification
  utilisateurCourant(): Promise<Utilisateur | null>;
  connecter(email: string, motDePasse: string): Promise<Utilisateur>;
  inscrire(email: string, motDePasse: string, nomComplet: string): Promise<Utilisateur | null>;
  deconnecter(): Promise<void>;
  /** Ré-authentification avant signature. */
  verifierMotDePasse(motDePasse: string): Promise<boolean>;

  // Organisations
  mesOrganisations(): Promise<Organisation[]>;
  creerOrganisation(nom: string, roles: DefinitionRoleAvecDroits[]): Promise<string>;
  renommerOrganisation(id: string, nom: string): Promise<void>;
  accepterInvitations(): Promise<number>;
  profils(orgId: string): Promise<Profil[]>;

  // Accès générique aux tables
  lister<T extends NomTable>(table: T, orgId: string, filtre?: Partial<Tables[T]>): Promise<Tables[T][]>;
  creer<T extends NomTable>(table: T, valeurs: Nouveau<T>): Promise<Tables[T]>;
  creerPlusieurs<T extends NomTable>(table: T, valeurs: Nouveau<T>[]): Promise<Tables[T][]>;
  modifier<T extends NomTable>(table: T, id: string, valeurs: Modification<T>): Promise<Tables[T]>;
  supprimer(table: NomTable, id: string): Promise<void>;
  /** Crée une salle propre et ses zones en une seule transaction. */
  creerSalleAvecZones(salle: Nouveau<"salles_propres">, zones: Omit<Nouveau<"zones">, "org_id" | "salle_id" | "site_id">[]): Promise<string>;

  // Signatures, journal, fichiers
  signer(objetType: "document", objetId: string, signification: Signification, commentaire: string): Promise<Signature>;
  signatures(orgId: string, objetType: string, objetId: string): Promise<Signature[]>;
  journal(orgId: string, filtre?: FiltreJournal): Promise<EntreeJournal[]>;
  deposerFichier(chemin: string, fichier: File): Promise<void>;
  urlFichier(chemin: string): Promise<string>;
}

export class ErreurDepot extends Error {}
