import type { Zone } from "../../data/types";
import { libelleClasse } from "../referentiels/classesIso";
import { genererHabillage, genererProcedure, niveauDeZone, type ContenuProcedure } from "./generation";

export interface Groupe {
  cle: string;
  titre: string;
  zones: Zone[];
  contenu: ContenuProcedure;
  categorie: "nettoyage" | "habillage";
  niveau: string;
  retenu: boolean;
}

function categorieType(t: string): string {
  if (t === "sas_personnel") return "SAS personnel";
  if (t === "sas_materiel" || t === "passe_plat") return "SAS matériel et passe-plats";
  if (t === "poste_flux") return "Postes sous flux";
  if (t === "couloir") return "Couloirs";
  return "Salles";
}

/** Regroupe les zones de même nature (type + niveau) : une procédure par groupe. */
export function groupesDeZones(secteur: string, zones: Zone[]): Groupe[] {
  const map = new Map<string, Zone[]>();
  for (const z of zones) {
    const cle = `${categorieType(z.type_zone)}|${niveauDeZone(z)}|${z.iso_repos ?? "-"}|${z.grade_bpf ?? "-"}`;
    map.set(cle, [...(map.get(cle) ?? []), z]);
  }
  const groupes: Groupe[] = [];
  for (const [cle, liste] of map) {
    const [categorie, niveau] = cle.split("|");
    const z = liste[0];
    const classe = z.grade_bpf ? `grade ${z.grade_bpf}` : libelleClasse(z.iso_repos);
    groupes.push({ cle, titre: `Nettoyage — ${categorie} (${classe})`, zones: liste, contenu: genererProcedure(secteur, z), categorie: "nettoyage", niveau, retenu: true });
    if (z.type_zone === "sas_personnel") {
      groupes.push({ cle: `${cle}|habillage`, titre: `Habillage — accès ${classe}`, zones: liste, contenu: genererHabillage(secteur, z), categorie: "habillage", niveau, retenu: true });
    }
  }
  return groupes;
}
