import { useState } from "react";
import { useSession } from "../session";
import type { Instrument } from "../data/types";
import { Badge, Bandeau, Carte, EnTete, MessageErreur, Modale, TableauDefilant, formatDate, useDonnees } from "../ui/composants";
import { GestionEntites, optionsDe } from "../ui/entites";
import { etatInstrument } from "../domain/mesures";
import { LIBELLES_MILIEUX, LIBELLES_NATURES } from "../domain/contamination";

export const TYPES_INSTRUMENTS: Record<string, string> = {
  compteur_particules: "Compteur de particules",
  biocollecteur: "Biocollecteur d'air",
  photometre: "Photomètre aérosol",
  generateur_aerosol: "Générateur d'aérosol",
  anemometre: "Anémomètre",
  balometre: "Balomètre (cône de débit)",
  manometre: "Manomètre / capteur de pression",
  sonde_th: "Sonde température / humidité",
  luminometre: "Luminomètre ATP",
  analyseur_cov: "Analyseur COV / AMC",
  conductimetre: "Conductimètre",
  autre: "Autre",
};

const STATUTS: Record<string, string> = { en_service: "En service", en_etalonnage: "En étalonnage", hors_service: "Hors service", reforme: "Réformé" };

export function Instruments() {
  const s = useSession();
  const org = s.org!.id;
  const { donnees, erreur, recharger } = useDonnees(async () => {
    const [instruments, etalonnages] = await Promise.all([s.depot.lister("instruments", org), s.depot.lister("etalonnages", org)]);
    return { instruments, etalonnages };
  }, [org]);
  const [ouvert, setOuvert] = useState<Instrument | null>(null);
  const etat = (i: Instrument) => etatInstrument(i, donnees?.etalonnages ?? []);
  return (
    <>
      <EnTete titre="Instruments et étalonnage" sousTitre="Un résultat ou un essai ne peut être enregistré qu'avec un instrument dont l'étalonnage couvre la date de mesure." />
      <MessageErreur erreur={erreur} />
      <GestionEntites
        table="instruments"
        lignes={donnees?.instruments ?? null}
        recharger={recharger}
        ouvrir={setOuvert}
        champs={[
          { cle: "libelle", libelle: "Libellé", type: "texte", requis: true },
          { cle: "type", libelle: "Type", type: "liste", requis: true, options: optionsDe(TYPES_INSTRUMENTS) },
          { cle: "marque", libelle: "Marque", type: "texte" },
          { cle: "modele", libelle: "Modèle", type: "texte" },
          { cle: "numero_serie", libelle: "N° de série", type: "texte" },
          { cle: "plage", libelle: "Plage de mesure", type: "texte" },
          { cle: "resolution", libelle: "Résolution", type: "texte" },
          { cle: "incertitude", libelle: "Incertitude", type: "texte" },
          { cle: "periodicite_etalonnage_mois", libelle: "Périodicité d'étalonnage (mois)", type: "nombre", requis: true },
          { cle: "proprietaire", libelle: "Propriété", type: "liste", requis: true, options: optionsDe({ interne: "Interne", prestataire: "Prestataire", location: "Location" }) },
          { cle: "localisation", libelle: "Localisation", type: "texte" },
          { cle: "statut", libelle: "Statut", type: "liste", requis: true, options: optionsDe(STATUTS) },
          { cle: "notes", libelle: "Notes", type: "zone_texte" },
        ]}
        valeursInitiales={() => ({ libelle: "", type: "compteur_particules", periodicite_etalonnage_mois: 12, proprietaire: "interne", statut: "en_service" })}
        texteRecherche={(i) => `${i.libelle} ${i.numero_serie} ${i.marque} ${i.modele}`}
        trier={(a, b) => a.libelle.localeCompare(b.libelle)}
        colonnes={[
          { libelle: "Instrument", rendu: (i) => <><strong className="text-navy-700">{i.libelle}</strong><div className="text-xs text-texte-2">{[i.marque, i.modele, i.numero_serie && `n° ${i.numero_serie}`].filter(Boolean).join(" · ")}</div></> },
          { libelle: "Type", rendu: (i) => TYPES_INSTRUMENTS[i.type] ?? i.type },
          { libelle: "Statut", rendu: (i) => STATUTS[i.statut] },
          { libelle: "Étalonnage", rendu: (i) => { const e = etat(i); return <Badge ton={e.statut === "ok" ? "ok" : e.statut}>{e.valide ? `valide → ${formatDate(e.echeance)}` : "invalide"}</Badge>; } },
        ]}
        vide="Aucun instrument."
      />
      {ouvert && <DetailInstrument instrument={ouvert} onFermer={() => { setOuvert(null); recharger(); }} />}
    </>
  );
}

function DetailInstrument({ instrument, onFermer }: { instrument: Instrument; onFermer: () => void }) {
  const s = useSession();
  const org = s.org!.id;
  const { donnees, recharger } = useDonnees(async () => {
    const [etalonnages, documents, resultats, essais, salles] = await Promise.all([
      s.depot.lister("etalonnages", org, { instrument_id: instrument.id }),
      s.peut("documents", 1) ? s.depot.lister("documents", org, { type_document: "certificat_etalonnage" }) : [],
      s.peut("contamination_resultats", 1) ? s.depot.lister("resultats", org, { instrument_id: instrument.id }) : [],
      s.peut("qualification_execution", 1) ? s.depot.lister("essais", org, { instrument_id: instrument.id }) : [],
      s.depot.lister("salles_propres", org),
    ]);
    return { etalonnages, documents, resultats, essais, salles };
  }, [org, instrument.id]);
  const etalonnages = [...(donnees?.etalonnages ?? [])].sort((a, b) => b.date_etalonnage.localeCompare(a.date_etalonnage));
  const etat = etatInstrument(instrument, etalonnages);

  // Impact d'un étalonnage non conforme : mesures faites depuis le dernier étalonnage conforme.
  const dernier = etalonnages[0];
  const precedentConforme = etalonnages.find((e) => e.conforme && dernier && e.date_etalonnage < dernier.date_etalonnage);
  const impact = dernier && !dernier.conforme
    ? {
      resultats: (donnees?.resultats ?? []).filter((r) => r.date_prelevement.slice(0, 10) >= (precedentConforme?.date_etalonnage ?? "0000") && r.date_prelevement.slice(0, 10) <= dernier.date_etalonnage),
      essais: (donnees?.essais ?? []).filter((e) => (e.date_realisation ?? "").slice(0, 10) >= (precedentConforme?.date_etalonnage ?? "0000") && (e.date_realisation ?? "") <= `${dernier.date_etalonnage}T23:59`),
    }
    : null;

  return (
    <Modale large titre={instrument.libelle} onFermer={onFermer}>
      <div className="mb-3"><Bandeau ton={etat.statut === "ok" ? "ok" : etat.statut}>{etat.message}</Bandeau></div>
      {impact && (
        <Carte titre="Analyse d'impact de l'étalonnage non conforme" className="mb-4">
          <p className="mb-2 text-sm">
            Mesures réalisées avec cet instrument depuis le dernier étalonnage conforme{precedentConforme ? ` (${formatDate(precedentConforme.date_etalonnage)})` : ""} :
            <strong> {impact.resultats.length} résultat(s)</strong> et <strong>{impact.essais.length} essai(s) de qualification</strong> à réévaluer.
            Ouvrez un écart pour tracer l'évaluation d'impact (module Écarts et CAPA).
          </p>
          {impact.resultats.length > 0 && (
            <TableauDefilant>
              <table className="tableau">
                <thead><tr><th>Date</th><th>Salle</th><th>Mesure</th><th className="nombre">Valeur</th></tr></thead>
                <tbody>{impact.resultats.slice(0, 50).map((r) => (
                  <tr key={r.id}><td>{formatDate(r.date_prelevement, true)}</td><td>{donnees?.salles.find((x) => x.id === r.salle_id)?.nom}</td><td>{LIBELLES_MILIEUX[r.milieu]} · {LIBELLES_NATURES[r.nature]} · {r.parametre}</td><td className="nombre">{r.valeur} {r.unite}</td></tr>
                ))}</tbody>
              </table>
            </TableauDefilant>
          )}
        </Carte>
      )}
      <GestionEntites
        table="etalonnages"
        titre="Étalonnages"
        lignes={etalonnages}
        recharger={recharger}
        champs={[
          { cle: "date_etalonnage", libelle: "Date d'étalonnage", type: "date", requis: true },
          { cle: "prochaine_echeance", libelle: "Prochaine échéance", type: "date", aide: `Vide = date + ${instrument.periodicite_etalonnage_mois} mois` },
          { cle: "organisme", libelle: "Organisme", type: "texte" },
          { cle: "numero_certificat", libelle: "N° de certificat", type: "texte" },
          { cle: "conforme", libelle: "Résultat", type: "case", aide: "Étalonnage conforme" },
          { cle: "document_id", libelle: "Certificat (GED)", type: "liste", options: (donnees?.documents ?? []).map((d) => ({ valeur: d.id, libelle: d.titre })) },
          { cle: "commentaire", libelle: "Commentaire", type: "zone_texte" },
        ]}
        valeursInitiales={() => ({ instrument_id: instrument.id, date_etalonnage: new Date().toISOString().slice(0, 10), conforme: true, prochaine_echeance: null, document_id: null })}
        colonnes={[
          { libelle: "Date", rendu: (e) => formatDate(e.date_etalonnage) },
          { libelle: "Échéance", rendu: (e) => formatDate(e.prochaine_echeance) },
          { libelle: "Organisme", rendu: (e) => e.organisme || "—" },
          { libelle: "Certificat", rendu: (e) => e.numero_certificat || "—" },
          { libelle: "Résultat", rendu: (e) => <Badge ton={e.conforme ? "ok" : "alerte"}>{e.conforme ? "Conforme" : "Non conforme"}</Badge> },
        ]}
        vide="Aucun étalonnage enregistré : l'instrument ne peut pas encore servir à des mesures."
      />
      <p className="mt-3 text-xs text-texte-2">{donnees?.resultats.length ?? 0} résultat(s) et {donnees?.essais.length ?? 0} essai(s) réalisés avec cet instrument.</p>
    </Modale>
  );
}
