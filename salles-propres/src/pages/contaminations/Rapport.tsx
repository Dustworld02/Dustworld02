import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useSession } from "../../session";
import { Bouton, Champ, Liste, Saisie, Vide, formatDate, useDonnees } from "../../ui/composants";
import { Courbe } from "../../ui/graphique";
import { LIBELLES_VERDICTS } from "../../domain/contamination";
import { formatNombre } from "../../domain/exigencesZone";
import { FREQUENCES_PRELEVEMENT, dateSuivante, resultatsDuPlan, signauxTendance, statistiques } from "../../domain/surveillance";
import { libellePoint } from "./Resultats";
import { LIBELLES_STATUTS_ECART } from "../Ecarts";

const jour = (d: Date) => d.toISOString().slice(0, 10);

/** Nombre de prélèvements attendus d'une ligne du plan sur une période. */
function attendus(debutPlan: string, frequence: Parameters<typeof dateSuivante>[1], du: string, au: string): number {
  let n = 0;
  let d = debutPlan;
  for (let i = 0; i < 2000 && d <= au; i++) {
    if (d >= du) n++;
    d = dateSuivante(d, frequence);
  }
  return n;
}

/** Rapport périodique de surveillance (mensuel, annuel…) d'une salle, imprimable. */
export function RapportContamination() {
  const s = useSession();
  const org = s.org!.id;
  const [params, setParams] = useSearchParams();
  const finDefaut = new Date();
  const debutDefaut = new Date(finDefaut.getFullYear(), finDefaut.getMonth() - 1, finDefaut.getDate());
  const [filtre, setFiltre] = useState({ salle: params.get("salle") ?? "", du: params.get("du") ?? jour(debutDefaut), au: params.get("au") ?? jour(finDefaut) });
  const { donnees } = useDonnees(async () => {
    const [salles, points, zones, resultats, plans, ecarts] = await Promise.all([
      s.depot.lister("salles_propres", org), s.depot.lister("points_prelevement", org), s.depot.lister("zones", org),
      s.depot.lister("resultats", org), s.depot.lister("plans_echantillonnage", org), s.peut("ecarts_capa", 1) ? s.depot.lister("ecarts", org) : [],
    ]);
    return { salles, points, zones, resultats, plans, ecarts };
  }, [org]);
  if (!donnees) return <p className="text-texte-2">Chargement…</p>;
  const salleId = filtre.salle || donnees.salles[0]?.id;
  const salle = donnees.salles.find((x) => x.id === salleId);
  if (!salle) return <Vide>Aucune salle propre.</Vide>;
  const periode = donnees.resultats.filter((r) => r.salle_id === salleId && r.origine !== "qualification" && r.date_prelevement.slice(0, 10) >= filtre.du && r.date_prelevement.slice(0, 10) <= filtre.au);
  const stats = statistiques(periode);
  const excursions = periode.filter((r) => r.verdict === "alerte" || r.verdict === "action").sort((a, b) => a.date_prelevement.localeCompare(b.date_prelevement));
  const signaux = signauxTendance(donnees.resultats.filter((r) => r.salle_id === salleId && r.date_prelevement.slice(0, 10) <= filtre.au), (r) => libellePoint(r, donnees.points));
  const ecarts = donnees.ecarts.filter((e) => e.salle_id === salleId && e.date_detection >= filtre.du && e.date_detection <= filtre.au);
  const plans = donnees.plans.filter((p) => p.salle_id === salleId && p.actif);
  const couverture = plans.map((p) => {
    const prevus = attendus(p.date_debut, p.frequence, filtre.du, filtre.au);
    const faits = resultatsDuPlan(p, periode).length;
    return { p, prevus, faits };
  });
  const totalPrevus = couverture.reduce((a, c) => a + c.prevus, 0);
  const totalFaits = couverture.reduce((a, c) => a + Math.min(c.faits, c.prevus), 0);
  const parametresCourbes = stats.filter((x) => x.n >= 3).slice(0, 4);
  const maj = (cle: keyof typeof filtre, v: string) => { const n = { ...filtre, [cle]: v }; setFiltre(n); setParams({ salle: n.salle, du: n.du, au: n.au }, { replace: true }); };
  const lieu = (pointId: string | null, zoneId: string | null) => donnees.points.find((p) => p.id === pointId)?.code ?? donnees.zones.find((z) => z.id === zoneId)?.code ?? "—";

  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-[13px] shadow-sm print:p-0 print:shadow-none">
      <div className="no-print mb-6 flex flex-wrap items-end gap-2">
        <Link to="/contaminations"><Bouton>← Retour</Bouton></Link>
        <Champ libelle="Salle"><Liste value={salleId} onChange={(e) => maj("salle", e.target.value)}>{donnees.salles.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</Liste></Champ>
        <Champ libelle="Du"><Saisie type="date" value={filtre.du} onChange={(e) => maj("du", e.target.value)} /></Champ>
        <Champ libelle="Au"><Saisie type="date" value={filtre.au} onChange={(e) => maj("au", e.target.value)} /></Champ>
        <Bouton variante="principal" onClick={() => window.print()}>Imprimer / PDF</Bouton>
      </div>

      <header className="mb-6 flex items-start justify-between border-b-2 border-navy-700 pb-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-texte-2">{s.org?.nom}</div>
          <h1 className="text-xl font-bold text-navy-900">Rapport de surveillance de la contamination</h1>
          <div className="text-base">{salle.nom}</div>
        </div>
        <table className="text-xs"><tbody>
          <tr><td className="pr-2 text-texte-2">Période</td><td>{formatDate(filtre.du)} au {formatDate(filtre.au)}</td></tr>
          <tr><td className="pr-2 text-texte-2">Édité le</td><td>{formatDate(new Date().toISOString())}</td></tr>
        </tbody></table>
      </header>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-bold uppercase text-navy-700">1. Synthèse</h2>
        <ul className="list-disc pl-5">
          <li>{periode.length} résultat(s) de surveillance et de nettoyage, dont <strong>{excursions.filter((r) => r.verdict === "alerte").length} au-delà de la limite d'alerte</strong> et <strong>{excursions.filter((r) => r.verdict === "action").length} au-delà de la limite d'action</strong>.</li>
          <li>Réalisation du plan d'échantillonnage : {totalPrevus ? `${totalFaits} prélèvement(s) sur ${totalPrevus} prévus (${Math.round((totalFaits / totalPrevus) * 100)} %)` : "aucun plan actif"}.</li>
          <li>{ecarts.length} écart(s) ouvert(s) sur la période ; {signaux.length} signal(aux) de dérive actif(s) à la fin de la période.</li>
        </ul>
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-bold uppercase text-navy-700">2. Résultats par paramètre</h2>
        {stats.length === 0 ? <p>Aucun résultat sur la période.</p> : (
          <table className="w-full border-collapse text-xs [&_td]:border [&_td]:border-bord [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-bord [&_th]:bg-fond [&_th]:px-2 [&_th]:py-1">
            <thead><tr><th className="text-left">Paramètre</th><th>N</th><th>Alertes</th><th>Actions</th><th>Moyenne</th><th>Max</th><th>Conformité</th></tr></thead>
            <tbody>{stats.map((x) => (
              <tr key={`${x.parametre}${x.unite}`}><td>{x.parametre} <span className="text-texte-2">({x.unite})</span></td><td className="text-right">{x.n}</td><td className="text-right">{x.alertes}</td><td className="text-right">{x.actions}</td><td className="text-right">{formatNombre(x.moyenne)}</td><td className="text-right">{formatNombre(x.max)}</td><td className="text-right">{x.tauxConformite != null ? `${x.tauxConformite} %` : "—"}</td></tr>
            ))}</tbody>
          </table>
        )}
      </section>

      {parametresCourbes.length > 0 && (
        <section className="mb-5 break-inside-avoid">
          <h2 className="mb-2 text-sm font-bold uppercase text-navy-700">3. Évolution</h2>
          <div className="grid gap-4">
            {parametresCourbes.map((x) => {
              const l = periode.filter((r) => r.parametre === x.parametre && r.unite === x.unite).sort((a, b) => a.date_prelevement.localeCompare(b.date_prelevement));
              const parPoint = new Map<string, typeof l>();
              for (const r of l) parPoint.set(lieu(r.point_id, r.zone_id), [...(parPoint.get(lieu(r.point_id, r.zone_id)) ?? []), r]);
              const couleurs = ["#1e3a5f", "#c2703c", "#059669", "#7c3aed", "#0891b2", "#be185d"];
              const alerte = l.find((r) => r.limite_alerte != null)?.limite_alerte;
              const action = l.find((r) => r.limite_action != null)?.limite_action;
              return (
                <div key={x.parametre} className="break-inside-avoid">
                  <div className="mb-1 font-semibold">{x.parametre}</div>
                  <Courbe hauteur={180} unite={x.unite}
                    seuils={[...(alerte != null ? [{ valeur: alerte, libelle: "Alerte", couleur: "#d97706" }] : []), ...(action != null ? [{ valeur: action, libelle: "Action", couleur: "#dc2626" }] : [])]}
                    series={[...parPoint.entries()].slice(0, 6).map(([p, rs], i) => ({ nom: p, couleur: couleurs[i], points: rs.map((r) => ({ date: r.date_prelevement, valeur: r.valeur })) }))} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-bold uppercase text-navy-700">4. Dépassements</h2>
        {excursions.length === 0 ? <p>Aucun dépassement sur la période.</p> : (
          <table className="w-full border-collapse text-xs [&_td]:border [&_td]:border-bord [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-bord [&_th]:bg-fond [&_th]:px-2 [&_th]:py-1">
            <thead><tr><th>Date</th><th>Point</th><th className="text-left">Paramètre</th><th>Valeur</th><th>Alerte / action</th><th>Verdict</th><th className="text-left">Germe / commentaire</th></tr></thead>
            <tbody>{excursions.map((r) => (
              <tr key={r.id}><td>{formatDate(r.date_prelevement)}</td><td>{lieu(r.point_id, r.zone_id)}</td><td>{r.parametre}</td><td className="text-right">{formatNombre(r.valeur)} {r.unite}</td><td className="text-right">{formatNombre(r.limite_alerte)} / {formatNombre(r.limite_action)}</td><td>{LIBELLES_VERDICTS[r.verdict]}</td><td>{[r.germe, r.commentaire].filter(Boolean).join(" — ")}</td></tr>
            ))}</tbody>
          </table>
        )}
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-bold uppercase text-navy-700">5. Signaux de dérive et écarts</h2>
        {signaux.length === 0 ? <p>Aucun signal de dérive.</p> : <ul className="list-disc pl-5">{signaux.map((sg) => <li key={sg.cle}>{sg.serie} : {sg.libelle}</li>)}</ul>}
        {ecarts.length > 0 && <ul className="mt-2 list-disc pl-5">{ecarts.map((e) => <li key={e.id}><strong>{e.numero}</strong> {e.titre} — {LIBELLES_STATUTS_ECART[e.statut].toLowerCase()}</li>)}</ul>}
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-bold uppercase text-navy-700">6. Réalisation du plan d'échantillonnage</h2>
        {couverture.length === 0 ? <p>Aucun plan d'échantillonnage actif.</p> : (
          <table className="w-full border-collapse text-xs [&_td]:border [&_td]:border-bord [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-bord [&_th]:bg-fond [&_th]:px-2 [&_th]:py-1">
            <thead><tr><th>Point</th><th className="text-left">Paramètre</th><th>Fréquence</th><th>Prévus</th><th>Réalisés</th></tr></thead>
            <tbody>{couverture.map(({ p, prevus, faits }) => (
              <tr key={p.id} className={faits < prevus ? "bg-amber-50" : ""}><td>{lieu(p.point_id, p.zone_id)}</td><td>{p.parametre}</td><td>{FREQUENCES_PRELEVEMENT[p.frequence]}</td><td className="text-right">{prevus}</td><td className="text-right">{faits}</td></tr>
            ))}</tbody>
          </table>
        )}
      </section>

      <footer className="mt-8 grid grid-cols-2 gap-6 text-xs">
        <div className="border-t border-bord pt-2">Rédigé par :<br /><br />Date et visa :</div>
        <div className="border-t border-bord pt-2">Approuvé par (assurance qualité) :<br /><br />Date et visa :</div>
      </footer>
    </div>
  );
}
