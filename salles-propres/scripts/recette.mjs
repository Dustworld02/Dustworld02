/**
 * Recette de bout en bout du mode démonstration, dans Chromium.
 * Usage : npm run build && npx vite preview --port 4173 &  puis  node scripts/recette.mjs
 * Variables : URL (défaut http://localhost:4173), CHROMIUM (chemin du navigateur),
 * CAPTURES (dossier où enregistrer les captures d'écran, facultatif).
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const URL_APP = process.env.URL ?? "http://localhost:4173";
const CAPTURES = process.env.CAPTURES;
if (CAPTURES) mkdirSync(CAPTURES, { recursive: true });

const navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await navigateur.newPage({ viewport: { width: 1400, height: 900 } });
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(`pageerror: ${e.message}`));
page.on("response", (r) => { if (r.status() >= 400) erreurs.push(`HTTP ${r.status()} ${r.url()}`); });
page.on("console", (m) => { if (m.type() === "error") erreurs.push(`console: ${m.text()}`); });
page.on("dialog", (d) => d.accept());

let etape = 0;
async function verifier(libelle, fn) {
  etape++;
  try {
    await fn();
    console.log(`✓ ${etape}. ${libelle}`);
  } catch (e) {
    console.log(`✗ ${etape}. ${libelle}\n   ${e.message.split("\n")[0]}`);
    if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/echec-${etape}.png`, fullPage: true });
    await navigateur.close();
    process.exit(1);
  }
}
const capture = async (nom) => { if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/${nom}.png`, fullPage: true }); };
const attendreTexte = (texte) => page.getByText(texte, { exact: false }).first().waitFor({ timeout: 5000 });

async function connecter(role) {
  await page.goto(URL_APP);
  await page.getByRole("button", { name: new RegExp(role) }).first().click();
  await page.getByRole("button", { name: "Déconnexion" }).waitFor();
}
async function deconnecter() {
  await page.getByRole("button", { name: "Déconnexion" }).click();
  await attendreTexte("choisissez un profil");
}

await verifier("L'écran de connexion propose les profils de démonstration", async () => {
  await page.goto(URL_APP);
  await attendreTexte("Mode démonstration : choisissez un profil");
  await capture("01-connexion");
});

await verifier("L'administrateur arrive sur l'accueil avec le jeu d'exemple", async () => {
  await connecter("Administrateur");
  await attendreTexte("Parcours de mise en service");
  await attendreTexte("Démo — Contrôle Contamination");
});

await verifier("L'assistant propose le secteur de l'entreprise", async () => {
  await page.goto(`${URL_APP}/#/salles/nouvelle`);
  await page.getByLabel("Entreprise").selectOption({ label: "MedTech Exemple" });
  await page.getByLabel("Site").selectOption({ label: "Usine de Lyon" });
  await page.getByRole("button", { name: "Suivant →" }).click();
  await page.getByLabel("Nom", { exact: true }).fill("Salle propre de recette");
  await page.getByRole("button", { name: "Suivant →" }).click();
  const carte = page.getByRole("button", { name: /Dispositifs médicaux/ });
  await carte.waitFor();
  if ((await carte.getAttribute("aria-pressed")) !== "true") throw new Error("Le secteur de l'entreprise n'est pas présélectionné");
  await capture("02-assistant-secteur");
});

await verifier("Les zones types du gabarit DM sont proposées et modifiables", async () => {
  await page.getByRole("button", { name: "Suivant →" }).click();
  await attendreTexte("Zones proposées — Dispositifs médicaux");
  await page.getByLabel("Quantité Salle de production").fill("2");
  await attendreTexte("5 zone(s) seront créées");
  await capture("03-assistant-zones");
  await page.getByRole("button", { name: "Suivant →" }).click();
  await attendreTexte("Récapitulatif");
});

await verifier("La salle est créée avec ses 5 zones numérotées", async () => {
  await page.getByRole("button", { name: "Créer la salle propre" }).click();
  await page.getByRole("heading", { name: "Salle propre de recette" }).waitFor();
  const codes = await page.locator("table.tableau tbody tr td:first-child").allInnerTexts();
  if (codes.join(",") !== "Z01,Z02,Z03,Z04,Z05") throw new Error(`Codes obtenus : ${codes.join(",")}`);
  await attendreTexte("Salle de production 2");
});

await verifier("L'éditeur de zone calcule volume, points de prélèvement et limites", async () => {
  await page.getByRole("button", { name: "Salle de production 1" }).click();
  await page.getByLabel("Surface (m²)").fill("60");
  await page.getByLabel("Hauteur sous plafond (m)").fill("2,8");
  await attendreTexte("Volume : 168 m³");
  await attendreTexte("Points de prélèvement (A.1) : 12");
  await attendreTexte("352 000");
  await capture("04-editeur-zone");
  await page.getByRole("dialog").getByRole("button", { name: "Enregistrer", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await attendreTexte("60 m²");
  await capture("05-fiche-salle");
});

await verifier("Une incohérence de classe est signalée", async () => {
  await page.getByRole("button", { name: "Salle de production 2" }).click();
  await page.getByLabel("Classe ISO en activité").fill("5");
  await attendreTexte("La classe en activité est plus exigeante que la classe au repos.");
  await page.getByRole("dialog").getByRole("button", { name: "Annuler" }).click();
});

await verifier("L'approbation d'un document exige la signature par mot de passe", async () => {
  await page.goto(`${URL_APP}/#/documents`);
  await page.getByRole("button", { name: /Cahier des charges \(URS\)/ }).click();
  await page.getByRole("button", { name: "Approuver (signature)" }).click();
  await page.getByLabel("Mot de passe (confirmation d'identité)").fill("faux");
  await page.getByRole("button", { name: "Signer", exact: true }).click();
  await attendreTexte("Mot de passe incorrect");
  await page.getByLabel("Mot de passe (confirmation d'identité)").fill("demo");
  await page.getByRole("button", { name: "Signer", exact: true }).click();
  await attendreTexte("Approuvé par");
  await capture("06-document-signe");
  await page.keyboard.press("Escape");
});

await verifier("Le journal d'audit trace la modification de surface", async () => {
  await page.goto(`${URL_APP}/#/journal`);
  await page.getByText("surface_m2").first().waitFor();
  await capture("07-journal");
});

await verifier("La matrice des droits est éditable par l'administrateur", async () => {
  await page.goto(`${URL_APP}/#/configuration`);
  await page.getByRole("tab", { name: "Rôles et droits" }).click();
  const cellule = page.getByLabel("Documents — Opérateur");
  await cellule.selectOption("2");
  await page.getByRole("button", { name: /Enregistrer \(1\)/ }).click();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).waitFor();
  if ((await cellule.inputValue()) !== "2") throw new Error("Le droit n'a pas été enregistré");
  await capture("08-matrice-droits");
});

await verifier("L'opérateur n'a ni création de salle, ni configuration, ni journal", async () => {
  await deconnecter();
  await connecter("Opérateur");
  await page.goto(`${URL_APP}/#/salles`);
  await attendreTexte("Salle propre de recette");
  if (await page.getByRole("button", { name: "+ Nouvelle salle propre" }).count()) throw new Error("Bouton de création visible");
  if (await page.getByRole("link", { name: /Configuration/ }).count()) throw new Error("Lien Configuration visible");
  if (await page.getByRole("link", { name: /Journal d'audit/ }).count()) throw new Error("Lien Journal visible");
});

await verifier("Le droit accordé à l'opérateur sur les documents s'applique", async () => {
  await page.goto(`${URL_APP}/#/documents`);
  await page.getByRole("button", { name: "+ Nouveau document" }).waitFor();
});

await verifier("Aucune erreur dans la console", async () => {
  if (erreurs.length) throw new Error(erreurs.join(" | "));
});

await navigateur.close();
console.log("Recette réussie.");
