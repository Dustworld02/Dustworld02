import { describe, expect, it } from "vitest";
import { limiteIso, pointsMinimaux } from "../src/domain/referentiels/classesIso";
import { GABARITS_NATIFS, gabaritNatif } from "../src/domain/secteurs/gabaritsNatifs";
import { genererZones, selectionParDefaut, gabaritDepuisZones, versionSuivante } from "../src/domain/secteurs/generation";
import { limitesParticulaires, incoherencesZone, volumeM3 } from "../src/domain/exigencesZone";
import { matriceParDefaut, MODULES, ROLES_SYSTEME } from "../src/domain/permissions";

describe("ISO 14644-1", () => {
  it("donne les valeurs du tableau 1 pour les classes entières", () => {
    expect(limiteIso(5, 0.5)).toBe(3520);
    expect(limiteIso(7, 5)).toBe(2930);
    expect(limiteIso(8, 0.5)).toBe(3_520_000);
    expect(limiteIso(5, 5)).toBeNull();
  });
  it("calcule une classe intermédiaire par la formule de la norme", () => {
    // 10^6,5 × (0,1/0,5)^2,08 ≈ 111 250 → 111 000 (3 chiffres significatifs)
    expect(limiteIso(6.5, 0.5)).toBe(111_000);
  });
  it("retrouve la formule pour les classes entières", () => {
    for (const [classe, taille] of [[5, 0.5], [7, 1], [6, 5]] as const) {
      const formule = Math.pow(10, classe) * Math.pow(0.1 / taille, 2.08);
      const table = limiteIso(classe, taille)!;
      expect(Math.abs(formule - table) / table).toBeLessThan(0.01);
    }
  });
  it("applique le tableau A.1", () => {
    expect(pointsMinimaux(1)).toBe(1);
    expect(pointsMinimaux(10)).toBe(5);
    expect(pointsMinimaux(10.5)).toBe(6);
    expect(pointsMinimaux(1000)).toBe(27);
    expect(pointsMinimaux(2000)).toBe(54);
    expect(pointsMinimaux(0)).toBeNull();
  });
});

describe("Gabarits sectoriels", () => {
  it("livre huit secteurs, chacun cohérent", () => {
    expect(GABARITS_NATIFS).toHaveLength(8);
    for (const g of GABARITS_NATIFS) {
      const cles = g.typesZones.map((t) => t.cle);
      expect(new Set(cles).size).toBe(cles.length);
      expect(g.typesZones.some((t) => t.parDefaut)).toBe(true);
      for (const t of g.typesZones) expect(incoherencesZone({ iso_repos: t.isoAuRepos, iso_activite: t.isoEnActivite, grade_bpf: t.gradeBpf ?? null, surface_m2: null, hauteur_m: null })).toEqual([]);
    }
  });
  it("génère les zones types DM avec référence au gabarit", () => {
    const dm = gabaritNatif("dispositifs_medicaux")!;
    const zones = genererZones(dm, selectionParDefaut(dm));
    expect(zones.map((z) => z.nom)).toEqual(["SAS personnel", "SAS matériel", "Salle de production", "Zone d'emballage"]);
    expect(zones.map((z) => z.code)).toEqual(["Z01", "Z02", "Z03", "Z04"]);
    expect(zones[2]).toMatchObject({ iso_repos: 7, pression_pa: 30, gabarit_ref: { gabarit: "dispositifs_medicaux", version: "1.0.0", type_zone_gabarit: "production" } });
  });
  it("numérote les quantités et applique les surcharges", () => {
    const dm = gabaritNatif("dispositifs_medicaux")!;
    const zones = genererZones(dm, [{ cleType: "production", quantite: 2, surcharge: { isoAuRepos: 6, isoEnActivite: 6 } }]);
    expect(zones.map((z) => z.nom)).toEqual(["Salle de production 1", "Salle de production 2"]);
    expect(zones[0].iso_repos).toBe(6);
  });
  it("crée un gabarit d'entreprise depuis des zones", () => {
    const dm = gabaritNatif("dispositifs_medicaux")!;
    const zones = genererZones(dm, selectionParDefaut(dm));
    const g = gabaritDepuisZones("entreprise_x", "Entreprise X", dm, zones);
    expect(g.natif).toBe(false);
    expect(g.baseSur).toEqual({ cle: "dispositifs_medicaux", version: "1.0.0" });
    expect(g.typesZones.map((t) => t.cle)).toEqual(["sas_personnel", "sas_materiel", "salle_de_production", "zone_d_emballage"]);
    expect(versionSuivante("1.0.0")).toBe("1.1.0");
  });
});

describe("Exigences d'une zone", () => {
  it("fait primer le grade BPF à 5 µm", () => {
    const lignes = limitesParticulaires({ iso_repos: 7, iso_activite: 8, grade_bpf: "C", surface_m2: 20, hauteur_m: 2.5 });
    const cinq = lignes.find((l) => l.taille === 5)!;
    expect(cinq).toEqual({ taille: 5, auRepos: 2930, enActivite: 29300 });
  });
  it("calcule le volume", () => {
    expect(volumeM3({ iso_repos: 7, iso_activite: 7, grade_bpf: null, surface_m2: 20, hauteur_m: 2.5 })).toBe(50);
  });
});

describe("Matrice de droits", () => {
  it("couvre tous les rôles et modules", () => {
    const m = matriceParDefaut();
    expect(Object.keys(m)).toEqual(ROLES_SYSTEME.map((r) => r.cle));
    expect(m.admin.configuration).toBe(4);
    expect(m.lecteur.installations).toBe(1);
    expect(m.operateur.configuration).toBe(0);
    for (const r of ROLES_SYSTEME) expect(Object.keys(m[r.cle])).toHaveLength(MODULES.length);
  });
});
