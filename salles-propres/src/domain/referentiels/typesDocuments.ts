export interface TypeDocument {
  cle: string;
  libelle: string;
  /** Durée de validité par défaut en mois (null = sans échéance). */
  validiteMois: number | null;
}

export const TYPES_DOCUMENTS_DEFAUT: TypeDocument[] = [
  { cle: "protocole", libelle: "Protocole de qualification", validiteMois: null },
  { cle: "rapport", libelle: "Rapport de qualification", validiteMois: null },
  { cle: "certificat_etalonnage", libelle: "Certificat d'étalonnage", validiteMois: 12 },
  { cle: "fds", libelle: "Fiche de données de sécurité", validiteMois: 36 },
  { cle: "procedure", libelle: "Procédure / mode opératoire", validiteMois: 36 },
  { cle: "plan", libelle: "Plan", validiteMois: null },
  { cle: "urs", libelle: "Cahier des charges (URS)", validiteMois: null },
  { cle: "autre", libelle: "Autre", validiteMois: null },
];
