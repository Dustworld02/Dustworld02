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
  /** Nom affichable d'un utilisateur. */
  nomUtilisateur(id: string | null | undefined): string;
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
  // Écarts : clôture contrôlée, écart clôturé figé.
  (ctx, table, n, a) => {
    if (table !== "ecarts") return;
    if (!n) {
      if (a?.statut === "cloture") throw new ErreurDepot("Un écart clôturé ne peut pas être supprimé");
      return;
    }
    if (a && (a.statut === "cloture" || a.statut === "annule")) throw new ErreurDepot("Écart clôturé : modification impossible");
    if (!n.date_detection) n.date_detection = new Date().toISOString().slice(0, 10);
    if (n.statut === "cloture" && a?.statut !== "cloture") {
      if (ctx.lignes("capa").some((c) => c.ecart_id === n.id && c.statut !== "efficace" && c.statut !== "annulee")) {
        throw new ErreurDepot("Clôture impossible : des CAPA ne sont ni vérifiées efficaces ni annulées");
      }
      if (!String(n.conclusion ?? "").trim()) throw new ErreurDepot("Clôture impossible : conclusion obligatoire");
      n.cloture_le = n.cloture_le ?? new Date().toISOString().slice(0, 10);
    }
  },
  // CAPA : figées avec l'écart clôturé ; vérification d'efficacité au niveau validation.
  (ctx, table, n, a) => {
    if (table !== "capa") return;
    const ecartId = (n ?? a)!.ecart_id;
    const ecart = ctx.lignes("ecarts").find((e) => e.id === ecartId);
    if (ecart && (ecart.statut === "cloture" || ecart.statut === "annule")) throw new ErreurDepot("Écart clôturé : ses CAPA ne peuvent plus être modifiées");
    if (!n) return;
    const change = !a || a.statut !== n.statut;
    if (change && (n.statut === "efficace" || n.statut === "non_efficace") && ctx.uid && ctx.niveau(String(n.org_id), "ecarts_capa") < 3) {
      throw new ErreurDepot("La vérification d'efficacité d'une CAPA relève du niveau validation");
    }
    const jour = new Date().toISOString().slice(0, 10);
    if (change && n.statut === "realisee") n.realisee_le = n.realisee_le ?? jour;
    if (change && (n.statut === "efficace" || n.statut === "non_efficace")) n.verifie_le = n.verifie_le ?? jour;
  },
  // Messages : jamais supprimés ni réécrits.
  (ctx, table, n, a) => {
    if (table !== "messages") return;
    if (!n) throw new ErreurDepot("Les messages ne sont jamais supprimés : archivez-les");
    if (!a) { n.auteur = ctx.uid ?? n.auteur; return; }
    for (const c of ["contenu", "auteur", "objet_id", "mentions"]) {
      if (JSON.stringify(n[c]) !== JSON.stringify(a[c])) throw new ErreurDepot("Un message publié ne peut pas être modifié (seul l'archivage est possible)");
    }
  },
  // Tâches : horodatage de fin à l'entrée dans une colonne terminale.
  (ctx, table, n, a) => {
    if (table !== "taches" || !n) return;
    const colonne = ctx.lignes("colonnes_kanban").find((c) => c.id === n.colonne_id);
    if (colonne?.terminale) { if (!a || a.colonne_id !== n.colonne_id) n.termine_le = new Date().toISOString(); }
    else n.termine_le = null;
  },
];

export const REACTIONS: Reaction[] = [
  // Notifications d'attribution.
  (ctx, table, a, n) => {
    if (!n || (table !== "taches" && table !== "capa")) return;
    if (!n.proprietaire || (a && a.proprietaire === n.proprietaire)) return;
    if (table === "taches") ctx.notifier(String(n.org_id), String(n.proprietaire), "tache", `Tâche assignée : ${n.titre}`, `/taches?carte=${n.id}`);
    else ctx.notifier(String(n.org_id), String(n.proprietaire), "capa", `Action CAPA assignée : ${String(n.action).slice(0, 120)}`, n.ecart_id ? `/ecarts/${n.ecart_id}` : "/ecarts");
  },
  // Notifications de mention.
  (ctx, table, a, n) => {
    if (table !== "messages" || a || !n) return;
    const auteur = ctx.nomUtilisateur(n.auteur as string);
    for (const dest of (n.mentions as string[]) ?? []) {
      ctx.notifier(String(n.org_id), dest, "mention", `${auteur} vous mentionne${n.objet_libelle ? ` (${n.objet_libelle})` : ""} : ${String(n.contenu).slice(0, 120)}`, String(n.lien || "/discussions"));
    }
  },
  // Écarts automatiques.
  (ctx, table, a, n) => {
    if (!n) return;
    const org = String(n.org_id);
    const creer = (valeurs: Omit<Nouveau<"ecarts">, "org_id">) => ctx.inserer("ecarts", { ...valeurs, org_id: org, automatique: true, gravite: "majeure" } as Nouveau<"ecarts">);
    if (table === "resultats" && n.verdict === "action" && n.origine !== "qualification" && (!a || a.verdict !== "action")) {
      creer({
        titre: `Dépassement de la limite d'action : ${n.parametre || n.nature}`,
        description: `Valeur ${n.valeur} ${n.unite} pour une limite d'action de ${n.limite_action} (${n.milieu}, ${n.nature}).`,
        origine: n.origine === "nettoyage" ? "nettoyage" : "surveillance", salle_id: n.salle_id as string, objet_type: "resultat", objet_id: n.id as string,
        lien: "/contaminations", date_detection: String(n.date_prelevement).slice(0, 10), detecte_par: String(n.operateur ?? ""),
      });
    }
    if (table === "essais" && n.statut === "realise" && n.verdict === "non_conforme" && (!a || a.verdict !== "non_conforme" || a.statut !== "realise")) {
      const campagne = ctx.lignes("campagnes_qualification").find((c) => c.id === n.campagne_id);
      creer({
        titre: `Essai non conforme : ${n.libelle} — ${n.cible_libelle}`,
        description: `Critère : ${n.critere}${n.commentaire ? `\n${n.commentaire}` : ""}`,
        origine: "qualification", salle_id: (campagne?.salle_id as string) ?? null, objet_type: "essai", objet_id: n.id as string,
        lien: `/qualification/${n.campagne_id}`, date_detection: String(n.date_realisation ?? new Date().toISOString()).slice(0, 10), detecte_par: String(n.realise_par ?? ""),
      });
    }
    if (table === "etalonnages" && n.conforme === false && (!a || a.conforme !== false)) {
      const instrument = ctx.lignes("instruments").find((i) => i.id === n.instrument_id);
      creer({
        titre: `Étalonnage non conforme : ${instrument?.libelle ?? ""}`,
        description: `Évaluer l'impact sur les mesures réalisées depuis le dernier étalonnage conforme. ${n.commentaire ?? ""}`,
        origine: "etalonnage", objet_type: "instrument", objet_id: n.instrument_id as string, lien: "/instruments", date_detection: String(n.date_etalonnage),
      });
    }
  },
];
