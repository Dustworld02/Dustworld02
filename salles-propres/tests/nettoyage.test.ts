import { describe, expect, it } from "vitest";
import { frequencesZone, genererHabillage, genererProcedure, niveauDeZone } from "../src/domain/nettoyage/generation";
import { momentsDuJour, planifier } from "../src/domain/nettoyage/planning";
import type { Zone } from "../src/data/types";

const z = (extra: Partial<Zone>) => ({ iso_repos: 7, grade_bpf: null, zone_risque: null, type_zone: "salle", ...extra }) as Pick<Zone, "iso_repos" | "grade_bpf" | "zone_risque" | "type_zone">;
const freq = (secteur: string, zone: ReturnType<typeof z>) => Object.fromEntries(frequencesZone(secteur, zone).map((f) => [f.surface, f.frequence]));

describe("Procédures de nettoyage générées par secteur", () => {
  it("reprend le tableau du plan pour les dispositifs médicaux", () => {
    expect(freq("dispositifs_medicaux", z({ iso_repos: 7 }))).toMatchObject({ sols: "chaque_poste", surfaces_travail: "debut_fin_poste", murs_portes: "hebdomadaire", plafonds_grilles: "hebdomadaire", desinfection_complete: "mensuel" });
    expect(freq("dispositifs_medicaux", z({ iso_repos: 8 }))).toMatchObject({ sols: "quotidien", surfaces_travail: "debut_poste", murs_portes: "mensuel", desinfection_complete: "trimestriel" });
    expect(freq("dispositifs_medicaux", z({ iso_repos: 8, type_zone: "sas_personnel" }))).toMatchObject({ sols: "quotidien", surfaces_travail: "quotidien", murs_portes: "mensuel", desinfection_complete: "trimestriel" });
  });

  it("propose lingettes polyester, détergent-désinfectant et techniques en S / bandes pour les DM", () => {
    const p = genererProcedure("dispositifs_medicaux", z({ iso_repos: 7 }));
    expect(p.consommables).toContain("lingette_polyester");
    expect(p.produits).toEqual(expect.arrayContaining(["detergent_desinfectant", "alcool_70", "sporicide_h2o2_apa"]));
    expect(p.etapes.find((e) => e.surface === "surfaces_travail")?.technique).toBe("essuyage_s");
    expect(p.etapes.find((e) => e.surface === "sols" && e.technique)?.technique).toBe("bandes_paralleles");
    const ordre = p.etapes.map((e) => e.surface);
    expect(ordre.indexOf("plafonds_grilles")).toBeLessThan(ordre.indexOf("murs_portes"));
    expect(ordre.indexOf("murs_portes")).toBeLessThan(ordre.indexOf("sols"));
    expect(genererProcedure("dispositifs_medicaux", z({ iso_repos: 8 })).consommables).toContain("lingette_polyester_cellulose");
  });

  it("utilise des produits et consommables stériles en grade A/B", () => {
    const p = genererProcedure("pharma_sterile", z({ iso_repos: 5, grade_bpf: "B" }));
    expect(niveauDeZone(z({ grade_bpf: "B", iso_repos: 5 }))).toBe("critique");
    expect(p.produits).toEqual(expect.arrayContaining(["desinfectant_aq_sterile", "alcool_70_sterile", "sporicide_sterile", "eau_ppi"]));
    expect(p.consommables).toEqual(expect.arrayContaining(["lingette_scellee_sterile", "mop_polyester_sterile"]));
    expect(freq("pharma_sterile", z({ grade_bpf: "B", iso_repos: 5 })).desinfection_complete).toBe("hebdomadaire");
  });

  it("n'emploie ni désinfectant ni sporicide en micro-électronique et aspire en HEPA", () => {
    const p = genererProcedure("micro_electronique", z({ iso_repos: 4 }));
    expect(p.produits).not.toContain("sporicide_h2o2_apa");
    expect(p.produits).toEqual(expect.arrayContaining(["ipa_electronique", "eau_di"]));
    expect(p.consommables).toEqual(expect.arrayContaining(["lingette_scellee", "aspirateur_hepa"]));
  });

  it("nettoie entre deux interventions au bloc opératoire", () => {
    expect(freq("hopital", z({ iso_repos: 7, zone_risque: 3 })).surfaces_travail).toBe("entre_operations");
    expect(genererProcedure("hopital", z({ iso_repos: 7, zone_risque: 3 })).consommables).toContain("lingette_microfibre");
  });

  it("génère une tenue adaptée au niveau", () => {
    expect(genererHabillage("pharma_sterile", z({ grade_bpf: "B", iso_repos: 5 })).tenue).toContain("Gants stériles (double paire)");
    expect(genererHabillage("micro_electronique", z({ iso_repos: 4 })).tenue?.[0]).toMatch(/ESD/);
    expect(genererHabillage("dispositifs_medicaux", z({ iso_repos: 8 })).tenue).toContain("Blouse de protection");
  });
});

describe("Planning", () => {
  it("place les fréquences sur les jours ouvrés", () => {
    const lundi = new Date(2026, 10, 2); // 2 novembre 2026
    expect(momentsDuJour("debut_fin_poste", lundi)).toEqual(["debut_poste", "fin_poste"]);
    expect(momentsDuJour("quotidien", new Date(2026, 10, 7))).toEqual([]);
    expect(momentsDuJour("hebdomadaire", new Date(2026, 10, 6))).toEqual(["fin_poste"]);
    expect(momentsDuJour("mensuel", lundi)).toEqual(["fin_poste"]);
    expect(momentsDuJour("mensuel", new Date(2026, 10, 3))).toEqual([]);
  });
  it("regroupe les surfaces dues au même moment", () => {
    const p = genererProcedure("dispositifs_medicaux", z({ iso_repos: 7 }));
    const occ = planifier(p, new Date(2026, 10, 2), 7);
    expect(occ.filter((o) => o.moment === "debut_poste")).toHaveLength(5);
    const lundiSoir = occ.find((o) => o.date === "2026-11-02" && o.moment === "fin_poste")!;
    expect(lundiSoir.surfaces).toEqual(expect.arrayContaining(["sols", "surfaces_travail", "desinfection_complete"]));
    expect(occ.find((o) => o.date === "2026-11-06" && o.moment === "fin_poste")!.surfaces).toContain("murs_portes");
  });
});
