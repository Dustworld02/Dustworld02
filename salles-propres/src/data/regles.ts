import type { Modification, NomTable, Nouveau, Tables } from "./types";
import { ErreurDepot } from "./depot";
import { ajouterMois, instrumentValideLe, verdictResultat } from "../domain/mesures";
import { personneHabilitee } from "../domain/personnel";

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
  // Procédures : toute modification d'une procédure approuvée crée une nouvelle version en brouillon.
  (_ctx, table, n, a) => {
    if (table !== "procedures_nettoyage" || !n || !a) return;
    if (a.statut === "approuvee" && n.statut === "approuvee"
      && (JSON.stringify(n.contenu) !== JSON.stringify(a.contenu) || n.titre !== a.titre || JSON.stringify(n.zones) !== JSON.stringify(a.zones))) {
      n.version = Number(a.version) + 1;
      n.statut = "brouillon";
    }
  },
  // Interventions : procédure approuvée, personne habilitée, réalisation tracée.
  (ctx, table, n, a) => {
    if (table !== "interventions_nettoyage" || !n) return;
    if (!a) {
      const p = ctx.lignes("procedures_nettoyage").find((x) => x.id === n.procedure_id);
      if (p?.statut !== "approuvee") throw new ErreurDepot("Procédure non approuvée : planification impossible");
    }
    if (n.personne_id && (!a || a.personne_id !== n.personne_id || a.statut !== n.statut)) {
      const zone = ctx.lignes("zones").find((z) => z.id === n.zone_id) as unknown as Tables["zones"];
      const habilitations = ctx.lignes("habilitations") as unknown as Tables["habilitations"][];
      const date = String(n.realise_le ?? n.date_prevue).slice(0, 10);
      if (!personneHabilitee(String(n.personne_id), zone, habilitations, date)) throw new ErreurDepot("Personne non habilitée pour cette zone à cette date");
    }
    if (n.statut === "realisee") {
      if (!n.personne_id) throw new ErreurDepot("Indiquez qui a réalisé le nettoyage");
      n.realise_le = n.realise_le ?? new Date().toISOString();
    }
  },
  // Personne liée à un compte : le compte doit être membre.
  (ctx, table, n) => {
    if (table !== "personnes" || !n?.user_id) return;
    if (!ctx.lignes("membres").some((m) => m.org_id === n.org_id && m.user_id === n.user_id)) throw new ErreurDepot("Rattachement invalide : cet utilisateur n'est pas membre de l'organisation");
  },
  // Tâches : horodatage de fin à l'entrée dans une colonne terminale.
  (ctx, table, n, a) => {
    if (table !== "taches" || !n) return;
    const colonne = ctx.lignes("colonnes_kanban").find((c) => c.id === n.colonne_id);
    if (colonne?.terminale) { if (!a || a.colonne_id !== n.colonne_id) n.termine_le = new Date().toISOString(); }
    else n.termine_le = null;
  },
  // Maintenance : l'équipement appartient à la salle ; intervention réalisée documentée.
  (ctx, table, n) => {
    if ((table !== "gammes_maintenance" && table !== "interventions_maintenance") || !n) return;
    if (n.equipement_id) {
      const eq = ctx.lignes("equipements").find((e) => e.id === n.equipement_id);
      if (!eq || eq.salle_id !== n.salle_id) throw new ErreurDepot("Rattachement invalide : l'équipement doit appartenir à la salle choisie");
    }
    if (table === "interventions_maintenance" && n.statut === "realisee") {
      n.date_realisation = n.date_realisation ?? new Date().toISOString().slice(0, 10);
      if (!String(n.compte_rendu ?? "").trim()) throw new ErreurDepot("Compte rendu obligatoire pour une intervention réalisée");
    }
  },
  // Change control : figé une fois clôturé, requalification exigée avant clôture.
  (ctx, table, n, a) => {
    if (table !== "changements") return;
    if (!n) {
      if (a && ["approuve", "realise", "cloture"].includes(String(a.statut))) throw new ErreurDepot("Un changement approuvé ne peut pas être supprimé");
      return;
    }
    if (a && (a.statut === "cloture" || a.statut === "refuse")) throw new ErreurDepot("Changement clôturé : modification impossible");
    if (n.statut === "realise" && a?.statut !== "realise") n.realise_le = n.realise_le ?? new Date().toISOString().slice(0, 10);
    if (n.statut === "cloture" && a?.statut !== "cloture") {
      if (!String(n.conclusion ?? "").trim()) throw new ErreurDepot("Clôture impossible : conclusion obligatoire");
      if (n.requalification_requise && !ctx.lignes("campagnes_qualification").some((c) => c.id === n.campagne_id && c.statut === "cloturee")) {
        throw new ErreurDepot("Clôture impossible : la requalification demandée n'est pas clôturée");
      }
      n.cloture_le = n.cloture_le ?? new Date().toISOString().slice(0, 10);
    }
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
    // Dérive : trois résultats de surveillance consécutifs hors limite d'alerte au même point.
    if (table === "resultats" && !a && n.point_id && n.origine === "surveillance" && (n.verdict === "alerte" || n.verdict === "action")) {
      const derniers = ctx.lignes("resultats")
        .filter((r) => r.point_id === n.point_id && r.parametre === n.parametre && r.origine === "surveillance")
        .sort((x, y) => String(y.date_prelevement).localeCompare(String(x.date_prelevement)) || String(y.cree_le).localeCompare(String(x.cree_le)))
        .slice(0, 3);
      if (derniers.length === 3 && derniers.every((r) => r.verdict === "alerte" || r.verdict === "action")) {
        const code = String(ctx.lignes("points_prelevement").find((p) => p.id === n.point_id)?.code ?? "");
        const titre = `Dérive : 3 résultats consécutifs hors limite d'alerte — ${code} (${n.parametre || n.nature})`;
        const ouvert = ctx.lignes("ecarts").some((e) => e.org_id === org && e.objet_type === "point" && e.objet_id === n.point_id && e.titre === titre && e.statut !== "cloture" && e.statut !== "annule");
        if (!ouvert) {
          ctx.inserer("ecarts", {
            org_id: org, titre, automatique: true, gravite: "mineure", origine: "surveillance", salle_id: n.salle_id as string, objet_type: "point", objet_id: n.point_id as string,
            description: `Les trois derniers résultats au point ${code} dépassent la limite d'alerte (dernier : ${n.valeur} ${n.unite}). Rechercher une cause commune (nettoyage, flux, comportement, équipement).`,
            lien: "/contaminations?onglet=tendances", date_detection: String(n.date_prelevement).slice(0, 10), detecte_par: String(n.operateur ?? ""),
          });
        }
      }
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
