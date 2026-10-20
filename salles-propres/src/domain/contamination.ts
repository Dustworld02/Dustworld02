import type { EtatOccupation, Milieu, NatureContamination, Zone } from "../data/types";
import { limitesParticulaires } from "./exigencesZone";
import { DEFINITIONS_GRADES } from "./referentiels/gradesBpf";

export const LIBELLES_MILIEUX: Record<Milieu, string> = { air: "Air", surface: "Surface", gants: "Gants / tenue", liquide: "Liquide" };
export const LIBELLES_NATURES: Record<NatureContamination, string> = { particulaire: "Particulaire", microbiologique: "Microbiologique", chimique: "Chimique" };
export const LIBELLES_ORIGINES: Record<string, string> = {
  qualification: "Qualification", surveillance: "Surveillance de routine", nettoyage: "Validation du nettoyage", investigation: "Investigation", autre: "Autre",
};
export const LIBELLES_VERDICTS: Record<string, string> = { conforme: "Conforme", alerte: "Alerte", action: "Action", non_evalue: "Non évalué" };
export const TON_VERDICT = { conforme: "ok", alerte: "attention", action: "alerte", non_evalue: "neutre" } as const;

export interface Parametre {
  cle: string;
  milieu: Milieu;
  nature: NatureContamination;
  libelle: string;
  methode: string;
  unite: string;
  taille_um?: number;
  /** Clé de la limite microbiologique Annexe 1 correspondante. */
  limiteBpf?: "airUfcM3" | "sedimentationUfc4h" | "contactUfcBoite" | "gantsUfcGant";
}

/** Paramètres usuels, par milieu et nature (tableau du plan §4.4). */
export const PARAMETRES: Parametre[] = [
  { cle: "air_p05", milieu: "air", nature: "particulaire", libelle: "Particules ≥ 0,5 µm", methode: "Compteur optique", unite: "particules/m³", taille_um: 0.5 },
  { cle: "air_p1", milieu: "air", nature: "particulaire", libelle: "Particules ≥ 1 µm", methode: "Compteur optique", unite: "particules/m³", taille_um: 1 },
  { cle: "air_p5", milieu: "air", nature: "particulaire", libelle: "Particules ≥ 5 µm", methode: "Compteur optique", unite: "particules/m³", taille_um: 5 },
  { cle: "air_bio", milieu: "air", nature: "microbiologique", libelle: "Air — biocollecteur", methode: "Impaction", unite: "UFC/m³", limiteBpf: "airUfcM3" },
  { cle: "air_sed", milieu: "air", nature: "microbiologique", libelle: "Boîte de sédimentation Ø 90 mm (4 h)", methode: "Sédimentation", unite: "UFC/4 h", limiteBpf: "sedimentationUfc4h" },
  { cle: "air_cov", milieu: "air", nature: "chimique", libelle: "COV totaux", methode: "Analyseur PID / tube adsorbant", unite: "µg/m³" },
  { cle: "air_acide", milieu: "air", nature: "chimique", libelle: "AMC — acides", methode: "ISO 14644-8", unite: "µg/m³" },
  { cle: "air_base", milieu: "air", nature: "chimique", libelle: "AMC — bases", methode: "ISO 14644-8", unite: "µg/m³" },
  { cle: "air_h2o2", milieu: "air", nature: "chimique", libelle: "H₂O₂ résiduel après décontamination", methode: "Capteur électrochimique", unite: "ppm" },
  { cle: "surf_contact", milieu: "surface", nature: "microbiologique", libelle: "Boîte contact Ø 55 mm", methode: "Gélose contact", unite: "UFC/boîte", limiteBpf: "contactUfcBoite" },
  { cle: "surf_ecouv", milieu: "surface", nature: "microbiologique", libelle: "Écouvillonnage", methode: "Écouvillon", unite: "UFC/écouvillon" },
  { cle: "surf_atp", milieu: "surface", nature: "chimique", libelle: "ATP-métrie", methode: "Luminomètre", unite: "RLU" },
  { cle: "surf_residus", milieu: "surface", nature: "chimique", libelle: "Résidus de produit de nettoyage", methode: "Écouvillon + dosage", unite: "µg/cm²" },
  { cle: "surf_iso9", milieu: "surface", nature: "particulaire", libelle: "Propreté particulaire (ISO 14644-9)", methode: "Comptage sur surface", unite: "particules/m²" },
  { cle: "surf_depot", milieu: "surface", nature: "particulaire", libelle: "Taux de dépôt (ISO 14644-17)", methode: "Plaquette témoin", unite: "particules/(m²·h)" },
  { cle: "gants_empreinte", milieu: "gants", nature: "microbiologique", libelle: "Empreinte de gants (5 doigts)", methode: "Gélose contact", unite: "UFC/gant", limiteBpf: "gantsUfcGant" },
  { cle: "tenue_contact", milieu: "gants", nature: "microbiologique", libelle: "Contact sur tenue", methode: "Gélose contact", unite: "UFC/boîte" },
  { cle: "liq_bio", milieu: "liquide", nature: "microbiologique", libelle: "Eau / solution — dénombrement", methode: "Filtration", unite: "UFC/100 mL" },
  { cle: "liq_endo", milieu: "liquide", nature: "chimique", libelle: "Endotoxines", methode: "LAL", unite: "UE/mL" },
  { cle: "liq_cond", milieu: "liquide", nature: "chimique", libelle: "Conductivité", methode: "Conductimètre", unite: "µS/cm" },
  { cle: "liq_toc", milieu: "liquide", nature: "chimique", libelle: "Carbone organique total", methode: "COT-mètre", unite: "ppb" },
];

/** Limites suggérées pour un paramètre dans une zone (Annexe 1, ISO 14644-1). */
export function limitesSuggerees(p: Parametre, zone: Zone | null, etat: EtatOccupation | null): { alerte: number | null; action: number | null; source: string } {
  if (!zone) return { alerte: null, action: null, source: "" };
  if (p.taille_um != null) {
    const ligne = limitesParticulaires(zone).find((l) => l.taille === p.taille_um);
    const action = ligne ? (etat === "activite" ? ligne.enActivite : ligne.auRepos) : null;
    return { alerte: null, action, source: action != null ? (zone.grade_bpf ? `Annexe 1, grade ${zone.grade_bpf}` : "ISO 14644-1") : "" };
  }
  if (p.limiteBpf && zone.grade_bpf) {
    const action = DEFINITIONS_GRADES[zone.grade_bpf].microbio[p.limiteBpf];
    return { alerte: null, action, source: action != null ? `Annexe 1, grade ${zone.grade_bpf}` : "" };
  }
  return { alerte: null, action: null, source: "" };
}

/** Lecture d'un fichier CSV (séparateur ; ou ,) avec en-têtes. */
export function lireCsv(texte: string): Record<string, string>[] {
  const lignes = texte.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lignes.length < 2) return [];
  const sep = (lignes[0].match(/;/g) ?? []).length >= (lignes[0].match(/,/g) ?? []).length ? ";" : ",";
  const decouper = (l: string) => {
    const cellules: string[] = [];
    let cur = "";
    let guillemets = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (c === '"') {
        if (guillemets && l[i + 1] === '"') { cur += '"'; i++; } else guillemets = !guillemets;
      } else if (c === sep && !guillemets) { cellules.push(cur); cur = ""; } else cur += c;
    }
    cellules.push(cur);
    return cellules.map((x) => x.trim());
  };
  const entetes = decouper(lignes[0]).map((h) => h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  return lignes.slice(1).map((l) => {
    const c = decouper(l);
    return Object.fromEntries(entetes.map((h, i) => [h, c[i] ?? ""]));
  });
}

export function nombreFr(t: string | undefined): number | null {
  if (t == null || t.trim() === "") return null;
  const n = Number(t.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Interprète une date « JJ/MM/AAAA [HH:MM] » ou ISO. */
export function dateFr(t: string): string | null {
  const m = t.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] ?? 12), Number(m[5] ?? 0));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
