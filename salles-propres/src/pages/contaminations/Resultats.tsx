import { useMemo, useState } from "react";
import { useSession } from "../../session";
import type { EtatOccupation, Instrument, Etalonnage, PlanEchantillonnage, PointPrelevement, Resultat, SallePropre, Zone, Nouveau } from "../../data/types";
import { Badge, Bandeau, Bouton, Champ, Liste, MessageErreur, Modale, Saisie, SaisieNombre, TableauDefilant, Vide, ZoneTexte, dateHeureLocale, formatDate, telechargerFichier, useAction } from "../../ui/composants";
import { versCsv } from "../../domain/csv";
import {
  LIBELLES_MILIEUX, LIBELLES_NATURES, LIBELLES_ORIGINES, LIBELLES_VERDICTS, PARAMETRES, TON_VERDICT, dateFr, limitesSuggerees, lireCsv, nombreFr, type Parametre,
} from "../../domain/contamination";
import { instrumentValideLe, verdictResultat } from "../../domain/mesures";
import { LIBELLES_ETATS } from "../../domain/qualification";
import { formatNombre } from "../../domain/exigencesZone";

export interface DonneesContamination {
  salles: SallePropre[];
  zones: Zone[];
  points: PointPrelevement[];
  resultats: Resultat[];
  instruments: Instrument[];
  etalonnages: Etalonnage[];
  plans: PlanEchantillonnage[];
}

export function libellePoint(r: Resultat, points: PointPrelevement[]): string {
  return r.point_id ? points.find((p) => p.id === r.point_id)?.code ?? "?" : r.point_libre || "—";
}

/** Liste filtrable des résultats de l'entrepôt. */
export function ListeResultats({ d, recharger, salleFixe }: { d: DonneesContamination; recharger: () => void; salleFixe?: string }) {
  const s = useSession();
  const [filtres, setFiltres] = useState({ salle: salleFixe ?? "", zone: "", milieu: "", nature: "", origine: "", verdict: "", du: "", au: "" });
  const [saisie, setSaisie] = useState(false);
  const [importer, setImporter] = useState(false);
  const ecriture = s.peut("contamination_resultats", 2);
  const liste = useMemo(() => d.resultats
    .filter((r) => !filtres.salle || r.salle_id === filtres.salle)
    .filter((r) => !filtres.zone || r.zone_id === filtres.zone)
    .filter((r) => !filtres.milieu || r.milieu === filtres.milieu)
    .filter((r) => !filtres.nature || r.nature === filtres.nature)
    .filter((r) => !filtres.origine || r.origine === filtres.origine)
    .filter((r) => !filtres.verdict || r.verdict === filtres.verdict)
    .filter((r) => !filtres.du || r.date_prelevement.slice(0, 10) >= filtres.du)
    .filter((r) => !filtres.au || r.date_prelevement.slice(0, 10) <= filtres.au)
    .sort((a, b) => b.date_prelevement.localeCompare(a.date_prelevement)), [d.resultats, filtres]);
  const f = (cle: keyof typeof filtres, v: string) => setFiltres({ ...filtres, [cle]: v, ...(cle === "salle" ? { zone: "" } : {}) });
  const nom = (id: string | null, l: { id: string; nom: string }[]) => l.find((x) => x.id === id)?.nom ?? "—";
  const compte = (v: string) => liste.filter((r) => r.verdict === v).length;

  return (
    <div>
      <div className="mb-3 grid gap-2 md:grid-cols-4 xl:grid-cols-8">
        {!salleFixe && <Liste aria-label="Salle" value={filtres.salle} onChange={(e) => f("salle", e.target.value)}><option value="">Toutes les salles</option>{d.salles.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</Liste>}
        <Liste aria-label="Zone" value={filtres.zone} onChange={(e) => f("zone", e.target.value)}><option value="">Toutes les zones</option>{d.zones.filter((z) => !filtres.salle || z.salle_id === filtres.salle).map((z) => <option key={z.id} value={z.id}>{z.code} {z.nom}</option>)}</Liste>
        <Liste aria-label="Milieu" value={filtres.milieu} onChange={(e) => f("milieu", e.target.value)}><option value="">Tous milieux</option>{Object.entries(LIBELLES_MILIEUX).map(([c, l]) => <option key={c} value={c}>{l}</option>)}</Liste>
        <Liste aria-label="Nature" value={filtres.nature} onChange={(e) => f("nature", e.target.value)}><option value="">Toutes natures</option>{Object.entries(LIBELLES_NATURES).map(([c, l]) => <option key={c} value={c}>{l}</option>)}</Liste>
        <Liste aria-label="Origine" value={filtres.origine} onChange={(e) => f("origine", e.target.value)}><option value="">Toutes origines</option>{Object.entries(LIBELLES_ORIGINES).map(([c, l]) => <option key={c} value={c}>{l}</option>)}</Liste>
        <Liste aria-label="Verdict" value={filtres.verdict} onChange={(e) => f("verdict", e.target.value)}><option value="">Tous verdicts</option>{Object.entries(LIBELLES_VERDICTS).map(([c, l]) => <option key={c} value={c}>{l}</option>)}</Liste>
        <Saisie type="date" aria-label="Du" value={filtres.du} onChange={(e) => f("du", e.target.value)} />
        <Saisie type="date" aria-label="Au" value={filtres.au} onChange={(e) => f("au", e.target.value)} />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span>{liste.length} résultat(s)</span>
        <Badge ton="ok">{compte("conforme")} conforme(s)</Badge>
        <Badge ton="attention">{compte("alerte")} alerte(s)</Badge>
        <Badge ton="alerte">{compte("action")} action(s)</Badge>
        <span className="ml-auto flex gap-2">
          <Bouton onClick={() => telechargerFichier(`resultats-${new Date().toISOString().slice(0, 10)}.csv`, versCsv(
            ["Date", "Salle", "Zone", "Point", "Milieu", "Nature", "Paramètre", "Valeur", "Unité", "Limite d'alerte", "Limite d'action", "Verdict", "Origine", "État", "Opérateur", "Lot de milieu", "Germe", "Commentaire"],
            liste.map((r) => [r.date_prelevement, nom(r.salle_id, d.salles), d.zones.find((z) => z.id === r.zone_id)?.code ?? "", libellePoint(r, d.points), LIBELLES_MILIEUX[r.milieu], LIBELLES_NATURES[r.nature],
              r.parametre, r.valeur, r.unite, r.limite_alerte, r.limite_action, LIBELLES_VERDICTS[r.verdict], LIBELLES_ORIGINES[r.origine], r.etat_occupation, r.operateur, r.lot_milieu, r.germe, r.commentaire]),
          ), "text/csv")}>Exporter (CSV)</Bouton>
          {ecriture && <Bouton onClick={() => setImporter(true)}>Importer un fichier CSV</Bouton>}
          {ecriture && <Bouton variante="principal" onClick={() => setSaisie(true)}>+ Saisir un résultat</Bouton>}
        </span>
      </div>
      {liste.length === 0 ? <Vide>Aucun résultat pour ces critères.</Vide> : (
        <TableauDefilant>
          <table className="tableau bg-white">
            <thead><tr><th>Date</th><th>Lieu</th><th>Mesure</th><th className="nombre">Valeur</th><th className="nombre">Alerte / action</th><th>Verdict</th><th>Origine</th></tr></thead>
            <tbody>
              {liste.slice(0, 300).map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{formatDate(r.date_prelevement, true)}</td>
                  <td>{nom(r.salle_id, d.salles)}<div className="text-xs text-texte-2">{d.zones.find((z) => z.id === r.zone_id)?.nom ?? "—"} · point {libellePoint(r, d.points)}</div></td>
                  <td>{r.parametre || r.methode}<div className="text-xs text-texte-2">{LIBELLES_MILIEUX[r.milieu]} · {LIBELLES_NATURES[r.nature]}{r.etat_occupation && ` · ${LIBELLES_ETATS[r.etat_occupation]}`}{r.germe && ` · ${r.germe}`}</div></td>
                  <td className="nombre whitespace-nowrap">{formatNombre(r.valeur)} <span className="text-xs text-texte-2">{r.unite}</span></td>
                  <td className="nombre whitespace-nowrap text-xs">{formatNombre(r.limite_alerte)} / {formatNombre(r.limite_action)}</td>
                  <td><Badge ton={TON_VERDICT[r.verdict]}>{LIBELLES_VERDICTS[r.verdict]}</Badge></td>
                  <td className="text-xs">{LIBELLES_ORIGINES[r.origine]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableauDefilant>
      )}
      {liste.length > 300 && <p className="mt-2 text-xs text-texte-2">Seuls les 300 plus récents sont affichés : affinez les filtres.</p>}
      {saisie && <SaisieResultat d={d} salleParDefaut={filtres.salle || salleFixe || d.salles[0]?.id} onFermer={(ok) => { setSaisie(false); if (ok) recharger(); }} />}
      {importer && <ImportResultats d={d} salleParDefaut={filtres.salle || salleFixe || d.salles[0]?.id} onFermer={(ok) => { setImporter(false); if (ok) recharger(); }} />}
    </div>
  );
}

export function ChoixInstrument({ instruments, etalonnages, date, valeur, onChange, id }: { instruments: Instrument[]; etalonnages: Etalonnage[]; date: string; valeur: string | null; onChange: (id: string | null) => void; id?: string }) {
  const valides = instruments.filter((i) => instrumentValideLe(i, etalonnages, date));
  const invalides = instruments.filter((i) => !valides.includes(i));
  return (
    <Liste id={id} value={valeur ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">— Aucun —</option>
      {valides.map((i) => <option key={i.id} value={i.id}>{i.libelle}{i.numero_serie && ` (n° ${i.numero_serie})`}</option>)}
      {invalides.length > 0 && <optgroup label="Non étalonnés à cette date">{invalides.map((i) => <option key={i.id} value={i.id} disabled>{i.libelle}</option>)}</optgroup>}
    </Liste>
  );
}

/** Clé du paramètre usuel correspondant à un libellé enregistré. */
export function cleParametre(libelle: string): string | undefined {
  return PARAMETRES.find((x) => x.libelle === libelle || x.cle === libelle)?.cle;
}

export function SaisieResultat({ d, salleParDefaut, plan, onFermer }: { d: DonneesContamination; salleParDefaut?: string; plan?: PlanEchantillonnage; onFermer: (ok: boolean) => void }) {
  const s = useSession();
  const [v, setV] = useState({
    salle_id: plan?.salle_id ?? salleParDefaut ?? "", zone_id: plan?.zone_id ?? "", point_id: plan?.point_id ?? "", point_libre: "",
    parametre: (plan && cleParametre(plan.parametre)) ?? "air_p05", etat: (plan?.etat_occupation ?? "activite") as EtatOccupation,
    date: dateHeureLocale(), valeur: null as number | null, alerte: plan?.limite_alerte ?? null as number | null, action: plan?.limite_action ?? null as number | null,
    instrument_id: null as string | null, operateur: s.utilisateur?.nom_complet ?? "", lot_milieu: "", germe: "", origine: "surveillance", commentaire: "",
  });
  const action = useAction();
  const p = PARAMETRES.find((x) => x.cle === v.parametre)!;
  const zone = d.zones.find((z) => z.id === v.zone_id) ?? null;
  const suggestion = limitesSuggerees(p, zone, v.etat);
  const maj = (champ: Partial<typeof v>) => {
    const n = { ...v, ...champ };
    if ("zone_id" in champ || "parametre" in champ || "etat" in champ) {
      const sug = limitesSuggerees(PARAMETRES.find((x) => x.cle === n.parametre)!, d.zones.find((z) => z.id === n.zone_id) ?? null, n.etat);
      n.alerte = sug.alerte;
      n.action = sug.action;
    }
    if ("point_id" in champ && champ.point_id) n.zone_id = d.points.find((x) => x.id === champ.point_id)?.zone_id ?? n.zone_id;
    setV(n);
  };
  const dateIso = new Date(v.date).toISOString();
  const points = d.points.filter((x) => x.salle_id === v.salle_id && (!v.zone_id || x.zone_id === v.zone_id));

  const enregistrer = () => action.executer(async () => {
    await s.depot.creer("resultats", {
      org_id: s.org!.id, salle_id: v.salle_id, zone_id: v.zone_id || null, point_id: v.point_id || null, point_libre: v.point_id ? "" : v.point_libre,
      origine: v.origine as Resultat["origine"], milieu: p.milieu, nature: p.nature, methode: p.methode, parametre: p.libelle, taille_um: p.taille_um ?? null,
      unite: p.unite, valeur: v.valeur!, etat_occupation: v.etat, instrument_id: v.instrument_id, date_prelevement: dateIso, operateur: v.operateur,
      lot_milieu: p.nature === "microbiologique" ? v.lot_milieu : "", germe: p.nature === "microbiologique" ? v.germe : "",
      limite_alerte: v.alerte, limite_action: v.action, commentaire: v.commentaire, plan_id: plan?.id ?? null,
    });
    onFermer(true);
  });

  const groupes = new Map<string, Parametre[]>();
  for (const x of PARAMETRES) groupes.set(`${LIBELLES_MILIEUX[x.milieu]} — ${LIBELLES_NATURES[x.nature]}`, [...(groupes.get(`${LIBELLES_MILIEUX[x.milieu]} — ${LIBELLES_NATURES[x.nature]}`) ?? []), x]);
  const verdict = v.valeur != null ? verdictResultat(v.valeur, v.alerte, v.action) : null;

  return (
    <Modale
      large
      titre={plan ? `Saisir un résultat — ${plan.parametre}` : "Saisir un résultat"}
      onFermer={() => onFermer(false)}
      pied={<>
        {verdict && <span className="mr-auto">Verdict : <Badge ton={TON_VERDICT[verdict]}>{LIBELLES_VERDICTS[verdict]}</Badge></span>}
        <Bouton onClick={() => onFermer(false)}>Annuler</Bouton>
        <Bouton variante="principal" disabled={action.enCours || v.valeur == null || !v.salle_id} onClick={() => void enregistrer()}>Enregistrer</Bouton>
      </>}
    >
      <MessageErreur erreur={action.erreur} />
      <div className="grid gap-3 md:grid-cols-3">
        <Champ libelle="Salle propre"><Liste value={v.salle_id} onChange={(e) => maj({ salle_id: e.target.value, zone_id: "", point_id: "" })}>{d.salles.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</Liste></Champ>
        <Champ libelle="Zone"><Liste value={v.zone_id} onChange={(e) => maj({ zone_id: e.target.value, point_id: "" })}><option value="">—</option>{d.zones.filter((z) => z.salle_id === v.salle_id).map((z) => <option key={z.id} value={z.id}>{z.code} {z.nom}</option>)}</Liste></Champ>
        <Champ libelle="Point de prélèvement">
          <Liste value={v.point_id} onChange={(e) => maj({ point_id: e.target.value })}><option value="">Point hors plan…</option>{points.map((x) => <option key={x.id} value={x.id}>{x.code}{x.description && ` — ${x.description}`}</option>)}</Liste>
        </Champ>
        {!v.point_id && <Champ libelle="Repère du point (hors plan)"><Saisie value={v.point_libre} onChange={(e) => maj({ point_libre: e.target.value })} /></Champ>}
        <Champ libelle="Paramètre mesuré" className="md:col-span-2">
          <Liste value={v.parametre} onChange={(e) => maj({ parametre: e.target.value })}>
            {[...groupes.entries()].map(([g, l]) => <optgroup key={g} label={g}>{l.map((x) => <option key={x.cle} value={x.cle}>{x.libelle} ({x.unite})</option>)}</optgroup>)}
          </Liste>
        </Champ>
        <Champ libelle="État d'occupation"><Liste value={v.etat} onChange={(e) => maj({ etat: e.target.value as EtatOccupation })}>{Object.entries(LIBELLES_ETATS).map(([c, l]) => <option key={c} value={c}>{l}</option>)}</Liste></Champ>
        <Champ libelle="Date et heure du prélèvement"><Saisie type="datetime-local" value={v.date} onChange={(e) => maj({ date: e.target.value })} /></Champ>
        <Champ libelle={`Valeur (${p.unite})`}><SaisieNombre autoFocus valeur={v.valeur} onChange={(n) => maj({ valeur: n })} /></Champ>
        <Champ libelle="Origine"><Liste value={v.origine} onChange={(e) => maj({ origine: e.target.value })}>{Object.entries(LIBELLES_ORIGINES).filter(([c]) => c !== "qualification").map(([c, l]) => <option key={c} value={c}>{l}</option>)}</Liste></Champ>
        <Champ libelle="Limite d'alerte"><SaisieNombre valeur={v.alerte} onChange={(n) => maj({ alerte: n })} /></Champ>
        <Champ libelle="Limite d'action" aide={suggestion.source ? `Proposée : ${suggestion.source}` : undefined}><SaisieNombre valeur={v.action} onChange={(n) => maj({ action: n })} /></Champ>
        <Champ libelle="Instrument"><ChoixInstrument instruments={d.instruments} etalonnages={d.etalonnages} date={dateIso} valeur={v.instrument_id} onChange={(id) => maj({ instrument_id: id })} /></Champ>
        <Champ libelle="Opérateur"><Saisie value={v.operateur} onChange={(e) => maj({ operateur: e.target.value })} /></Champ>
        {p.nature === "microbiologique" && <>
          <Champ libelle="Lot de milieu de culture"><Saisie value={v.lot_milieu} onChange={(e) => maj({ lot_milieu: e.target.value })} /></Champ>
          <Champ libelle="Germe identifié"><Saisie value={v.germe} onChange={(e) => maj({ germe: e.target.value })} placeholder="ex. Staphylococcus epidermidis" /></Champ>
        </>}
        <Champ libelle="Commentaire" className="md:col-span-3"><ZoneTexte value={v.commentaire} onChange={(e) => maj({ commentaire: e.target.value })} /></Champ>
      </div>
    </Modale>
  );
}

function ImportResultats({ d, salleParDefaut, onFermer }: { d: DonneesContamination; salleParDefaut?: string; onFermer: (ok: boolean) => void }) {
  const s = useSession();
  const [salle, setSalle] = useState(salleParDefaut ?? "");
  const [etat, setEtat] = useState<EtatOccupation>("activite");
  const [origine, setOrigine] = useState("surveillance");
  const [instrument, setInstrument] = useState<string | null>(null);
  const [lignes, setLignes] = useState<Record<string, string>[]>([]);
  const action = useAction();

  const analyse = lignes.map((l, i) => {
    const erreurs: string[] = [];
    const date = dateFr(l.date ?? "");
    if (!date) erreurs.push("date illisible");
    const valeur = nombreFr(l.valeur);
    if (valeur == null) erreurs.push("valeur illisible");
    const taille = nombreFr(l.taille_um ?? l.taille);
    const param = l.parametre ? PARAMETRES.find((p) => p.cle === l.parametre || p.libelle.toLowerCase() === l.parametre.toLowerCase()) : PARAMETRES.find((p) => p.taille_um === taille && p.milieu === "air");
    if (!param) erreurs.push(l.parametre ? `paramètre inconnu « ${l.parametre} »` : "taille ou paramètre manquant");
    const point = d.points.find((p) => p.salle_id === salle && p.code.toLowerCase() === (l.point ?? "").toLowerCase());
    const zone = point ? d.zones.find((z) => z.id === point.zone_id) ?? null : d.zones.find((z) => z.salle_id === salle && (z.code === l.zone || z.nom === l.zone)) ?? null;
    const sug = param ? limitesSuggerees(param, zone, etat) : { alerte: null, action: null };
    const alerte = nombreFr(l.limite_alerte) ?? sug.alerte;
    const act = nombreFr(l.limite_action) ?? sug.action;
    if (instrument && date && !instrumentValideLe(d.instruments.find((x) => x.id === instrument)!, d.etalonnages, date)) erreurs.push("instrument non étalonné à cette date");
    return { n: i + 2, l, erreurs, date, valeur, param, point, zone, alerte, act };
  });
  const valides = analyse.filter((a) => a.erreurs.length === 0);

  const importer = () => action.executer(async () => {
    const lignesNouvelles: Nouveau<"resultats">[] = valides.map((a) => ({
      org_id: s.org!.id, salle_id: salle, zone_id: a.zone?.id ?? null, point_id: a.point?.id ?? null, point_libre: a.point ? "" : a.l.point ?? "",
      origine: origine as Resultat["origine"], milieu: a.param!.milieu, nature: a.param!.nature, methode: a.param!.methode, parametre: a.param!.libelle,
      taille_um: a.param!.taille_um ?? null, unite: a.l.unite || a.param!.unite, valeur: a.valeur!, etat_occupation: etat, instrument_id: instrument,
      date_prelevement: a.date!, operateur: a.l.operateur ?? "", germe: a.l.germe ?? "", limite_alerte: a.alerte, limite_action: a.act,
      commentaire: `Import CSV (ligne ${a.n})`,
    }));
    await s.depot.creerPlusieurs("resultats", lignesNouvelles);
    onFermer(true);
  });

  return (
    <Modale
      large
      titre="Importer des résultats (CSV)"
      onFermer={() => onFermer(false)}
      pied={<><Bouton onClick={() => onFermer(false)}>Annuler</Bouton><Bouton variante="principal" disabled={action.enCours || valides.length === 0 || !salle} onClick={() => void importer()}>Importer {valides.length} ligne(s)</Bouton></>}
    >
      <MessageErreur erreur={action.erreur} />
      <Bandeau>
        Colonnes reconnues (séparateur « ; » ou « , ») : <code>date</code>, <code>point</code>, <code>valeur</code> et soit <code>taille_um</code> (export de compteur de particules), soit <code>parametre</code> (clé ou libellé, ex. <code>air_bio</code>, <code>surf_contact</code>, <code>surf_atp</code>).
        Facultatives : <code>zone</code>, <code>unite</code>, <code>limite_alerte</code>, <code>limite_action</code>, <code>germe</code>, <code>operateur</code>. Les limites absentes sont reprises de la classe de la zone. L'import est tout ou rien.
      </Bandeau>
      <div className="my-3 grid gap-3 md:grid-cols-4">
        <Champ libelle="Salle propre"><Liste value={salle} onChange={(e) => setSalle(e.target.value)}>{d.salles.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</Liste></Champ>
        <Champ libelle="État d'occupation"><Liste value={etat} onChange={(e) => setEtat(e.target.value as EtatOccupation)}>{Object.entries(LIBELLES_ETATS).map(([c, l]) => <option key={c} value={c}>{l}</option>)}</Liste></Champ>
        <Champ libelle="Origine"><Liste value={origine} onChange={(e) => setOrigine(e.target.value)}>{Object.entries(LIBELLES_ORIGINES).filter(([c]) => c !== "qualification").map(([c, l]) => <option key={c} value={c}>{l}</option>)}</Liste></Champ>
        <Champ libelle="Instrument"><ChoixInstrument instruments={d.instruments} etalonnages={d.etalonnages} date={valides[0]?.date ?? new Date().toISOString()} valeur={instrument} onChange={setInstrument} /></Champ>
      </div>
      <input type="file" accept=".csv,text/csv,text/plain" className="mb-3 text-sm" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setLignes(lireCsv(await f.text())); }} />
      {analyse.length > 0 && (
        <TableauDefilant>
          <table className="tableau">
            <thead><tr><th>Ligne</th><th>Date</th><th>Point</th><th>Paramètre</th><th className="nombre">Valeur</th><th>Contrôle</th></tr></thead>
            <tbody>{analyse.slice(0, 200).map((a) => (
              <tr key={a.n}>
                <td>{a.n}</td><td>{a.date ? formatDate(a.date, true) : a.l.date}</td>
                <td>{a.l.point}{a.point ? "" : a.l.point ? <span className="text-xs text-texte-2"> (hors plan)</span> : ""}</td>
                <td>{a.param?.libelle ?? a.l.parametre ?? a.l.taille_um}</td><td className="nombre">{a.valeur ?? a.l.valeur}</td>
                <td>{a.erreurs.length ? <Badge ton="alerte">{a.erreurs.join(", ")}</Badge> : <Badge ton="ok">OK</Badge>}</td>
              </tr>
            ))}</tbody>
          </table>
        </TableauDefilant>
      )}
    </Modale>
  );
}
