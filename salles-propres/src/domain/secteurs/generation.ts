import type { Gabarit, TypeZoneGabarit, TypeZone } from "./types";
import type { GradeBpf } from "../referentiels/gradesBpf";

/** Champs d'une zone produite par un gabarit (avant enregistrement). */
export interface ZoneBrouillon {
  code: string;
  nom: string;
  type_zone: TypeZone;
  iso_repos: number | null;
  iso_activite: number | null;
  grade_bpf: GradeBpf | null;
  zone_risque: number | null;
  pression_pa: number | null;
  tolerance_pression_pa: number | null;
  renouvellement_vol_h: number | null;
  temperature_min: number | null;
  temperature_max: number | null;
  hr_min: number | null;
  hr_max: number | null;
  surface_m2: number | null;
  hauteur_m: number | null;
  gabarit_ref: ReferenceGabarit | null;
  notes: string;
}

export interface ReferenceGabarit {
  gabarit: string;
  version: string;
  type_zone_gabarit: string;
}

export interface SelectionTypeZone {
  cleType: string;
  quantite: number;
  /** Surcharge des valeurs du gabarit, saisie dans l'assistant. */
  surcharge?: Partial<TypeZoneGabarit>;
}

export const MENTION_POINT_DE_DEPART =
  "Généré depuis un gabarit sectoriel : point de départ à valider par l'analyse de risque et la qualification du site.";

function nombreOuNull(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Produit les zones d'une nouvelle salle propre à partir d'un gabarit et
 * des types de zones retenus. Les quantités > 1 numérotent les noms.
 */
export function genererZones(gabarit: Gabarit, selections: SelectionTypeZone[]): ZoneBrouillon[] {
  const zones: ZoneBrouillon[] = [];
  for (const selection of selections) {
    const base = gabarit.typesZones.find((t) => t.cle === selection.cleType);
    if (!base) throw new Error(`Type de zone inconnu dans le gabarit ${gabarit.cle} : ${selection.cleType}`);
    const type = { ...base, ...selection.surcharge };
    const quantite = Math.max(0, Math.floor(selection.quantite));
    for (let i = 1; i <= quantite; i++) {
      zones.push({
        code: "",
        nom: quantite > 1 ? `${type.libelle} ${i}` : type.libelle,
        type_zone: type.type,
        iso_repos: nombreOuNull(type.isoAuRepos),
        iso_activite: nombreOuNull(type.isoEnActivite),
        grade_bpf: type.gradeBpf ?? null,
        zone_risque: type.zoneRisque ?? null,
        pression_pa: nombreOuNull(type.pressionPa),
        tolerance_pression_pa: type.pressionPa != null ? 5 : null,
        renouvellement_vol_h: nombreOuNull(type.renouvellementVolH),
        temperature_min: nombreOuNull(type.temperatureMin),
        temperature_max: nombreOuNull(type.temperatureMax),
        hr_min: nombreOuNull(type.hrMin),
        hr_max: nombreOuNull(type.hrMax),
        surface_m2: null,
        hauteur_m: null,
        gabarit_ref: { gabarit: gabarit.cle, version: gabarit.version, type_zone_gabarit: base.cle },
        notes: MENTION_POINT_DE_DEPART,
      });
    }
  }
  zones.forEach((z, index) => {
    z.code = `Z${String(index + 1).padStart(2, "0")}`;
  });
  return zones;
}

/** Sélection par défaut proposée par l'assistant (types cochés d'office). */
export function selectionParDefaut(gabarit: Gabarit): SelectionTypeZone[] {
  return gabarit.typesZones.map((t) => ({ cleType: t.cle, quantite: t.parDefaut ? 1 : 0 }));
}

/** Incrémente la version mineure (1.0.0 → 1.1.0). */
export function versionSuivante(version: string): string {
  const [maj = 1, min = 0] = version.split(".").map((n) => parseInt(n, 10) || 0);
  return `${maj}.${min + 1}.0`;
}

/**
 * Crée un gabarit d'entreprise à partir des zones d'une salle existante
 * (« enregistrer comme gabarit »).
 */
export function gabaritDepuisZones(
  cle: string,
  libelle: string,
  gabaritOrigine: Gabarit | undefined,
  zones: Array<Omit<ZoneBrouillon, "code" | "gabarit_ref" | "notes">>,
): Gabarit {
  const vus = new Map<string, number>();
  return {
    cle,
    version: "1.0.0",
    libelle,
    description: `Gabarit d'entreprise créé à partir d'une salle existante${gabaritOrigine ? ` (base : ${gabaritOrigine.libelle})` : ""}.`,
    referentiels: gabaritOrigine?.referentiels ?? [],
    vocabulaire: gabaritOrigine?.vocabulaire ?? "classe",
    specificites: gabaritOrigine?.specificites ?? [],
    natif: false,
    baseSur: gabaritOrigine ? { cle: gabaritOrigine.cle, version: gabaritOrigine.version } : null,
    typesZones: zones.map((z) => {
      const racine = z.nom.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "zone";
      const n = (vus.get(racine) ?? 0) + 1;
      vus.set(racine, n);
      return {
        cle: n > 1 ? `${racine}_${n}` : racine,
        libelle: z.nom,
        type: z.type_zone,
        isoAuRepos: z.iso_repos,
        isoEnActivite: z.iso_activite,
        gradeBpf: z.grade_bpf,
        zoneRisque: (z.zone_risque as 2 | 3 | 4 | null) ?? null,
        pressionPa: z.pression_pa,
        renouvellementVolH: z.renouvellement_vol_h,
        temperatureMin: z.temperature_min,
        temperatureMax: z.temperature_max,
        hrMin: z.hr_min,
        hrMax: z.hr_max,
        parDefaut: true,
      };
    }),
  };
}
