import type { Formation, Habilitation, Zone } from "../data/types";

export const TYPES_HABILITATIONS: Record<Habilitation["type"], string> = {
  acces_zone: "Accès en zone",
  habillage: "Qualification d'habillage",
  nettoyage: "Nettoyage en zone",
};

export const THEMES_FORMATION: Record<string, string> = {
  essentiel_salle_propre: "L'essentiel de la salle propre (contamination, comportement)",
  habillage: "Habillage",
  nettoyage_desinfection: "Nettoyage et désinfection",
  iso_14644: "ISO 14644-1 et 2 (classification, surveillance)",
  biocontamination: "Biocontamination",
  qualification: "Qualification des locaux et du traitement d'air",
  metrologie: "Métrologie et essais",
  bpf_annexe1: "BPF / Annexe 1",
  autre: "Autre",
};

/** Habilitation valide à la date et suffisante pour la zone (même règle que la base). */
export function habilitationCouvre(h: Habilitation, zone: Pick<Zone, "iso_repos" | "grade_bpf">, date: string): boolean {
  if (h.type !== "acces_zone" && h.type !== "nettoyage") return false;
  if (h.date_obtention > date || (h.date_expiration && h.date_expiration < date)) return false;
  if (zone.grade_bpf && h.grade_bpf && h.grade_bpf <= zone.grade_bpf) return true;
  if (h.classe_iso_max != null && h.classe_iso_max <= (zone.iso_repos ?? 9)) return true;
  return !zone.grade_bpf && zone.iso_repos == null;
}

export function personneHabilitee(personneId: string, zone: Pick<Zone, "iso_repos" | "grade_bpf"> | undefined, habilitations: Habilitation[], date: string): boolean {
  if (!zone) return false;
  return habilitations.some((h) => h.personne_id === personneId && habilitationCouvre(h, zone, date));
}

export type StatutValidite = "valide" | "a_renouveler" | "expiree";

export function statutEcheance(dateFin: string | null, aujourdhui = new Date(), horizonJours = 60): StatutValidite {
  if (!dateFin) return "valide";
  const jour = aujourdhui.toISOString().slice(0, 10);
  if (dateFin < jour) return "expiree";
  const horizon = new Date(aujourdhui.getTime() + horizonJours * 86400000).toISOString().slice(0, 10);
  return dateFin <= horizon ? "a_renouveler" : "valide";
}

export function libelleNiveauHabilitation(h: Pick<Habilitation, "grade_bpf" | "classe_iso_max">): string {
  if (h.grade_bpf) return `Grade ${h.grade_bpf} et moins exigeant`;
  if (h.classe_iso_max != null) return `ISO ${h.classe_iso_max} et moins exigeant`;
  return "Zones non classées";
}

export function formationsARecycler(formations: Formation[], aujourdhui = new Date()): Formation[] {
  return formations.filter((f) => statutEcheance(f.date_recyclage, aujourdhui) !== "valide");
}
