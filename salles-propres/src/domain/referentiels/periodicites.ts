/**
 * ISO 14644-2:2015 — périodicités maximales des essais (en mois).
 * Valeurs par défaut, resserrables par zone sur analyse de risque.
 */

export interface Periodicite {
  essai: string;
  libelle: string;
  /** Périodicité pour les classes ISO ≤ 5. */
  moisIsoInf5: number;
  /** Périodicité pour les classes ISO > 5. */
  moisIsoSup5: number;
  obligatoire: boolean;
}

export const PERIODICITES_DEFAUT: Periodicite[] = [
  { essai: "classification_particulaire", libelle: "Classification particulaire", moisIsoInf5: 6, moisIsoSup5: 12, obligatoire: true },
  { essai: "pression_differentielle", libelle: "Pression différentielle", moisIsoInf5: 12, moisIsoSup5: 12, obligatoire: true },
  { essai: "debit_vitesse", libelle: "Débit / vitesse d'air", moisIsoInf5: 12, moisIsoSup5: 12, obligatoire: true },
  { essai: "integrite_filtres", libelle: "Intégrité des filtres installés", moisIsoInf5: 24, moisIsoSup5: 24, obligatoire: false },
  { essai: "visualisation_flux", libelle: "Visualisation des flux d'air", moisIsoInf5: 24, moisIsoSup5: 24, obligatoire: false },
  { essai: "temps_recuperation", libelle: "Temps de récupération", moisIsoInf5: 24, moisIsoSup5: 24, obligatoire: false },
  { essai: "etancheite_enceinte", libelle: "Étanchéité de l'enceinte", moisIsoInf5: 24, moisIsoSup5: 24, obligatoire: false },
];

export function periodiciteMois(p: Periodicite, classeIso: number): number {
  return classeIso <= 5 ? p.moisIsoInf5 : p.moisIsoSup5;
}
