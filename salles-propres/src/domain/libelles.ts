export const TYPES_EQUIPEMENTS: Record<string, string> = {
  psm: "Poste de sécurité microbiologique",
  isolateur: "Isolateur",
  hotte_flux: "Hotte à flux laminaire",
  autoclave: "Autoclave",
  etuve: "Étuve / incubateur",
  balance: "Balance",
  compteur_particules: "Compteur de particules fixe",
  passe_plat_ventile: "Passe-plat ventilé",
  sas_decontamination: "SAS de décontamination",
  autre: "Autre",
};

export const ABREVIATIONS_EQUIPEMENTS: Record<string, string> = {
  psm: "PSM", isolateur: "ISO", hotte_flux: "FL", autoclave: "AC", etuve: "ÉT", balance: "BAL",
  compteur_particules: "CP", passe_plat_ventile: "PP", sas_decontamination: "SAS", autre: "ÉQ",
};

export const TYPES_MOBILIER: Record<string, string> = {
  paillasse: "Paillasse", etagere: "Étagère", armoire: "Armoire", chariot: "Chariot", table: "Table",
  chaise: "Chaise / tabouret", poubelle: "Poubelle", banc_sas: "Banc de SAS", autre: "Autre",
};

export const MATERIAUX: Record<string, string> = {
  inox: "Inox", pvc: "PVC", verre: "Verre", stratifie: "Stratifié", resine: "Résine", aluminium: "Aluminium", autre: "Autre",
};

export const NETTOYABILITE: Record<string, string> = { bonne: "Bonne", moyenne: "Moyenne", faible: "Faible" };

export const NATURES_PRELEVEMENT: Record<string, string> = {
  particulaire: "Particulaire (air)",
  microbio_air: "Microbiologique (air)",
  surface: "Surface",
  gants: "Gants / tenue",
  chimique: "Chimique",
};

export const TYPES_PORTES: Record<string, string> = { porte: "Porte", porte_sas: "Porte de SAS", passe_plat: "Passe-plat", porte_secours: "Porte de secours" };

export const TYPES_BOUCHES: Record<string, string> = { soufflage: "Soufflage", reprise: "Reprise", extraction: "Extraction" };

export const TYPES_FLUX: Record<string, string> = { personnel: "Personnel", materiel: "Matériel", produit: "Produit", dechets: "Déchets" };

export const COULEURS_FLUX: Record<string, string> = { personnel: "#2563eb", materiel: "#16a34a", produit: "#9333ea", dechets: "#92400e" };

export const TYPES_ETAGES: Record<string, string> = {
  prefiltre: "Préfiltre", filtre: "Filtre", batterie_chaude: "Batterie chaude", batterie_froide: "Batterie froide",
  humidificateur: "Humidificateur", ventilateur: "Ventilateur", recuperateur: "Récupérateur", autre: "Autre",
};

export const STATUTS_CTA: Record<string, string> = { en_service: "En service", maintenance: "En maintenance", arret: "À l'arrêt" };
export const STATUTS_EQUIPEMENTS: Record<string, string> = { en_service: "En service", en_qualification: "En qualification", hors_service: "Hors service" };

export const CLASSES_FILTRES = ["G4", "M5", "M6", "F7", "F8", "F9", "ePM10 50%", "ePM2,5 65%", "ePM1 80%", "E10", "E11", "E12", "H13", "H14", "U15", "U16", "U17"];

/** Couleur d'une classe ISO sur la cartographie. */
export function couleurClasse(iso: number | null | undefined): string {
  if (iso == null) return "#e5e7eb";
  if (iso <= 4) return "#1e3a8a";
  if (iso <= 5) return "#1d4ed8";
  if (iso <= 6) return "#3b82f6";
  if (iso <= 7) return "#60a5fa";
  if (iso <= 8) return "#93c5fd";
  return "#dbeafe";
}

export function couleurTexteClasse(iso: number | null | undefined): string {
  return iso != null && iso <= 6 ? "#ffffff" : "#0a1830";
}
