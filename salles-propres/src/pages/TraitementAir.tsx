import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useSession } from "../session";
import type { Cta, EtageCta, Filtre } from "../data/types";
import { Badge, Bandeau, Bouton, Carte, EnTete, Liste, MessageErreur, Modale, Saisie, SaisieNombre, TableauDefilant, Vide, dateHeureLocale, formatDate, useAction, useDonnees, Onglets, Champ } from "../ui/composants";
import { Formulaire, GestionEntites, champsManquants, optionsDe, type DefinitionChamp } from "../ui/entites";
import { Courbe } from "../ui/graphique";
import { CLASSES_FILTRES, STATUTS_CTA, TYPES_BOUCHES, TYPES_ETAGES } from "../domain/libelles";
import { etatFiltre, type Statut } from "../domain/aeraulique";
import { formatNombre } from "../domain/exigencesZone";
import { energieCta } from "../domain/maintenance";
import { AmbianceZones } from "./Ambiance";

const TON_STATUT: Record<Statut, "ok" | "attention" | "alerte" | "neutre" | "info"> = { ok: "ok", attention: "attention", alerte: "alerte", inconnu: "neutre", info: "info" };

function champsCta(sites: { id: string; nom: string }[]): DefinitionChamp[] {
  return [
    { cle: "nom", libelle: "Nom", type: "texte", requis: true },
    { cle: "repere", libelle: "Repère", type: "texte" },
    { cle: "site_id", libelle: "Site", type: "liste", requis: true, options: sites.map((x) => ({ valeur: x.id, libelle: x.nom })) },
    { cle: "localisation", libelle: "Localisation", type: "texte" },
    { cle: "debit_nominal_m3h", libelle: "Débit nominal (m³/h)", type: "nombre" },
    { cle: "debit_reduit_m3h", libelle: "Débit réduit hors activité (m³/h)", type: "nombre" },
    { cle: "air_neuf_pct", libelle: "Part d'air neuf (%)", type: "nombre" },
    { cle: "statut", libelle: "Statut", type: "liste", requis: true, options: optionsDe(STATUTS_CTA) },
    { cle: "puissance_ventilateur_kw", libelle: "Puissance ventilateur (kW)", type: "nombre" },
    { cle: "heures_nominal_jour", libelle: "Heures/jour au débit nominal", type: "nombre" },
    { cle: "heures_reduit_jour", libelle: "Heures/jour au débit réduit", type: "nombre" },
    { cle: "notes", libelle: "Notes", type: "zone_texte" },
  ];
}

export function TraitementAir() {
  const s = useSession();
  const org = s.org!.id;
  const naviguer = useNavigate();
  const [onglet, setOnglet] = useState<"ctas" | "ambiance">(() => (window.location.hash.includes("onglet=ambiance") ? "ambiance" : "ctas"));
  const { donnees, erreur, recharger } = useDonnees(async () => {
    const [ctas, sites, filtres, releves, bouches] = await Promise.all([
      s.depot.lister("ctas", org), s.depot.lister("sites", org), s.depot.lister("filtres", org), s.depot.lister("releves_filtres", org), s.depot.lister("bouches", org),
    ]);
    return { ctas, sites, filtres, releves, bouches };
  }, [org]);
  const alertes = (cta: Cta) => {
    const ids = new Set(donnees!.bouches.filter((b) => b.cta_id === cta.id).map((b) => b.id));
    return donnees!.filtres.filter((f) => f.cta_id === cta.id || (f.bouche_id && ids.has(f.bouche_id)))
      .map((f) => etatFiltre(f, donnees!.releves)).filter((e) => e.statut === "alerte" || e.statut === "attention").length;
  };
  return (
    <>
      <EnTete titre="Traitement d'air" sousTitre="Centrales de traitement d'air, étages de filtration, filtres terminaux, relevés de perte de charge et ambiance des zones." />
      <MessageErreur erreur={erreur} />
      <Onglets actif={onglet} onChange={setOnglet} onglets={[{ cle: "ctas", libelle: "Centrales" }, { cle: "ambiance", libelle: "Ambiance des zones (GTC)" }]} />
      {onglet === "ambiance" && <AmbianceZones />}
      {onglet === "ctas" && <GestionEntites
        table="ctas"
        lignes={donnees?.ctas ?? null}
        recharger={recharger}
        champs={champsCta(donnees?.sites ?? [])}
        valeursInitiales={() => ({ nom: "", site_id: donnees?.sites[0]?.id ?? "", statut: "en_service", etages: [
          { type: "prefiltre", libelle: "Préfiltre", classe: "G4" }, { type: "filtre", libelle: "Filtre fin", classe: "F9" },
          { type: "batterie_froide", libelle: "Batterie froide", classe: "" }, { type: "batterie_chaude", libelle: "Batterie chaude", classe: "" },
          { type: "ventilateur", libelle: "Ventilateur de soufflage", classe: "" },
        ] })}
        ouvrir={(c) => naviguer(`/traitement-air/${c.id}`)}
        texteRecherche={(c) => `${c.nom} ${c.repere} ${c.localisation}`}
        colonnes={[
          { libelle: "CTA", rendu: (c) => <><strong className="text-navy-700">{c.nom}</strong>{c.repere && <span className="text-texte-2"> · {c.repere}</span>}</> },
          { libelle: "Site", rendu: (c) => donnees?.sites.find((x) => x.id === c.site_id)?.nom },
          { libelle: "Débit nominal", classe: "nombre", rendu: (c) => (c.debit_nominal_m3h != null ? `${formatNombre(c.debit_nominal_m3h)} m³/h` : "—") },
          { libelle: "Bouches", classe: "nombre", rendu: (c) => donnees?.bouches.filter((b) => b.cta_id === c.id).length },
          { libelle: "Statut", rendu: (c) => <Badge ton={c.statut === "en_service" ? "ok" : "attention"}>{STATUTS_CTA[c.statut]}</Badge> },
          { libelle: "Filtres", rendu: (c) => { const n = alertes(c); return n ? <Badge ton="alerte">{n} à traiter</Badge> : <Badge ton="ok">OK</Badge>; } },
        ]}
        vide="Aucune CTA. Créez-en une, puis reliez-lui les bouches de soufflage depuis le plan des salles."
      />}
    </>
  );
}

export function CtaDetail() {
  const { id = "" } = useParams();
  const s = useSession();
  const org = s.org!.id;
  const ecriture = s.peut("cta", 2);
  const { donnees, erreur, recharger } = useDonnees(async () => {
    const [ctas, sites, bouches, filtres, releves, salles, zones] = await Promise.all([
      s.depot.lister("ctas", org, { id }), s.depot.lister("sites", org), s.depot.lister("bouches", org, { cta_id: id }),
      s.depot.lister("filtres", org), s.depot.lister("releves_filtres", org), s.depot.lister("salles_propres", org), s.depot.lister("zones", org),
    ]);
    const idsBouches = new Set(bouches.map((b) => b.id));
    return {
      cta: ctas[0] ?? null, sites, bouches, salles, zones, releves,
      filtres: filtres.filter((f) => f.cta_id === id || (f.bouche_id && idsBouches.has(f.bouche_id))),
    };
  }, [org, id]);
  const [edition, setEdition] = useState<Record<string, unknown> | null>(null);
  const [etages, setEtages] = useState<EtageCta[] | null>(null);
  const [releve, setReleve] = useState<Filtre | null>(null);
  const action = useAction();

  if (erreur) return <MessageErreur erreur={erreur} />;
  if (!donnees) return <p className="text-texte-2">Chargement…</p>;
  if (!donnees.cta) return <Vide>CTA introuvable ou hors de votre périmètre.</Vide>;
  const cta = donnees.cta;
  const souffle = donnees.bouches.filter((b) => b.type === "soufflage").reduce((t, b) => t + (b.debit_m3h ?? 0), 0);
  const champs = champsCta(donnees.sites);
  const listeEtages = etages ?? cta.etages;
  const nomBouche = (bid: string | null) => {
    const b = donnees.bouches.find((x) => x.id === bid);
    if (!b) return "";
    const z = donnees.zones.find((x) => x.id === b.zone_id);
    return `${TYPES_BOUCHES[b.type]} ${b.repere || ""}${z ? ` — ${z.nom}` : ""}`;
  };

  const majEtage = (i: number, e: Partial<EtageCta>) => setEtages(listeEtages.map((x, j) => (j === i ? { ...x, ...e } : x)));
  const deplacer = (i: number, d: number) => {
    const l = [...listeEtages];
    const [x] = l.splice(i, 1);
    l.splice(i + d, 0, x);
    setEtages(l);
  };

  const parSalle = new Map<string, typeof donnees.bouches>();
  for (const b of donnees.bouches) parSalle.set(b.salle_id, [...(parSalle.get(b.salle_id) ?? []), b]);

  return (
    <>
      <EnTete
        titre={cta.nom}
        sousTitre={<>{donnees.sites.find((x) => x.id === cta.site_id)?.nom}{cta.localisation && ` · ${cta.localisation}`} · <Link to="/traitement-air" className="text-navy-700 hover:underline">toutes les CTA</Link></>}
        actions={<>
          <Link to={`/traitement-air/${cta.id}/carnet`}><Bouton>Carnet sanitaire</Bouton></Link>
          {ecriture && <Bouton onClick={() => { action.effacer(); setEdition({ ...cta }); }}>Modifier</Bouton>}
        </>}
      />
      <MessageErreur erreur={edition ? null : action.erreur} />
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Carte titre="Caractéristiques">
          <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
            <dt className="text-texte-2">Statut</dt><dd><Badge ton={cta.statut === "en_service" ? "ok" : "attention"}>{STATUTS_CTA[cta.statut]}</Badge></dd>
            <dt className="text-texte-2">Débit nominal</dt><dd className="nombre">{cta.debit_nominal_m3h != null ? `${formatNombre(cta.debit_nominal_m3h)} m³/h` : "—"}</dd>
            <dt className="text-texte-2">Débit réduit</dt><dd className="nombre">{cta.debit_reduit_m3h != null ? `${formatNombre(cta.debit_reduit_m3h)} m³/h` : "—"}</dd>
            <dt className="text-texte-2">Air neuf</dt><dd className="nombre">{cta.air_neuf_pct != null ? `${cta.air_neuf_pct} %` : "—"}</dd>
            <dt className="text-texte-2">Soufflé par les bouches</dt><dd className="nombre">{formatNombre(souffle)} m³/h</dd>
          </dl>
          {cta.debit_nominal_m3h != null && souffle > cta.debit_nominal_m3h && <div className="mt-2"><Bandeau ton="alerte">Les bouches soufflent plus que le débit nominal de la CTA.</Bandeau></div>}
        </Carte>
        <Carte
          titre="Étages (dans l'ordre du flux d'air)"
          className="lg:col-span-2"
          actions={ecriture && etages && <>
            <Bouton variante="discret" onClick={() => setEtages(null)}>Annuler</Bouton>
            <Bouton variante="principal" disabled={action.enCours} onClick={() => void action.executer(async () => { await s.depot.modifier("ctas", cta.id, { etages: listeEtages }); setEtages(null); recharger(); })}>Enregistrer</Bouton>
          </>}
        >
          <div className="mb-3 flex flex-wrap items-center gap-1 text-xs">
            <span className="rounded bg-sky-100 px-2 py-1">Air extérieur{cta.air_neuf_pct != null && ` ${cta.air_neuf_pct} %`}</span>
            {listeEtages.map((e, i) => <span key={i} className="flex items-center gap-1"><span aria-hidden>→</span><span className="rounded border border-bord bg-fond px-2 py-1">{e.libelle || TYPES_ETAGES[e.type]}{e.classe && <strong> {e.classe}</strong>}</span></span>)}
            <span aria-hidden>→</span><span className="rounded bg-navy-050 px-2 py-1">Gaines → bouches ({donnees.bouches.length})</span>
          </div>
          {ecriture && (
            <TableauDefilant>
              <table className="tableau">
                <thead><tr><th>Type</th><th>Libellé</th><th>Classe</th><th /></tr></thead>
                <tbody>
                  {listeEtages.map((e, i) => (
                    <tr key={i}>
                      <td><Liste aria-label="Type d'étage" value={e.type} onChange={(ev) => majEtage(i, { type: ev.target.value as EtageCta["type"] })}>{Object.entries(TYPES_ETAGES).map(([c, l]) => <option key={c} value={c}>{l}</option>)}</Liste></td>
                      <td><Saisie aria-label="Libellé de l'étage" value={e.libelle} onChange={(ev) => majEtage(i, { libelle: ev.target.value })} /></td>
                      <td className="w-36"><Saisie aria-label="Classe" list="classes-filtres" value={e.classe} onChange={(ev) => majEtage(i, { classe: ev.target.value })} /></td>
                      <td className="whitespace-nowrap">
                        <Bouton variante="discret" disabled={i === 0} onClick={() => deplacer(i, -1)}>↑</Bouton>
                        <Bouton variante="discret" disabled={i === listeEtages.length - 1} onClick={() => deplacer(i, 1)}>↓</Bouton>
                        <Bouton variante="discret" onClick={() => setEtages(listeEtages.filter((_, j) => j !== i))}>Retirer</Bouton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <datalist id="classes-filtres">{CLASSES_FILTRES.map((c) => <option key={c} value={c} />)}</datalist>
            </TableauDefilant>
          )}
          {ecriture && <Bouton className="mt-2" onClick={() => setEtages([...listeEtages, { type: "filtre", libelle: "", classe: "" }])}>+ Étage</Bouton>}
        </Carte>
      </div>

      <CarteEnergie cta={cta} />

      <Carte titre="Zones desservies" className="mb-4">
        {donnees.bouches.length === 0 ? <p className="text-sm text-texte-2">Aucune bouche reliée. Sur le plan d'une salle, posez des bouches et choisissez cette CTA.</p> : (
          <div className="grid gap-3 md:grid-cols-2">
            {[...parSalle.entries()].map(([salleId, bouches]) => (
              <div key={salleId} className="rounded-lg border border-bord p-3 text-sm">
                <Link to={`/salles/${salleId}`} className="font-semibold text-navy-700 hover:underline">{donnees.salles.find((x) => x.id === salleId)?.nom}</Link>
                <ul className="mt-1 space-y-0.5">
                  {bouches.map((b) => <li key={b.id} className="flex justify-between gap-2"><span>{nomBouche(b.id)}</span><span className="nombre">{b.debit_m3h != null ? `${formatNombre(b.debit_m3h)} m³/h` : "débit ?"}</span></li>)}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Carte>

      <Carte>
        <GestionEntites
          table="filtres"
          titre="Filtres"
          lignes={donnees.filtres}
          recharger={recharger}
          champs={[
            { cle: "repere", libelle: "Repère", type: "texte" },
            { cle: "emplacement", libelle: "Emplacement", type: "liste", requis: true, options: [{ valeur: "etage_cta", libelle: "Étage de la CTA" }, { valeur: "terminal", libelle: "Filtre terminal (bouche)" }] },
            { cle: "bouche_id", libelle: "Bouche", type: "liste", requis: true, options: donnees.bouches.map((b) => ({ valeur: b.id, libelle: nomBouche(b.id) })), visible: (v) => v.emplacement === "terminal" },
            { cle: "classe", libelle: "Classe", type: "liste", requis: true, options: CLASSES_FILTRES.map((c) => ({ valeur: c, libelle: c })) },
            { cle: "norme", libelle: "Norme", type: "liste", options: optionsDe({ "ISO 16890": "ISO 16890", "EN 779": "EN 779", "EN 1822": "EN 1822", "ISO 29463": "ISO 29463" }) },
            { cle: "reference_fabricant", libelle: "Référence fabricant", type: "texte" },
            { cle: "dimensions", libelle: "Dimensions", type: "texte" },
            { cle: "date_pose", libelle: "Date de pose", type: "date" },
            { cle: "periodicite_remplacement_mois", libelle: "Remplacement tous les (mois)", type: "nombre" },
            { cle: "dp_initiale_pa", libelle: "Perte de charge initiale (Pa)", type: "nombre" },
            { cle: "dp_finale_pa", libelle: "Perte de charge finale / colmatage (Pa)", type: "nombre" },
            { cle: "test_integrite", libelle: "Test d'intégrité", type: "case", aide: "Soumis au test d'intégrité (DEHS / Emery)" },
            { cle: "statut", libelle: "Statut", type: "liste", requis: true, options: [{ valeur: "en_place", libelle: "En place" }, { valeur: "remplace", libelle: "Remplacé (historique)" }] },
            { cle: "notes", libelle: "Notes", type: "zone_texte" },
          ]}
          avantEnregistrement={(v) => (v.emplacement === "terminal" ? { ...v, cta_id: null } : { ...v, cta_id: cta.id, bouche_id: null })}
          valeursInitiales={() => ({ emplacement: "etage_cta", classe: "F9", norme: "", statut: "en_place", cta_id: cta.id, bouche_id: null, date_pose: new Date().toISOString().slice(0, 10), dp_initiale_pa: null, dp_finale_pa: null, periodicite_remplacement_mois: null, test_integrite: false })}
          trier={(a, b) => (a.statut === b.statut ? a.repere.localeCompare(b.repere) : a.statut === "en_place" ? -1 : 1)}
          colonnes={[
            { libelle: "Filtre", rendu: (f) => <><strong>{f.repere || f.classe}</strong> <span className="text-texte-2">{f.classe}</span></> },
            { libelle: "Emplacement", rendu: (f) => (f.emplacement === "terminal" ? `Terminal : ${nomBouche(f.bouche_id)}` : "Étage CTA") },
            { libelle: "Posé le", rendu: (f) => formatDate(f.date_pose) },
            { libelle: "Dernier relevé", rendu: (f) => { const e = etatFiltre(f, donnees.releves); return e.dernierReleve ? `${e.dernierReleve.dp_pa} Pa le ${formatDate(e.dernierReleve.date_releve)}` : "—"; } },
            { libelle: "État", rendu: (f) => { const e = etatFiltre(f, donnees.releves); return <Badge ton={TON_STATUT[e.statut]} title={e.message}>{e.encrassementPct != null ? `${e.encrassementPct} %` : e.statut === "alerte" ? "à remplacer" : e.statut === "info" ? "remplacé" : "—"}</Badge>; } },
            { libelle: "Échéance", rendu: (f) => formatDate(etatFiltre(f, donnees.releves).echeanceRemplacement) },
          ]}
          actionsLigne={(f) => <Bouton variante="discret" onClick={() => setReleve(f)}>Relevés Δp</Bouton>}
          vide="Aucun filtre enregistré."
        />
      </Carte>

      {edition && (
        <Modale
          large
          titre="Modifier la CTA"
          onFermer={() => setEdition(null)}
          pied={<><Bouton onClick={() => setEdition(null)}>Annuler</Bouton><Bouton variante="principal" disabled={action.enCours || champsManquants(champs, edition).length > 0} onClick={() => void action.executer(async () => {
            const valeurs = Object.fromEntries(champs.map((c) => [c.cle, edition[c.cle]]));
            await s.depot.modifier("ctas", cta.id, valeurs);
            setEdition(null);
            recharger();
          })}>Enregistrer</Bouton></>}
        >
          <MessageErreur erreur={action.erreur} />
          <Formulaire champs={champs} valeurs={edition} onChange={setEdition} />
        </Modale>
      )}
      {releve && <RelevesFiltre filtre={releve} onFermer={() => { setReleve(null); recharger(); }} />}
    </>
  );
}

function RelevesFiltre({ filtre, onFermer }: { filtre: Filtre; onFermer: () => void }) {
  const s = useSession();
  const org = s.org!.id;
  const { donnees, recharger } = useDonnees(() => s.depot.lister("releves_filtres", org, { filtre_id: filtre.id }), [org, filtre.id]);
  const [dp, setDp] = useState<number | null>(null);
  const [date, setDate] = useState(dateHeureLocale());
  const [commentaire, setCommentaire] = useState("");
  const action = useAction();
  const releves = [...(donnees ?? [])].sort((a, b) => b.date_releve.localeCompare(a.date_releve));
  const etat = etatFiltre(filtre, releves);
  const seuils = [
    ...(filtre.dp_initiale_pa != null ? [{ valeur: filtre.dp_initiale_pa, libelle: "Initiale", couleur: "#059669" }] : []),
    ...(filtre.dp_finale_pa != null ? [{ valeur: filtre.dp_finale_pa, libelle: "Colmatage", couleur: "#dc2626" }] : []),
  ];
  return (
    <Modale large titre={`Pertes de charge — filtre ${filtre.repere || filtre.classe}`} onFermer={onFermer}>
      <MessageErreur erreur={action.erreur} />
      <Bandeau ton={TON_STATUT[etat.statut] === "neutre" ? "info" : TON_STATUT[etat.statut]}>{etat.message}</Bandeau>
      <div className="my-3">
        <Courbe unite="Pa" seuils={seuils} series={[{ nom: "Δp", couleur: "#17355f", points: releves.map((r) => ({ date: r.date_releve, valeur: r.dp_pa, info: r.commentaire })) }]} />
      </div>
      {s.peut("cta", 2) && (
        <div className="mb-3 grid gap-2 rounded-lg bg-fond p-3 md:grid-cols-[160px_200px_1fr_auto] md:items-end">
          <label className="text-xs font-semibold text-texte-2">Δp (Pa)<SaisieNombre aria-label="Perte de charge" valeur={dp} onChange={setDp} /></label>
          <label className="text-xs font-semibold text-texte-2">Date<Saisie type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="text-xs font-semibold text-texte-2">Commentaire<Saisie value={commentaire} onChange={(e) => setCommentaire(e.target.value)} /></label>
          <Bouton variante="principal" disabled={dp == null || action.enCours} onClick={() => void action.executer(async () => {
            await s.depot.creer("releves_filtres", { org_id: org, filtre_id: filtre.id, dp_pa: dp!, date_releve: new Date(date).toISOString(), commentaire });
            setDp(null); setCommentaire(""); recharger();
          })}>Enregistrer le relevé</Bouton>
        </div>
      )}
      <TableauDefilant>
        <table className="tableau">
          <thead><tr><th>Date</th><th className="nombre">Δp</th><th>Commentaire</th></tr></thead>
          <tbody>{releves.map((r) => <tr key={r.id}><td>{formatDate(r.date_releve, true)}</td><td className="nombre">{r.dp_pa} Pa</td><td>{r.commentaire}</td></tr>)}</tbody>
        </table>
      </TableauDefilant>
    </Modale>
  );
}

const CLE_PRIX = "salles-propres:prix-kwh";

function CarteEnergie({ cta }: { cta: Cta }) {
  const [prix, setPrix] = useState<number | null>(() => {
    try { const v = localStorage.getItem(CLE_PRIX); return v ? Number(v) : 0.2; } catch { return 0.2; }
  });
  const bilan = energieCta(cta, prix);
  const majPrix = (v: number | null) => { setPrix(v); try { if (v != null) localStorage.setItem(CLE_PRIX, String(v)); } catch { /* stockage indisponible */ } };
  return (
    <Carte titre="Énergie de ventilation (estimation)" className="mb-4">
      {!bilan ? <p className="text-sm text-texte-2">Renseignez la puissance du ventilateur et les heures de fonctionnement (bouton Modifier) pour estimer la consommation.</p> : (
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_160px] md:items-end">
          <div><div className="text-xs text-texte-2">Consommation annuelle</div><div className="text-xl font-bold text-navy-900">{formatNombre(bilan.kwhAn)} kWh</div>{bilan.coutAn != null && <div className="text-sm">≈ {formatNombre(bilan.coutAn)} €/an</div>}</div>
          <div><div className="text-xs text-texte-2">Sans débit réduit</div><div className="text-lg font-semibold">{formatNombre(bilan.kwhAnSansReduit)} kWh</div></div>
          <div><div className="text-xs text-texte-2">Gain du mode réduit</div><div className="text-lg font-semibold text-emerald-700">{formatNombre(bilan.economieKwh)} kWh{bilan.economieCout != null && ` · ${formatNombre(bilan.economieCout)} €`}</div></div>
          <Champ libelle="Prix (€/kWh)"><SaisieNombre valeur={prix} onChange={majPrix} /></Champ>
          <p className="text-xs text-texte-2 md:col-span-4">Ventilateurs seuls, loi de similitude (P ∝ Q³) au débit réduit, plancher de 20 % pour les pertes moteur et variateur. Le mode réduit hors activité doit être validé : retour à la classe au repos dans le temps de récupération mesuré.</p>
        </div>
      )}
    </Carte>
  );
}
