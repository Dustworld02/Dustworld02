import { describe, expect, it } from "vitest";
import { aire, centroide, distanceContour, pointDansPolygone, rectangle } from "../src/domain/geometrie";
import { analyserCascade, bilanAeraulique, etatFiltre } from "../src/domain/aeraulique";
import type { Bouche, Filtre, Porte, ReleveFiltre, Zone } from "../src/data/types";

const trace = { org_id: "o", cree_le: "", cree_par: null, modifie_le: "", modifie_par: null };

function zone(id: string, iso: number | null, pression: number | null, extra: Partial<Zone> = {}): Zone {
  return {
    ...trace, id, salle_id: "s", site_id: "x", code: id, nom: `Zone ${id}`, type_zone: "salle", iso_repos: iso, iso_activite: iso,
    grade_bpf: null, zone_risque: null, surface_m2: 20, hauteur_m: 2.5, pression_pa: pression, tolerance_pression_pa: 5,
    renouvellement_vol_h: 20, temperature_min: null, temperature_max: null, hr_min: null, hr_max: null, gabarit_ref: null, notes: "", geometrie: null, ...extra,
  };
}

function porte(a: string | null, b: string | null): Porte {
  return { ...trace, id: `${a}-${b}`, salle_id: "s", site_id: "x", libelle: "", type: "porte", zone_a: a, zone_b: b, x: 0, y: 0, angle: 0, asservie: false, notes: "" };
}

describe("Géométrie", () => {
  const r = rectangle(4, 2, 0, 0);
  it("calcule aire et centroïde", () => {
    expect(aire(r)).toBe(8);
    expect(centroide(r)).toEqual([2, 1]);
    expect(aire([[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4]])).toBe(12);
  });
  it("teste l'appartenance et la distance au contour", () => {
    expect(pointDansPolygone([1, 1], r)).toBe(true);
    expect(pointDansPolygone([5, 1], r)).toBe(false);
    expect(distanceContour([4.2, 1], r).distance).toBeCloseTo(0.2);
    expect(Math.abs(distanceContour([4.2, 1], r).angle)).toBe(90);
  });
});

describe("Cascade de pression", () => {
  const prod = zone("prod", 7, 30);
  const sas = zone("sas", 8, 15);
  it("valide une cascade correcte vers l'extérieur", () => {
    const [p1, p2] = analyserCascade([prod, sas], [porte("prod", "sas"), porte("sas", null)]);
    expect(p1).toMatchObject({ statut: "ok", deltaPa: 15 });
    expect(p1.zoneHaute?.id).toBe("prod");
    expect(p2).toMatchObject({ statut: "ok", deltaPa: 15 });
  });
  it("détecte une inversion", () => {
    const [p] = analyserCascade([zone("prod", 7, 10), sas], [porte("prod", "sas")]);
    expect(p.statut).toBe("alerte");
    expect(p.message).toMatch(/Inversion/);
  });
  it("signale un écart trop faible entre classes différentes", () => {
    const [p] = analyserCascade([zone("prod", 7, 20), sas], [porte("prod", "sas")]);
    expect(p).toMatchObject({ statut: "attention", deltaPa: 5 });
  });
  it("traite le grade A plus propre que le grade B à classe égale", () => {
    const a = zone("a", 5, 45, { grade_bpf: "A" });
    const b = zone("b", 5, 50, { grade_bpf: "B" });
    expect(analyserCascade([a, b], [porte("a", "b")])[0].statut).toBe("alerte");
  });
  it("accepte le confinement en dépression", () => {
    expect(analyserCascade([zone("l3", 7, -30)], [porte("l3", null)])[0].statut).toBe("info");
  });
  it("signale une consigne manquante", () => {
    expect(analyserCascade([zone("x", 7, null), sas], [porte("x", "sas")])[0].statut).toBe("inconnu");
  });
});

describe("Bilan aéraulique", () => {
  it("calcule le taux de renouvellement", () => {
    const z = zone("prod", 7, 30, { renouvellement_vol_h: 40 });
    const b = (type: Bouche["type"], debit: number): Bouche => ({ ...trace, id: `${type}${debit}`, salle_id: "s", site_id: "x", zone_id: "prod", cta_id: null, type, repere: "", debit_m3h: debit, x: 0, y: 0, notes: "" });
    const [bilan] = bilanAeraulique([z], [b("soufflage", 1000), b("soufflage", 500), b("reprise", 1200)]);
    expect(bilan.tauxVolH).toBe(30);
    expect(bilan.statut).toBe("alerte");
    expect(bilan.repriseM3h).toBe(1200);
  });
});

describe("État d'un filtre", () => {
  const f: Filtre = {
    ...trace, id: "f", site_id: "x", cta_id: "c", bouche_id: null, repere: "F1", emplacement: "etage_cta", classe: "F9", norme: "EN 779",
    reference_fabricant: "", dimensions: "", date_pose: "2026-01-01", dp_initiale_pa: 100, dp_finale_pa: 300, periodicite_remplacement_mois: 12,
    test_integrite: false, statut: "en_place", notes: "",
  };
  const releve = (dp: number, date = "2026-06-01"): ReleveFiltre => ({ ...trace, id: `${dp}`, site_id: "x", filtre_id: "f", date_releve: date, dp_pa: dp, commentaire: "" });
  it("calcule l'encrassement", () => {
    expect(etatFiltre(f, [releve(150)], new Date("2026-07-01"))).toMatchObject({ encrassementPct: 25, statut: "ok", echeanceRemplacement: "2027-01-01" });
    expect(etatFiltre(f, [releve(270)], new Date("2026-07-01")).statut).toBe("attention");
    expect(etatFiltre(f, [releve(310)], new Date("2026-07-01")).statut).toBe("alerte");
  });
  it("utilise le relevé le plus récent et signale l'échéance dépassée", () => {
    expect(etatFiltre(f, [releve(290, "2026-05-01"), releve(120, "2026-06-01")], new Date("2026-07-01")).encrassementPct).toBe(10);
    expect(etatFiltre(f, [releve(120)], new Date("2027-02-01")).statut).toBe("alerte");
  });
});
