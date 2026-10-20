import { beforeEach, describe, expect, it } from "vitest";
import { DepotDemo, FichiersMemoire, StockageMemoire } from "../src/data/depotDemo";
import { COMPTES_DEMO, MOT_DE_PASSE_DEMO, creerJeuDemo } from "../src/data/jeuDemo";

let depot: DepotDemo;
let org = "";

async function connecter(role: keyof typeof COMPTES_DEMO) {
  await depot.connecter(COMPTES_DEMO[role].email, MOT_DE_PASSE_DEMO);
}

beforeEach(async () => {
  depot = new DepotDemo(new StockageMemoire(), new FichiersMemoire());
  await creerJeuDemo(depot);
  await connecter("admin");
  org = (await depot.mesOrganisations())[0].id;
});

describe("Mode démo : mêmes règles que la base", () => {
  it("crée le jeu de démonstration", async () => {
    expect(await depot.lister("zones", org)).toHaveLength(4);
    expect(await depot.lister("membres", org)).toHaveLength(7);
    const zones = await depot.lister("zones", org);
    expect(zones.every((z) => z.site_id)).toBe(true);
    const [doc] = await depot.lister("documents", org);
    expect(doc.version_courante).toBe(1);
  });

  it("refuse l'écriture à un opérateur et la lecture du journal", async () => {
    await connecter("operateur");
    const [salle] = await depot.lister("salles_propres", org);
    await expect(depot.creer("zones", { ...(await depot.lister("zones", org))[0], org_id: org, salle_id: salle.id })).rejects.toThrow(/droits insuffisants/);
    expect(await depot.journal(org)).toEqual([]);
  });

  it("journalise les modifications", async () => {
    const [zone] = await depot.lister("zones", org);
    await depot.modifier("zones", zone.id, { pression_pa: 18 });
    const [entree] = await depot.journal(org, { table: "zones", enregistrementId: zone.id });
    expect(entree.action).toBe("update");
    expect(entree.anciennes?.pression_pa).toBe(15);
    expect(entree.nouvelles?.pression_pa).toBe(18);
  });

  it("exige une signature d'approbation, réservée au niveau validation", async () => {
    const [doc] = await depot.lister("documents", org);
    await expect(depot.modifier("documents", doc.id, { statut: "approuve" })).rejects.toThrow(/signature/);
    await connecter("technique");
    await expect(depot.signer("document", doc.id, "approuve", "")).rejects.toThrow(/Droits insuffisants/);
    await depot.signer("document", doc.id, "verifie", "");
    await connecter("qualite");
    await depot.signer("document", doc.id, "approuve", "OK");
    const approuve = await depot.modifier("documents", doc.id, { statut: "approuve" });
    expect(approuve.statut).toBe("approuve");
    expect((await depot.signatures(org, "document", doc.id)).map((s) => s.signification)).toEqual(["verifie", "approuve"]);
  });

  it("réserve le retrait d'approbation au niveau validation", async () => {
    const [doc] = await depot.lister("documents", org);
    await depot.signer("document", doc.id, "approuve", "");
    await depot.modifier("documents", doc.id, { statut: "approuve" });
    await connecter("technique");
    await expect(depot.modifier("documents", doc.id, { statut: "brouillon" })).rejects.toThrow(/niveau validation/);
    await connecter("admin");
    await expect(depot.supprimer("documents", doc.id)).rejects.toThrow(/signatures/);
  });

  it("garde un administrateur et annule toute la transaction en cas de refus", async () => {
    const roles = await depot.lister("roles", org);
    const moi = (await depot.lister("membres", org)).find((m) => roles.find((r) => r.id === m.role_id)?.cle === "admin")!;
    const lecteur = roles.find((r) => r.cle === "lecteur")!;
    await expect(depot.modifier("membres", moi.id, { role_id: lecteur.id })).rejects.toThrow(/administrateur/);
    expect((await depot.lister("membres", org)).find((m) => m.id === moi.id)!.role_id).toBe(moi.role_id);
  });

  it("restreint un membre à ses sites", async () => {
    const [entreprise] = await depot.lister("entreprises", org);
    const autre = await depot.creer("sites", { org_id: org, entreprise_id: entreprise.id, nom: "Autre site", adresse: "" });
    const membres = await depot.lister("membres", org);
    const profils = await depot.profils(org);
    const tech = membres.find((m) => m.user_id === profils.find((p) => p.email === COMPTES_DEMO.technique.email)!.id)!;
    await depot.modifier("membres", tech.id, { sites: [autre.id] });
    await connecter("technique");
    expect((await depot.lister("sites", org)).map((s) => s.nom)).toEqual(["Autre site"]);
    expect(await depot.lister("zones", org)).toEqual([]);
  });

  it("crée le compte d'un invité à sa première connexion", async () => {
    const roles = await depot.lister("roles", org);
    await depot.creer("invitations", { org_id: org, email: "nouveau@demo.fr", nom_complet: "Nouvel Arrivant", role_id: roles.find((r) => r.cle === "lecteur")!.id, sites: null, acceptee_le: null });
    await depot.connecter("nouveau@demo.fr", "secret");
    expect(await depot.accepterInvitations()).toBe(1);
    expect(await depot.lister("zones", org)).toHaveLength(4);
    await expect(depot.connecter("nouveau@demo.fr", "faux")).rejects.toThrow(/incorrect/);
  });
});
