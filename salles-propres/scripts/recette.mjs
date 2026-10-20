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

/** Convertit des coordonnées du plan (mètres) en coordonnées écran. */
async function versEcran(x, y) {
  return page.evaluate(([px, py]) => {
    const svg = document.querySelector('svg[aria-label^="Plan de"]');
    const p = new DOMPoint(px, py).matrixTransform(svg.getScreenCTM());
    return { x: p.x, y: p.y };
  }, [x, y]);
}

await verifier("Le plan de démonstration affiche la cascade de pression sans anomalie", async () => {
  await page.goto(`${URL_APP}/#/salles`);
  await page.getByRole("link", { name: "Salle propre assemblage cathéters" }).click();
  await page.getByRole("tab", { name: "Plan" }).click();
  await page.locator('svg[aria-label^="Plan de"]').waitFor();
  await page.locator("aside").getByText("Production → emballage").waitFor();
  await page.getByLabel("Affichage").selectOption("pression");
  if ((await page.getByLabel("Affichage").inputValue()) !== "pression") throw new Error("Vue non appliquée");
  await page.getByText("Pression forte").waitFor();
  if (await page.getByText("Inversion :").count()) throw new Error("Inversion inattendue");
  await capture("09-plan-cascade");
});

await verifier("On trace une zone à la souris et on l'associe à une nouvelle zone", async () => {
  await page.getByLabel("Affichage").selectOption("classes");
  await page.getByRole("button", { name: "▭ Zone" }).click();
  const a = await versEcran(18.05, 7.05);
  const b = await versEcran(23.95, 10);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  await attendreTexte("Nouveau tracé");
  await page.getByLabel("Associer le tracé à").selectOption("");
  await page.getByRole("dialog").getByLabel("Nom").fill("Local déchets");
  await page.getByRole("dialog").getByLabel("Classe ISO").fill("9");
  await page.getByRole("dialog").getByRole("button", { name: "Valider" }).click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await page.locator("svg text", { hasText: "Local déchets" }).waitFor();
});

await verifier("Une porte posée sur une cloison détecte les deux zones", async () => {
  await page.getByRole("button", { name: "🚪 Porte" }).click();
  const p = await versEcran(21, 7);
  await page.mouse.click(p.x, p.y);
  await page.getByRole("heading", { name: "Porte" }).waitFor();
  const a = await page.locator("aside").getByLabel("Côté A").inputValue();
  const b = await page.locator("aside").getByLabel("Côté B").inputValue();
  if (!a || !b) throw new Error(`Zones non détectées (A=${a}, B=${b})`);
  await capture("10-plan-porte");
});

await verifier("Une consigne de pression inversée est signalée", async () => {
  await page.getByRole("button", { name: "↖ Sélection" }).click();
  const p = await versEcran(21, 8.8);
  await page.mouse.click(p.x, p.y);
  await page.getByRole("heading", { name: "Zone" }).waitFor();
  await page.locator("aside").getByLabel("Pression (Pa)").fill("40");
  await page.locator("aside").getByRole("button", { name: "Enregistrer" }).click();
  await page.locator("aside").getByRole("button", { name: "Fermer" }).click();
  await page.getByRole("tab", { name: /Cascade/ }).click();
  await page.locator("aside").getByText("Inversion : l'air passe de Z05 Local déchets").waitFor();
});

await verifier("La CTA de démonstration montre ses étages, ses zones desservies et ses filtres", async () => {
  await page.goto(`${URL_APP}/#/traitement-air`);
  await page.getByText("CTA-01 Salle d'assemblage").first().click();
  await attendreTexte("Zones desservies");
  await attendreTexte("Humidificateur vapeur");
  await page.getByRole("row", { name: /CTA-01 F9/ }).getByRole("button", { name: "Relevés Δp" }).click();
  await attendreTexte("Encrassement 70 %");
  await capture("11-cta-releves");
  await page.keyboard.press("Escape");
});

await verifier("L'échéancier montre la requalification à venir de la qualification initiale clôturée", async () => {
  await page.goto(`${URL_APP}/#/qualification`);
  await page.getByRole("row", { name: /Qualification initiale/ }).getByText("Qualifié").waitFor();
  await page.getByRole("tab", { name: "Échéancier de requalification" }).click();
  await page.getByText("À échéance").first().waitFor();
});

await verifier("L'assistant propose les essais et leurs critères pour la salle, ses CTA et ses équipements", async () => {
  await page.goto(`${URL_APP}/#/qualification/nouvelle`);
  await page.locator("main").getByLabel("Salle propre", { exact: true }).selectOption({ label: "Salle propre assemblage cathéters" });
  await page.getByRole("button", { name: "Suivant →" }).click();
  await page.getByText("CTA-01 Salle d'assemblage").waitFor();
  await page.getByRole("button", { name: "Suivant →" }).click();
  await page.getByText("Vitesse du flux unidirectionnel").waitFor();
  await page.getByRole("row", { name: /Pression différentielle.*Z03/ }).getByText("Pression différentielle").waitFor();
  await capture("12-assistant-essais");
  await page.getByRole("button", { name: "Créer la campagne" }).click();
  await page.getByText("Protocole en rédaction").first().waitFor();
});

await verifier("Le protocole est approuvé par signature, puis l'exécution démarre", async () => {
  await page.getByRole("button", { name: "Approuver le protocole" }).click();
  await page.getByLabel("Mot de passe (confirmation d'identité)").fill("demo");
  await page.getByRole("dialog").getByRole("button", { name: "Signer" }).click();
  await page.getByRole("button", { name: "Démarrer l'exécution" }).click();
  await page.getByText("essai(s) restant(s) à réaliser").waitFor();
});

await verifier("Un instrument dont l'étalonnage est non conforme ne peut pas être choisi", async () => {
  await page.getByRole("row", { name: /Pression différentielle.*Z01/ }).click();
  const options = await page.getByRole("dialog").getByLabel("Instrument").locator("option:not([disabled])").allInnerTexts();
  if (options.some((o) => o.includes("Micromanomètre"))) throw new Error("Instrument non conforme proposé");
  await page.getByRole("dialog").getByLabel(/^Valeur/).fill("16");
  await page.getByRole("dialog").getByRole("button", { name: "Valider l'essai" }).click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await page.getByRole("row", { name: /Pression différentielle.*Z01/ }).getByText("Conforme").waitFor();
});

await verifier("La classification calcule le verdict point par point et exige le nombre de points du tableau A.1", async () => {
  await page.getByRole("row", { name: /Comptage particulaire.*Z01/ }).click();
  const d = page.getByRole("dialog");
  await d.getByText("4 requis").first().waitFor();
  await d.getByRole("button", { name: "+ Point" }).click();
  await d.getByRole("button", { name: "+ Point" }).click();
  await d.getByRole("button", { name: "+ Point" }).click();
  const champs = d.locator('input[aria-label$="µm"]');
  const n = await champs.count();
  for (let i = 0; i < n; i++) await champs.nth(i).fill(i % 2 === 0 ? "120000" : "800");
  await d.getByText("Points : 4 mesuré(s), 4 requis").waitFor();
  await d.getByLabel("Instrument").selectOption({ label: "Compteur de particules portable (n° CP28-0193)" });
  await capture("13-classification");
  await d.getByRole("button", { name: "Valider l'essai" }).click();
  await d.waitFor({ state: "detached" });
  await page.getByRole("row", { name: /Comptage particulaire.*Z01/ }).getByText("Conforme").waitFor();
});

await verifier("L'étalonnage non conforme du micromanomètre liste les essais à réévaluer", async () => {
  await page.goto(`${URL_APP}/#/instruments`);
  await page.getByText("Micromanomètre").first().click();
  await page.getByText("Analyse d'impact de l'étalonnage non conforme").waitFor();
  await page.getByText(/essai\(s\) de qualification/).first().waitFor();
  await page.keyboard.press("Escape");
});

await verifier("Un résultat saisi au-delà de la limite d'alerte est classé en alerte", async () => {
  await page.goto(`${URL_APP}/#/contaminations`);
  await page.getByRole("button", { name: "+ Saisir un résultat" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Point de prélèvement").selectOption({ label: "P03 — Paillasse 2" });
  await d.getByLabel("Paramètre mesuré").selectOption("surf_contact");
  await d.getByLabel("Limite d'alerte").fill("15");
  await d.getByLabel("Limite d'action").fill("25");
  await d.getByLabel(/^Valeur/).fill("18");
  await d.getByText("Alerte").first().waitFor();
  await d.getByRole("button", { name: "Enregistrer" }).click();
  await d.waitFor({ state: "detached" });
  await capture("14-resultats");
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
