import type { Etalonnage, Instrument, VerdictResultat } from "../data/types";

/** Verdict d'un résultat au regard de ses limites (strictement supérieur = dépassement). */
export function verdictResultat(valeur: number, alerte: number | null, action: number | null): VerdictResultat {
  if (action != null && valeur > action) return "action";
  if (alerte != null && valeur > alerte) return "alerte";
  if (action != null || alerte != null) return "conforme";
  return "non_evalue";
}

export function ajouterMois(date: string, mois: number): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  const jour = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + mois);
  if (d.getUTCDate() < jour) d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

export interface EtatInstrument {
  valide: boolean;
  dernier: Etalonnage | null;
  echeance: string | null;
  message: string;
  statut: "ok" | "attention" | "alerte";
}

/** Validité d'un instrument à une date : étalonnage conforme couvrant la date, instrument en service. */
export function etatInstrument(instrument: Instrument, etalonnages: Etalonnage[], date = new Date()): EtatInstrument {
  const jour = date.toISOString().slice(0, 10);
  const liste = etalonnages.filter((e) => e.instrument_id === instrument.id).sort((a, b) => b.date_etalonnage.localeCompare(a.date_etalonnage));
  const dernier = liste[0] ?? null;
  const couvrant = liste.find((e) => e.conforme && e.date_etalonnage <= jour && (e.prochaine_echeance ?? "") >= jour);
  const echeance = couvrant?.prochaine_echeance ?? dernier?.prochaine_echeance ?? null;
  if (instrument.statut === "hors_service" || instrument.statut === "reforme") {
    return { valide: false, dernier, echeance, statut: "alerte", message: instrument.statut === "reforme" ? "Instrument réformé." : "Instrument hors service." };
  }
  if (!couvrant) {
    if (dernier && !dernier.conforme) return { valide: false, dernier, echeance, statut: "alerte", message: `Dernier étalonnage non conforme (${new Date(dernier.date_etalonnage).toLocaleDateString("fr-FR")}).` };
    return { valide: false, dernier, echeance, statut: "alerte", message: dernier ? `Étalonnage échu depuis le ${new Date(echeance!).toLocaleDateString("fr-FR")}.` : "Jamais étalonné." };
  }
  const jours = Math.round((new Date(couvrant.prochaine_echeance!).getTime() - new Date(jour).getTime()) / 86400000);
  if (jours <= 30) return { valide: true, dernier, echeance, statut: "attention", message: `Étalonnage à renouveler sous ${jours} jour(s).` };
  return { valide: true, dernier, echeance, statut: "ok", message: `Étalonné jusqu'au ${new Date(couvrant.prochaine_echeance!).toLocaleDateString("fr-FR")}.` };
}

export function instrumentValideLe(instrument: Instrument, etalonnages: Etalonnage[], dateIso: string): boolean {
  return etatInstrument(instrument, etalonnages, new Date(dateIso)).valide;
}
