import type { GradeBpf } from "../referentiels/gradesBpf";

export type TypeZone =
  | "salle"
  | "sas_personnel"
  | "sas_materiel"
  | "passe_plat"
  | "couloir"
  | "poste_flux"
  | "stockage"
  | "autre";

export const LIBELLES_TYPES_ZONES: Record<TypeZone, string> = {
  salle: "Salle",
  sas_personnel: "SAS personnel",
  sas_materiel: "SAS matériel",
  passe_plat: "Passe-plat",
  couloir: "Couloir",
  poste_flux: "Poste sous flux / enceinte",
  stockage: "Stockage",
  autre: "Autre",
};

/** Vocabulaire employé pour la classification dans les documents du secteur. */
export type Vocabulaire = "grade" | "classe" | "zone_risque";

export interface TypeZoneGabarit {
  cle: string;
  libelle: string;
  type: TypeZone;
  isoAuRepos: number | null;
  isoEnActivite: number | null;
  gradeBpf?: GradeBpf | null;
  /** NF S 90-351 : zone à risque 2, 3 ou 4. */
  zoneRisque?: 2 | 3 | 4 | null;
  /** Consigne de pression par rapport à l'extérieur des locaux propres (Pa). */
  pressionPa?: number | null;
  renouvellementVolH?: number | null;
  temperatureMin?: number | null;
  temperatureMax?: number | null;
  hrMin?: number | null;
  hrMax?: number | null;
  /** Proposée cochée dans l'assistant de création. */
  parDefaut: boolean;
  description?: string;
}

export interface Gabarit {
  cle: string;
  version: string;
  libelle: string;
  description: string;
  referentiels: string[];
  vocabulaire: Vocabulaire;
  /** Ce que le secteur injecte dans les modules (affiché à la création). */
  specificites: string[];
  typesZones: TypeZoneGabarit[];
  /** Gabarit livré avec l'outil (true) ou gabarit d'entreprise (false). */
  natif: boolean;
  /** Pour un gabarit d'entreprise : gabarit d'origine. */
  baseSur?: { cle: string; version: string } | null;
}
