/** Catalogue initial des essais de qualification (ISO 14644-3 et essais d'équipements). */

export type CibleEssai = "zone" | "cta" | "psm" | "isolateur" | "hotte";

export interface DefinitionEssai {
  cle: string;
  libelle: string;
  reference: string;
  cibles: CibleEssai[];
  optionnel: boolean;
}

export const CATALOGUE_ESSAIS: DefinitionEssai[] = [
  { cle: "classification_particulaire", libelle: "Comptage particulaire (classification)", reference: "ISO 14644-1, 14644-3 B.1", cibles: ["zone", "psm", "isolateur", "hotte"], optionnel: false },
  { cle: "debit_vitesse", libelle: "Débit et vitesse d'air", reference: "ISO 14644-3 B.4", cibles: ["zone", "cta", "psm", "hotte"], optionnel: false },
  { cle: "pression_differentielle", libelle: "Pression différentielle", reference: "ISO 14644-3 B.5", cibles: ["zone", "isolateur"], optionnel: false },
  { cle: "integrite_filtres", libelle: "Intégrité des filtres installés (DEHS / Emery)", reference: "ISO 14644-3 B.6, EN 1822", cibles: ["zone", "cta", "psm", "isolateur", "hotte"], optionnel: true },
  { cle: "visualisation_flux", libelle: "Visualisation des flux d'air", reference: "ISO 14644-3 B.7", cibles: ["zone", "psm", "hotte"], optionnel: true },
  { cle: "temps_recuperation", libelle: "Temps de récupération / décontamination", reference: "ISO 14644-3 B.12", cibles: ["zone"], optionnel: true },
  { cle: "etancheite_enceinte", libelle: "Étanchéité de l'enceinte", reference: "ISO 14644-3 B.13", cibles: ["zone", "isolateur"], optionnel: true },
  { cle: "temperature", libelle: "Température", reference: "ISO 14644-3 B.8", cibles: ["zone"], optionnel: true },
  { cle: "humidite", libelle: "Humidité relative", reference: "ISO 14644-3 B.9", cibles: ["zone"], optionnel: true },
  { cle: "electrostatique", libelle: "Électrostatique et générateurs d'ions", reference: "ISO 14644-3 B.10", cibles: ["zone"], optionnel: true },
  { cle: "eclairage_bruit", libelle: "Éclairage et bruit", reference: "Usage", cibles: ["zone"], optionnel: true },
  { cle: "psm_vitesse_frontale", libelle: "PSM — vitesse d'air frontale", reference: "EN 12469", cibles: ["psm"], optionnel: false },
  { cle: "psm_flux_descendant", libelle: "PSM — flux descendant", reference: "EN 12469", cibles: ["psm"], optionnel: false },
  { cle: "psm_ki_discus", libelle: "PSM — facteur de protection (KI-Discus)", reference: "EN 12469", cibles: ["psm"], optionnel: false },
  { cle: "isolateur_fuite", libelle: "Isolateur — test de fuite", reference: "ISO 14644-7, ISO 10648-2", cibles: ["isolateur"], optionnel: false },
  { cle: "isolateur_gants", libelle: "Isolateur — intégrité des gants", reference: "ISO 14644-7", cibles: ["isolateur"], optionnel: false },
  { cle: "isolateur_decontamination", libelle: "Isolateur — cycle de décontamination", reference: "Annexe 1", cibles: ["isolateur"], optionnel: false },
];
