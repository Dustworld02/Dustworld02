import { useEffect, useMemo, useState } from "react";
import { useSession } from "../../session";
import type { InterventionNettoyage, LotUtilise, Nouveau } from "../../data/types";
import { Badge, Bandeau, Bouton, Champ, Liste, MessageErreur, Modale, Saisie, TableauDefilant, Vide, ZoneTexte, formatDate, useAction } from "../../ui/composants";
import { planifier, LIBELLES_MOMENTS } from "../../domain/nettoyage/planning";
import { SURFACES, TECHNIQUES, type CleSurface } from "../../domain/nettoyage/referentiel";
import { personneHabilitee } from "../../domain/personnel";
import { modifierOuDifferer, operationsEnAttente, synchroniser } from "../../data/fileHorsLigne";
import { nomConsommable, nomProduit, type DonneesNettoyage } from "./donnees";

const STATUTS = { a_faire: "À faire", realisee: "Réalisée", non_realisee: "Non réalisée", reportee: "Reportée" };
const TON = { a_faire: "neutre", realisee: "ok", non_realisee: "alerte", reportee: "attention" } as const;
const COURT: Record<string, string> = {
  points_contact: "Points de contact", surfaces_travail: "Surfaces", equipements_mobilier: "Équipements", sols: "Sols",
  murs_portes: "Murs", plafonds_grilles: "Plafonds", desinfection_complete: "Désinfection complète",
};

function jour(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nomPersonne(d: DonneesNettoyage, id: string | null) {
  const p = d.personnes.find((x) => x.id === id);
  return p ? `${p.prenom} ${p.nom}`.trim() : "—";
}

export function PlanningNettoyage({ d, recharger, salleFixe }: { d: DonneesNettoyage; recharger: () => void; salleFixe?: string }) {
  const s = useSession();
  const [salle, setSalle] = useState(salleFixe ?? d.salles[0]?.id ?? "");
  const [debut, setDebut] = useState(() => { const x = new Date(); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return jour(x); });
  const [semaines, setSemaines] = useState(2);
  const [info, setInfo] = useState<string | null>(null);
  const action = useAction();
  const aujourdhui = jour();
  const fin = jour(new Date(new Date(debut).getTime() + (semaines * 7 - 1) * 86400000));
  const liste = d.interventions.filter((i) => i.salle_id === salle && i.date_prevue >= debut && i.date_prevue <= fin)
    .sort((a, b) => a.date_prevue.localeCompare(b.date_prevue) || a.moment.localeCompare(b.moment));
  const approuvees = d.procedures.filter((p) => p.salle_id === salle && p.categorie === "nettoyage" && p.statut === "approuvee");
  const passees = d.interventions.filter((i) => i.salle_id === salle && i.date_prevue < aujourdhui);
  const taux = passees.length ? Math.round((passees.filter((i) => i.statut === "realisee").length / passees.length) * 100) : null;

  const generer = () => action.executer(async () => {
    const existantes = new Set(d.interventions.map((i) => `${i.procedure_id}|${i.zone_id}|${i.date_prevue}|${i.moment}`));
    const nouvelles: Nouveau<"interventions_nettoyage">[] = [];
    for (const p of approuvees) {
      for (const zoneId of p.zones) {
        const z = d.zones.find((x) => x.id === zoneId);
        if (!z) continue;
        for (const o of planifier(p.contenu, new Date(debut), semaines * 7)) {
          if (existantes.has(`${p.id}|${zoneId}|${o.date}|${o.moment}`)) continue;
          nouvelles.push({ org_id: s.org!.id, salle_id: salle, zone_id: zoneId, procedure_id: p.id, date_prevue: o.date, moment: o.moment, surfaces: o.surfaces, titre: `${z.code} ${z.nom}` });
        }
      }
    }
    if (nouvelles.length) await s.depot.creerPlusieurs("interventions_nettoyage", nouvelles);
    setInfo(nouvelles.length ? `${nouvelles.length} intervention(s) planifiée(s).` : "Le planning de la période est déjà complet.");
    recharger();
  });

  const affecter = (i: InterventionNettoyage, personne: string) => action.executer(async () => { await s.depot.modifier("interventions_nettoyage", i.id, { personne_id: personne || null }); recharger(); });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        {!salleFixe && <Champ libelle="Salle propre"><Liste value={salle} onChange={(e) => setSalle(e.target.value)}>{d.salles.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</Liste></Champ>}
        <Champ libelle="À partir du"><Saisie type="date" value={debut} onChange={(e) => setDebut(e.target.value)} /></Champ>
        <Champ libelle="Période"><Liste value={semaines} onChange={(e) => setSemaines(Number(e.target.value))}>{[1, 2, 4, 8].map((n) => <option key={n} value={n}>{n} semaine(s)</option>)}</Liste></Champ>
        {s.peut("nettoyage_execution", 2) && <Bouton variante="principal" disabled={action.enCours || approuvees.length === 0} onClick={() => void generer()}>Générer le planning de la période</Bouton>}
        {taux != null && <span className="ml-auto text-sm">Réalisation sur les jours passés : <Badge ton={taux >= 95 ? "ok" : taux >= 80 ? "attention" : "alerte"}>{taux} %</Badge></span>}
      </div>
      {approuvees.length === 0 && <Bandeau ton="attention">Aucune procédure approuvée pour cette salle : le planning se génère à partir des procédures approuvées.</Bandeau>}
      <MessageErreur erreur={action.erreur} />
      {info && <div className="mb-3"><Bandeau ton="ok">{info}</Bandeau></div>}
      {liste.length === 0 ? <Vide>Aucune intervention sur la période.</Vide> : (
        <TableauDefilant>
          <table className="tableau bg-white">
            <thead><tr><th>Date</th><th>Moment</th><th>Zone</th><th>Surfaces</th><th>Intervenant</th><th>Statut</th></tr></thead>
            <tbody>{liste.map((i) => {
              const zone = d.zones.find((z) => z.id === i.zone_id);
              const habilitees = d.personnes.filter((p) => p.actif && personneHabilitee(p.id, zone, d.habilitations, i.date_prevue));
              const retard = i.statut === "a_faire" && i.date_prevue < aujourdhui;
              return (
                <tr key={i.id} className={i.date_prevue === aujourdhui ? "bg-cuivre-050/50" : ""}>
                  <td className="whitespace-nowrap">{new Date(i.date_prevue).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" })}</td>
                  <td className="whitespace-nowrap">{LIBELLES_MOMENTS[i.moment]}</td>
                  <td>{i.titre}</td>
                  <td><div className="flex flex-wrap gap-1">{i.surfaces.map((x) => <Badge key={x} ton={x === "desinfection_complete" ? "cuivre" : "neutre"}>{COURT[x] ?? x}</Badge>)}</div></td>
                  <td className="w-56">
                    {i.statut === "a_faire" && s.peut("nettoyage_execution", 2) ? (
                      <Liste aria-label={`Intervenant ${i.titre} ${i.date_prevue}`} value={i.personne_id ?? ""} onChange={(e) => void affecter(i, e.target.value)}>
                        <option value="">— Non affecté —</option>
                        {habilitees.map((p) => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
                      </Liste>
                    ) : nomPersonne(d, i.personne_id)}
                  </td>
                  <td><Badge ton={retard ? "alerte" : TON[i.statut]}>{retard ? "En retard" : STATUTS[i.statut]}</Badge></td>
                </tr>
              );
            })}</tbody>
          </table>
        </TableauDefilant>
      )}
      <p className="mt-2 text-xs text-texte-2">Seules les personnes détenant une habilitation valide pour la classe de la zone sont proposées (règle appliquée aussi par la base).</p>
    </div>
  );
}

/** Mode terrain : interventions du jour, gros boutons, enregistrement différé sans réseau. */
export function Terrain({ d, recharger }: { d: DonneesNettoyage; recharger: () => void }) {
  const s = useSession();
  const [salle, setSalle] = useState(d.salles[0]?.id ?? "");
  const [date, setDate] = useState(jour());
  const [ouverte, setOuverte] = useState<InterventionNettoyage | null>(null);
  const [attente, setAttente] = useState(operationsEnAttente().length);
  const [enLigne, setEnLigne] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const action = useAction();

  useEffect(() => {
    const maj = () => setAttente(operationsEnAttente().length);
    const connexion = () => { setEnLigne(navigator.onLine); if (navigator.onLine) void synchroniser(s.depot).then((n) => { maj(); if (n) recharger(); }); };
    window.addEventListener("file-hors-ligne", maj);
    window.addEventListener("online", connexion);
    window.addEventListener("offline", connexion);
    return () => { window.removeEventListener("file-hors-ligne", maj); window.removeEventListener("online", connexion); window.removeEventListener("offline", connexion); };
  }, [s.depot, recharger]);

  const liste = d.interventions.filter((i) => i.salle_id === salle && i.date_prevue === date).sort((a, b) => a.moment.localeCompare(b.moment) || a.titre.localeCompare(b.titre));
  return (
    <div className="mx-auto max-w-3xl">
      {!enLigne && <div className="mb-3"><Bandeau ton="attention">Hors ligne : les enregistrements sont conservés sur l'appareil et envoyés au retour du réseau.</Bandeau></div>}
      {attente > 0 && (
        <div className="mb-3 flex items-center gap-2"><Bandeau ton="info">{attente} enregistrement(s) en attente de synchronisation.</Bandeau>
          <Bouton disabled={action.enCours} onClick={() => void action.executer(async () => { const n = await synchroniser(s.depot); setAttente(operationsEnAttente().length); if (n) recharger(); })}>Synchroniser</Bouton>
        </div>
      )}
      <MessageErreur erreur={action.erreur} />
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Liste aria-label="Salle propre" className="!py-3 !text-base" value={salle} onChange={(e) => setSalle(e.target.value)}>{d.salles.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</Liste>
        <Saisie aria-label="Date" type="date" className="!py-3 !text-base" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {liste.length === 0 ? <Vide>Aucune intervention prévue ce jour.</Vide> : (
        <ul className="space-y-2">
          {liste.map((i) => (
            <li key={i.id}>
              <button type="button" onClick={() => setOuverte(i)} className={`flex w-full items-center gap-3 rounded-xl border-2 bg-white p-4 text-left ${i.statut === "realisee" ? "border-emerald-300" : i.statut === "non_realisee" ? "border-red-300" : "border-bord hover:border-navy-600"}`}>
                <span className="text-3xl" aria-hidden>{i.statut === "realisee" ? "✅" : i.statut === "non_realisee" ? "⛔" : "🧽"}</span>
                <span className="flex-1">
                  <span className="block text-lg font-semibold">{i.titre}</span>
                  <span className="block text-sm text-texte-2">{LIBELLES_MOMENTS[i.moment]} · {i.surfaces.map((x) => COURT[x] ?? x).join(", ")}</span>
                </span>
                <Badge ton={TON[i.statut]}>{STATUTS[i.statut]}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
      {ouverte && <SaisieIntervention intervention={ouverte} d={d} onFermer={(ok) => { setOuverte(null); setAttente(operationsEnAttente().length); if (ok) recharger(); }} />}
    </div>
  );
}

function SaisieIntervention({ intervention: i, d, onFermer }: { intervention: InterventionNettoyage; d: DonneesNettoyage; onFermer: (ok: boolean) => void }) {
  const s = useSession();
  const procedure = d.procedures.find((p) => p.id === i.procedure_id);
  const zone = d.zones.find((z) => z.id === i.zone_id);
  const etapes = (procedure?.contenu.etapes ?? []).filter((e) => ["preparation", "dechets", "cloture"].includes(e.surface) || i.surfaces.includes(e.surface as CleSurface));
  const produits = [...new Set(etapes.map((e) => e.produit).filter((x): x is string => !!x))];
  const moi = d.personnes.find((p) => p.user_id === s.utilisateur?.id);
  const habilitees = d.personnes.filter((p) => p.actif && personneHabilitee(p.id, zone, d.habilitations, i.date_prevue));
  const [faites, setFaites] = useState<number[]>(i.etapes_faites);
  const [lots, setLots] = useState<LotUtilise[]>(produits.map((p) => i.lots.find((l) => l.produit === p) ?? { produit: p, lot: "" }));
  const [personne, setPersonne] = useState(i.personne_id ?? (moi && habilitees.includes(moi) ? moi.id : ""));
  const [anomalies, setAnomalies] = useState(i.anomalies);
  const [debut] = useState(Date.now());
  const [message, setMessage] = useState<string | null>(null);
  const action = useAction();
  const lecture = i.statut !== "a_faire" || !s.peut("nettoyage_execution", 2);
  const toutes = etapes.length > 0 && etapes.every((e) => faites.includes(e.ordre));

  const enregistrer = (statut: InterventionNettoyage["statut"]) => action.executer(async () => {
    const r = await modifierOuDifferer(s.depot, "interventions_nettoyage", i.id, {
      statut, personne_id: personne || null, etapes_faites: faites, lots: lots.filter((l) => l.lot.trim()), anomalies,
      duree_min: Math.max(1, Math.round((Date.now() - debut) / 60000)), realise_le: new Date().toISOString(),
    }, `${i.titre} — ${formatDate(i.date_prevue)}`);
    if (r === "file") { setMessage("Enregistré sur l'appareil : envoi au retour du réseau."); setTimeout(() => onFermer(true), 1200); }
    else onFermer(true);
  });

  return (
    <Modale large titre={`${i.titre} — ${LIBELLES_MOMENTS[i.moment]}`} onFermer={() => onFermer(false)} pied={lecture ? <Bouton onClick={() => onFermer(false)}>Fermer</Bouton> : <>
      <Bouton variante="danger" disabled={action.enCours || !anomalies.trim() || !personne} title="Décrire la raison dans « Anomalies »" onClick={() => void enregistrer("non_realisee")}>Non réalisé</Bouton>
      <Bouton variante="principal" className="!px-5 !py-2.5 !text-base" disabled={action.enCours || !toutes || !personne} onClick={() => void enregistrer("realisee")}>Valider le nettoyage</Bouton>
    </>}>
      <MessageErreur erreur={action.erreur} />
      {message && <Bandeau ton="info">{message}</Bandeau>}
      {procedure && procedure.statut !== "approuvee" && <Bandeau ton="attention">La procédure a changé de version depuis la planification.</Bandeau>}
      <div className="mb-3 grid gap-3 md:grid-cols-2">
        <Champ libelle="Intervenant (habilité pour cette zone)">
          <Liste disabled={lecture} className="!py-2.5 !text-base" value={personne} onChange={(e) => setPersonne(e.target.value)}>
            <option value="">— Choisir —</option>
            {habilitees.map((p) => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
          </Liste>
        </Champ>
        <div className="text-sm text-texte-2">Surfaces du jour : {i.surfaces.map((x) => SURFACES[x as CleSurface] ?? x).join(" ; ")}</div>
      </div>
      <ol className="mb-4 space-y-2">
        {etapes.map((e) => {
          const fait = faites.includes(e.ordre);
          return (
            <li key={e.ordre}>
              <label className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3 ${fait ? "border-emerald-300 bg-emerald-50" : "border-bord bg-white"}`}>
                <input type="checkbox" className="mt-1 h-6 w-6 shrink-0" disabled={lecture} checked={fait} onChange={(ev) => setFaites(ev.target.checked ? [...faites, e.ordre] : faites.filter((x) => x !== e.ordre))} />
                <span>
                  <span className="block text-base">{e.action}</span>
                  <span className="block text-sm text-texte-2">{[e.technique && TECHNIQUES[e.technique]?.libelle, e.produit && nomProduit(e.produit, d.produits), e.consommable && nomConsommable(e.consommable, d.consommables), e.temps_contact_min != null && `temps de contact ${e.temps_contact_min} min`].filter(Boolean).join(" · ")}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ol>
      {produits.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-sm font-semibold">Lots des produits utilisés</div>
          <div className="grid gap-2 md:grid-cols-2">
            {lots.map((l, k) => (
              <Champ key={l.produit} libelle={nomProduit(l.produit, d.produits)}><Saisie disabled={lecture} value={l.lot} placeholder="N° de lot" onChange={(e) => setLots(lots.map((x, j) => (j === k ? { ...x, lot: e.target.value } : x)))} /></Champ>
            ))}
          </div>
        </div>
      )}
      <Champ libelle="Anomalies constatées"><ZoneTexte disabled={lecture} value={anomalies} onChange={(e) => setAnomalies(e.target.value)} placeholder="Matériel endommagé, produit manquant, zone inaccessible…" /></Champ>
      {i.statut !== "a_faire" && <p className="mt-2 text-sm text-texte-2">{STATUTS[i.statut]} le {formatDate(i.realise_le, true)} par {nomPersonne(d, i.personne_id)}{i.duree_min ? ` · ${i.duree_min} min` : ""}.</p>}
    </Modale>
  );
}

export function useEtatTerrain() {
  return useMemo(() => operationsEnAttente().length, []);
}
