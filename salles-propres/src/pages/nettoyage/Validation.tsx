import { useState } from "react";
import { useSession } from "../../session";
import type { ValidationNettoyage } from "../../data/types";
import { Badge, Bouton, Champ, Liste, MessageErreur, Modale, Saisie, SaisieNombre, TableauDefilant, ZoneTexte, formatDate, useAction } from "../../ui/composants";
import { GestionEntites, optionsDe } from "../../ui/entites";
import { LIBELLES_VERDICTS, PARAMETRES, TON_VERDICT } from "../../domain/contamination";
import { verdictResultat } from "../../domain/mesures";
import { formatNombre } from "../../domain/exigencesZone";
import type { DonneesNettoyage } from "./donnees";

const STATUTS = { planifiee: "Planifiée", en_cours: "En cours", conforme: "Conforme", non_conforme: "Non conforme" };
const TON = { planifiee: "neutre", en_cours: "cuivre", conforme: "ok", non_conforme: "alerte" } as const;
const PARAMS = PARAMETRES.filter((p) => ["surf_atp", "surf_contact", "surf_ecouv", "surf_residus", "surf_iso9", "air_bio", "air_p05"].includes(p.cle));

export function ValidationsNettoyage({ d, recharger }: { d: DonneesNettoyage; recharger: () => void }) {
  const [ouverte, setOuverte] = useState<ValidationNettoyage | null>(null);
  return (
    <>
      <GestionEntites
        table="validations_nettoyage"
        titre="Validations du nettoyage"
        lignes={d.validations}
        recharger={recharger}
        ouvrir={setOuverte}
        champs={[
          { cle: "titre", libelle: "Titre", type: "texte", requis: true, large: true },
          { cle: "salle_id", libelle: "Salle propre", type: "liste", requis: true, options: d.salles.map((x) => ({ valeur: x.id, libelle: x.nom })) },
          { cle: "procedure_id", libelle: "Procédure validée", type: "liste", options: d.procedures.filter((p) => p.categorie === "nettoyage").map((p) => ({ valeur: p.id, libelle: `${d.salles.find((x) => x.id === p.salle_id)?.nom} — ${p.titre} v${p.version}` })) },
          { cle: "date_validation", libelle: "Date", type: "date", requis: true },
          { cle: "statut", libelle: "Statut", type: "liste", requis: true, options: optionsDe(STATUTS) },
          { cle: "criteres", libelle: "Critères d'acceptation", type: "zone_texte", aide: "ex. ATP ≤ 150 RLU après nettoyage ; boîtes contact ≤ 5 UFC ; réduction ≥ 2 log" },
          { cle: "conclusion", libelle: "Conclusion", type: "zone_texte" },
        ]}
        valeursInitiales={() => ({ titre: "Validation du nettoyage", salle_id: d.salles[0]?.id ?? "", date_validation: new Date().toISOString().slice(0, 10), statut: "planifiee", criteres: "ATP ≤ 150 RLU après nettoyage sur toutes les surfaces de travail ; boîtes contact ≤ 5 UFC après nettoyage ; aucun résidu visible.", procedure_id: null })}
        colonnes={[
          { libelle: "Validation", rendu: (v) => <strong className="text-navy-700">{v.titre}</strong> },
          { libelle: "Salle", rendu: (v) => d.salles.find((x) => x.id === v.salle_id)?.nom },
          { libelle: "Date", rendu: (v) => formatDate(v.date_validation) },
          { libelle: "Mesures", classe: "nombre", rendu: (v) => d.resultats.filter((r) => r.validation_id === v.id).length },
          { libelle: "Statut", rendu: (v) => <Badge ton={TON[v.statut]}>{STATUTS[v.statut]}</Badge> },
        ]}
        vide="Aucune validation. Une validation démontre, par des mesures avant / après, que la procédure atteint son objectif."
      />
      {ouverte && <DetailValidation validation={ouverte} d={d} onFermer={() => { setOuverte(null); recharger(); }} />}
    </>
  );
}

function DetailValidation({ validation: v, d, onFermer }: { validation: ValidationNettoyage; d: DonneesNettoyage; onFermer: () => void }) {
  const s = useSession();
  const mesures = d.resultats.filter((r) => r.validation_id === v.id).sort((a, b) => a.date_prelevement.localeCompare(b.date_prelevement));
  const zones = d.zones.filter((z) => z.salle_id === v.salle_id);
  const [m, setM] = useState({ parametre: "surf_atp", zone: zones[0]?.id ?? "", point: "", moment: "après", valeur: null as number | null, alerte: null as number | null, action: 150 as number | null });
  const [conclusion, setConclusion] = useState(v.conclusion);
  const action = useAction();
  const p = PARAMS.find((x) => x.cle === m.parametre)!;
  const ecriture = s.peut("contamination_resultats", 2);
  const ajouter = () => action.executer(async () => {
    await s.depot.creer("resultats", {
      org_id: s.org!.id, salle_id: v.salle_id, zone_id: m.zone || null, point_libre: `${m.point || "point"} (${m.moment})`, origine: "nettoyage", validation_id: v.id,
      milieu: p.milieu, nature: p.nature, methode: p.methode, parametre: p.libelle, taille_um: p.taille_um ?? null, unite: p.unite, valeur: m.valeur!,
      limite_alerte: m.moment === "après" ? m.alerte : null, limite_action: m.moment === "après" ? m.action : null, date_prelevement: new Date().toISOString(), operateur: s.utilisateur?.nom_complet ?? "",
      commentaire: `Validation du nettoyage — mesure ${m.moment} nettoyage`,
    });
    setM({ ...m, valeur: null, point: "" });
    onFermer();
  });
  const conclure = (statut: ValidationNettoyage["statut"]) => action.executer(async () => { await s.depot.modifier("validations_nettoyage", v.id, { statut, conclusion }); onFermer(); });
  const apres = mesures.filter((r) => r.point_libre.includes("(après)"));
  return (
    <Modale large titre={v.titre} onFermer={onFermer} pied={<>
      <Bouton onClick={onFermer}>Fermer</Bouton>
      {s.peut("nettoyage_execution", 2) && <>
        <Bouton variante="danger" disabled={!conclusion.trim() || action.enCours} onClick={() => void conclure("non_conforme")}>Conclure non conforme</Bouton>
        <Bouton variante="principal" disabled={!conclusion.trim() || action.enCours} onClick={() => void conclure("conforme")}>Conclure conforme</Bouton>
      </>}
    </>}>
      <MessageErreur erreur={action.erreur} />
      <p className="mb-2 text-sm"><strong>Critères :</strong> {v.criteres || "—"}</p>
      <TableauDefilant>
        <table className="tableau">
          <thead><tr><th>Point</th><th>Mesure</th><th className="nombre">Valeur</th><th>Verdict</th></tr></thead>
          <tbody>{mesures.map((r) => <tr key={r.id}><td>{r.point_libre}</td><td>{r.parametre}</td><td className="nombre">{formatNombre(r.valeur)} {r.unite}</td><td><Badge ton={TON_VERDICT[r.verdict]}>{LIBELLES_VERDICTS[r.verdict]}</Badge></td></tr>)}</tbody>
        </table>
      </TableauDefilant>
      {apres.length > 0 && <p className="mt-2 text-sm">Après nettoyage : {apres.filter((r) => r.verdict === "conforme").length}/{apres.length} mesure(s) conforme(s).</p>}
      {ecriture && (
        <div className="mt-3 grid gap-2 rounded-lg bg-fond p-3 md:grid-cols-4">
          <Champ libelle="Mesure"><Liste value={m.parametre} onChange={(e) => setM({ ...m, parametre: e.target.value })}>{PARAMS.map((x) => <option key={x.cle} value={x.cle}>{x.libelle}</option>)}</Liste></Champ>
          <Champ libelle="Zone"><Liste value={m.zone} onChange={(e) => setM({ ...m, zone: e.target.value })}>{zones.map((z) => <option key={z.id} value={z.id}>{z.code} {z.nom}</option>)}</Liste></Champ>
          <Champ libelle="Point / surface"><Saisie value={m.point} onChange={(e) => setM({ ...m, point: e.target.value })} placeholder="ex. paillasse 1" /></Champ>
          <Champ libelle="Moment"><Liste value={m.moment} onChange={(e) => setM({ ...m, moment: e.target.value })}><option>avant</option><option>après</option></Liste></Champ>
          <Champ libelle={`Valeur (${p.unite})`}><SaisieNombre valeur={m.valeur} onChange={(n) => setM({ ...m, valeur: n })} /></Champ>
          <Champ libelle="Limite d'alerte (après)"><SaisieNombre valeur={m.alerte} onChange={(n) => setM({ ...m, alerte: n })} /></Champ>
          <Champ libelle="Limite d'action (après)"><SaisieNombre valeur={m.action} onChange={(n) => setM({ ...m, action: n })} /></Champ>
          <div className="flex items-end gap-2">
            {m.valeur != null && m.moment === "après" && <Badge ton={TON_VERDICT[verdictResultat(m.valeur, m.alerte, m.action)]}>{LIBELLES_VERDICTS[verdictResultat(m.valeur, m.alerte, m.action)]}</Badge>}
            <Bouton variante="principal" disabled={m.valeur == null || action.enCours} onClick={() => void ajouter()}>Ajouter</Bouton>
          </div>
        </div>
      )}
      <Champ libelle="Conclusion" className="mt-3"><ZoneTexte value={conclusion} onChange={(e) => setConclusion(e.target.value)} /></Champ>
    </Modale>
  );
}
