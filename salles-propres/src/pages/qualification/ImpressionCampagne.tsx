import { Link, useParams } from "react-router";
import { useSession } from "../../session";
import { Bouton, Vide, formatDate } from "../../ui/composants";
import { useCampagne, zoneDeLEssai } from "./CampagneDetail";
import { LIBELLES_ETATS, LIBELLES_VERDICTS_CAMPAGNE, limitesEssai, verdictClassification, verdictMesures } from "../../domain/qualification";
import { LIBELLES_SIGNIFICATIONS, type Signification } from "../../domain/permissions";
import { formatNombre } from "../../domain/exigencesZone";
import { etatInstrument } from "../../domain/mesures";
import { TYPES_CAMPAGNE } from "./Qualification";

const VERDICTS = { conforme: "Conforme", non_conforme: "Non conforme", sans_objet: "Sans objet" };

export function ImpressionCampagne() {
  const { id = "", doc = "protocole" } = useParams();
  const s = useSession();
  const { donnees } = useCampagne(id);
  if (donnees === null) return <Vide>Campagne introuvable.</Vide>;
  if (!donnees) return <p className="text-texte-2">Chargement…</p>;
  const c = donnees.campagne;
  const rapport = doc === "rapport";
  const signatures = donnees.signatures.filter((x) => x.portee === (rapport ? "rapport" : "protocole"));
  const codes = new Map(donnees.points.map((p) => [p.id, p.code]));
  const instrumentsUtilises = [...new Set(donnees.essais.map((e) => e.instrument_id).filter((x): x is string => !!x))]
    .map((iid) => donnees.instruments.find((i) => i.id === iid)).filter((i) => !!i);

  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-[13px] shadow-sm print:p-0 print:shadow-none">
      <div className="no-print mb-6 flex gap-2">
        <Link to={`/qualification/${c.id}`}><Bouton>← Retour à la campagne</Bouton></Link>
        <Bouton variante="principal" onClick={() => window.print()}>Imprimer / PDF</Bouton>
      </div>

      <header className="mb-6 flex items-start justify-between border-b-2 border-navy-700 pb-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-texte-2">{s.org?.nom}</div>
          <h1 className="text-xl font-bold text-navy-900">{rapport ? "Rapport de qualification" : "Protocole de qualification"}</h1>
          <div className="text-base">{c.titre}</div>
        </div>
        <table className="text-xs">
          <tbody>
            <tr><td className="pr-2 text-texte-2">Référence</td><td className="font-mono font-semibold">{c.numero}{rapport ? "-R" : "-P"}</td></tr>
            <tr><td className="pr-2 text-texte-2">Version</td><td>{c.version}</td></tr>
            <tr><td className="pr-2 text-texte-2">Édité le</td><td>{formatDate(new Date().toISOString())}</td></tr>
          </tbody>
        </table>
      </header>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-bold uppercase text-navy-700">1. Identification</h2>
        <table className="w-full border-collapse text-xs [&_td]:border [&_td]:border-bord [&_td]:px-2 [&_td]:py-1">
          <tbody>
            <tr><td className="w-48 bg-fond">Salle propre</td><td>{donnees.salle?.nom}{donnees.salle?.batiment && ` — bâtiment ${donnees.salle.batiment}`}</td></tr>
            <tr><td className="bg-fond">Type de campagne</td><td>{TYPES_CAMPAGNE[c.type_campagne]}</td></tr>
            <tr><td className="bg-fond">Étapes</td><td>{c.etapes.join(", ")}</td></tr>
            <tr><td className="bg-fond">Responsable</td><td>{c.responsable || "—"}{c.prestataire && ` — prestataire : ${c.prestataire}`}</td></tr>
            {rapport && <tr><td className="bg-fond">Période</td><td>{formatDate(c.date_debut)} au {formatDate(c.date_fin)}</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-bold uppercase text-navy-700">2. Objectif</h2>
        <p>{c.objectif || "—"}</p>
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-bold uppercase text-navy-700">3. {rapport ? "Résultats des essais" : "Essais et critères d'acceptation"}</h2>
        <table className="w-full border-collapse text-xs [&_td]:border [&_td]:border-bord [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-bord [&_th]:bg-fond [&_th]:px-2 [&_th]:py-1 [&_th]:text-left">
          <thead><tr><th>#</th><th>Essai</th><th>Cible</th><th>État</th><th>Critère</th>{rapport && <th>Verdict</th>}</tr></thead>
          <tbody>{donnees.essais.map((e) => (
            <tr key={e.id}>
              <td>{e.ordre}</td><td>{e.libelle}<div className="text-[10px] text-texte-2">{e.reference}</div></td><td>{e.cible_libelle}</td>
              <td>{e.etat_occupation ? LIBELLES_ETATS[e.etat_occupation] : "—"}</td><td>{e.critere}</td>
              {rapport && <td className="font-semibold">{e.verdict ? VERDICTS[e.verdict] : "Non réalisé"}</td>}
            </tr>
          ))}</tbody>
        </table>
      </section>

      {rapport && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-bold uppercase text-navy-700">4. Détail des mesures</h2>
          {donnees.essais.filter((e) => e.statut !== "a_faire").map((e) => {
            const zone = zoneDeLEssai(e, donnees);
            const instrument = donnees.instruments.find((i) => i.id === e.instrument_id);
            const res = donnees.resultats.filter((r) => r.essai_id === e.id);
            const vc = e.cle_essai === "classification_particulaire" ? verdictClassification(e, zone, res, codes) : null;
            const vm = !vc && e.mesures.length ? verdictMesures(e, zone) : null;
            const limites = limitesEssai(e, zone);
            return (
              <div key={e.id} className="mb-4 break-inside-avoid">
                <h3 className="font-semibold">{e.ordre}. {e.libelle} — {e.cible_libelle}</h3>
                <p className="text-xs text-texte-2">Réalisé le {formatDate(e.date_realisation, true)} par {e.realise_par || "—"}{instrument && ` · instrument ${instrument.libelle}${instrument.numero_serie ? ` n° ${instrument.numero_serie}` : ""}`}</p>
                {vc && (
                  <table className="mt-1 w-full border-collapse text-xs [&_td]:border [&_td]:border-bord [&_td]:px-2 [&_td]:py-0.5 [&_th]:border [&_th]:border-bord [&_th]:bg-fond [&_th]:px-2">
                    <thead><tr><th>Point</th>{[...limites.keys()].map((t) => <th key={t}>≥ {String(t).replace(".", ",")} µm (limite {formatNombre(limites.get(t))})</th>)}<th>Résultat</th></tr></thead>
                    <tbody>{vc.points.map((p) => (
                      <tr key={p.point}><td>{p.point}</td>{[...limites.keys()].map((t) => <td key={t} className="text-right">{formatNombre(p.moyennes.find((m) => m.taille === t)?.moyenne)}</td>)}<td>{p.conforme ? "Conforme" : "Dépassement"}</td></tr>
                    ))}</tbody>
                  </table>
                )}
                {vc?.pointsRequis != null && <p className="text-xs">{vc.points.length} point(s) mesuré(s) pour {vc.pointsRequis} requis.</p>}
                {vm && (
                  <table className="mt-1 w-full border-collapse text-xs [&_td]:border [&_td]:border-bord [&_td]:px-2 [&_td]:py-0.5">
                    <tbody>{e.mesures.map((m, i) => <tr key={i}><td>{m.point || "—"}</td><td className="text-right">{formatNombre(m.valeur)} {e.unite}</td><td>{m.commentaire}</td></tr>)}</tbody>
                  </table>
                )}
                {vm && <p className="text-xs">{vm.message}</p>}
                <p className="text-xs"><strong>Verdict : {e.verdict ? VERDICTS[e.verdict] : "—"}.</strong> {e.commentaire}</p>
              </div>
            );
          })}
        </section>
      )}

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-bold uppercase text-navy-700">{rapport ? "5" : "4"}. Instruments</h2>
        {instrumentsUtilises.length === 0 ? <p className="text-xs text-texte-2">{rapport ? "Aucun instrument renseigné." : "Les instruments seront choisis à l'exécution parmi ceux dont l'étalonnage est valide."}</p> : (
          <ul className="text-xs">{instrumentsUtilises.map((i) => <li key={i!.id}>{i!.libelle} — n° {i!.numero_serie || "—"} — {etatInstrument(i!, donnees.etalonnages).message}</li>)}</ul>
        )}
      </section>

      {rapport && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-bold uppercase text-navy-700">6. Conclusion</h2>
          <p className="mb-1 font-semibold">Verdict : {c.verdict ? LIBELLES_VERDICTS_CAMPAGNE[c.verdict] : "—"}</p>
          <p className="whitespace-pre-line">{c.conclusion}</p>
        </section>
      )}

      <section className="break-inside-avoid">
        <h2 className="mb-2 text-sm font-bold uppercase text-navy-700">Signatures</h2>
        <table className="w-full border-collapse text-xs [&_td]:border [&_td]:border-bord [&_td]:px-2 [&_td]:py-2 [&_th]:border [&_th]:border-bord [&_th]:bg-fond [&_th]:px-2">
          <thead><tr><th>Signification</th><th>Nom</th><th>Date (serveur)</th><th>Commentaire</th></tr></thead>
          <tbody>
            {(["redige", "verifie", "approuve"] as Signification[]).map((sig) => {
              const liste = signatures.filter((x) => x.signification === sig);
              return liste.length ? liste.map((x) => <tr key={x.id}><td>{LIBELLES_SIGNIFICATIONS[sig]}</td><td>{x.nom_signataire}</td><td>{formatDate(x.signe_le, true)}</td><td>{x.commentaire}</td></tr>)
                : <tr key={sig}><td>{LIBELLES_SIGNIFICATIONS[sig]}</td><td className="text-texte-2">—</td><td /><td /></tr>;
            })}
          </tbody>
        </table>
        <p className="mt-2 text-[10px] text-texte-2">Signatures électroniques horodatées par le serveur, avec ressaisie du mot de passe ; journal d'audit consultable dans l'outil.</p>
      </section>
    </div>
  );
}
