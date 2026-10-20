import { TAILLES_PARTICULES, limiteIso, pointsMinimaux, type TailleParticule } from "./referentiels/classesIso";
import { DEFINITIONS_GRADES, type GradeBpf } from "./referentiels/gradesBpf";

export interface ZoneClassification {
  iso_repos: number | null;
  iso_activite: number | null;
  grade_bpf: GradeBpf | null;
  surface_m2: number | null;
  hauteur_m: number | null;
}

export interface LigneLimite {
  taille: TailleParticule;
  auRepos: number | null;
  enActivite: number | null;
}

/**
 * Limites particulaires applicables à une zone, pour chaque taille.
 * Si un grade BPF est renseigné, ses limites (0,5 et 5 µm) priment sur la
 * classe ISO pour ces tailles, car l'Annexe 1 est plus contraignante
 * (notamment à 5 µm pour les grades C et D).
 */
export function limitesParticulaires(zone: ZoneClassification): LigneLimite[] {
  const grade = zone.grade_bpf ? DEFINITIONS_GRADES[zone.grade_bpf] : null;
  return TAILLES_PARTICULES.map((taille) => {
    let auRepos = zone.iso_repos != null ? limiteIso(zone.iso_repos, taille) : null;
    let enActivite = zone.iso_activite != null ? limiteIso(zone.iso_activite, taille) : null;
    if (grade && (taille === 0.5 || taille === 5)) {
      const cle = taille === 0.5 ? "0.5" : "5";
      auRepos = grade.particulesAuRepos[cle];
      enActivite = grade.particulesEnActivite[cle];
    }
    return { taille, auRepos, enActivite };
  }).filter((l) => l.auRepos !== null || l.enActivite !== null);
}

export function limitesMicrobio(zone: ZoneClassification) {
  return zone.grade_bpf ? DEFINITIONS_GRADES[zone.grade_bpf].microbio : null;
}

export function volumeM3(zone: ZoneClassification): number | null {
  if (zone.surface_m2 == null || zone.hauteur_m == null) return null;
  return Math.round(zone.surface_m2 * zone.hauteur_m * 100) / 100;
}

export function pointsPrelevementZone(zone: ZoneClassification): number | null {
  return zone.surface_m2 != null ? pointsMinimaux(zone.surface_m2) : null;
}

export interface Incoherence {
  message: string;
}

/** Contrôles de cohérence simples sur la classification d'une zone. */
export function incoherencesZone(zone: ZoneClassification): Incoherence[] {
  const resultat: Incoherence[] = [];
  if (zone.iso_repos != null && zone.iso_activite != null && zone.iso_activite < zone.iso_repos) {
    resultat.push({ message: "La classe en activité est plus exigeante que la classe au repos." });
  }
  if (zone.grade_bpf) {
    const g = DEFINITIONS_GRADES[zone.grade_bpf];
    if (zone.iso_repos != null && zone.iso_repos !== g.isoAuRepos) {
      resultat.push({ message: `Le grade ${g.grade} correspond à ISO ${g.isoAuRepos} au repos (saisi : ISO ${zone.iso_repos}).` });
    }
    if (g.isoEnActivite != null && zone.iso_activite != null && zone.iso_activite !== g.isoEnActivite) {
      resultat.push({ message: `Le grade ${g.grade} correspond à ISO ${g.isoEnActivite} en activité (saisi : ISO ${zone.iso_activite}).` });
    }
  }
  return resultat;
}

export function formatNombre(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("fr-FR").format(n);
}
