import type { Capa, Essai, Etalonnage, Filtre, Instrument, ReleveFiltre, Zone } from "../data/types";
import type { Periodicite } from "./referentiels/periodicites";
import { echeancier } from "./qualification";
import { etatInstrument } from "./mesures";
import { etatFiltre } from "./aeraulique";

export interface EcheanceAPlanifier {
  source_cle: string;
  titre: string;
  description: string;
  echeance: string | null;
  lien: string;
  objet_type: string;
  objet_id: string;
  salle_id: string | null;
  priorite: "basse" | "normale" | "haute" | "urgente";
  proprietaire: string | null;
  etiquettes: string[];
}

export interface SourcesEcheances {
  zones: Zone[];
  essais: Essai[];
  periodicites: Periodicite[];
  instruments: Instrument[];
  etalonnages: Etalonnage[];
  filtres: Filtre[];
  releves: ReleveFiltre[];
  capa: Capa[];
  /** Noms des salles, pour regrouper les requalifications par salle. */
  salles?: { id: string; nom: string }[];
  /** Interventions de nettoyage prévues et non réalisées (phase 5). */
  nettoyagesEnRetard?: { id: string; titre: string; date: string; salle_id: string | null; lien: string }[];
}

/**
 * Échéances à transformer en cartes du tableau de tâches. Chaque carte a une
 * clé de source stable : une échéance déjà planifiée n'est pas recréée.
 */
export function echeancesAPlanifier(src: SourcesEcheances, aujourdhui = new Date()): EcheanceAPlanifier[] {
  const liste: EcheanceAPlanifier[] = [];
  const jour = aujourdhui.toISOString().slice(0, 10);
  // Requalifications : une carte par salle, à l'échéance la plus proche.
  const parSalle = new Map<string, ReturnType<typeof echeancier>>();
  for (const l of echeancier(src.zones, src.essais, src.periodicites, aujourdhui)) {
    if (l.statut !== "en_retard" && l.statut !== "a_echeance") continue;
    parSalle.set(l.zone.salle_id, [...(parSalle.get(l.zone.salle_id) ?? []), l]);
  }
  for (const [salleId, lignes] of parSalle) {
    const tri = [...lignes].sort((a, b) => (a.prochaine ?? "").localeCompare(b.prochaine ?? ""));
    const premiere = tri[0];
    const nom = src.salles?.find((x) => x.id === salleId)?.nom ?? "salle propre";
    liste.push({
      source_cle: `requalif:${salleId}:${premiere.prochaine}`,
      titre: `Requalification — ${nom} (${tri.length} essai${tri.length > 1 ? "s" : ""})`,
      description: tri.map((l) => `• ${l.essai.libelle} — ${l.zone.code} ${l.zone.nom} : échéance ${l.prochaine}`).join("\n"),
      echeance: premiere.prochaine, lien: `/qualification/nouvelle?salle=${salleId}`, objet_type: "salle", objet_id: salleId, salle_id: salleId,
      priorite: tri.some((l) => l.statut === "en_retard") ? "urgente" : "haute", proprietaire: null, etiquettes: ["qualification"],
    });
  }
  for (const i of src.instruments) {
    if (i.statut === "reforme") continue;
    const e = etatInstrument(i, src.etalonnages, aujourdhui);
    if (e.statut === "ok") continue;
    liste.push({
      source_cle: `etalonnage:${i.id}:${e.echeance ?? "jamais"}`,
      titre: `Étalonnage : ${i.libelle}`,
      description: e.message, echeance: e.valide && e.echeance ? e.echeance : jour, lien: "/instruments", objet_type: "instrument", objet_id: i.id,
      salle_id: null, priorite: e.valide ? "normale" : "haute", proprietaire: null, etiquettes: ["métrologie"],
    });
  }
  for (const f of src.filtres) {
    const e = etatFiltre(f, src.releves, aujourdhui);
    if (e.statut !== "alerte" && e.statut !== "attention") continue;
    liste.push({
      source_cle: `filtre:${f.id}:${e.statut}`,
      titre: `Filtre ${f.repere || f.classe} : ${e.statut === "alerte" ? "à remplacer" : "remplacement à prévoir"}`,
      description: e.message, echeance: e.echeanceRemplacement, lien: f.cta_id ? `/traitement-air/${f.cta_id}` : "/traitement-air", objet_type: "filtre", objet_id: f.id,
      salle_id: null, priorite: e.statut === "alerte" ? "haute" : "normale", proprietaire: null, etiquettes: ["traitement d'air"],
    });
  }
  for (const c of src.capa) {
    if (c.statut === "a_faire" || c.statut === "en_cours") {
      liste.push({
        source_cle: `capa:${c.id}`, titre: `${c.numero ?? "CAPA"} : ${c.action.slice(0, 80)}`, description: c.action, echeance: c.echeance,
        lien: c.ecart_id ? `/ecarts/${c.ecart_id}` : "/ecarts", objet_type: "capa", objet_id: c.id, salle_id: null,
        priorite: c.echeance && c.echeance < jour ? "urgente" : "normale", proprietaire: c.proprietaire, etiquettes: ["CAPA"],
      });
    } else if (c.statut === "realisee") {
      liste.push({
        source_cle: `capa-verif:${c.id}`, titre: `Vérifier l'efficacité : ${c.numero ?? "CAPA"}`, description: c.action, echeance: c.verification_prevue,
        lien: c.ecart_id ? `/ecarts/${c.ecart_id}` : "/ecarts", objet_type: "capa", objet_id: c.id, salle_id: null, priorite: "normale", proprietaire: null, etiquettes: ["CAPA"],
      });
    }
  }
  for (const n of src.nettoyagesEnRetard ?? []) {
    liste.push({
      source_cle: `nettoyage:${n.id}`, titre: `Nettoyage non réalisé : ${n.titre}`, description: `Prévu le ${n.date}.`, echeance: n.date, lien: n.lien,
      objet_type: "intervention_nettoyage", objet_id: n.id, salle_id: n.salle_id, priorite: "haute", proprietaire: null, etiquettes: ["nettoyage"],
    });
  }
  return liste;
}

/** Ordre d'insertion entre deux cartes (tri par nombre croissant). */
export function ordreEntre(avant: number | null, apres: number | null): number {
  if (avant == null && apres == null) return 1000;
  if (avant == null) return apres! - 1000;
  if (apres == null) return avant + 1000;
  return (avant + apres) / 2;
}
