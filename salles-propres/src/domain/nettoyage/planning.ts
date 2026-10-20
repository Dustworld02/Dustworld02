import type { CleFrequence, CleSurface } from "./referentiel";
import type { ContenuProcedure } from "./generation";

export type Moment = "debut_poste" | "fin_poste" | "journee";

export interface OccurrencePlanifiee {
  date: string;
  moment: Moment;
  surfaces: CleSurface[];
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function jourOuvre(d: Date): boolean {
  const j = d.getDay();
  return j !== 0 && j !== 6;
}

/** Premier jour ouvré du mois de d. */
function premierOuvreDuMois(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  while (!jourOuvre(x)) x.setDate(x.getDate() + 1);
  return iso(x);
}

/** La fréquence tombe-t-elle ce jour-là, et à quel(s) moment(s) ? */
export function momentsDuJour(f: CleFrequence, d: Date): Moment[] {
  if (!jourOuvre(d)) return [];
  const premier = premierOuvreDuMois(d) === iso(d);
  switch (f) {
    case "entre_operations":
    case "debut_fin_poste": return ["debut_poste", "fin_poste"];
    case "chaque_poste":
    case "fin_poste": return ["fin_poste"];
    case "debut_poste": return ["debut_poste"];
    case "quotidien": return ["fin_poste"];
    case "hebdomadaire": return d.getDay() === 5 ? ["fin_poste"] : [];
    case "mensuel": return premier ? ["fin_poste"] : [];
    case "trimestriel": return premier && d.getMonth() % 3 === 0 ? ["fin_poste"] : [];
    case "semestriel": return premier && d.getMonth() % 6 === 0 ? ["fin_poste"] : [];
    case "apres_intervention": return [];
  }
}

/**
 * Occurrences d'une procédure sur une période (jours ouvrés). Les surfaces
 * dues au même moment sont regroupées en une seule intervention.
 */
export function planifier(contenu: Pick<ContenuProcedure, "frequences">, debut: Date, jours: number): OccurrencePlanifiee[] {
  const resultat: OccurrencePlanifiee[] = [];
  for (let i = 0; i < jours; i++) {
    const d = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + i);
    const parMoment = new Map<Moment, CleSurface[]>();
    for (const f of contenu.frequences) {
      for (const m of momentsDuJour(f.frequence, d)) parMoment.set(m, [...(parMoment.get(m) ?? []), f.surface]);
    }
    for (const m of ["debut_poste", "fin_poste"] as Moment[]) {
      const surfaces = parMoment.get(m);
      if (surfaces?.length) resultat.push({ date: iso(d), moment: m, surfaces });
    }
  }
  return resultat;
}

export const LIBELLES_MOMENTS: Record<Moment, string> = { debut_poste: "Début de poste", fin_poste: "Fin de poste", journee: "Dans la journée" };
