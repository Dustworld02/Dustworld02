import type { Modification, NomTable, Nouveau, Tables } from "./types";
import { ErreurDepot } from "./depot";
import { ajouterMois, instrumentValideLe, verdictResultat } from "../domain/mesures";

/**
 * Règles métier appliquées par la base (déclencheurs SQL) et émulées
 * à l'identique en mode démonstration.
 */

export type Ligne = Record<string, unknown>;

export interface ContexteRegle {
  uid: string | null;
  lignes(table: NomTable): Ligne[];
  inserer<T extends NomTable>(table: T, valeurs: Nouveau<T>): Tables[T];
  modifier<T extends NomTable>(table: T, id: string, valeurs: Modification<T>): void;
  notifier(org: string, destinataire: string | null | undefined, type: string, texte: string, lien: string): void;
  niveau(org: string, module: string): number;
}

/** Contrôle avant écriture : peut modifier `nouvelle` ou lever une erreur. `nouvelle` vaut null pour une suppression. */
export type Controle = (ctx: ContexteRegle, table: NomTable, nouvelle: Ligne | null, ancienne: Ligne | null) => void;

/** Réaction après écriture (équivalent d'un déclencheur « after »). */
export type Reaction = (ctx: ContexteRegle, table: NomTable, avant: Ligne | null, apres: Ligne | null) => void;

function instrumentValide(ctx: ContexteRegle, id: unknown, date: unknown): boolean {
  const instrument = ctx.lignes("instruments").find((i) => i.id === id) as unknown as Tables["instruments"] | undefined;
  if (!instrument) return false;
  const etalonnages = ctx.lignes("etalonnages") as unknown as Tables["etalonnages"][];
  return instrumentValideLe(instrument, etalonnages, String(date ?? new Date().toISOString()));
}

function campagneFigee(ctx: ContexteRegle, campagneId: unknown): boolean {
  const c = ctx.lignes("campagnes_qualification").find((x) => x.id === campagneId);
  return !!c && (c.statut === "cloturee" || c.statut === "annulee");
}

export const CONTROLES: Controle[] = [
  // Étalonnage : échéance calculée à partir de la périodicité de l'instrument.
  (ctx, table, n) => {
    if (table !== "etalonnages" || !n || n.prochaine_echeance) return;
    const instrument = ctx.lignes("instruments").find((i) => i.id === n.instrument_id);
    n.prochaine_echeance = ajouterMois(String(n.date_etalonnage), Number(instrument?.periodicite_etalonnage_mois ?? 12));
  },
  // Résultat : instrument valide à la date, verdict calculé.
  (ctx, table, n) => {
    if (table !== "resultats" || !n) return;
    if (n.instrument_id && !instrumentValide(ctx, n.instrument_id, n.date_prelevement)) {
      throw new ErreurDepot("Instrument non étalonné (ou hors service) à la date du prélèvement : résultat refusé");
    }
    n.verdict = verdictResultat(Number(n.valeur), n.limite_alerte as number | null, n.limite_action as number | null);
  },
  // Campagne clôturée : figée.
  (_ctx, table, _n, a) => {
    if (table !== "campagnes_qualification" || !a) return;
    if (a.statut === "cloturee" || a.statut === "annulee") throw new ErreurDepot("Campagne clôturée : modification impossible (ouvrez une nouvelle campagne)");
  },
  // Essais et résultats d'une campagne clôturée : figés.
  (ctx, table, n, a) => {
    if (table === "essais") {
      if (campagneFigee(ctx, (n ?? a)!.campagne_id)) throw new ErreurDepot("Campagne clôturée : essais et résultats figés");
    }
    if (table === "resultats") {
      const essaiId = (n ?? a)!.essai_id;
      if (!essaiId) return;
      const essai = ctx.lignes("essais").find((e) => e.id === essaiId);
      if (essai && campagneFigee(ctx, essai.campagne_id)) throw new ErreurDepot("Campagne clôturée : essais et résultats figés");
    }
  },
  // Essai réalisé : verdict obligatoire, instrument valide.
  (ctx, table, n) => {
    if (table !== "essais" || !n || n.statut !== "realise") return;
    if (n.instrument_id && !instrumentValide(ctx, n.instrument_id, n.date_realisation ?? new Date().toISOString())) {
      throw new ErreurDepot("Instrument non étalonné (ou hors service) à la date de l'essai : validation refusée");
    }
    if (!n.verdict) throw new ErreurDepot("Un essai réalisé doit porter un verdict");
  },
];

export const REACTIONS: Reaction[] = [];
