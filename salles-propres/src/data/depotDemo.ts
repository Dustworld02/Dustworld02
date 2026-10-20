import type { DefinitionRoleAvecDroits, Depot, FiltreJournal, Utilisateur } from "./depot";
import { ErreurDepot } from "./depot";
import type {
  DocumentGed, EntreeJournal, Modification, NomTable, Nouveau, Organisation, Profil, Signature, Tables, Zone,
} from "./types";
import {
  MODULE_DES_TABLES, niveauEcriture, niveauSignature, niveauSuppression, type Signification,
} from "../domain/permissions";

/**
 * Mode démonstration : toutes les données restent dans ce navigateur.
 * Les règles de la base (droits, cohérence, journal, signatures) sont
 * émulées ici pour que la démonstration se comporte comme la version
 * hébergée — mais rien n'empêche un utilisateur averti de modifier ses
 * propres données locales : ce mode n'a aucune valeur de preuve.
 */

export interface Stockage {
  getItem(cle: string): string | null;
  setItem(cle: string, valeur: string): void;
  removeItem(cle: string): void;
}

export interface StockageFichiers {
  ecrire(chemin: string, contenu: Blob): Promise<void>;
  lire(chemin: string): Promise<Blob | null>;
}

interface ProfilDemo extends Profil {
  mot_de_passe: string;
}

export interface EtatDemo {
  version: 1;
  organisations: Organisation[];
  profils: ProfilDemo[];
  tables: { [K in NomTable]: Tables[K][] };
  signatures: Signature[];
  journal_audit: EntreeJournal[];
  sequenceJournal: number;
  session: string | null;
}

const CLE = "salles-propres-demo-v1";

function etatVide(): EtatDemo {
  return {
    version: 1,
    organisations: [],
    profils: [],
    tables: {
      roles: [], droits_roles: [], membres: [], invitations: [], referentiels_org: [], gabarits_org: [],
      entreprises: [], sites: [], salles_propres: [], zones: [], documents: [], versions_documents: [],
    },
    signatures: [],
    journal_audit: [],
    sequenceJournal: 0,
    session: null,
  };
}

function uuid(): string {
  return crypto.randomUUID();
}

function maintenant(): string {
  return new Date().toISOString();
}

function refus(): never {
  throw new ErreurDepot("Action refusée : droits insuffisants.");
}

export class DepotDemo implements Depot {
  readonly mode = "demo" as const;
  private etat: EtatDemo;

  constructor(private stockage: Stockage, private fichiers: StockageFichiers) {
    const brut = stockage.getItem(CLE);
    this.etat = brut ? (JSON.parse(brut) as EtatDemo) : etatVide();
  }

  /** Vrai si aucune donnée de démonstration n'existe encore. */
  estVide(): boolean {
    return this.etat.organisations.length === 0 && this.etat.profils.length === 0;
  }

  reinitialiser(): void {
    this.etat = etatVide();
    this.stockage.removeItem(CLE);
  }

  exporterEtat(): EtatDemo {
    return structuredClone(this.etat);
  }

  importerEtat(etat: EtatDemo): void {
    if (etat?.version !== 1 || !etat.tables) throw new ErreurDepot("Fichier de sauvegarde de démonstration invalide.");
    this.etat = structuredClone(etat);
    this.persister();
  }

  /** Crée un compte de démonstration (utilisé pour le jeu de données initial). */
  creerCompte(email: string, nomComplet: string, motDePasse: string): string {
    const id = uuid();
    this.etat.profils.push({ id, email, nom_complet: nomComplet, mot_de_passe: motDePasse });
    this.persister();
    return id;
  }

  ouvrirSession(userId: string | null): void {
    this.etat.session = userId;
    this.persister();
  }

  comptes(): Profil[] {
    return this.etat.profils.map(({ id, email, nom_complet }) => ({ id, email, nom_complet }));
  }

  // ------------------------------------------------------------------
  // Mécanique interne : transaction, droits, journal
  // ------------------------------------------------------------------

  private persister(): void {
    this.stockage.setItem(CLE, JSON.stringify(this.etat));
  }

  /** Applique une mutation sur une copie ; n'enregistre que si tout réussit. */
  private transaction<T>(fn: (e: EtatDemo) => T): T {
    const copie = structuredClone(this.etat);
    const resultat = fn(copie);
    this.etat = copie;
    this.persister();
    return resultat;
  }

  private uid(): string {
    if (!this.etat.session) throw new ErreurDepot("Non authentifié.");
    return this.etat.session;
  }

  private membre(e: EtatDemo, orgId: string) {
    const uid = this.etat.session;
    return e.tables.membres.find((m) => m.org_id === orgId && m.user_id === uid && m.actif);
  }

  private niveau(e: EtatDemo, orgId: string, module: string): number {
    const m = this.membre(e, orgId);
    if (!m) return 0;
    const d = e.tables.droits_roles.find((x) => x.role_id === m.role_id && x.module === module);
    return d?.niveau ?? 0;
  }

  private accesSite(e: EtatDemo, orgId: string, siteId: string | null): boolean {
    const m = this.membre(e, orgId);
    if (!m) return false;
    return m.sites === null || (siteId !== null && m.sites.includes(siteId));
  }

  private siteDe(table: NomTable, ligne: Record<string, unknown>): string | null {
    if (table === "sites") return ligne.id as string;
    if (table === "salles_propres" || table === "zones") return (ligne.site_id as string) ?? null;
    return null;
  }

  private lisible(e: EtatDemo, table: NomTable, ligne: Record<string, unknown>): boolean {
    const org = ligne.org_id as string;
    const module = MODULE_DES_TABLES[table];
    if (["roles", "droits_roles", "membres", "invitations", "referentiels_org", "gabarits_org"].includes(table)) {
      return !!this.membre(e, org);
    }
    if (this.niveau(e, org, module) < 1) return false;
    if (["sites", "salles_propres", "zones"].includes(table)) return this.accesSite(e, org, this.siteDe(table, ligne));
    return true;
  }

  private journaliser(e: EtatDemo, orgId: string | null, table: string, id: string, action: EntreeJournal["action"],
    anciennes: unknown, nouvelles: unknown): void {
    e.sequenceJournal += 1;
    e.journal_audit.push({
      id: e.sequenceJournal,
      org_id: orgId,
      table_nom: table,
      enregistrement_id: id,
      action,
      anciennes: anciennes ? structuredClone(anciennes) as Record<string, unknown> : null,
      nouvelles: nouvelles ? structuredClone(nouvelles) as Record<string, unknown> : null,
      auteur: this.etat.session,
      horodatage: maintenant(),
    });
  }

  /** Équivalent des déclencheurs de cohérence et de contrôle de la base. */
  private controler(e: EtatDemo, table: NomTable, ligne: Record<string, unknown>, ancienne: Record<string, unknown> | null): void {
    const org = ligne.org_id as string;
    const meme = (t: NomTable, id: unknown) => (e.tables[t] as unknown as Record<string, unknown>[]).some((x) => x.id === id && x.org_id === org);
    switch (table) {
      case "sites":
        if (!meme("entreprises", ligne.entreprise_id)) throw new ErreurDepot("L'entreprise n'appartient pas à cette organisation");
        break;
      case "salles_propres":
        if (!meme("sites", ligne.site_id)) throw new ErreurDepot("Le site n'appartient pas à cette organisation");
        if (ancienne && ancienne.site_id !== ligne.site_id) {
          e.tables.zones.filter((z) => z.salle_id === ligne.id).forEach((z) => { z.site_id = ligne.site_id as string; });
        }
        break;
      case "zones": {
        const salle = e.tables.salles_propres.find((s) => s.id === ligne.salle_id && s.org_id === org);
        if (!salle) throw new ErreurDepot("La salle propre n'appartient pas à cette organisation");
        ligne.site_id = salle.site_id;
        break;
      }
      case "membres":
      case "invitations":
      case "droits_roles":
        if (!meme("roles", ligne.role_id)) throw new ErreurDepot("Le rôle n'appartient pas à cette organisation");
        break;
      case "versions_documents":
        if (!meme("documents", ligne.document_id)) throw new ErreurDepot("Le document n'appartient pas à cette organisation");
        break;
      case "documents": {
        const doc = ligne as unknown as DocumentGed;
        const avant = ancienne as unknown as DocumentGed | null;
        if (avant && doc.version_courante !== avant.version_courante && avant.statut === "approuve") doc.statut = "brouillon";
        else if (avant && doc.statut !== avant.statut
          && (avant.statut === "approuve" || doc.statut === "perime" || avant.statut === "perime")
          && this.niveau(e, org, "documents") < 3) {
          throw new ErreurDepot("Droits insuffisants : retirer une approbation ou gérer la péremption demande le niveau validation");
        }
        if (doc.statut === "approuve" && (!avant || avant.statut !== "approuve")) {
          const signe = e.signatures.some((s) => s.objet_type === "document" && s.objet_id === doc.id
            && s.signification === "approuve" && s.version_objet === doc.version_courante);
          if (!signe) throw new ErreurDepot(`Approbation impossible : signature « approuvé » manquante pour la version ${doc.version_courante}`);
        }
        break;
      }
    }
  }

  private verifierAdminRestant(e: EtatDemo, orgId: string): void {
    const ok = e.tables.membres.some((m) => m.org_id === orgId && m.actif
      && e.tables.droits_roles.some((d) => d.role_id === m.role_id && d.module === "configuration" && d.niveau === 4));
    if (!ok) throw new ErreurDepot("Opération refusée : l'organisation doit garder au moins un administrateur actif");
  }

  private inserer<T extends NomTable>(e: EtatDemo, table: T, valeurs: Nouveau<T>, verifierDroits = true): Tables[T] {
    const uid = this.etat.session;
    const horodatage = maintenant();
    const ligne = {
      ...structuredClone(valeurs),
      id: uuid(), cree_le: horodatage, cree_par: uid, modifie_le: horodatage, modifie_par: uid,
    } as unknown as Record<string, unknown>;
    const org = ligne.org_id as string;
    if (verifierDroits) {
      if (this.niveau(e, org, MODULE_DES_TABLES[table]) < niveauEcriture(table)) refus();
    }
    this.controler(e, table, ligne, null);
    if (verifierDroits && ["sites", "salles_propres", "zones"].includes(table)) {
      if (!this.accesSite(e, org, this.siteDe(table, ligne))) refus();
    }
    if (table === "versions_documents") {
      const versions = e.tables.versions_documents.filter((v) => v.document_id === ligne.document_id);
      ligne.version = versions.reduce((max, v) => Math.max(max, v.version), 0) + 1;
    }
    (e.tables[table] as unknown as Record<string, unknown>[]).push(ligne);
    this.journaliser(e, org, table, ligne.id as string, "insert", null, ligne);
    if (table === "versions_documents") {
      const doc = e.tables.documents.find((d) => d.id === ligne.document_id)!;
      this.appliquerModification(e, "documents", doc.id, { version_courante: ligne.version as number }, false);
    }
    return ligne as unknown as Tables[T];
  }

  private appliquerModification<T extends NomTable>(e: EtatDemo, table: T, id: string, valeurs: Modification<T>, verifierDroits = true): Tables[T] {
    const lignes = e.tables[table] as unknown as Record<string, unknown>[];
    const index = lignes.findIndex((l) => l.id === id);
    if (index < 0) throw new ErreurDepot("Enregistrement introuvable ou droits insuffisants.");
    const ancienne = lignes[index];
    const org = ancienne.org_id as string;
    if (verifierDroits) {
      if (!this.lisible(e, table, ancienne)) throw new ErreurDepot("Enregistrement introuvable ou droits insuffisants.");
      if (this.niveau(e, org, MODULE_DES_TABLES[table]) < niveauEcriture(table)) refus();
      if (table === "versions_documents") refus();
    }
    const nouvelle: Record<string, unknown> = {
      ...ancienne, ...structuredClone(valeurs),
      id: ancienne.id, org_id: ancienne.org_id, cree_le: ancienne.cree_le, cree_par: ancienne.cree_par,
      modifie_le: maintenant(), modifie_par: this.etat.session,
    };
    if ((valeurs as Record<string, unknown>).org_id && (valeurs as Record<string, unknown>).org_id !== org) {
      throw new ErreurDepot("Un enregistrement ne peut pas changer d'organisation");
    }
    this.controler(e, table, nouvelle, ancienne);
    if (verifierDroits && ["sites", "salles_propres", "zones"].includes(table)) {
      if (!this.accesSite(e, org, this.siteDe(table, nouvelle))) refus();
    }
    lignes[index] = nouvelle;
    this.journaliser(e, org, table, id, "update", ancienne, nouvelle);
    if (table === "membres" || table === "droits_roles") this.verifierAdminRestant(e, org);
    return nouvelle as unknown as Tables[T];
  }

  // ------------------------------------------------------------------
  // Authentification
  // ------------------------------------------------------------------

  async utilisateurCourant(): Promise<Utilisateur | null> {
    const p = this.etat.profils.find((x) => x.id === this.etat.session);
    return p ? { id: p.id, email: p.email, nom_complet: p.nom_complet } : null;
  }

  async connecter(email: string, motDePasse: string): Promise<Utilisateur> {
    const cle = email.trim().toLowerCase();
    let p = this.etat.profils.find((x) => x.email.toLowerCase() === cle);
    if (!p) {
      // Un invité se connecte pour la première fois : son compte est créé avec ce mot de passe.
      const invitation = this.etat.tables.invitations.find((i) => i.email.toLowerCase() === cle && !i.acceptee_le);
      if (!invitation || motDePasse.length < 4) throw new ErreurDepot("Adresse e-mail ou mot de passe incorrect.");
      this.creerCompte(email.trim(), invitation.nom_complet, motDePasse);
      p = this.etat.profils.find((x) => x.email.toLowerCase() === cle)!;
    }
    if (p.mot_de_passe !== motDePasse) throw new ErreurDepot("Adresse e-mail ou mot de passe incorrect.");
    this.ouvrirSession(p.id);
    return { id: p.id, email: p.email, nom_complet: p.nom_complet };
  }

  async inscrire(email: string, motDePasse: string, nomComplet: string): Promise<Utilisateur | null> {
    if (this.etat.profils.some((x) => x.email.toLowerCase() === email.trim().toLowerCase())) {
      throw new ErreurDepot("Un compte existe déjà avec cette adresse.");
    }
    if (motDePasse.length < 4) throw new ErreurDepot("Mot de passe trop court (4 caractères minimum en démonstration).");
    const id = this.creerCompte(email.trim(), nomComplet, motDePasse);
    this.ouvrirSession(id);
    return { id, email: email.trim(), nom_complet: nomComplet };
  }

  async deconnecter(): Promise<void> {
    this.ouvrirSession(null);
  }

  async verifierMotDePasse(motDePasse: string): Promise<boolean> {
    const p = this.etat.profils.find((x) => x.id === this.etat.session);
    return !!p && p.mot_de_passe === motDePasse;
  }

  // ------------------------------------------------------------------
  // Organisations
  // ------------------------------------------------------------------

  async mesOrganisations(): Promise<Organisation[]> {
    return this.etat.organisations.filter((o) => !!this.membre(this.etat, o.id)).sort((a, b) => a.nom.localeCompare(b.nom));
  }

  async creerOrganisation(nom: string, roles: DefinitionRoleAvecDroits[]): Promise<string> {
    const uid = this.uid();
    if (!roles.some((r) => r.cle === "admin" && r.droits.configuration === 4)) {
      throw new ErreurDepot("La matrice doit contenir un rôle admin avec l'administration de la configuration");
    }
    if (!nom.trim()) throw new ErreurDepot("Nom d'organisation obligatoire");
    return this.transaction((e) => {
      const h = maintenant();
      const org: Organisation = { id: uuid(), nom: nom.trim(), cree_le: h, cree_par: uid, modifie_le: h, modifie_par: uid };
      e.organisations.push(org);
      this.journaliser(e, org.id, "organisations", org.id, "insert", null, org);
      let admin = "";
      for (const r of roles) {
        const role = this.inserer(e, "roles", { org_id: org.id, cle: r.cle, libelle: r.libelle, description: r.description, systeme: true }, false);
        if (r.cle === "admin") admin = role.id;
        for (const [module, niveau] of Object.entries(r.droits)) {
          this.inserer(e, "droits_roles", { org_id: org.id, role_id: role.id, module, niveau }, false);
        }
      }
      this.inserer(e, "membres", { org_id: org.id, user_id: uid, role_id: admin, sites: null, actif: true }, false);
      return org.id;
    });
  }

  async renommerOrganisation(id: string, nom: string): Promise<void> {
    this.transaction((e) => {
      if (this.niveau(e, id, "configuration") < 4) refus();
      const org = e.organisations.find((o) => o.id === id);
      if (!org) throw new ErreurDepot("Organisation introuvable");
      const avant = { ...org };
      org.nom = nom.trim();
      org.modifie_le = maintenant();
      org.modifie_par = this.etat.session;
      this.journaliser(e, id, "organisations", id, "update", avant, org);
    });
  }

  async accepterInvitations(): Promise<number> {
    const uid = this.uid();
    const p = this.etat.profils.find((x) => x.id === uid)!;
    return this.transaction((e) => {
      let n = 0;
      for (const inv of e.tables.invitations.filter((i) => i.email.toLowerCase() === p.email.toLowerCase() && !i.acceptee_le)) {
        if (!e.tables.membres.some((m) => m.org_id === inv.org_id && m.user_id === uid)) {
          this.inserer(e, "membres", { org_id: inv.org_id, user_id: uid, role_id: inv.role_id, sites: inv.sites, actif: true }, false);
        }
        this.appliquerModification(e, "invitations", inv.id, { acceptee_le: maintenant() }, false);
        n++;
      }
      return n;
    });
  }

  async profils(orgId: string): Promise<Profil[]> {
    if (!this.membre(this.etat, orgId)) return [];
    const ids = new Set(this.etat.tables.membres.filter((m) => m.org_id === orgId).map((m) => m.user_id));
    return this.etat.profils.filter((p) => ids.has(p.id)).map(({ id, email, nom_complet }) => ({ id, email, nom_complet }));
  }

  // ------------------------------------------------------------------
  // Accès générique
  // ------------------------------------------------------------------

  async lister<T extends NomTable>(table: T, orgId: string, filtre?: Partial<Tables[T]>): Promise<Tables[T][]> {
    const lignes = (this.etat.tables[table] as unknown as Record<string, unknown>[])
      .filter((l) => l.org_id === orgId)
      .filter((l) => this.lisible(this.etat, table, l))
      .filter((l) => !filtre || Object.entries(filtre).every(([k, v]) => l[k] === v));
    return structuredClone(lignes) as unknown as Tables[T][];
  }

  async creer<T extends NomTable>(table: T, valeurs: Nouveau<T>): Promise<Tables[T]> {
    this.uid();
    return structuredClone(this.transaction((e) => this.inserer(e, table, valeurs)));
  }

  async creerPlusieurs<T extends NomTable>(table: T, valeurs: Nouveau<T>[]): Promise<Tables[T][]> {
    this.uid();
    return structuredClone(this.transaction((e) => valeurs.map((v) => this.inserer(e, table, v))));
  }

  async modifier<T extends NomTable>(table: T, id: string, valeurs: Modification<T>): Promise<Tables[T]> {
    this.uid();
    return structuredClone(this.transaction((e) => this.appliquerModification(e, table, id, valeurs)));
  }

  async supprimer(table: NomTable, id: string): Promise<void> {
    this.uid();
    this.transaction((e) => {
      const lignes = e.tables[table] as unknown as Record<string, unknown>[];
      const ligne = lignes.find((l) => l.id === id);
      if (!ligne || !this.lisible(e, table, ligne)) throw new ErreurDepot("Suppression refusée : droits insuffisants ou enregistrement introuvable.");
      const org = ligne.org_id as string;
      if (table === "versions_documents" || this.niveau(e, org, MODULE_DES_TABLES[table]) < niveauSuppression(table)) {
        throw new ErreurDepot("Suppression refusée : droits insuffisants ou enregistrement introuvable.");
      }
      if (table === "entreprises" && e.tables.sites.some((s) => s.entreprise_id === id)) {
        throw new ErreurDepot("Suppression impossible : des sites sont rattachés à cette entreprise.");
      }
      if (table === "sites" && e.tables.salles_propres.some((s) => s.site_id === id)) {
        throw new ErreurDepot("Suppression impossible : des salles propres sont rattachées à ce site.");
      }
      if (table === "roles" && e.tables.membres.some((m) => m.role_id === id)) {
        throw new ErreurDepot("Suppression impossible : des membres ont ce rôle.");
      }
      const supprimer = (t: NomTable, predicat: (l: Record<string, unknown>) => boolean) => {
        const liste = e.tables[t] as unknown as Record<string, unknown>[];
        for (const l of liste.filter(predicat)) this.journaliser(e, org, t, l.id as string, "delete", l, null);
        (e.tables as Record<string, unknown>)[t] = liste.filter((l) => !predicat(l));
      };
      // Suppressions en cascade, comme en base.
      if (table === "salles_propres") supprimer("zones", (z) => (z as unknown as Zone).salle_id === id);
      if (table === "roles") {
        supprimer("droits_roles", (d) => d.role_id === id);
        supprimer("invitations", (i) => i.role_id === id);
      }
      if (table === "documents") {
        if (e.signatures.some((s) => s.objet_type === "document" && s.objet_id === id)) {
          throw new ErreurDepot("Suppression impossible : ce document porte des signatures (passez-le au statut périmé).");
        }
        supprimer("versions_documents", (v) => v.document_id === id);
      }
      supprimer(table, (l) => l.id === id);
      if (table === "membres" || table === "droits_roles") this.verifierAdminRestant(e, org);
    });
  }

  async creerSalleAvecZones(salle: Nouveau<"salles_propres">, zones: Omit<Nouveau<"zones">, "org_id" | "salle_id" | "site_id">[]): Promise<string> {
    this.uid();
    return this.transaction((e) => {
      const s = this.inserer(e, "salles_propres", salle);
      for (const z of zones) this.inserer(e, "zones", { ...z, org_id: salle.org_id, salle_id: s.id, site_id: null });
      return s.id;
    });
  }

  // ------------------------------------------------------------------
  // Signatures, journal, fichiers
  // ------------------------------------------------------------------

  async signer(objetType: "document", objetId: string, signification: Signification, commentaire: string): Promise<Signature> {
    const uid = this.uid();
    return structuredClone(this.transaction((e) => {
      const doc = e.tables.documents.find((d) => d.id === objetId);
      if (!doc) throw new ErreurDepot("Document introuvable");
      if (doc.version_courante < 1) throw new ErreurDepot("Le document n'a aucune version à signer");
      if (this.niveau(e, doc.org_id, "documents") < niveauSignature(signification)) {
        throw new ErreurDepot(`Droits insuffisants pour signer « ${signification} »`);
      }
      const p = e.profils.find((x) => x.id === uid)!;
      const s: Signature = {
        id: uuid(), org_id: doc.org_id, objet_type: objetType, objet_id: objetId, version_objet: doc.version_courante,
        signification, signataire: uid, nom_signataire: p.nom_complet || p.email, commentaire, signe_le: maintenant(),
      };
      e.signatures.push(s);
      this.journaliser(e, doc.org_id, "signatures", s.id, "insert", null, s);
      return s;
    }));
  }

  async signatures(orgId: string, objetType: string, objetId: string): Promise<Signature[]> {
    if (!this.membre(this.etat, orgId)) return [];
    return structuredClone(this.etat.signatures.filter((s) => s.org_id === orgId && s.objet_type === objetType && s.objet_id === objetId));
  }

  async journal(orgId: string, filtre: FiltreJournal = {}): Promise<EntreeJournal[]> {
    if (this.niveau(this.etat, orgId, "audit") < 1) return [];
    return structuredClone(this.etat.journal_audit
      .filter((j) => j.org_id === orgId)
      .filter((j) => !filtre.table || j.table_nom === filtre.table)
      .filter((j) => !filtre.enregistrementId || j.enregistrement_id === filtre.enregistrementId)
      .sort((a, b) => b.id - a.id)
      .slice(0, filtre.limite ?? 200));
  }

  async deposerFichier(chemin: string, fichier: File): Promise<void> {
    const org = chemin.split("/")[0];
    if (this.niveau(this.etat, org, "documents") < 2) refus();
    if (await this.fichiers.lire(chemin)) throw new ErreurDepot("Un fichier existe déjà à cet emplacement.");
    await this.fichiers.ecrire(chemin, fichier);
  }

  async urlFichier(chemin: string): Promise<string> {
    const org = chemin.split("/")[0];
    if (this.niveau(this.etat, org, "documents") < 1) refus();
    const blob = await this.fichiers.lire(chemin);
    if (!blob) throw new ErreurDepot("Fichier introuvable dans ce navigateur.");
    return URL.createObjectURL(blob);
  }
}

/** Stockage des fichiers de démonstration dans IndexedDB (navigateur). */
export class FichiersIndexedDb implements StockageFichiers {
  private base: Promise<IDBDatabase> | null = null;

  private ouvrir(): Promise<IDBDatabase> {
    if (!this.base) {
      this.base = new Promise((resolve, reject) => {
        const requete = indexedDB.open("salles-propres-demo-fichiers", 1);
        requete.onupgradeneeded = () => requete.result.createObjectStore("fichiers");
        requete.onsuccess = () => resolve(requete.result);
        requete.onerror = () => reject(requete.error);
      });
    }
    return this.base;
  }

  async ecrire(chemin: string, contenu: Blob): Promise<void> {
    const base = await this.ouvrir();
    await new Promise<void>((resolve, reject) => {
      const tx = base.transaction("fichiers", "readwrite");
      tx.objectStore("fichiers").put(contenu, chemin);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async lire(chemin: string): Promise<Blob | null> {
    const base = await this.ouvrir();
    return new Promise((resolve, reject) => {
      const requete = base.transaction("fichiers").objectStore("fichiers").get(chemin);
      requete.onsuccess = () => resolve((requete.result as Blob | undefined) ?? null);
      requete.onerror = () => reject(requete.error);
    });
  }
}

export class FichiersMemoire implements StockageFichiers {
  private fichiers = new Map<string, Blob>();
  async ecrire(chemin: string, contenu: Blob) { this.fichiers.set(chemin, contenu); }
  async lire(chemin: string) { return this.fichiers.get(chemin) ?? null; }
}

export class StockageMemoire implements Stockage {
  private valeurs = new Map<string, string>();
  getItem(cle: string) { return this.valeurs.get(cle) ?? null; }
  setItem(cle: string, valeur: string) { this.valeurs.set(cle, valeur); }
  removeItem(cle: string) { this.valeurs.delete(cle); }
}
