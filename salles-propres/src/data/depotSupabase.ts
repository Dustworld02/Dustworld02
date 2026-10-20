import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DefinitionRoleAvecDroits, Depot, FiltreJournal, Utilisateur } from "./depot";
import { ErreurDepot } from "./depot";
import type {
  EntreeJournal, Modification, NomTable, Nouveau, Organisation, Profil, Signature, Tables,
} from "./types";
import type { Signification } from "../domain/permissions";

function verifier<T>(resultat: { data: T | null; error: { message: string } | null }): T {
  if (resultat.error) throw new ErreurDepot(traduire(resultat.error.message));
  return resultat.data as T;
}

function traduire(message: string): string {
  if (/row-level security/i.test(message)) return "Action refusée : droits insuffisants.";
  if (/JSON object requested, multiple \(or no\) rows returned/i.test(message)) return "Enregistrement introuvable ou droits insuffisants.";
  if (/Invalid login credentials/i.test(message)) return "Adresse e-mail ou mot de passe incorrect.";
  return message;
}

export class DepotSupabase implements Depot {
  readonly mode = "supabase" as const;
  private client: SupabaseClient;

  constructor(url: string, cleAnonyme: string) {
    this.client = createClient(url, cleAnonyme);
  }

  private async profil(id: string, email: string): Promise<Utilisateur> {
    const { data } = await this.client.from("profils").select("*").eq("id", id).maybeSingle();
    return { id, email, nom_complet: (data as Profil | null)?.nom_complet ?? "" };
  }

  async utilisateurCourant(): Promise<Utilisateur | null> {
    const { data } = await this.client.auth.getUser();
    if (!data.user) return null;
    return this.profil(data.user.id, data.user.email ?? "");
  }

  async connecter(email: string, motDePasse: string): Promise<Utilisateur> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password: motDePasse });
    if (error || !data.user) throw new ErreurDepot(traduire(error?.message ?? "Connexion impossible"));
    return this.profil(data.user.id, data.user.email ?? email);
  }

  async inscrire(email: string, motDePasse: string, nomComplet: string): Promise<Utilisateur | null> {
    const { data, error } = await this.client.auth.signUp({
      email, password: motDePasse, options: { data: { nom_complet: nomComplet } },
    });
    if (error) throw new ErreurDepot(traduire(error.message));
    // Sans session : confirmation de l'adresse e-mail requise.
    if (!data.session || !data.user) return null;
    return this.profil(data.user.id, email);
  }

  async deconnecter(): Promise<void> {
    await this.client.auth.signOut();
  }

  async verifierMotDePasse(motDePasse: string): Promise<boolean> {
    const { data } = await this.client.auth.getUser();
    if (!data.user?.email) return false;
    const { error } = await this.client.auth.signInWithPassword({ email: data.user.email, password: motDePasse });
    return !error;
  }

  async mesOrganisations(): Promise<Organisation[]> {
    return verifier(await this.client.from("organisations").select("*").order("nom"));
  }

  async creerOrganisation(nom: string, roles: DefinitionRoleAvecDroits[]): Promise<string> {
    return verifier(await this.client.rpc("creer_organisation", { p_nom: nom, p_roles: roles })) as string;
  }

  async renommerOrganisation(id: string, nom: string): Promise<void> {
    verifier(await this.client.from("organisations").update({ nom }).eq("id", id).select().single());
  }

  async accepterInvitations(): Promise<number> {
    return verifier(await this.client.rpc("accepter_invitations")) as number;
  }

  async profils(orgId: string): Promise<Profil[]> {
    const membres = verifier(await this.client.from("membres").select("user_id").eq("org_id", orgId)) as { user_id: string }[];
    if (membres.length === 0) return [];
    return verifier(await this.client.from("profils").select("*").in("id", membres.map((m) => m.user_id)));
  }

  async lister<T extends NomTable>(table: T, orgId: string, filtre?: Partial<Tables[T]>): Promise<Tables[T][]> {
    return this.parPages<Tables[T]>((debut, fin) => {
      let requete = this.client.from(table).select("*").eq("org_id", orgId);
      if (filtre && Object.keys(filtre).length > 0) requete = requete.match(filtre as Record<string, unknown>);
      return requete.order("cree_le").order("id").range(debut, fin);
    });
  }

  /** Le serveur plafonne chaque réponse (1 000 lignes par défaut) : on lit par pages. */
  private async parPages<L>(
    page: (debut: number, fin: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
    limite = Number.POSITIVE_INFINITY,
  ): Promise<L[]> {
    const TAILLE = 1000;
    const lignes: L[] = [];
    while (lignes.length < limite) {
      const taille = Math.min(TAILLE, limite - lignes.length);
      const lot = verifier(await page(lignes.length, lignes.length + taille - 1)) as L[];
      lignes.push(...lot);
      if (lot.length < taille) break;
    }
    return lignes;
  }

  async creer<T extends NomTable>(table: T, valeurs: Nouveau<T>): Promise<Tables[T]> {
    return verifier(await this.client.from(table).insert(valeurs).select().single());
  }

  async creerPlusieurs<T extends NomTable>(table: T, valeurs: Nouveau<T>[]): Promise<Tables[T][]> {
    if (valeurs.length === 0) return [];
    return verifier(await this.client.from(table).insert(valeurs).select());
  }

  async modifier<T extends NomTable>(table: T, id: string, valeurs: Modification<T>): Promise<Tables[T]> {
    return verifier(await this.client.from(table).update(valeurs as never).eq("id", id).select().single());
  }

  async supprimer(table: NomTable, id: string): Promise<void> {
    const { error, count } = await this.client.from(table).delete({ count: "exact" }).eq("id", id);
    if (error) throw new ErreurDepot(traduire(error.message));
    if (!count) throw new ErreurDepot("Suppression refusée : droits insuffisants ou enregistrement introuvable.");
  }

  async creerSalleAvecZones(salle: Nouveau<"salles_propres">, zones: Omit<Nouveau<"zones">, "org_id" | "salle_id" | "site_id">[]): Promise<string> {
    return verifier(await this.client.rpc("creer_salle_propre", { p_salle: salle, p_zones: zones })) as string;
  }

  async signer(objetType: string, objetId: string, signification: Signification, commentaire: string, portee = ""): Promise<Signature> {
    return verifier(await this.client.rpc("signer", {
      p_objet_type: objetType, p_objet_id: objetId, p_signification: signification, p_commentaire: commentaire, p_portee: portee,
    })) as Signature;
  }

  async signatures(orgId: string, objetType: string, objetId: string): Promise<Signature[]> {
    return verifier(await this.client.from("signatures").select("*")
      .eq("org_id", orgId).eq("objet_type", objetType).eq("objet_id", objetId).order("signe_le"));
  }

  async journal(orgId: string, filtre: FiltreJournal = {}): Promise<EntreeJournal[]> {
    return this.parPages<EntreeJournal>((debut, fin) => {
      let requete = this.client.from("journal_audit").select("*").eq("org_id", orgId);
      if (filtre.table) requete = requete.eq("table_nom", filtre.table);
      if (filtre.enregistrementId) requete = requete.eq("enregistrement_id", filtre.enregistrementId);
      return requete.order("id", { ascending: false }).range(debut, fin);
    }, filtre.limite ?? 200);
  }

  async deposerFichier(chemin: string, fichier: File): Promise<void> {
    const { error } = await this.client.storage.from("documents").upload(chemin, fichier, { upsert: false });
    if (error) throw new ErreurDepot(traduire(error.message));
  }

  async urlFichier(chemin: string): Promise<string> {
    const { data, error } = await this.client.storage.from("documents").createSignedUrl(chemin, 300);
    if (error || !data) throw new ErreurDepot(traduire(error?.message ?? "Fichier introuvable"));
    return data.signedUrl;
  }
}
