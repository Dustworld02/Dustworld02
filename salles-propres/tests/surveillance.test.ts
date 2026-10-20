import { describe, expect, it } from "vitest";
import type { GammeMaintenance, InterventionMaintenance, PlanEchantillonnage, PointPrelevement, Resultat, Zone } from "../src/data/types";
import { dateSuivante, horsLimites, prelevementsDus, proposerPlan, signauxTendance, statistiques } from "../src/domain/surveillance";
import { energieCta, etatGamme, requalificationSuggeree } from "../src/domain/maintenance";

const trace = { id: "", org_id: "o", cree_le: "", cree_par: null, modifie_le: "", modifie_par: null };
const res = (valeur: number, verdict: Resultat["verdict"], jour: number, extra: Partial<Resultat> = {}): Resultat => ({
  ...trace, id: `r${jour}`, salle_id: "s", site_id: null, zone_id: "z", point_id: "p3", point_libre: "", origine: "surveillance", essai_id: null, milieu: "surface", nature: "microbiologique",
  methode: "", parametre: "Boîte contact Ø 55 mm", taille_um: null, unite: "UFC/boîte", valeur, etat_occupation: "activite", instrument_id: null,
  date_prelevement: `2026-10-${String(jour).padStart(2, "0")}T09:00:00Z`, operateur: "", lot_milieu: "", germe: "", limite_alerte: 15, limite_action: 25, verdict, commentaire: "",
  validation_id: null, plan_id: null, ...extra,
});
const zone = (extra: Partial<Zone>): Zone => ({
  ...trace, id: "z", salle_id: "s", site_id: null, code: "Z03", nom: "Production", type_zone: "salle", iso_repos: 7, iso_activite: 8, grade_bpf: null, zone_risque: null, surface_m2: 60, hauteur_m: 2.8,
  pression_pa: 30, tolerance_pression_pa: 5, renouvellement_vol_h: null, temperature_min: 18, temperature_max: 24, hr_min: 30, hr_max: 60, gabarit_ref: null, notes: "", geometrie: null, ...extra,
});

describe("Plan d'échantillonnage et dérives", () => {
  it("calcule le prochain prélèvement à partir du dernier résultat", () => {
    expect(dateSuivante("2026-01-31", "mensuel")).toBe("2026-02-28");
    expect(dateSuivante("2026-10-01", "hebdomadaire")).toBe("2026-10-08");
    const plan = { ...trace, id: "pl", salle_id: "s", site_id: null, zone_id: "z", point_id: "p3", parametre: "Boîte contact Ø 55 mm", milieu: "surface", nature: "microbiologique", methode: "", unite: "", taille_um: null, etat_occupation: null, frequence: "hebdomadaire", limite_alerte: 15, limite_action: 25, date_debut: "2026-09-01", actif: true, notes: "" } as PlanEchantillonnage;
    const [du] = prelevementsDus([plan], [res(3, "conforme", 5)], new Date("2026-10-20T10:00:00Z"));
    expect(du).toMatchObject({ dernier: "2026-10-05", prochain: "2026-10-12", statut: "en_retard" });
    expect(prelevementsDus([plan], [], new Date("2026-08-20T10:00:00Z"))[0].statut).toBe("a_venir");
  });

  it("détecte trois alertes consécutives, une hausse continue et des alertes fréquentes", () => {
    const lib = () => "P03";
    const consecutifs = signauxTendance([res(3, "conforme", 1), res(16, "alerte", 2), res(17, "alerte", 3), res(18, "alerte", 4)], lib);
    expect(consecutifs.map((x) => x.regle)).toEqual(["consecutifs"]);
    const hausse = signauxTendance([1, 2, 3, 4, 5, 6].map((v, i) => res(v, "conforme", i + 1)), lib);
    expect(hausse.map((x) => x.regle)).toEqual(["croissance"]);
    const frequence = signauxTendance([res(16, "alerte", 1), res(3, "conforme", 2), res(17, "alerte", 3), res(2, "conforme", 4), res(1, "conforme", 5)], lib);
    expect(frequence.map((x) => x.regle)).toEqual(["frequence"]);
    expect(signauxTendance([res(16, "alerte", 1, { origine: "qualification" })], lib)).toEqual([]);
  });

  it("produit les statistiques par paramètre", () => {
    const [st] = statistiques([res(2, "conforme", 1), res(16, "alerte", 2), res(30, "action", 3), res(4, "conforme", 4)]);
    expect(st).toMatchObject({ n: 4, alertes: 1, actions: 1, max: 30, moyenne: 13, tauxConformite: 50 });
  });

  it("propose un plan selon les natures des points et le niveau de la zone", () => {
    const pt = { ...trace, id: "p1", salle_id: "s", site_id: null, zone_id: "z", code: "P01", natures: ["particulaire", "surface"], x: 1, y: 1, hauteur_m: null, description: "", actif: true } as PointPrelevement;
    const lignes = proposerPlan("s", [zone({})], [pt], "2026-11-01");
    expect(lignes.map((l) => [l.parametre, l.frequence])).toEqual([["Particules ≥ 0,5 µm", "hebdomadaire"], ["Boîte contact Ø 55 mm", "hebdomadaire"]]);
    expect(lignes[0].limite_action).toBe(3520000);
    expect(lignes[0].limite_alerte).toBe(2112000);
    expect(proposerPlan("s", [zone({ grade_bpf: "B", iso_repos: 5 })], [pt], "2026-11-01").map((l) => l.parametre)).toContain("Particules ≥ 5 µm");
    // Zone ISO 7 sans grade : limite microbiologique empruntée au grade C, sauf historique du point.
    expect(lignes[1]).toMatchObject({ limite_action: 25, limite_alerte: 15 });
    expect(lignes[1].notes).toContain("grade C");
    const historique = proposerPlan("s", [zone({})], [pt], "2026-11-01", [res(3, "conforme", 1, { point_id: "p1", limite_alerte: 10, limite_action: 20 })]);
    expect(historique[1]).toMatchObject({ limite_action: 20, limite_alerte: 10 });
  });

  it("contrôle l'ambiance par rapport aux limites de la zone", () => {
    const z = zone({});
    expect(horsLimites(z, "pression", 24)).toBe(true);
    expect(horsLimites(z, "pression", 28)).toBe(false);
    expect(horsLimites(z, "temperature", 25)).toBe(true);
    expect(horsLimites(z, "hr", 45)).toBe(false);
  });
});

describe("Maintenance, change control et énergie", () => {
  const g = { ...trace, id: "g", site_id: null, cta_id: "c", salle_id: null, equipement_id: null, libelle: "Visite", periodicite_mois: 6, operations: [], prestataire: "", duree_h: null, impact_requalification: false, date_debut: "2026-01-15", actif: true, notes: "" } as GammeMaintenance;
  it("calcule l'échéance d'une gamme depuis la dernière intervention réalisée", () => {
    const i = { ...trace, id: "i", gamme_id: "g", statut: "realisee", date_realisation: "2026-05-10" } as InterventionMaintenance;
    expect(etatGamme(g, [i], new Date("2026-10-20")).prochaine).toBe("2026-11-10");
    expect(etatGamme(g, [i], new Date("2026-10-20")).statut).toBe("a_echeance");
    expect(etatGamme(g, [], new Date("2026-10-20")).statut).toBe("en_retard");
  });

  it("suggère une requalification pour un changement majeur ou touchant le traitement d'air", () => {
    expect(requalificationSuggeree({ categorie: "traitement_air", type: "mineur", evaluation: {} })).toBe(true);
    expect(requalificationSuggeree({ categorie: "documentation", type: "mineur", evaluation: {} })).toBe(false);
    expect(requalificationSuggeree({ categorie: "procede", type: "mineur", evaluation: { qualification: true } })).toBe(true);
  });

  it("estime l'énergie des ventilateurs et le gain du débit réduit", () => {
    const b = energieCta({ puissance_ventilateur_kw: 7.5, debit_nominal_m3h: 10000, debit_reduit_m3h: 5000, heures_nominal_jour: 12, heures_reduit_jour: 12 }, 0.2)!;
    // 7,5 kW × 12 h + 7,5 × max(0,5³ ; 0,2) × 12 h = 90 + 18 kWh/j
    expect(b.kwhAn).toBe(Math.round(108 * 365));
    expect(b.economieKwh).toBe(Math.round(180 * 365) - Math.round(108 * 365));
    expect(b.coutAn).toBe(Math.round(108 * 365 * 0.2));
    expect(energieCta({ puissance_ventilateur_kw: null, debit_nominal_m3h: null, debit_reduit_m3h: null, heures_nominal_jour: null, heures_reduit_jour: null })).toBeNull();
  });
});

describe("Export CSV", () => {
  it("échappe les séparateurs et utilise la virgule décimale", async () => {
    const { versCsv } = await import("../src/domain/csv");
    expect(versCsv(["a", "b"], [["x;y", 1.5], [null, true]])).toBe('﻿a;b\r\n"x;y";1,5\r\n;oui\r\n');
  });
});

describe("Tableau de bord", () => {
  it("synthétise une salle : conformité, nettoyage, écarts, ambiance", async () => {
    const { syntheseSalles } = await import("../src/domain/tableauDeBord");
    const salle = { ...trace, id: "s", nom: "Salle" } as never;
    const maintenant = new Date("2026-10-20T12:00:00Z");
    const recent = (j: number) => `2026-10-${String(j).padStart(2, "0")}T09:00:00Z`;
    const [x] = syntheseSalles({
      salles: [salle], zones: [zone({})], essais: [], periodicites: [],
      resultats: [res(2, "conforme", 10), res(16, "alerte", 11), res(1, "conforme", 12), res(3, "non_evalue", 13), res(9, "action", 1, { date_prelevement: "2026-08-01T09:00:00Z" })],
      interventions: [{ salle_id: "s", date_prevue: "2026-10-15", statut: "realisee" }, { salle_id: "s", date_prevue: "2026-10-16", statut: "a_faire" }, { salle_id: "s", date_prevue: "2026-10-25", statut: "a_faire" }] as never,
      ecarts: [{ salle_id: "s", statut: "ouvert" }, { salle_id: "s", statut: "cloture" }] as never,
      releves: [{ zone_id: "z", grandeur: "pression", valeur: 20, date_mesure: recent(18) }, { zone_id: "z", grandeur: "pression", valeur: 30, date_mesure: recent(18) }] as never,
    }, 30, maintenant);
    expect(x).toMatchObject({ resultats: 4, excursions: 1, conformite: 66.7, nettoyagesPrevus: 2, nettoyagesFaits: 1, ecartsOuverts: 1, ambianceHorsLimites: 1, qualification: null });
  });
});
