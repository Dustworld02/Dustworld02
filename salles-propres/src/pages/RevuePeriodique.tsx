import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useSession } from "../session";
import { Bandeau, Bouton, Champ, Liste, MessageErreur, Saisie, Vide, formatDate, useAction, useDonnees } from "../ui/composants";
import { LIBELLES_STATUTS_CAMPAGNE, LIBELLES_VERDICTS_CAMPAGNE, echeancier } from "../domain/qualification";
import { GRANDEURS, horsLimites, resultatsDuPlan, dateSuivante, signauxTendance, statistiques } from "../domain/surveillance";
import { STATUTS_CHANGEMENT, etatGamme } from "../domain/maintenance";
import { statutEcheance } from "../domain/personnel";
import { formatNombre } from "../domain/exigencesZone";
import { libellePoint } from "./contaminations/Resultats";
import { deposerVersion } from "./Documents";
import type { GrandeurAmbiance } from "../data/types";

const tableau = "w-full border-collapse text-xs [&_td]:border [&_td]:border-bord [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-bord [&_th]:bg-fond [&_th]:px-2 [&_th]:py-1 [&_th]:text-left";
const ORIGINES: Record<string, string> = { qualification: "Qualification", surveillance: "Surveillance", nettoyage: "Nettoyage", audit: "Audit", etalonnage: "Étalonnage", reclamation: "Réclamation", maintenance: "Maintenance", autre: "Autre" };

/** Nombre d'occurrences attendues d'une fréquence entre deux dates. */
function attendus(debut: string, frequence: Parameters<typeof dateSuivante>[1], du: string, au: string): number {
  let n = 0;
  for (let d = debut, i = 0; d <= au && i < 2000; d = dateSuivante(d, frequence), i++) if (d >= du) n++;
  return n;
}

/**
 * Revue périodique (annuelle par défaut) d'une salle propre : état qualifié,
 * surveillance, ambiance, nettoyage, écarts et CAPA, changements,
 * maintenance, personnel, puis conclusions proposées. Imprimable et
 * archivable dans la GED pour approbation signée.
 */
export function RevuePeriodique() {
  const s = useSession();
  const org = s.org!.id;
  const [params, setParams] = useSearchParams();
  const fin = new Date();
  const debutDefaut = new Date(fin.getFullYear() - 1, fin.getMonth(), fin.getDate());
  const [f, setF] = useState({ salle: params.get("salle") ?? "", du: params.get("du") ?? debutDefaut.toISOString().slice(0, 10), au: params.get("au") ?? fin.toISOString().slice(0, 10) });
  const zoneRapport = useRef<HTMLDivElement>(null);
  const action = useAction();
  const [archive, setArchive] = useState<string | null>(null);
  const { donnees, erreur } = useDonnees(async () => {
    const lire = <T,>(module: string, fn: () => Promise<T[]>) => (s.peut(module, 1) ? fn() : Promise.resolve([] as T[]));
    const [salles, zones, points, essais, campagnes, resultats, plans, releves, interventions, validations, ecarts, capa, changements, gammes, interventionsMaint, personnes, habilitations, bouches] = await Promise.all([
      s.depot.lister("salles_propres", org), s.depot.lister("zones", org), s.depot.lister("points_prelevement", org),
      lire("qualification_execution", () => s.depot.lister("essais", org)), lire("qualification_protocoles", () => s.depot.lister("campagnes_qualification", org)),
      lire("contamination_resultats", () => s.depot.lister("resultats", org)), lire("contamination_resultats", () => s.depot.lister("plans_echantillonnage", org)),
      lire("cta", () => s.depot.lister("releves_ambiance", org)), lire("nettoyage_execution", () => s.depot.lister("interventions_nettoyage", org)),
      lire("nettoyage_execution", () => s.depot.lister("validations_nettoyage", org)), lire("ecarts_capa", () => s.depot.lister("ecarts", org)), lire("ecarts_capa", () => s.depot.lister("capa", org)),
      lire("maintenance", () => s.depot.lister("changements", org)), lire("maintenance", () => s.depot.lister("gammes_maintenance", org)), lire("maintenance", () => s.depot.lister("interventions_maintenance", org)),
      lire("personnel", () => s.depot.lister("personnes", org)), lire("personnel", () => s.depot.lister("habilitations", org)), lire("cta", () => s.depot.lister("bouches", org)),
    ]);
    return { salles, zones, points, essais, campagnes, resultats, plans, releves, interventions, validations, ecarts, capa, changements, gammes, interventionsMaint, personnes, habilitations, bouches };
  }, [org]);
  if (erreur) return <MessageErreur erreur={erreur} />;
  if (!donnees) return <p className="text-texte-2">Chargement…</p>;
  const d = donnees;
  const salleId = f.salle || d.salles[0]?.id;
  const salle = d.salles.find((x) => x.id === salleId);
  if (!salle) return <Vide>Aucune salle propre.</Vide>;
  const dansPeriode = (date: string | null | undefined) => !!date && date.slice(0, 10) >= f.du && date.slice(0, 10) <= f.au;
  const maj = (cle: keyof typeof f, v: string) => { const n = { ...f, [cle]: v }; setF(n); setParams({ salle: n.salle, du: n.du, au: n.au }, { replace: true }); setArchive(null); };

  // 1. Qualification
  const zones = d.zones.filter((z) => z.salle_id === salle.id).sort((a, b) => a.code.localeCompare(b.code));
  const campagnes = d.campagnes.filter((c) => c.salle_id === salle.id && (dansPeriode(c.date_fin) || dansPeriode(c.date_debut)));
  const lignesEch = echeancier(zones, d.essais, s.referentiels.periodicites, new Date(`${f.au}T12:00:00Z`));
  const enRetard = lignesEch.filter((l) => l.statut === "en_retard" || l.statut === "jamais");
  // 2. Surveillance
  const resultats = d.resultats.filter((r) => r.salle_id === salle.id && r.origine !== "qualification" && dansPeriode(r.date_prelevement));
  const stats = statistiques(resultats);
  const plans = d.plans.filter((p) => p.salle_id === salle.id && p.actif);
  const prevus = plans.reduce((a, p) => a + attendus(p.date_debut, p.frequence, f.du, f.au), 0);
  const faits = plans.reduce((a, p) => a + Math.min(resultatsDuPlan(p, resultats).length, attendus(p.date_debut, p.frequence, f.du, f.au)), 0);
  const signaux = signauxTendance(d.resultats.filter((r) => r.salle_id === salle.id && r.date_prelevement.slice(0, 10) <= f.au), (r) => libellePoint(r, d.points));
  const sansLimite = plans.filter((p) => p.limite_action == null && p.limite_alerte == null);
  // 3. Ambiance
  const idsZones = new Set(zones.map((z) => z.id));
  const releves = d.releves.filter((r) => idsZones.has(r.zone_id) && dansPeriode(r.date_mesure));
  const ambiance = (Object.keys(GRANDEURS) as GrandeurAmbiance[]).map((g) => {
    const l = releves.filter((r) => r.grandeur === g);
    return { g, n: l.length, hors: l.filter((r) => horsLimites(zones.find((z) => z.id === r.zone_id)!, g, r.valeur)).length };
  });
  // 4. Nettoyage
  const nettoyages = d.interventions.filter((i) => i.salle_id === salle.id && dansPeriode(i.date_prevue) && i.date_prevue < new Date().toISOString().slice(0, 10));
  const nettoyagesFaits = nettoyages.filter((i) => i.statut === "realisee").length;
  const tauxNettoyage = nettoyages.length ? Math.round((nettoyagesFaits / nettoyages.length) * 1000) / 10 : null;
  const anomalies = nettoyages.filter((i) => i.anomalies.trim()).length;
  const validations = d.validations.filter((v) => v.salle_id === salle.id);
  // 5. Écarts et CAPA
  const ecarts = d.ecarts.filter((e) => e.salle_id === salle.id && dansPeriode(e.date_detection));
  const parOrigine = Object.entries(ecarts.reduce<Record<string, number>>((a, e) => ({ ...a, [e.origine]: (a[e.origine] ?? 0) + 1 }), {}));
  const capa = d.capa.filter((c) => ecarts.some((e) => e.id === c.ecart_id));
  const ouverts = d.ecarts.filter((e) => e.salle_id === salle.id && !["cloture", "annule"].includes(e.statut));
  // 6. Changements et maintenance
  const changements = d.changements.filter((c) => c.salle_id === salle.id && (dansPeriode(c.cree_le) || dansPeriode(c.cloture_le) || !["cloture", "refuse"].includes(c.statut)));
  const ctasSalle = new Set(d.bouches.filter((b) => b.salle_id === salle.id && b.cta_id).map((b) => b.cta_id));
  const gammes = d.gammes.filter((g) => g.salle_id === salle.id || (g.cta_id && ctasSalle.has(g.cta_id)));
  const maint = d.interventionsMaint.filter((i) => (i.salle_id === salle.id || (i.cta_id && ctasSalle.has(i.cta_id))) && dansPeriode(i.date_realisation ?? i.date_prevue));
  const gammesRetard = gammes.filter((g) => g.actif && etatGamme(g, d.interventionsMaint, new Date(`${f.au}T12:00:00Z`)).statut === "en_retard");
  // 7. Personnel
  const actives = d.personnes.filter((p) => p.actif);
  const habilitees = actives.filter((p) => d.habilitations.some((h) => h.personne_id === p.id && h.type === "acces_zone" && statutEcheance(h.date_expiration, new Date(`${f.au}T12:00:00Z`)) !== "expiree"));

  // Conclusions proposées (à valider par le rédacteur).
  const constats: string[] = [];
  if (enRetard.length) constats.push(`${enRetard.length} essai(s) de requalification dépassé(s) ou jamais réalisé(s) : planifier la campagne.`);
  if (prevus && faits / prevus < 0.9) constats.push(`Plan d'échantillonnage réalisé à ${Math.round((faits / prevus) * 100)} % : analyser les prélèvements manqués.`);
  if (sansLimite.length) constats.push(`${sansLimite.length} ligne(s) du plan d'échantillonnage sans limite : résultats non évalués, définir les limites.`);
  if (signaux.length) constats.push(`${signaux.length} signal(aux) de dérive actif(s) : ${signaux.map((x) => x.serie).join(", ")}.`);
  if (stats.some((x) => x.actions > 0)) constats.push(`Dépassements de limite d'action sur : ${stats.filter((x) => x.actions > 0).map((x) => x.parametre).join(", ")}.`);
  if (ambiance.some((a) => a.n && a.hors / a.n > 0.02)) constats.push(`Ambiance hors limites sur plus de 2 % des relevés (${ambiance.filter((a) => a.n && a.hors / a.n > 0.02).map((a) => GRANDEURS[a.g].libelle.toLowerCase()).join(", ")}).`);
  if (tauxNettoyage != null && tauxNettoyage < 95) constats.push(`Nettoyage réalisé à ${tauxNettoyage} % : renforcer le suivi du planning.`);
  if (!validations.some((v) => v.statut === "conforme")) constats.push("Aucune validation de l'efficacité du nettoyage conforme enregistrée.");
  if (ouverts.length) constats.push(`${ouverts.length} écart(s) encore ouvert(s) à la date de la revue.`);
  if (gammesRetard.length) constats.push(`${gammesRetard.length} gamme(s) de maintenance en retard.`);
  if (actives.length && habilitees.length < actives.length) constats.push(`${actives.length - habilitees.length} personne(s) active(s) sans habilitation d'accès valide.`);
  if (!constats.length) constats.push("Aucun constat défavorable : l'état de maîtrise de la salle est maintenu sur la période.");

  const archiver = () => action.executer(async () => {
    const css = [...document.styleSheets].map((f) => { try { return [...f.cssRules].map((r) => r.cssText).join("\n"); } catch { return ""; } }).join("\n");
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Revue périodique — ${salle.nom}</title><style>${css}</style></head><body>${zoneRapport.current?.outerHTML ?? ""}</body></html>`;
    const titre = `Revue périodique — ${salle.nom} — ${formatDate(f.du)} au ${formatDate(f.au)}`;
    const doc = await s.depot.creer("documents", { org_id: org, titre, type_document: "revue_periodique", statut: "brouillon", objet_type: "salle_propre", objet_id: salle.id, valide_jusqu_au: null, version_courante: 0 });
    await deposerVersion(s, doc.id, new File([html], `revue-periodique-${f.au}.html`, { type: "text/html" }), "Générée par l'application");
    setArchive(doc.id);
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-4 flex flex-wrap items-end gap-2">
        <Champ libelle="Salle"><Liste value={salleId} onChange={(e) => maj("salle", e.target.value)}>{d.salles.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</Liste></Champ>
        <Champ libelle="Du"><Saisie type="date" value={f.du} onChange={(e) => maj("du", e.target.value)} /></Champ>
        <Champ libelle="Au"><Saisie type="date" value={f.au} onChange={(e) => maj("au", e.target.value)} /></Champ>
        <Bouton onClick={() => window.print()}>Imprimer / PDF</Bouton>
        {s.peut("documents", 2) && <Bouton variante="principal" disabled={action.enCours || !!archive} onClick={() => void archiver()}>Archiver dans la GED</Bouton>}
      </div>
      <MessageErreur erreur={action.erreur} />
      {archive && <div className="no-print mb-4"><Bandeau ton="ok">Revue archivée en brouillon dans la GED : <Link className="underline" to="/documents">la soumettre à revue puis approbation signée</Link>.</Bandeau></div>}

      <div ref={zoneRapport} className="bg-white p-8 text-[13px] shadow-sm print:p-0 print:shadow-none">
        <header className="mb-6 flex items-start justify-between border-b-2 border-navy-700 pb-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-texte-2">{s.org?.nom}</div>
            <h1 className="text-xl font-bold text-navy-900">Revue périodique de la salle propre</h1>
            <div className="text-base">{salle.nom}</div>
          </div>
          <table className="text-xs"><tbody>
            <tr><td className="pr-2 text-texte-2">Période</td><td>{formatDate(f.du)} au {formatDate(f.au)}</td></tr>
            <tr><td className="pr-2 text-texte-2">Éditée le</td><td>{formatDate(new Date().toISOString())}</td></tr>
          </tbody></table>
        </header>

        <section className="mb-5">
          <h2 className="mb-2 text-sm font-bold uppercase text-navy-700">1. État qualifié</h2>
          <p className="mb-2">Zones : {zones.map((z) => `${z.code} ${z.nom} (${z.grade_bpf ? `grade ${z.grade_bpf}` : z.iso_repos != null ? `ISO ${z.iso_repos}` : "NC"})`).join(" ; ")}.</p>
          {campagnes.length > 0 ? <ul className="list-disc pl-5">{campagnes.map((c) => <li key={c.id}>{c.numero} {c.titre} — {LIBELLES_STATUTS_CAMPAGNE[c.statut] ?? c.statut}{c.verdict ? ` (${(LIBELLES_VERDICTS_CAMPAGNE[c.verdict] ?? c.verdict).toLowerCase()})` : ""}</li>)}</ul> : <p>Aucune campagne de qualification sur la période.</p>}
          <p className="mt-2">{enRetard.length ? `${enRetard.length} essai(s) périodique(s) dépassé(s) ou jamais réalisé(s) à la fin de la période.` : "Tous les essais périodiques sont à jour à la fin de la période."}</p>
        </section>

        <section className="mb-5">
          <h2 className="mb-2 text-sm font-bold uppercase text-navy-700">2. Surveillance de la contamination</h2>
          <p className="mb-2">{resultats.length} résultat(s) ; plan d'échantillonnage {prevus ? `réalisé à ${Math.round((faits / prevus) * 100)} % (${faits} / ${prevus})` : "non défini"}.</p>
          {stats.length > 0 && (
            <table className={tableau}>
              <thead><tr><th>Paramètre</th><th>N</th><th>Alertes</th><th>Actions</th><th>Max</th><th>Conformité</th></tr></thead>
              <tbody>{stats.map((x) => <tr key={x.parametre + x.unite}><td>{x.parametre} ({x.unite})</td><td>{x.n}</td><td>{x.alertes}</td><td>{x.actions}</td><td>{formatNombre(x.max)}</td><td>{x.tauxConformite != null ? `${x.tauxConformite} %` : "non évalué"}</td></tr>)}</tbody>
            </table>
          )}
          {signaux.length > 0 && <ul className="mt-2 list-disc pl-5">{signaux.map((x) => <li key={x.cle}>{x.serie} : {x.libelle}</li>)}</ul>}
        </section>

        <section className="mb-5">
          <h2 className="mb-2 text-sm font-bold uppercase text-navy-700">3. Ambiance (pression, température, humidité)</h2>
          {releves.length === 0 ? <p>Aucun relevé d'ambiance sur la période.</p> : (
            <table className={tableau}>
              <thead><tr><th>Grandeur</th><th>Relevés</th><th>Hors limites</th></tr></thead>
              <tbody>{ambiance.map((a) => <tr key={a.g}><td>{GRANDEURS[a.g].libelle}</td><td>{a.n}</td><td>{a.hors}{a.n ? ` (${Math.round((a.hors / a.n) * 1000) / 10} %)` : ""}</td></tr>)}</tbody>
            </table>
          )}
        </section>

        <section className="mb-5">
          <h2 className="mb-2 text-sm font-bold uppercase text-navy-700">4. Nettoyage et désinfection</h2>
          <p>{nettoyages.length ? `${nettoyagesFaits} intervention(s) réalisée(s) sur ${nettoyages.length} prévue(s) (${tauxNettoyage} %), ${anomalies} avec anomalie signalée.` : "Aucune intervention planifiée sur la période."}</p>
          <p>Validations de l'efficacité : {validations.length ? validations.map((v) => `${v.titre} (${formatDate(v.date_validation)}, ${{ planifiee: "planifiée", en_cours: "en cours", conforme: "conforme", non_conforme: "non conforme" }[v.statut]})`).join(" ; ") : "aucune"}.</p>
        </section>

        <section className="mb-5">
          <h2 className="mb-2 text-sm font-bold uppercase text-navy-700">5. Écarts et CAPA</h2>
          <p>{ecarts.length} écart(s) détecté(s) sur la période{parOrigine.length ? ` : ${parOrigine.map(([o, n]) => `${ORIGINES[o] ?? o} ${n}`).join(", ")}` : ""} ; {ouverts.length} encore ouvert(s) à ce jour.</p>
          <p>{capa.length} action(s) CAPA, dont {capa.filter((c) => c.statut === "efficace").length} vérifiée(s) efficace(s) et {capa.filter((c) => c.statut === "non_efficace").length} non efficace(s).</p>
        </section>

        <section className="mb-5">
          <h2 className="mb-2 text-sm font-bold uppercase text-navy-700">6. Changements et maintenance</h2>
          {changements.length ? <ul className="list-disc pl-5">{changements.map((c) => <li key={c.id}>{c.numero} {c.titre} — {STATUTS_CHANGEMENT[c.statut]}{c.requalification_requise ? " (requalification requise)" : ""}</li>)}</ul> : <p>Aucun changement sur la période.</p>}
          <p className="mt-2">{maint.filter((i) => i.statut === "realisee").length} intervention(s) de maintenance réalisée(s), dont {maint.filter((i) => i.type === "corrective" && i.statut === "realisee").length} corrective(s) ; {gammesRetard.length} gamme(s) en retard.</p>
        </section>

        <section className="mb-5">
          <h2 className="mb-2 text-sm font-bold uppercase text-navy-700">7. Personnel</h2>
          <p>{actives.length} personne(s) active(s), dont {habilitees.length} avec une habilitation d'accès valide.</p>
        </section>

        <section className="mb-5">
          <h2 className="mb-2 text-sm font-bold uppercase text-navy-700">8. Constats et conclusion</h2>
          <p className="mb-1 text-xs text-texte-2">Constats proposés automatiquement à partir des données : à compléter et valider par le rédacteur.</p>
          <ul className="list-disc pl-5">{constats.map((c) => <li key={c}>{c}</li>)}</ul>
          <div className="mt-3 min-h-16 rounded border border-dashed border-bord p-2 text-xs text-texte-2">Conclusion sur l'état de maîtrise et actions décidées :</div>
        </section>

        <footer className="mt-8 grid grid-cols-2 gap-6 text-xs">
          <div className="border-t border-bord pt-2">Rédigée par :<br /><br />Date et visa :</div>
          <div className="border-t border-bord pt-2">Approuvée par (assurance qualité) :<br /><br />Date et visa :</div>
        </footer>
      </div>
    </div>
  );
}
