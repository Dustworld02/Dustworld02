import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Depot, Utilisateur } from "./data/depot";
import type { DroitRole, Membre, Organisation, Profil, ReferentielOrg, Role, GabaritOrg } from "./data/types";
import { obtenirDepot } from "./data/initialisation";
import { GABARITS_NATIFS } from "./domain/secteurs/gabaritsNatifs";
import type { Gabarit } from "./domain/secteurs/types";
import { PERIODICITES_DEFAUT, type Periodicite } from "./domain/referentiels/periodicites";
import { TYPES_DOCUMENTS_DEFAUT, type TypeDocument } from "./domain/referentiels/typesDocuments";

const CLE_ORG = "salles-propres-org-courante";

export interface Referentiels {
  periodicites: Periodicite[];
  typesDocuments: TypeDocument[];
  /** Enregistrements d'organisation qui surchargent les valeurs par défaut. */
  surcharges: ReferentielOrg[];
}

export interface Session {
  depot: Depot;
  utilisateur: Utilisateur | null;
  organisations: Organisation[];
  org: Organisation | null;
  roles: Role[];
  droits: DroitRole[];
  membres: Membre[];
  profils: Profil[];
  monMembre: Membre | null;
  monRole: Role | null;
  referentiels: Referentiels;
  gabarits: Gabarit[];
  gabaritsOrg: GabaritOrg[];
  niveau(module: string): number;
  peut(module: string, niveau: number): boolean;
  choisirOrg(id: string): void;
  rafraichir(): Promise<void>;
  apresConnexion(): Promise<void>;
  deconnecter(): Promise<void>;
}

const Contexte = createContext<Session | null>(null);

export function useSession(): Session {
  const s = useContext(Contexte);
  if (!s) throw new Error("useSession hors du fournisseur de session");
  return s;
}

function lireOrgMemorisee(): string | null {
  try { return window.localStorage.getItem(CLE_ORG); } catch { return null; }
}
function memoriserOrg(id: string | null): void {
  try { if (id) window.localStorage.setItem(CLE_ORG, id); else window.localStorage.removeItem(CLE_ORG); } catch { /* sans effet */ }
}

interface EtatOrg {
  roles: Role[];
  droits: DroitRole[];
  membres: Membre[];
  profils: Profil[];
  surcharges: ReferentielOrg[];
  gabaritsOrg: GabaritOrg[];
}

const ETAT_ORG_VIDE: EtatOrg = { roles: [], droits: [], membres: [], profils: [], surcharges: [], gabaritsOrg: [] };

export function FournisseurSession({ children, chargement, erreur }: {
  children: (etat: "chargement" | "deconnecte" | "sans_org" | "pret") => ReactNode;
  chargement?: ReactNode;
  erreur?: (message: string) => ReactNode;
}) {
  const [depot, setDepot] = useState<Depot | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [etatOrg, setEtatOrg] = useState<EtatOrg>(ETAT_ORG_VIDE);
  const [pret, setPret] = useState(false);

  const chargerOrg = useCallback(async (d: Depot, id: string) => {
    const [roles, droits, membres, profils, surcharges, gabaritsOrg] = await Promise.all([
      d.lister("roles", id), d.lister("droits_roles", id), d.lister("membres", id), d.profils(id),
      d.lister("referentiels_org", id), d.lister("gabarits_org", id),
    ]);
    setEtatOrg({ roles, droits, membres, profils, surcharges, gabaritsOrg });
  }, []);

  const charger = useCallback(async (d: Depot) => {
    const u = await d.utilisateurCourant();
    setUtilisateur(u);
    if (!u) {
      setOrganisations([]);
      setOrgId(null);
      setEtatOrg(ETAT_ORG_VIDE);
      return;
    }
    await d.accepterInvitations();
    const orgs = await d.mesOrganisations();
    setOrganisations(orgs);
    const memorisee = lireOrgMemorisee();
    const choisie = orgs.find((o) => o.id === memorisee) ?? orgs[0] ?? null;
    setOrgId(choisie?.id ?? null);
    memoriserOrg(choisie?.id ?? null);
    if (choisie) await chargerOrg(d, choisie.id);
    else setEtatOrg(ETAT_ORG_VIDE);
  }, [chargerOrg]);

  useEffect(() => {
    obtenirDepot()
      .then(async (d) => { setDepot(d); await charger(d); })
      .catch((e: unknown) => setMessage(e instanceof Error ? e.message : String(e)))
      .finally(() => setPret(true));
  }, [charger]);

  const valeur = useMemo<Session | null>(() => {
    if (!depot) return null;
    const org = organisations.find((o) => o.id === orgId) ?? null;
    const monMembre = etatOrg.membres.find((m) => m.user_id === utilisateur?.id && m.actif) ?? null;
    const monRole = etatOrg.roles.find((r) => r.id === monMembre?.role_id) ?? null;
    const niveau = (module: string) =>
      monMembre ? etatOrg.droits.find((d) => d.role_id === monMembre.role_id && d.module === module)?.niveau ?? 0 : 0;
    const surcharge = <T,>(cle: string, defaut: T): T =>
      (etatOrg.surcharges.find((s) => s.cle === cle)?.donnees as T | undefined) ?? defaut;
    const gabaritsEntreprise = etatOrg.gabaritsOrg.map((g) => g.donnees as Gabarit);
    return {
      depot, utilisateur, organisations, org, monMembre, monRole,
      roles: etatOrg.roles, droits: etatOrg.droits, membres: etatOrg.membres, profils: etatOrg.profils,
      gabaritsOrg: etatOrg.gabaritsOrg,
      referentiels: {
        periodicites: surcharge("periodicites", PERIODICITES_DEFAUT),
        typesDocuments: surcharge("types_documents", TYPES_DOCUMENTS_DEFAUT),
        surcharges: etatOrg.surcharges,
      },
      gabarits: [...GABARITS_NATIFS, ...gabaritsEntreprise],
      niveau,
      peut: (module, n) => niveau(module) >= n,
      choisirOrg: (id) => {
        setOrgId(id);
        memoriserOrg(id);
        void chargerOrg(depot, id);
      },
      rafraichir: async () => {
        setOrganisations(await depot.mesOrganisations());
        if (orgId) await chargerOrg(depot, orgId);
      },
      apresConnexion: () => charger(depot),
      deconnecter: async () => {
        await depot.deconnecter();
        await charger(depot);
      },
    };
  }, [depot, utilisateur, organisations, orgId, etatOrg, charger, chargerOrg]);

  if (message) return <>{erreur ? erreur(message) : message}</>;
  if (!pret || !valeur) return <>{chargement}</>;
  const etat = !valeur.utilisateur ? "deconnecte" : !valeur.org ? "sans_org" : "pret";
  return <Contexte.Provider value={valeur}>{children(etat)}</Contexte.Provider>;
}

/** Libellé lisible d'un utilisateur à partir de son identifiant. */
export function nomUtilisateur(profils: Profil[], id: string | null | undefined): string {
  if (!id) return "système";
  const p = profils.find((x) => x.id === id);
  return p ? p.nom_complet || p.email : "utilisateur inconnu";
}
