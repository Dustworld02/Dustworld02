import type { DefinitionRoleAvecDroits, Depot, FiltreJournal, Utilisateur } from "./depot";
import { ErreurDepot } from "./depot";
import type {
  DocumentGed, EntreeJournal, Modification, NomTable, Nouveau, Organisation, Profil, Signature, Tables,
} from "./types";
import { META, OBJETS_SIGNABLES, niveauEcritureTable, niveauSuppressionTable } from "./schema";
import { CONTROLES, REACTIONS, type ContexteRegle } from "./regles";
import { niveauSignature, type Signification } from "../domain/permissions";

/**
 * Mode démonstration : toutes les données restent dans ce navigateur.
 * Les règles de la base (droits, cohérence, journal, signatures) sont
 * émulées à partir du registre des tables (schema.ts) pour que la
 * démonstration se comporte comme la version hébergée — mais rien
 * n'empêche un utilisateur averti de modifier ses propres données
 * locales : ce mode n'a aucune valeur de preuve.
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

type Ligne = Record<string, unknown>;
export type { ContexteRegle };

export interface EtatDemo {
  version: 1;
  organisations: Organisation[];
  profils: ProfilDemo[];
  tables: Partial<Record<NomTable, Ligne[]>>;
  signatures: Signature[];
  journal_audit: EntreeJournal[];
  sequenceJournal: number;
  session: string | null;
}

const CLE = "salles-propres-demo-v1";

function etatVide(): EtatDemo {
  return { version: 1, organisations: [], profils: [], tables: {}, signatures: [], journal_audit: [], sequenceJournal: 0, session: null };
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

function lignesDe(e: EtatDemo, table: NomTable): Ligne[] {
  if (!e.tables[table]) e.tables[table] = [];
  return e.tables[table]!;
}

export class DepotDemo implements Depot {
  readonly mode = "demo" as const;
  private etat: EtatDemo;

  constructor(private stockage: Stockage, private fichiers: StockageFichiers) {
    const brut = stockage.getItem(CLE);
    this.etat = brut ? (JSON.parse(brut) as EtatDemo) : etatVide();
  }

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
  // Mécanique interne
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
    return (lignesDe(e, "membres") as unknown as Tables["membres"][]).find((m) => m.org_id === orgId && m.user_id === uid && m.actif);
  }

  private niveau(e: EtatDemo, orgId: string, module: string): number {
    const m = this.membre(e, orgId);
    if (!m) return 0;
    const d = (lignesDe(e, "droits_roles") as unknown as Tables["droits_roles"][]).find((x) => x.role_id === m.role_id && x.module === module);
    return d?.niveau ?? 0;
  }

  private accesSite(e: EtatDemo, orgId: string, siteId: unknown): boolean {
    const m = this.membre(e, orgId);
    if (!m) return false;
    return m.sites === null || (typeof siteId === "string" && m.sites.includes(siteId));
  }

  /** Équivalent des politiques de lecture (RLS). */
  private lisible(e: EtatDemo, table: NomTable, ligne: Ligne): boolean {
    const meta = META[table];
    const org = ligne.org_id as string;
    switch (meta.portee) {
      case "membre": return !!this.membre(e, org);
      case "personnel": return ligne.destinataire === this.etat.session && !!this.membre(e, org);
      case "soi": return this.niveau(e, org, meta.module) >= 1 && this.accesSite(e, org, ligne.id);
      case "site": return this.niveau(e, org, meta.module) >= 1 && this.accesSite(e, org, ligne.site_id);
      default: return this.niveau(e, org, meta.module) >= 1;
    }
  }

  /** Équivalent des politiques d'écriture (RLS), évaluées après les déclencheurs. */
  private ecrivable(e: EtatDemo, table: NomTable, ligne: Ligne): boolean {
    const meta = META[table];
    const org = ligne.org_id as string;
    if (meta.portee === "personnel") return ligne.destinataire === this.etat.session;
    if (this.niveau(e, org, meta.module) < niveauEcritureTable(table)) return false;
    if (meta.portee === "soi") return this.accesSite(e, org, ligne.id);
    if (meta.portee === "site") return this.accesSite(e, org, ligne.site_id);
    return true;
  }

  private journaliser(e: EtatDemo, orgId: string | null, table: string, id: string, action: EntreeJournal["action"], anciennes: unknown, nouvelles: unknown): void {
    e.sequenceJournal += 1;
    e.journal_audit.push({
      id: e.sequenceJournal, org_id: orgId, table_nom: table, enregistrement_id: id, action,
      anciennes: anciennes ? structuredClone(anciennes) as Ligne : null,
      nouvelles: nouvelles ? structuredClone(nouvelles) as Ligne : null,
      auteur: this.etat.session, horodatage: maintenant(),
    });
  }

  /** Équivalent des déclencheurs de cohérence : rattachements, site déduit, numérotation, signatures exigées. */
  private controler(e: EtatDemo, table: NomTable, ligne: Ligne, ancienne: Ligne | null): void {
    const meta = META[table];
    const org = ligne.org_id as string;
    let siteDeduit: unknown = undefined;
    let siteRequis = false;
    for (const r of meta.rattachements ?? []) {
      const valeur = ligne[r.colonne];
      if (r.site) siteRequis = true;
      if (valeur === null || valeur === undefined) continue;
      const parent = lignesDe(e, r.table).find((x) => x.id === valeur && x.org_id === org);
      if (!parent) throw new ErreurDepot(`Rattachement invalide : ${r.table} n'appartient pas à cette organisation`);
      if (r.site && siteDeduit === undefined) siteDeduit = r.table === "sites" ? parent.id : parent.site_id;
    }
    if (siteRequis) {
      if (siteDeduit === undefined) throw new ErreurDepot("Rattachement obligatoire manquant.");
      ligne.site_id = siteDeduit;
    }
    if (meta.numero && !ligne.numero) {
      const annee = new Date().getFullYear();
      const prefixe = `${meta.numero}-${annee}-`;
      const n = lignesDe(e, table).filter((x) => x.org_id === org && String(x.numero ?? "").startsWith(prefixe)).length;
      ligne.numero = `${prefixe}${String(n + 1).padStart(3, "0")}`;
    }

    // Règles propres à certaines tables
    if (table === "salles_propres" && ancienne && ancienne.site_id !== ligne.site_id) {
      throw new ErreurDepot("Une salle propre ne peut pas changer de site");
    }
    if (table === "documents") {
      const doc = ligne as unknown as DocumentGed;
      const avant = ancienne as unknown as DocumentGed | null;
      if (avant && doc.version_courante !== avant.version_courante && avant.statut === "approuve") doc.statut = "brouillon";
      else if (avant && doc.statut !== avant.statut
        && (avant.statut === "approuve" || doc.statut === "perime" || avant.statut === "perime")
        && this.niveau(e, org, "documents") < 3) {
        throw new ErreurDepot("Droits insuffisants : retirer une approbation ou gérer la péremption demande le niveau validation");
      }
    }

    for (const c of CONTROLES) c(this.contexte(e), table, ligne, ancienne);

    if (meta.signatures) {
      for (const ex of meta.signatures.exigences) {
        if (ligne.statut !== ex.statut || (ancienne && ancienne.statut === ex.statut)) continue;
        const version = meta.signatures.colonneVersion ? Number(ligne[meta.signatures.colonneVersion]) : 1;
        const signe = e.signatures.some((s) => s.objet_type === meta.signatures!.objetType && s.objet_id === ligne.id
          && s.signification === ex.signification && s.portee === ex.portee && s.version_objet === version);
        if (!signe) {
          throw new ErreurDepot(table === "documents"
            ? `Approbation impossible : signature « approuvé » manquante pour la version ${version}`
            : `Signature « ${ex.signification} » requise pour passer au statut « ${ex.statut} »`);
        }
      }
    }
  }

  private verifierAdminRestant(e: EtatDemo, orgId: string): void {
    const membres = lignesDe(e, "membres") as unknown as Tables["membres"][];
    const droits = lignesDe(e, "droits_roles") as unknown as Tables["droits_roles"][];
    const ok = membres.some((m) => m.org_id === orgId && m.actif
      && droits.some((d) => d.role_id === m.role_id && d.module === "configuration" && d.niveau === 4));
    if (!ok) throw new ErreurDepot("Opération refusée : l'organisation doit garder au moins un administrateur actif");
  }

  private contexte(e: EtatDemo): ContexteRegle {
    return {
      uid: this.etat.session,
      lignes: (t) => lignesDe(e, t),
      inserer: (t, v) => this.inserer(e, t, v, false),
      modifier: (t, id, v) => { this.appliquerModification(e, t, id, v, false); },
      notifier: (org, destinataire, type, texte, lien) => {
        if (!destinataire || destinataire === this.etat.session) return;
        const membres = lignesDe(e, "membres") as unknown as Tables["membres"][];
        if (!membres.some((m) => m.org_id === org && m.user_id === destinataire && m.actif)) return;
        this.inserer(e, "notifications", { org_id: org, destinataire, type, texte, lien, lue: false }, false);
      },
      niveau: (org, module) => this.niveau(e, org, module),
      nomUtilisateur: (id) => {
        const p = e.profils.find((x) => x.id === id);
        return p ? p.nom_complet || p.email : "Quelqu'un";
      },
    };
  }

  private inserer<T extends NomTable>(e: EtatDemo, table: T, valeurs: Nouveau<T>, verifierDroits = true): Tables[T] {
    const uid = this.etat.session;
    const h = maintenant();
    const ligne: Ligne = {
      ...structuredClone(META[table].defauts ?? {}), ...structuredClone(valeurs) as Ligne,
      id: uuid(), cree_le: h, cree_par: uid, modifie_le: h, modifie_par: uid,
    };
    for (const [cle, v] of Object.entries(META[table].defauts ?? {})) if (ligne[cle] === undefined) ligne[cle] = structuredClone(v);
    const org = ligne.org_id as string;
    if (verifierDroits && META[table].portee === "personnel") refus();
    this.controler(e, table, ligne, null);
    if (verifierDroits && !this.ecrivable(e, table, ligne)) refus();
    if (table === "versions_documents") {
      const versions = lignesDe(e, "versions_documents").filter((v) => v.document_id === ligne.document_id);
      ligne.version = versions.reduce((max, v) => Math.max(max, Number(v.version)), 0) + 1;
    }
    lignesDe(e, table).push(ligne);
    this.journaliser(e, org, table, ligne.id as string, "insert", null, ligne);
    if (table === "versions_documents") {
      this.appliquerModification(e, "documents", ligne.document_id as string, { version_courante: ligne.version as number }, false);
    }
    for (const r of REACTIONS) r(this.contexte(e), table, null, ligne);
    return ligne as unknown as Tables[T];
  }

  private appliquerModification<T extends NomTable>(e: EtatDemo, table: T, id: string, valeurs: Modification<T>, verifierDroits = true): Tables[T] {
    const lignes = lignesDe(e, table);
    const index = lignes.findIndex((l) => l.id === id);
    if (index < 0) throw new ErreurDepot("Enregistrement introuvable ou droits insuffisants.");
    const ancienne = lignes[index];
    const org = ancienne.org_id as string;
    if (verifierDroits) {
      if (!this.lisible(e, table, ancienne)) throw new ErreurDepot("Enregistrement introuvable ou droits insuffisants.");
      if (META[table].immuable || !this.ecrivable(e, table, ancienne)) refus();
    }
    if ((valeurs as Ligne).org_id && (valeurs as Ligne).org_id !== org) throw new ErreurDepot("Un enregistrement ne peut pas changer d'organisation");
    const nouvelle: Ligne = {
      ...ancienne, ...structuredClone(valeurs) as Ligne,
      id: ancienne.id, org_id: org, cree_le: ancienne.cree_le, cree_par: ancienne.cree_par,
      modifie_le: maintenant(), modifie_par: this.etat.session,
    };
    this.controler(e, table, nouvelle, ancienne);
    if (verifierDroits && !this.ecrivable(e, table, nouvelle)) refus();
    lignes[index] = nouvelle;
    this.journaliser(e, org, table, id, "update", ancienne, nouvelle);
    if (table === "membres" || table === "droits_roles") this.verifierAdminRestant(e, org);
    for (const r of REACTIONS) r(this.contexte(e), table, ancienne, nouvelle);
    return nouvelle as unknown as Tables[T];
  }

  /** Suppression avec les comportements des clés étrangères (cascade, restriction, mise à null). */
  private retirer(e: EtatDemo, table: NomTable, ligne: Ligne): void {
    const org = ligne.org_id as string;
    for (const c of CONTROLES) c(this.contexte(e), table, null, ligne);
    if (table === "documents" && e.signatures.some((s) => s.objet_type === "document" && s.objet_id === ligne.id)) {
      throw new ErreurDepot("Suppression impossible : ce document porte des signatures (déclarez-le périmé)");
    }
    for (const [enfant, meta] of Object.entries(META) as [NomTable, typeof META[NomTable]][]) {
      for (const r of meta.rattachements ?? []) {
        if (r.table !== table) continue;
        const lies = lignesDe(e, enfant).filter((x) => x[r.colonne] === ligne.id);
        if (lies.length === 0) continue;
        if (r.suppression === "restreint") {
          throw new ErreurDepot(`Suppression impossible : ${lies.length} enregistrement(s) y sont rattachés (${enfant}).`);
        }
        for (const lie of lies) {
          if (r.suppression === "cascade") this.retirer(e, enfant, lie);
          else this.appliquerModification(e, enfant, lie.id as string, { [r.colonne]: null } as Modification<NomTable>, false);
        }
      }
    }
    e.tables[table] = lignesDe(e, table).filter((x) => x.id !== ligne.id);
    this.journaliser(e, org, table, ligne.id as string, "delete", ligne, null);
    for (const r of REACTIONS) r(this.contexte(e), table, ligne, null);
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
      const invitations = (this.etat.tables.invitations ?? []) as unknown as Tables["invitations"][];
      const invitation = invitations.find((i) => i.email.toLowerCase() === cle && !i.acceptee_le);
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
      const invitations = lignesDe(e, "invitations") as unknown as Tables["invitations"][];
      const membres = lignesDe(e, "membres") as unknown as Tables["membres"][];
      for (const inv of invitations.filter((i) => i.email.toLowerCase() === p.email.toLowerCase() && !i.acceptee_le)) {
        if (!membres.some((m) => m.org_id === inv.org_id && m.user_id === uid)) {
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
    const membres = lignesDe(this.etat, "membres") as unknown as Tables["membres"][];
    const ids = new Set(membres.filter((m) => m.org_id === orgId).map((m) => m.user_id));
    return this.etat.profils.filter((p) => ids.has(p.id)).map(({ id, email, nom_complet }) => ({ id, email, nom_complet }));
  }

  // ------------------------------------------------------------------
  // Accès générique
  // ------------------------------------------------------------------

  async lister<T extends NomTable>(table: T, orgId: string, filtre?: Partial<Tables[T]>): Promise<Tables[T][]> {
    const lignes = (this.etat.tables[table] ?? [])
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
      const ligne = lignesDe(e, table).find((l) => l.id === id);
      const refusMessage = "Suppression refusée : droits insuffisants ou enregistrement introuvable.";
      if (!ligne || !this.lisible(e, table, ligne)) throw new ErreurDepot(refusMessage);
      const org = ligne.org_id as string;
      const meta = META[table];
      if (meta.portee === "personnel") {
        if (ligne.destinataire !== this.etat.session) throw new ErreurDepot(refusMessage);
      } else if (meta.immuable || this.niveau(e, org, meta.module) < niveauSuppressionTable(table)) {
        throw new ErreurDepot(refusMessage);
      }
      this.retirer(e, table, ligne);
      if (table === "membres" || table === "droits_roles") this.verifierAdminRestant(e, org);
    });
  }

  async creerSalleAvecZones(salle: Nouveau<"salles_propres">, zones: Omit<Nouveau<"zones">, "org_id" | "salle_id" | "site_id">[]): Promise<string> {
    this.uid();
    return this.transaction((e) => {
      const s = this.inserer(e, "salles_propres", salle);
      for (const z of zones) this.inserer(e, "zones", { ...z, org_id: salle.org_id, salle_id: s.id } as Nouveau<"zones">);
      return s.id;
    });
  }

  // ------------------------------------------------------------------
  // Signatures, journal, fichiers
  // ------------------------------------------------------------------

  async signer(objetType: string, objetId: string, signification: Signification, commentaire: string, portee = ""): Promise<Signature> {
    const uid = this.uid();
    return structuredClone(this.transaction((e) => {
      const def = OBJETS_SIGNABLES[objetType];
      if (!def) throw new ErreurDepot(`Type d'objet non signable : ${objetType}`);
      const objet = lignesDe(e, def.table).find((d) => d.id === objetId);
      if (!objet) throw new ErreurDepot("Objet introuvable");
      const version = def.colonneVersion ? Number(objet[def.colonneVersion]) : 1;
      if (version < 1) throw new ErreurDepot(objetType === "document" ? "Le document n'a aucune version à signer" : "L'objet n'a aucune version à signer");
      const org = objet.org_id as string;
      if (this.niveau(e, org, def.module) < niveauSignature(signification)) {
        throw new ErreurDepot(`Droits insuffisants pour signer « ${signification} »`);
      }
      const p = e.profils.find((x) => x.id === uid)!;
      const s: Signature = {
        id: uuid(), org_id: org, objet_type: objetType, objet_id: objetId, version_objet: version,
        signification, signataire: uid, nom_signataire: p.nom_complet || p.email, commentaire, signe_le: maintenant(), portee,
      };
      e.signatures.push(s);
      this.journaliser(e, org, "signatures", s.id, "insert", null, s);
      return s;
    }));
  }

  async signatures(orgId: string, objetType: string, objetId: string): Promise<Signature[]> {
    if (!this.membre(this.etat, orgId)) return [];
    return structuredClone(this.etat.signatures
      .filter((s) => s.org_id === orgId && s.objet_type === objetType && s.objet_id === objetId)
      .map((s) => ({ ...s, portee: s.portee ?? "" })));
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
