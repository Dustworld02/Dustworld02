import { useMemo, useState } from "react";
import { useSession } from "../session";
import type { GrandeurAmbiance, Nouveau, Zone } from "../data/types";
import { Badge, Bandeau, Bouton, Carte, Champ, Liste, MessageErreur, Modale, Saisie, SaisieNombre, TableauDefilant, Vide, dateHeureLocale, formatDate, useAction, useDonnees } from "../ui/composants";
import { Courbe, type Seuil } from "../ui/graphique";
import { GRANDEURS, grandeurDepuisTexte, horsLimites, limitesAmbiance } from "../domain/surveillance";
import { dateFr, lireCsv, nombreFr } from "../domain/contamination";
import { formatNombre } from "../domain/exigencesZone";

/**
 * Relevés d'ambiance des zones (pression différentielle, température,
 * humidité) : saisie, import des exports de GTC, évolution et dépassements.
 */
export function AmbianceZones() {
  const s = useSession();
  const org = s.org!.id;
  const { donnees, erreur, recharger } = useDonnees(async () => {
    const [salles, zones, releves] = await Promise.all([s.depot.lister("salles_propres", org), s.depot.lister("zones", org), s.depot.lister("releves_ambiance", org)]);
    return { salles, zones, releves };
  }, [org]);
  const [salle, setSalle] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [grandeur, setGrandeur] = useState<GrandeurAmbiance>("pression");
  const [jours, setJours] = useState(30);
  const [importer, setImporter] = useState(false);
  const [valeur, setValeur] = useState<number | null>(null);
  const [date, setDate] = useState(dateHeureLocale());
  const action = useAction();
  const salleId = salle || donnees?.salles[0]?.id || "";
  const zones = (donnees?.zones ?? []).filter((z) => z.salle_id === salleId).sort((a, b) => a.code.localeCompare(b.code));
  const zone = zones.find((z) => z.id === zoneId) ?? zones[0];
  const depuis = new Date(Date.now() - jours * 86400000).toISOString();
  const releves = useMemo(() => (donnees?.releves ?? []).filter((r) => r.zone_id === zone?.id && r.grandeur === grandeur && r.date_mesure >= depuis).sort((a, b) => a.date_mesure.localeCompare(b.date_mesure)), [donnees, zone, grandeur, depuis]);
  if (!donnees) return <MessageErreur erreur={erreur} />;
  if (!donnees.salles.length) return <Vide>Aucune salle propre.</Vide>;
  const lim = zone ? limitesAmbiance(zone, grandeur) : { min: null, max: null };
  const seuils: Seuil[] = [...(lim.min != null ? [{ valeur: lim.min, libelle: "Min", couleur: "#dc2626" }] : []), ...(lim.max != null ? [{ valeur: lim.max, libelle: "Max", couleur: "#dc2626" }] : [])];
  const hors = zone ? releves.filter((r) => horsLimites(zone, grandeur, r.valeur)) : [];
  const unite = GRANDEURS[grandeur].unite;
  const ecriture = s.peut("cta", 2);

  // Synthèse de toutes les zones de la salle sur la période.
  const synthese = zones.map((z) => {
    const parGrandeur = (Object.keys(GRANDEURS) as GrandeurAmbiance[]).map((g) => {
      const l = donnees.releves.filter((r) => r.zone_id === z.id && r.grandeur === g && r.date_mesure >= depuis);
      return { g, n: l.length, hors: l.filter((r) => horsLimites(z, g, r.valeur)).length, dernier: l.sort((a, b) => b.date_mesure.localeCompare(a.date_mesure))[0] };
    });
    return { z, parGrandeur };
  });

  return (
    <div className="grid gap-4">
      <MessageErreur erreur={erreur ?? action.erreur} />
      <div className="flex flex-wrap items-end gap-3">
        <Champ libelle="Salle propre"><Liste value={salleId} onChange={(e) => { setSalle(e.target.value); setZoneId(""); }}>{donnees.salles.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</Liste></Champ>
        <Champ libelle="Période"><Liste value={jours} onChange={(e) => setJours(Number(e.target.value))}>{[7, 30, 90, 365].map((n) => <option key={n} value={n}>{n} derniers jours</option>)}</Liste></Champ>
        {ecriture && <Bouton className="ml-auto" onClick={() => setImporter(true)}>Importer un export GTC (CSV)</Bouton>}
      </div>
      <Carte titre="Synthèse des zones">
        {zones.length === 0 ? <Vide>Aucune zone.</Vide> : (
          <TableauDefilant>
            <table className="tableau">
              <thead><tr><th>Zone</th>{(Object.keys(GRANDEURS) as GrandeurAmbiance[]).map((g) => <th key={g}>{GRANDEURS[g].libelle}</th>)}</tr></thead>
              <tbody>{synthese.map(({ z, parGrandeur }) => (
                <tr key={z.id} className="cursor-pointer" onClick={() => setZoneId(z.id)}>
                  <td><strong>{z.code}</strong> {z.nom}</td>
                  {parGrandeur.map((x) => (
                    <td key={x.g}>
                      {x.n === 0 ? <span className="text-texte-2">—</span> : <>
                        {formatNombre(x.dernier?.valeur)} {GRANDEURS[x.g].unite} <Badge ton={x.hors ? "alerte" : "ok"}>{x.hors ? `${x.hors}/${x.n} hors limites` : `${x.n} conformes`}</Badge>
                      </>}
                    </td>
                  ))}
                </tr>
              ))}</tbody>
            </table>
          </TableauDefilant>
        )}
      </Carte>
      {zone && (
        <Carte titre={`${zone.code} ${zone.nom}`} actions={
          <Liste aria-label="Grandeur" className="!w-56" value={grandeur} onChange={(e) => setGrandeur(e.target.value as GrandeurAmbiance)}>
            {(Object.keys(GRANDEURS) as GrandeurAmbiance[]).map((g) => <option key={g} value={g}>{GRANDEURS[g].libelle}</option>)}
          </Liste>
        }>
          <p className="mb-2 text-sm text-texte-2">
            Limites : {lim.min != null || lim.max != null ? `${formatNombre(lim.min)} à ${formatNombre(lim.max)} ${unite}` : "non définies pour cette zone (fiche de la zone)"} · {releves.length} relevé(s), {hors.length} hors limites.
          </p>
          <Courbe unite={unite} seuils={seuils} series={[{ nom: GRANDEURS[grandeur].libelle, couleur: "#17355f", points: releves.map((r) => ({ date: r.date_mesure, valeur: r.valeur, couleur: horsLimites(zone, grandeur, r.valeur) ? "#dc2626" : undefined })) }]} />
          {ecriture && (
            <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-fond p-3">
              <Champ libelle={`Valeur (${unite})`}><SaisieNombre valeur={valeur} onChange={setValeur} /></Champ>
              <Champ libelle="Date et heure"><Saisie type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} /></Champ>
              <Bouton variante="principal" disabled={valeur == null || action.enCours} onClick={() => void action.executer(async () => {
                await s.depot.creer("releves_ambiance", { org_id: org, zone_id: zone.id, grandeur, valeur: valeur!, date_mesure: new Date(date).toISOString() });
                setValeur(null); recharger();
              })}>Enregistrer le relevé</Bouton>
            </div>
          )}
          {hors.length > 0 && (
            <div className="mt-3">
              <Bandeau ton="alerte">{hors.length} relevé(s) hors limites sur la période. Une excursion de pression prolongée doit faire l'objet d'un écart avec évaluation de l'impact produit.</Bandeau>
            </div>
          )}
        </Carte>
      )}
      {importer && <ImportAmbiance zones={donnees.zones} salleId={salleId} existants={new Set(donnees.releves.map((r) => `${r.zone_id}|${r.grandeur}|${r.date_mesure}`))} onFermer={(ok) => { setImporter(false); if (ok) recharger(); }} />}
    </div>
  );
}

function ImportAmbiance({ zones, salleId, existants, onFermer }: { zones: Zone[]; salleId: string; existants: Set<string>; onFermer: (ok: boolean) => void }) {
  const s = useSession();
  const [lignes, setLignes] = useState<Record<string, string>[]>([]);
  const action = useAction();
  const zonesSalle = zones.filter((z) => z.salle_id === salleId);
  const analyse = lignes.flatMap((l, i) => {
    const date = dateFr(l.date ?? l.horodatage ?? "");
    const zone = zonesSalle.find((z) => z.code.toLowerCase() === (l.zone ?? "").toLowerCase() || z.nom.toLowerCase() === (l.zone ?? "").toLowerCase());
    // Format long (date ; zone ; grandeur ; valeur) ou large (date ; zone ; pression ; temperature ; hr).
    const valeurs: [GrandeurAmbiance | null, number | null][] = l.grandeur != null
      ? [[grandeurDepuisTexte(l.grandeur), nombreFr(l.valeur)]]
      : (["pression", "temperature", "hr"] as const).filter((g) => l[g] != null && l[g] !== "").map((g) => [g, nombreFr(l[g])]);
    return valeurs.map(([g, v]) => {
      const erreurs: string[] = [];
      if (!date) erreurs.push("date illisible");
      if (!zone) erreurs.push(`zone « ${l.zone ?? ""} » inconnue`);
      if (!g) erreurs.push("grandeur inconnue");
      if (v == null) erreurs.push("valeur illisible");
      const doublon = !!(date && zone && g && existants.has(`${zone.id}|${g}|${date}`));
      return { n: i + 2, date, zone, g, v, erreurs, doublon };
    });
  });
  const valides = analyse.filter((a) => a.erreurs.length === 0 && !a.doublon);
  return (
    <Modale large titre="Importer des relevés d'ambiance" onFermer={() => onFermer(false)} pied={<>
      <Bouton onClick={() => onFermer(false)}>Annuler</Bouton>
      <Bouton variante="principal" disabled={action.enCours || valides.length === 0} onClick={() => void action.executer(async () => {
        const nouveaux: Nouveau<"releves_ambiance">[] = valides.map((a) => ({ org_id: s.org!.id, zone_id: a.zone!.id, grandeur: a.g!, valeur: a.v!, date_mesure: a.date!, source: "gtc" }));
        for (let i = 0; i < nouveaux.length; i += 500) await s.depot.creerPlusieurs("releves_ambiance", nouveaux.slice(i, i + 500));
        onFermer(true);
      })}>Importer {valides.length} relevé(s)</Bouton>
    </>}>
      <MessageErreur erreur={action.erreur} />
      <Bandeau>
        Colonnes reconnues (séparateur « ; » ou « , ») : <code>date</code>, <code>zone</code> (code ou nom) puis soit <code>grandeur</code> + <code>valeur</code>, soit une colonne par grandeur : <code>pression</code>, <code>temperature</code>, <code>hr</code>.
        Les relevés déjà présents (même zone, grandeur et horodatage) sont ignorés. Pour un export de GTC à la minute, agrégez d'abord à l'heure : la tendance reste lisible et la base ne grossit pas inutilement.
      </Bandeau>
      <input type="file" accept=".csv,text/csv,text/plain" className="my-3 text-sm" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setLignes(lireCsv(await f.text())); }} />
      {analyse.length > 0 && (
        <TableauDefilant>
          <table className="tableau">
            <thead><tr><th>Ligne</th><th>Date</th><th>Zone</th><th>Grandeur</th><th className="nombre">Valeur</th><th>Contrôle</th></tr></thead>
            <tbody>{analyse.slice(0, 200).map((a, k) => (
              <tr key={k}><td>{a.n}</td><td>{a.date ? formatDate(a.date, true) : "—"}</td><td>{a.zone?.code ?? "—"}</td><td>{a.g ? GRANDEURS[a.g].libelle : "—"}</td><td className="nombre">{a.v ?? "—"}</td>
                <td>{a.erreurs.length ? <Badge ton="alerte">{a.erreurs.join(", ")}</Badge> : a.doublon ? <Badge>déjà importé</Badge> : <Badge ton="ok">OK</Badge>}</td></tr>
            ))}</tbody>
          </table>
        </TableauDefilant>
      )}
    </Modale>
  );
}
