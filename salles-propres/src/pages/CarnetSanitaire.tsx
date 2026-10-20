import { Link, useParams } from "react-router";
import { useSession } from "../session";
import { Bouton, Vide, formatDate, useDonnees } from "../ui/composants";
import { etatFiltre } from "../domain/aeraulique";
import { etatGamme, energieCta, STATUTS_CHANGEMENT } from "../domain/maintenance";
import { formatNombre } from "../domain/exigencesZone";
import { TYPES_ETAGES } from "../domain/libelles";

const tableau = "w-full border-collapse text-xs [&_td]:border [&_td]:border-bord [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-bord [&_th]:bg-fond [&_th]:px-2 [&_th]:py-1 [&_th]:text-left";

/**
 * Carnet sanitaire de l'installation de traitement d'air : identification,
 * filtration, relevés, maintenance, essais de qualification des zones
 * desservies et changements. Généré à la demande, imprimable.
 */
export function CarnetSanitaire() {
  const { id = "" } = useParams();
  const s = useSession();
  const org = s.org!.id;
  const lire = <T,>(module: string, f: () => Promise<T[]>) => (s.peut(module, 1) ? f() : Promise.resolve([] as T[]));
  const { donnees } = useDonnees(async () => {
    const [ctas, sites, bouches, filtres, releves, zones, salles, gammes, interventions, changements, essais, campagnes] = await Promise.all([
      s.depot.lister("ctas", org, { id }), s.depot.lister("sites", org), s.depot.lister("bouches", org, { cta_id: id }), s.depot.lister("filtres", org), s.depot.lister("releves_filtres", org),
      s.depot.lister("zones", org), s.depot.lister("salles_propres", org),
      lire("maintenance", () => s.depot.lister("gammes_maintenance", org, { cta_id: id })), lire("maintenance", () => s.depot.lister("interventions_maintenance", org, { cta_id: id })),
      lire("maintenance", () => s.depot.lister("changements", org)), lire("qualification_execution", () => s.depot.lister("essais", org)), lire("qualification_protocoles", () => s.depot.lister("campagnes_qualification", org)),
    ]);
    return { cta: ctas[0] ?? null, sites, bouches, filtres, releves, zones, salles, gammes, interventions, changements, essais, campagnes };
  }, [org, id]);
  if (!donnees) return <p className="text-texte-2">Chargement…</p>;
  const cta = donnees.cta;
  if (!cta) return <Vide>CTA introuvable.</Vide>;
  const idsBouches = new Set(donnees.bouches.map((b) => b.id));
  const filtres = donnees.filtres.filter((f) => f.cta_id === cta.id || (f.bouche_id && idsBouches.has(f.bouche_id)));
  const zonesDesservies = donnees.zones.filter((z) => donnees.bouches.some((b) => b.zone_id === z.id));
  const sallesDesservies = new Set(donnees.bouches.map((b) => b.salle_id));
  const idsZones = new Set(zonesDesservies.map((z) => z.id));
  const ilYA2Ans = new Date(Date.now() - 730 * 86400000).toISOString().slice(0, 10);
  const essais = donnees.essais
    .filter((e) => e.statut === "realise" && ((e.cible_type === "cta" && e.cible_id === cta.id) || (e.cible_type === "zone" && e.cible_id && idsZones.has(e.cible_id)) || (e.cible_type === "filtre" && filtres.some((f) => f.id === e.cible_id))))
    .sort((a, b) => (b.date_realisation ?? "").localeCompare(a.date_realisation ?? ""));
  const derniersEssais = [...new Map(essais.map((e) => [`${e.cle_essai}|${e.cible_id}`, e])).values()];
  const interventions = donnees.interventions.filter((i) => (i.date_realisation ?? i.date_prevue) >= ilYA2Ans).sort((a, b) => (b.date_realisation ?? b.date_prevue).localeCompare(a.date_realisation ?? a.date_prevue));
  const changements = donnees.changements.filter((c) => c.categorie === "traitement_air" && (!c.salle_id || sallesDesservies.has(c.salle_id)));
  const energie = energieCta(cta);
  const nomZone = (zid: string | null) => { const z = donnees.zones.find((x) => x.id === zid); return z ? `${z.code} ${z.nom}` : "—"; };

  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-[13px] shadow-sm print:p-0 print:shadow-none">
      <div className="no-print mb-6 flex gap-2">
        <Link to={`/traitement-air/${cta.id}`}><Bouton>← Retour à la CTA</Bouton></Link>
        <Bouton variante="principal" onClick={() => window.print()}>Imprimer / PDF</Bouton>
      </div>
      <header className="mb-6 flex items-start justify-between border-b-2 border-navy-700 pb-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-texte-2">{s.org?.nom}</div>
          <h1 className="text-xl font-bold text-navy-900">Carnet sanitaire de l'installation de traitement d'air</h1>
          <div className="text-base">{cta.nom}{cta.repere && ` (${cta.repere})`}</div>
        </div>
        <table className="text-xs"><tbody>
          <tr><td className="pr-2 text-texte-2">Site</td><td>{donnees.sites.find((x) => x.id === cta.site_id)?.nom}</td></tr>
          <tr><td className="pr-2 text-texte-2">Édité le</td><td>{formatDate(new Date().toISOString())}</td></tr>
        </tbody></table>
      </header>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-bold uppercase text-navy-700">1. Identification</h2>
        <table className={tableau}><tbody>
          <tr><td className="w-56 bg-fond">Localisation</td><td>{cta.localisation || "—"}</td></tr>
          <tr><td className="bg-fond">Débit nominal / réduit</td><td>{formatNombre(cta.debit_nominal_m3h)} / {formatNombre(cta.debit_reduit_m3h)} m³/h</td></tr>
          <tr><td className="bg-fond">Air neuf</td><td>{cta.air_neuf_pct != null ? `${cta.air_neuf_pct} %` : "—"}</td></tr>
          <tr><td className="bg-fond">Composition</td><td>{cta.etages.map((e) => `${e.libelle || TYPES_ETAGES[e.type]}${e.classe ? ` ${e.classe}` : ""}`).join(" → ") || "—"}</td></tr>
          <tr><td className="bg-fond">Zones desservies</td><td>{zonesDesservies.map((z) => `${z.code} ${z.nom} (${donnees.salles.find((x) => x.id === z.salle_id)?.nom})`).join(" ; ") || "—"}</td></tr>
          {energie && <tr><td className="bg-fond">Énergie ventilateurs (estimation)</td><td>{formatNombre(energie.kwhAn)} kWh/an</td></tr>}
        </tbody></table>
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-bold uppercase text-navy-700">2. Filtration</h2>
        {filtres.length === 0 ? <p>Aucun filtre enregistré.</p> : (
          <table className={tableau}>
            <thead><tr><th>Repère</th><th>Classe</th><th>Emplacement</th><th>Posé le</th><th>Dernier Δp</th><th>État</th><th>Remplacement</th></tr></thead>
            <tbody>{filtres.map((f) => { const e = etatFiltre(f, donnees.releves); return (
              <tr key={f.id}><td>{f.repere || "—"}</td><td>{f.classe}</td><td>{f.emplacement === "terminal" ? "Terminal" : "Étage CTA"}</td><td>{formatDate(f.date_pose)}</td>
                <td>{e.dernierReleve ? `${e.dernierReleve.dp_pa} Pa (${formatDate(e.dernierReleve.date_releve)})` : "—"}</td><td>{e.message}</td><td>{formatDate(e.echeanceRemplacement)}</td></tr>
            ); })}</tbody>
          </table>
        )}
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-bold uppercase text-navy-700">3. Maintenance préventive</h2>
        {donnees.gammes.length === 0 ? <p>Aucune gamme de maintenance.</p> : (
          <table className={tableau}>
            <thead><tr><th>Gamme</th><th>Périodicité</th><th>Dernière</th><th>Prochaine</th><th>Opérations</th></tr></thead>
            <tbody>{donnees.gammes.map((g) => { const e = etatGamme(g, donnees.interventions); return (
              <tr key={g.id}><td>{g.libelle}</td><td>{g.periodicite_mois} mois</td><td>{formatDate(e.derniere)}</td><td>{formatDate(e.prochaine)}{e.statut === "en_retard" ? " (en retard)" : ""}</td><td>{g.operations.join(" ; ")}</td></tr>
            ); })}</tbody>
          </table>
        )}
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-bold uppercase text-navy-700">4. Interventions (24 derniers mois)</h2>
        {interventions.length === 0 ? <p>Aucune intervention enregistrée.</p> : (
          <table className={tableau}>
            <thead><tr><th>Date</th><th>Type</th><th>Intervention</th><th>Intervenant</th><th>Compte rendu</th></tr></thead>
            <tbody>{interventions.map((i) => (
              <tr key={i.id}><td>{formatDate(i.date_realisation ?? i.date_prevue)}</td><td>{i.type === "corrective" ? "Corrective" : "Préventive"}{i.statut !== "realisee" ? ` (${i.statut})` : ""}</td><td>{i.titre}</td><td>{i.intervenant}</td><td>{[i.compte_rendu, i.remise_en_service && `Remise en service : ${i.remise_en_service}`].filter(Boolean).join(" — ")}</td></tr>
            ))}</tbody>
          </table>
        )}
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-bold uppercase text-navy-700">5. Derniers essais de qualification</h2>
        {derniersEssais.length === 0 ? <p>Aucun essai réalisé sur l'installation ou les zones desservies.</p> : (
          <table className={tableau}>
            <thead><tr><th>Date</th><th>Essai</th><th>Objet</th><th>Critère</th><th>Verdict</th><th>Campagne</th></tr></thead>
            <tbody>{derniersEssais.map((e) => (
              <tr key={e.id}><td>{formatDate(e.date_realisation)}</td><td>{e.libelle}</td><td>{e.cible_type === "zone" ? nomZone(e.cible_id) : e.cible_libelle}</td><td>{e.critere}</td><td>{e.verdict === "conforme" ? "Conforme" : e.verdict === "non_conforme" ? "Non conforme" : "—"}</td><td>{donnees.campagnes.find((c) => c.id === e.campagne_id)?.numero}</td></tr>
            ))}</tbody>
          </table>
        )}
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-bold uppercase text-navy-700">6. Modifications de l'installation</h2>
        {changements.length === 0 ? <p>Aucun changement enregistré.</p> : (
          <ul className="list-disc pl-5">{changements.map((c) => <li key={c.id}><strong>{c.numero}</strong> {c.titre} — {STATUTS_CHANGEMENT[c.statut]}{c.cloture_le && ` le ${formatDate(c.cloture_le)}`}</li>)}</ul>
        )}
      </section>

      <footer className="mt-8 grid grid-cols-2 gap-6 text-xs">
        <div className="border-t border-bord pt-2">Responsable de l'installation :<br /><br />Date et visa :</div>
        <div className="border-t border-bord pt-2">Assurance qualité :<br /><br />Date et visa :</div>
      </footer>
    </div>
  );
}
