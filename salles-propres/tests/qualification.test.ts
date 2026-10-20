import { describe, expect, it } from "vitest";
import { echeancier, proposerEssais, verdictClassification, verdictMesures, verdictCampagnePropose } from "../src/domain/qualification";
import { etatInstrument, verdictResultat, ajouterMois } from "../src/domain/mesures";
import { PERIODICITES_DEFAUT } from "../src/domain/referentiels/periodicites";
import type { Essai, Etalonnage, Instrument, Resultat, Zone } from "../src/data/types";

const trace = { org_id: "o", cree_le: "", cree_par: null, modifie_le: "", modifie_par: null };
const zone: Zone = {
  ...trace, id: "z", salle_id: "s", site_id: "x", code: "Z03", nom: "Production", type_zone: "salle", iso_repos: 7, iso_activite: 7,
  grade_bpf: null, zone_risque: null, surface_m2: 10, hauteur_m: 2.5, pression_pa: 30, tolerance_pression_pa: 5, renouvellement_vol_h: 40,
  temperature_min: 18, temperature_max: 24, hr_min: 30, hr_max: 65, gabarit_ref: null, notes: "", geometrie: null,
};

function resultat(point: string, taille: number, valeur: number): Resultat {
  return {
    ...trace, id: `${point}-${taille}-${valeur}`, salle_id: "s", site_id: "x", zone_id: "z", point_id: null, point_libre: point, origine: "qualification",
    essai_id: "e", milieu: "air", nature: "particulaire", methode: "", parametre: "", taille_um: taille, unite: "/m³", valeur, etat_occupation: "repos",
    instrument_id: null, date_prelevement: "2026-10-01T10:00:00Z", operateur: "", lot_milieu: "", germe: "", limite_alerte: null, limite_action: null, verdict: "non_evalue", commentaire: "", validation_id: null,
  };
}

describe("Proposition d'essais", () => {
  it("déduit les critères des exigences de la zone", () => {
    const essais = proposerEssais({ zones: [zone], ctas: [], equipements: [], bouches: [], filtres: [], etats: ["repos", "activite"], optionnels: true });
    const cles = essais.map((e) => e.cle_essai);
    expect(cles.filter((c) => c === "classification_particulaire")).toHaveLength(2);
    expect(essais.find((e) => e.cle_essai === "pression_differentielle")).toMatchObject({ critere_min: 25, critere_max: 35, unite: "Pa" });
    expect(essais.find((e) => e.cle_essai === "debit_vitesse")).toMatchObject({ critere_min: 40, unite: "vol/h" });
    expect(essais.find((e) => e.cle_essai === "temps_recuperation")?.critere_max).toBe(20);
    expect(essais[0].critere).toMatch(/352\s000/);
    expect(essais[0].critere).toContain("au moins 5 points");
  });
  it("propose les essais normatifs d'un PSM", () => {
    const psm = { ...trace, id: "p", salle_id: "s", site_id: "x", zone_id: null, type: "psm", libelle: "PSM 1", repere: "", marque: "", modele: "", numero_serie: "", date_mise_service: null, statut: "en_service" as const, x: null, y: null, largeur: 1, profondeur: 1, notes: "" };
    const essais = proposerEssais({ zones: [], ctas: [], equipements: [psm], bouches: [], filtres: [], etats: ["repos"], optionnels: false });
    expect(essais.map((e) => e.cle_essai)).toEqual(["psm_vitesse_frontale", "psm_flux_descendant", "psm_ki_discus", "classification_particulaire"]);
  });
});

describe("Verdicts", () => {
  const essai = { cible_type: "zone" as const, etat_occupation: "repos" as const };
  it("classe une zone conforme avec le bon nombre de points", () => {
    const rs = ["P1", "P2", "P3", "P4", "P5"].flatMap((p) => [resultat(p, 0.5, 100000), resultat(p, 0.5, 120000), resultat(p, 5, 1000)]);
    const v = verdictClassification(essai, zone, rs, new Map());
    expect(v.conforme).toBe(true);
    expect(v.points[0].moyennes[0]).toMatchObject({ taille: 0.5, moyenne: 110000, limite: 352000 });
  });
  it("refuse une classification avec trop peu de points ou un dépassement", () => {
    const peu = verdictClassification(essai, zone, [resultat("P1", 0.5, 10), resultat("P1", 5, 1)], new Map());
    expect(peu.conforme).toBe(false);
    expect(peu.messages[0]).toMatch(/1 point\(s\) mesuré\(s\) pour 5 requis/);
    const rs = ["P1", "P2", "P3", "P4", "P5"].flatMap((p) => [resultat(p, 0.5, 1000), resultat(p, 5, p === "P3" ? 4000 : 10)]);
    const depasse = verdictClassification(essai, zone, rs, new Map());
    expect(depasse.conforme).toBe(false);
    expect(depasse.messages.join(" ")).toContain("P3");
  });
  it("calcule le taux de renouvellement à partir des débits mesurés", () => {
    const v = verdictMesures({ cle_essai: "debit_vitesse", cible_type: "zone", critere_min: 40, critere_max: null, mesures: [{ point: "S1", valeur: 600 }, { point: "S2", valeur: 500 }] }, zone);
    expect(v).toMatchObject({ conforme: true, valeurCalculee: 44 });
  });
  it("contrôle des mesures simples", () => {
    expect(verdictMesures({ cle_essai: "pression_differentielle", cible_type: "zone", critere_min: 25, critere_max: 35, mesures: [{ point: "", valeur: 22 }] }, zone).conforme).toBe(false);
  });
  it("propose un verdict de campagne", () => {
    const e = (cle: string, verdict: Essai["verdict"]) => ({ cle_essai: cle, statut: "realise", verdict }) as Essai;
    expect(verdictCampagnePropose([e("pression_differentielle", "conforme")])).toBe("qualifie");
    expect(verdictCampagnePropose([e("visualisation_flux", "non_conforme")])).toBe("qualifie_reserves");
    expect(verdictCampagnePropose([e("classification_particulaire", "non_conforme")])).toBe("non_qualifie");
  });
});

describe("Échéancier", () => {
  it("calcule la prochaine requalification selon la classe", () => {
    const essais = [{ cible_type: "zone", cible_id: "z", cle_essai: "classification_particulaire", statut: "realise", verdict: "conforme", date_realisation: "2025-11-15T10:00:00Z" } as Essai];
    const lignes = echeancier([zone], essais, PERIODICITES_DEFAUT, new Date("2026-10-20"));
    const classif = lignes.find((l) => l.essai.essai === "classification_particulaire")!;
    expect(classif).toMatchObject({ dernier: "2025-11-15", prochaine: "2026-11-15", statut: "a_echeance" });
    expect(lignes.find((l) => l.essai.essai === "pression_differentielle")!.statut).toBe("jamais");
    expect(echeancier([{ ...zone, iso_repos: 5 }], essais, PERIODICITES_DEFAUT, new Date("2026-10-20")).find((l) => l.essai.essai === "classification_particulaire")!.statut).toBe("en_retard");
  });
});

describe("Instruments et résultats", () => {
  const instrument = { ...trace, id: "i", statut: "en_service" } as Instrument;
  const etal = (date: string, conforme = true): Etalonnage => ({ ...trace, id: date, instrument_id: "i", date_etalonnage: date, prochaine_echeance: ajouterMois(date, 12), organisme: "", numero_certificat: "", conforme, document_id: null, commentaire: "" });
  it("valide un instrument couvert par un étalonnage conforme", () => {
    expect(etatInstrument(instrument, [etal("2026-01-10")], new Date("2026-06-01")).valide).toBe(true);
    expect(etatInstrument(instrument, [etal("2025-01-10")], new Date("2026-06-01")).valide).toBe(false);
    expect(etatInstrument(instrument, [etal("2026-01-10", false)], new Date("2026-06-01")).valide).toBe(false);
    expect(etatInstrument({ ...instrument, statut: "hors_service" }, [etal("2026-01-10")], new Date("2026-06-01")).valide).toBe(false);
    expect(etatInstrument(instrument, [etal("2025-11-10")], new Date("2026-10-20")).statut).toBe("attention");
  });
  it("calcule le verdict d'un résultat", () => {
    expect(verdictResultat(5, 10, 20)).toBe("conforme");
    expect(verdictResultat(15, 10, 20)).toBe("alerte");
    expect(verdictResultat(25, 10, 20)).toBe("action");
    expect(verdictResultat(1, null, 0)).toBe("action");
    expect(verdictResultat(1, null, null)).toBe("non_evalue");
    expect(ajouterMois("2026-01-31", 1)).toBe("2026-02-28");
  });
});

describe("Échéances à planifier", () => {
  it("regroupe les requalifications par salle et rend urgent un instrument invalide", async () => {
    const { echeancesAPlanifier } = await import("../src/domain/echeances");
    const essais = ["classification_particulaire", "pression_differentielle", "debit_vitesse"].map((cle) => ({ cible_type: "zone", cible_id: "z", cle_essai: cle, statut: "realise", verdict: "conforme", date_realisation: "2025-11-15T10:00:00Z" } as Essai));
    const instrument = { ...trace, id: "i", libelle: "Manomètre", statut: "en_service" } as Instrument;
    const nc = { ...trace, id: "e", instrument_id: "i", date_etalonnage: "2026-10-13", prochaine_echeance: "2027-10-13", conforme: false } as Etalonnage;
    const liste = echeancesAPlanifier({ zones: [zone], essais, periodicites: PERIODICITES_DEFAUT, instruments: [instrument], etalonnages: [nc], filtres: [], releves: [], capa: [], salles: [{ id: "s", nom: "Salle A" }] }, new Date("2026-10-20"));
    const requalif = liste.filter((x) => x.source_cle.startsWith("requalif:"));
    expect(requalif).toHaveLength(1);
    expect(requalif[0].titre).toBe("Requalification — Salle A (3 essais)");
    expect(liste.find((x) => x.objet_type === "instrument")!.echeance).toBe("2026-10-20");
  });
});
