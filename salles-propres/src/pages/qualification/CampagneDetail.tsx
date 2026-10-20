import { useState } from "react";
import { Link, useParams } from "react-router";
import { useSession } from "../../session";
import type { CampagneQualification, Essai, EtatOccupation, MesureEssai, Resultat, Signature, StatutCampagne, Zone } from "../../data/types";
import { Badge, Bandeau, Bouton, Carte, Champ, EnTete, Liste, MessageErreur, Modale, Saisie, SaisieNombre, TableauDefilant, Vide, ZoneTexte, formatDate, useAction, useDonnees } from "../../ui/composants";
import { ListeSignatures, ModaleSignature } from "../../ui/signature";
import { FilDiscussion } from "../../ui/discussion";
import { ChoixInstrument } from "../contaminations/Resultats";
import {
  LIBELLES_ETATS, LIBELLES_STATUTS_CAMPAGNE, LIBELLES_VERDICTS_CAMPAGNE, essaiQualitatif, limitesEssai, verdictCampagnePropose, verdictClassification, verdictMesures,
} from "../../domain/qualification";
import { CATALOGUE_ESSAIS } from "../../domain/referentiels/essais";
import { formatNombre } from "../../domain/exigencesZone";
import { TON_VERDICT_CAMPAGNE, TYPES_CAMPAGNE } from "./Qualification";
import type { Signification } from "../../domain/permissions";

const ETAPES_FLUX: StatutCampagne[] = ["brouillon", "protocole_approuve", "en_execution", "rapport_redige", "cloturee"];
const TON_ESSAI = { conforme: "ok", non_conforme: "alerte", sans_objet: "neutre" } as const;
const LIBELLES_VERDICT_ESSAI = { conforme: "Conforme", non_conforme: "Non conforme", sans_objet: "Sans objet" };

export function useCampagne(id: string) {
  const s = useSession();
  const org = s.org!.id;
  return useDonnees(async () => {
    const [campagnes, essais, signatures] = await Promise.all([
      s.depot.lister("campagnes_qualification", org, { id }), s.depot.lister("essais", org, { campagne_id: id }), s.depot.signatures(org, "campagne", id),
    ]);
    const campagne = campagnes[0] ?? null;
    if (!campagne) return null;
    const [salles, zones, points, resultats, instruments, etalonnages, equipements, ctas] = await Promise.all([
      s.depot.lister("salles_propres", org, { id: campagne.salle_id }), s.depot.lister("zones", org, { salle_id: campagne.salle_id }),
      s.depot.lister("points_prelevement", org, { salle_id: campagne.salle_id }),
      s.peut("contamination_resultats", 1) ? s.depot.lister("resultats", org, { salle_id: campagne.salle_id }) : [],
      s.peut("instruments", 1) ? s.depot.lister("instruments", org) : [], s.peut("instruments", 1) ? s.depot.lister("etalonnages", org) : [],
      s.depot.lister("equipements", org, { salle_id: campagne.salle_id }), s.peut("cta", 1) ? s.depot.lister("ctas", org) : [],
    ]);
    const ids = new Set(essais.map((e) => e.id));
    return {
      campagne, essais: essais.sort((a, b) => a.ordre - b.ordre), signatures, salle: salles[0], zones, points, equipements, ctas,
      resultats: resultats.filter((r) => r.essai_id && ids.has(r.essai_id)), instruments, etalonnages,
    };
  }, [org, id]);
}

export type DonneesCampagne = NonNullable<ReturnType<typeof useCampagne>["donnees"]>;

export function zoneDeLEssai(e: Essai, d: Pick<DonneesCampagne, "zones" | "equipements">): Zone | null {
  if (e.cible_type === "zone") return d.zones.find((z) => z.id === e.cible_id) ?? null;
  if (e.cible_type === "equipement") {
    const q = d.equipements.find((x) => x.id === e.cible_id);
    return d.zones.find((z) => z.id === q?.zone_id) ?? null;
  }
  return null;
}

export function CampagneDetail() {
  const { id = "" } = useParams();
  const s = useSession();
  const { donnees, erreur, recharger } = useCampagne(id);
  const [signature, setSignature] = useState<{ portee: "protocole" | "rapport"; significations: Signification[]; statut?: StatutCampagne } | null>(null);
  const [ouvert, setOuvert] = useState<Essai | null>(null);
  const [edition, setEdition] = useState<Partial<CampagneQualification> | null>(null);
  const [rapport, setRapport] = useState<{ verdict: string; conclusion: string } | null>(null);
  const [ajout, setAjout] = useState(false);
  const action = useAction();

  if (erreur) return <MessageErreur erreur={erreur} />;
  if (donnees === null) return <Vide>Campagne introuvable ou hors de votre périmètre.</Vide>;
  if (!donnees) return <p className="text-texte-2">Chargement…</p>;
  const c = donnees.campagne;
  const redaction = s.peut("qualification_protocoles", 2);
  const validation = s.peut("qualification_protocoles", 3);
  const execution = s.peut("qualification_execution", 2);
  const fige = c.statut === "cloturee" || c.statut === "annulee";
  const utiles = donnees.essais.filter((e) => e.statut !== "non_applicable");
  const restants = utiles.filter((e) => e.statut === "a_faire").length;
  const propose = verdictCampagnePropose(donnees.essais);

  const changerStatut = (statut: StatutCampagne, extra: Partial<CampagneQualification> = {}) =>
    action.executer(async () => { await s.depot.modifier("campagnes_qualification", c.id, { statut, ...extra }); recharger(); });

  const supprimerEssai = (e: Essai) => {
    if (!window.confirm(`Retirer l'essai « ${e.libelle} » du protocole ?`)) return;
    void action.executer(async () => { await s.depot.supprimer("essais", e.id); recharger(); });
  };

  return (
    <>
      <EnTete
        titre={<><span className="mr-2 font-mono text-base text-texte-2">{c.numero}</span>{c.titre}</>}
        sousTitre={<><Link className="text-navy-700 hover:underline" to={`/salles/${c.salle_id}`}>{donnees.salle?.nom}</Link> · {TYPES_CAMPAGNE[c.type_campagne]} · {c.etapes.join(", ")}{c.prestataire && ` · ${c.prestataire}`}</>}
        actions={<>
          <Link to={`/qualification/${c.id}/imprimer/protocole`}><Bouton>Protocole (impression)</Bouton></Link>
          {(c.statut === "rapport_redige" || c.statut === "cloturee") && <Link to={`/qualification/${c.id}/imprimer/rapport`}><Bouton>Rapport (impression)</Bouton></Link>}
          {!fige && redaction && c.statut === "brouillon" && <Bouton onClick={() => setEdition({ ...c })}>Modifier</Bouton>}
          {!fige && validation && <Bouton variante="danger" onClick={() => { if (window.confirm("Annuler la campagne ? Elle sera figée.")) void changerStatut("annulee"); }}>Annuler la campagne</Bouton>}
        </>}
      />
      <MessageErreur erreur={action.erreur} />

      <ol className="mb-4 flex flex-wrap items-center gap-1 text-sm">
        {ETAPES_FLUX.map((st, i) => {
          const atteint = ETAPES_FLUX.indexOf(c.statut) >= i;
          return (
            <li key={st} className="flex items-center gap-1">
              {i > 0 && <span className="text-texte-2" aria-hidden>→</span>}
              <span className={`rounded-full border px-3 py-1 ${c.statut === st ? "border-navy-700 bg-navy-700 text-white" : atteint ? "border-navy-100 bg-navy-050 text-navy-700" : "border-bord bg-white text-texte-2"}`}>{LIBELLES_STATUTS_CAMPAGNE[st]}</span>
            </li>
          );
        })}
        {c.statut === "annulee" && <Badge ton="alerte">Annulée</Badge>}
      </ol>

      <Carte className="mb-4" titre="Étape en cours">
        {c.statut === "brouillon" && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-sm">Complétez les essais et leurs critères, puis faites approuver le protocole par signature électronique (niveau validation). Les critères sont figés ensuite.</p>
            {redaction && <Bouton onClick={() => setSignature({ portee: "protocole", significations: ["redige", "verifie"] })}>Signer (rédaction / vérification)</Bouton>}
            {validation && <Bouton variante="principal" disabled={utiles.length === 0} onClick={() => setSignature({ portee: "protocole", significations: ["approuve"], statut: "protocole_approuve" })}>Approuver le protocole</Bouton>}
          </div>
        )}
        {c.statut === "protocole_approuve" && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-sm">Protocole approuvé. Démarrez l'exécution pour saisir les mesures.</p>
            {execution && <Bouton variante="principal" onClick={() => void changerStatut("en_execution", { date_debut: c.date_debut ?? new Date().toISOString().slice(0, 10) })}>Démarrer l'exécution</Bouton>}
          </div>
        )}
        {c.statut === "en_execution" && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-sm">{restants > 0 ? `${restants} essai(s) restant(s) à réaliser.` : "Tous les essais sont réalisés : rédigez le rapport."}</p>
            {redaction && <Bouton variante="principal" disabled={restants > 0} onClick={() => setRapport({ verdict: propose ?? "qualifie", conclusion: c.conclusion })}>Rédiger le rapport</Bouton>}
          </div>
        )}
        {c.statut === "rapport_redige" && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-sm">Verdict proposé : <Badge ton={TON_VERDICT_CAMPAGNE[c.verdict!]}>{LIBELLES_VERDICTS_CAMPAGNE[c.verdict!]}</Badge>. L'approbation du rapport clôture la campagne et fige ses résultats.</p>
            {redaction && <Bouton onClick={() => setRapport({ verdict: c.verdict ?? "qualifie", conclusion: c.conclusion })}>Modifier le rapport</Bouton>}
            {redaction && <Bouton onClick={() => void changerStatut("en_execution")}>Revenir à l'exécution</Bouton>}
            {redaction && <Bouton onClick={() => setSignature({ portee: "rapport", significations: ["redige", "verifie"] })}>Signer (rédaction / vérification)</Bouton>}
            {validation && <Bouton variante="principal" onClick={() => setSignature({ portee: "rapport", significations: ["approuve"], statut: "cloturee" })}>Approuver le rapport et clôturer</Bouton>}
          </div>
        )}
        {c.statut === "cloturee" && (
          <p className="text-sm">Campagne clôturée le {formatDate(c.date_fin)} — <Badge ton={TON_VERDICT_CAMPAGNE[c.verdict!]}>{LIBELLES_VERDICTS_CAMPAGNE[c.verdict!]}</Badge>. {c.conclusion}</p>
        )}
        {c.statut === "annulee" && <p className="text-sm">Campagne annulée.</p>}
      </Carte>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Carte
          titre={`Essais (${utiles.length - restants}/${utiles.length} réalisés)`}
          actions={c.statut === "brouillon" && redaction && execution && <Bouton onClick={() => setAjout(true)}>+ Essai</Bouton>}
        >
          {donnees.essais.length === 0 ? <Vide>Aucun essai.</Vide> : (
            <TableauDefilant>
              <table className="tableau">
                <thead><tr><th>#</th><th>Essai</th><th>Cible</th><th>Critère</th><th>Résultat</th><th /></tr></thead>
                <tbody>
                  {donnees.essais.map((e) => (
                    <tr key={e.id} className="cursor-pointer" onClick={() => setOuvert(e)}>
                      <td>{e.ordre}</td>
                      <td><span className="font-medium text-navy-700">{e.libelle}</span><div className="text-xs text-texte-2">{e.reference}{e.etat_occupation && ` · ${LIBELLES_ETATS[e.etat_occupation]}`}</div></td>
                      <td>{e.cible_libelle}</td>
                      <td className="text-xs">{e.critere}</td>
                      <td>{e.statut === "a_faire" ? <Badge>À faire</Badge> : e.verdict ? <Badge ton={TON_ESSAI[e.verdict]}>{LIBELLES_VERDICT_ESSAI[e.verdict]}</Badge> : "—"}{e.date_realisation && <div className="text-xs text-texte-2">{formatDate(e.date_realisation)}</div>}</td>
                      <td onClick={(ev) => ev.stopPropagation()}>{c.statut === "brouillon" && s.peut("qualification_execution", 3) && <Bouton variante="discret" onClick={() => supprimerEssai(e)}>Retirer</Bouton>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableauDefilant>
          )}
        </Carte>
        <div className="grid content-start gap-4">
          <Carte titre="Campagne">
            <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-texte-2">Responsable</dt><dd>{c.responsable || "—"}</dd>
              <dt className="text-texte-2">Début</dt><dd>{formatDate(c.date_debut)}</dd>
              <dt className="text-texte-2">Fin</dt><dd>{formatDate(c.date_fin)}</dd>
            </dl>
            {c.objectif && <p className="mt-2 text-sm text-texte-2">{c.objectif}</p>}
          </Carte>
          <Carte titre="Signatures">
            <ListeSignatures signatures={donnees.signatures} />
          </Carte>
          <Carte titre="Discussion">
            <FilDiscussion objetType="campagne" objetId={c.id} objetLibelle={`${c.numero} ${c.titre}`} lien={`/qualification/${c.id}`} hauteur="max-h-72" />
          </Carte>
        </div>
      </div>

      {signature && (
        <ModaleSignature
          objetType="campagne"
          objetId={c.id}
          objet={`${signature.portee === "protocole" ? "le protocole" : "le rapport"} de la campagne ${c.numero}`}
          module="qualification_protocoles"
          significations={signature.significations}
          portee={signature.portee}
          apres={signature.statut ? async () => {
            await s.depot.modifier("campagnes_qualification", c.id, { statut: signature.statut!, ...(signature.statut === "cloturee" ? { date_fin: new Date().toISOString().slice(0, 10) } : {}) });
          } : undefined}
          onFermer={(signe) => { setSignature(null); if (signe) recharger(); }}
        />
      )}
      {ouvert && <ExecutionEssai essai={donnees.essais.find((e) => e.id === ouvert.id) ?? ouvert} d={donnees} modifiable={!fige && c.statut === "en_execution" && execution} criteresModifiables={c.statut === "brouillon" && execution} onFermer={() => { setOuvert(null); recharger(); }} />}
      {edition && (
        <Modale
          titre="Modifier la campagne"
          onFermer={() => setEdition(null)}
          pied={<><Bouton onClick={() => setEdition(null)}>Annuler</Bouton><Bouton variante="principal" disabled={action.enCours || !edition.titre?.trim()} onClick={() => void action.executer(async () => {
            await s.depot.modifier("campagnes_qualification", c.id, { titre: edition.titre, objectif: edition.objectif, responsable: edition.responsable, prestataire: edition.prestataire, date_debut: edition.date_debut || null });
            setEdition(null);
            recharger();
          })}>Enregistrer</Bouton></>}
        >
          <div className="grid gap-3">
            <Champ libelle="Titre"><Saisie value={edition.titre ?? ""} onChange={(e) => setEdition({ ...edition, titre: e.target.value })} /></Champ>
            <Champ libelle="Responsable"><Saisie value={edition.responsable ?? ""} onChange={(e) => setEdition({ ...edition, responsable: e.target.value })} /></Champ>
            <Champ libelle="Prestataire"><Saisie value={edition.prestataire ?? ""} onChange={(e) => setEdition({ ...edition, prestataire: e.target.value })} /></Champ>
            <Champ libelle="Date de début"><Saisie type="date" value={edition.date_debut ?? ""} onChange={(e) => setEdition({ ...edition, date_debut: e.target.value })} /></Champ>
            <Champ libelle="Objectif"><ZoneTexte value={edition.objectif ?? ""} onChange={(e) => setEdition({ ...edition, objectif: e.target.value })} /></Champ>
          </div>
        </Modale>
      )}
      {rapport && (
        <Modale
          titre="Rapport de qualification"
          onFermer={() => setRapport(null)}
          pied={<><Bouton onClick={() => setRapport(null)}>Annuler</Bouton><Bouton variante="principal" disabled={action.enCours || !rapport.conclusion.trim()} onClick={() => void action.executer(async () => {
            await s.depot.modifier("campagnes_qualification", c.id, { statut: "rapport_redige", verdict: rapport.verdict as CampagneQualification["verdict"], conclusion: rapport.conclusion });
            setRapport(null);
            recharger();
          })}>Enregistrer le rapport</Bouton></>}
        >
          <MessageErreur erreur={action.erreur} />
          <div className="grid gap-3">
            {propose && <Bandeau>Verdict proposé d'après les essais : <strong>{LIBELLES_VERDICTS_CAMPAGNE[propose]}</strong>. Une non-conformité de classification, de pression ou d'intégrité de filtre conduit à « non qualifié ».</Bandeau>}
            <Champ libelle="Verdict"><Liste value={rapport.verdict} onChange={(e) => setRapport({ ...rapport, verdict: e.target.value })}>{Object.entries(LIBELLES_VERDICTS_CAMPAGNE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Liste></Champ>
            <Champ libelle="Conclusion"><ZoneTexte rows={6} value={rapport.conclusion} onChange={(e) => setRapport({ ...rapport, conclusion: e.target.value })} placeholder="Synthèse des résultats, écarts, réserves et recommandations." /></Champ>
          </div>
        </Modale>
      )}
      {ajout && <AjoutEssai campagne={c} d={donnees} onFermer={() => { setAjout(false); recharger(); }} />}
    </>
  );
}

function AjoutEssai({ campagne, d, onFermer }: { campagne: CampagneQualification; d: DonneesCampagne; onFermer: () => void }) {
  const s = useSession();
  const [v, setV] = useState({ cle: CATALOGUE_ESSAIS[0].cle, cible: d.zones[0] ? `zone:${d.zones[0].id}` : "salle:", critere: "", min: null as number | null, max: null as number | null, unite: "", etat: "" });
  const action = useAction();
  const cibles = [
    ...d.zones.map((z) => ({ valeur: `zone:${z.id}`, libelle: `Zone ${z.code} ${z.nom}` })),
    ...d.equipements.map((q) => ({ valeur: `equipement:${q.id}`, libelle: `Équipement ${q.libelle}` })),
    { valeur: "salle:", libelle: "Salle entière" },
  ];
  return (
    <Modale
      titre="Ajouter un essai au protocole"
      onFermer={onFermer}
      pied={<><Bouton onClick={onFermer}>Annuler</Bouton><Bouton variante="principal" disabled={action.enCours} onClick={() => void action.executer(async () => {
        const def = CATALOGUE_ESSAIS.find((x) => x.cle === v.cle)!;
        const [type, id] = v.cible.split(":");
        await s.depot.creer("essais", {
          org_id: s.org!.id, campagne_id: campagne.id, ordre: d.essais.length + 1, cle_essai: def.cle, libelle: def.libelle, reference: def.reference,
          cible_type: type as Essai["cible_type"], cible_id: id || null, cible_libelle: cibles.find((x) => x.valeur === v.cible)?.libelle ?? "",
          critere: v.critere, critere_min: v.min, critere_max: v.max, unite: v.unite, etat_occupation: (v.etat || null) as EtatOccupation | null,
        });
        onFermer();
      })}>Ajouter</Bouton></>}
    >
      <MessageErreur erreur={action.erreur} />
      <div className="grid gap-3 md:grid-cols-2">
        <Champ libelle="Essai" className="md:col-span-2"><Liste value={v.cle} onChange={(e) => setV({ ...v, cle: e.target.value })}>{CATALOGUE_ESSAIS.map((x) => <option key={x.cle} value={x.cle}>{x.libelle} — {x.reference}</option>)}</Liste></Champ>
        <Champ libelle="Cible"><Liste value={v.cible} onChange={(e) => setV({ ...v, cible: e.target.value })}>{cibles.map((x) => <option key={x.valeur} value={x.valeur}>{x.libelle}</option>)}</Liste></Champ>
        <Champ libelle="État d'occupation"><Liste value={v.etat} onChange={(e) => setV({ ...v, etat: e.target.value })}><option value="">—</option>{Object.entries(LIBELLES_ETATS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Liste></Champ>
        <Champ libelle="Critère d'acceptation" className="md:col-span-2"><Saisie value={v.critere} onChange={(e) => setV({ ...v, critere: e.target.value })} /></Champ>
        <Champ libelle="Minimum"><SaisieNombre valeur={v.min} onChange={(n) => setV({ ...v, min: n })} /></Champ>
        <Champ libelle="Maximum"><SaisieNombre valeur={v.max} onChange={(n) => setV({ ...v, max: n })} /></Champ>
        <Champ libelle="Unité"><Saisie value={v.unite} onChange={(e) => setV({ ...v, unite: e.target.value })} /></Champ>
      </div>
    </Modale>
  );
}

/** Exécution d'un essai : saisie des mesures, verdict calculé, validation. */
function ExecutionEssai({ essai, d, modifiable, criteresModifiables, onFermer }: { essai: Essai; d: DonneesCampagne; modifiable: boolean; criteresModifiables: boolean; onFermer: () => void }) {
  const s = useSession();
  const org = s.org!.id;
  const action = useAction();
  const zone = zoneDeLEssai(essai, d);
  const classification = essai.cle_essai === "classification_particulaire";
  const qualitatif = essaiQualitatif(essai);
  const codes = new Map(d.points.map((p) => [p.id, p.code]));
  const resultats = d.resultats.filter((r) => r.essai_id === essai.id);
  const limites = limitesEssai(essai, zone);
  const [general, setGeneral] = useState({
    instrument_id: essai.instrument_id, date: (essai.date_realisation ?? new Date().toISOString()).slice(0, 16),
    realise_par: essai.realise_par || s.utilisateur?.nom_complet || "", commentaire: essai.commentaire,
  });
  const [criteres, setCriteres] = useState({ critere: essai.critere, min: essai.critere_min, max: essai.critere_max });
  const [mesures, setMesures] = useState<MesureEssai[]>(essai.mesures.length ? essai.mesures : [{ point: "", valeur: null }]);
  const [verdictManuel, setVerdictManuel] = useState<string>(essai.verdict ?? "");

  // Grille de classification : points × tailles.
  const tailles = [...new Set([...limites.keys(), ...resultats.map((r) => r.taille_um!).filter((t) => t != null)])].filter((t) => t === 0.5 || t === 5 || resultats.some((r) => r.taille_um === t)).sort((a, b) => a - b);
  const pointsZone = d.points.filter((p) => p.zone_id === zone?.id && p.natures.includes("particulaire")).map((p) => p.code);
  const pointsMesures = [...new Set(resultats.map((r) => (r.point_id ? codes.get(r.point_id) ?? r.point_libre : r.point_libre)))];
  // Un repère saisi ne renvoie à un point du plan que s'il appartient à la zone de l'essai.
  const [grille, setGrille] = useState<{ point: string; valeurs: Record<string, number | null> }[]>(() => {
    const noms = [...new Set([...pointsZone, ...pointsMesures])].sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
    return (noms.length ? noms : ["P01"]).map((point) => ({
      point,
      valeurs: Object.fromEntries(tailles.map((t) => [String(t), resultats.find((r) => r.taille_um === t && (r.point_id ? codes.get(r.point_id) : r.point_libre) === point)?.valeur ?? null])),
    }));
  });

  const dateIso = new Date(general.date).toISOString();
  const resultatsGrille: Resultat[] = grille.flatMap((g) => tailles.filter((t) => g.valeurs[String(t)] != null).map((t) => ({ point_id: null, point_libre: g.point, taille_um: t, valeur: g.valeurs[String(t)]!, nature: "particulaire" } as Resultat)));
  const vClassif = classification ? verdictClassification(essai, zone, resultatsGrille, new Map()) : null;
  const vMesures = !classification && !qualitatif ? verdictMesures({ ...essai, critere_min: criteres.min, critere_max: criteres.max, mesures }, zone) : null;
  const verdictCalcule = classification ? (vClassif!.conforme ? "conforme" : "non_conforme") : vMesures?.conforme == null ? "" : vMesures.conforme ? "conforme" : "non_conforme";
  const verdict = qualitatif ? verdictManuel : verdictManuel || verdictCalcule;
  const derogation = !qualitatif && verdictManuel && verdictCalcule && verdictManuel !== verdictCalcule;

  const enregistrerGrille = async () => {
    for (const g of grille) {
      const point = d.points.find((p) => p.code === g.point && p.zone_id === zone?.id);
      for (const t of tailles) {
        const valeur = g.valeurs[String(t)];
        const existant = resultats.find((r) => r.taille_um === t && (r.point_id ? codes.get(r.point_id) : r.point_libre) === g.point);
        if (valeur == null) continue;
        const commun = {
          valeur, instrument_id: general.instrument_id, date_prelevement: dateIso, operateur: general.realise_par, etat_occupation: essai.etat_occupation,
          limite_action: limites.get(t) ?? null, limite_alerte: null,
        };
        if (existant) await s.depot.modifier("resultats", existant.id, commun);
        else {
          await s.depot.creer("resultats", {
            ...commun, org_id: org, salle_id: d.campagne.salle_id, zone_id: zone?.id ?? null, point_id: point?.id ?? null, point_libre: point ? "" : g.point,
            origine: "qualification", essai_id: essai.id, milieu: "air", nature: "particulaire", methode: "Compteur optique (ISO 14644-1)",
            parametre: `Particules ≥ ${String(t).replace(".", ",")} µm`, taille_um: t, unite: "particules/m³", commentaire: `Essai ${d.campagne.numero}`,
          });
        }
      }
    }
  };

  const valider = (statut: Essai["statut"]) => action.executer(async () => {
    if (classification) await enregistrerGrille();
    await s.depot.modifier("essais", essai.id, {
      statut, verdict: statut === "non_applicable" ? "sans_objet" : (verdict as Essai["verdict"]) || null,
      instrument_id: general.instrument_id, date_realisation: statut === "a_faire" ? null : dateIso, realise_par: general.realise_par,
      commentaire: general.commentaire, mesures: classification || qualitatif ? essai.mesures : mesures,
    });
    onFermer();
  });

  return (
    <Modale
      large
      titre={`${essai.libelle} — ${essai.cible_libelle}`}
      onFermer={onFermer}
      pied={<>
        {verdict && <span className="mr-auto">Verdict : <Badge ton={verdict === "conforme" ? "ok" : "alerte"}>{verdict === "conforme" ? "Conforme" : "Non conforme"}</Badge></span>}
        <Bouton onClick={onFermer}>Fermer</Bouton>
        {criteresModifiables && <Bouton variante="principal" disabled={action.enCours} onClick={() => void action.executer(async () => {
          await s.depot.modifier("essais", essai.id, { critere: criteres.critere, critere_min: criteres.min, critere_max: criteres.max });
          onFermer();
        })}>Enregistrer les critères</Bouton>}
        {modifiable && <Bouton onClick={() => void valider("non_applicable")} disabled={action.enCours || !general.commentaire.trim()} title="Commentaire obligatoire">Sans objet</Bouton>}
        {modifiable && <Bouton variante="principal" disabled={action.enCours || !verdict || (!!derogation && !general.commentaire.trim())} onClick={() => void valider("realise")}>Valider l'essai</Bouton>}
      </>}
    >
      <MessageErreur erreur={action.erreur} />
      <div className="mb-3 grid gap-3 md:grid-cols-3">
        <Champ libelle="Critère d'acceptation" className="md:col-span-3">
          {criteresModifiables ? <Saisie value={criteres.critere} onChange={(e) => setCriteres({ ...criteres, critere: e.target.value })} /> : <p className="text-sm">{essai.critere || "—"}</p>}
        </Champ>
        {criteresModifiables && !classification && <>
          <Champ libelle={`Minimum${essai.unite ? ` (${essai.unite})` : ""}`}><SaisieNombre valeur={criteres.min} onChange={(v) => setCriteres({ ...criteres, min: v })} /></Champ>
          <Champ libelle={`Maximum${essai.unite ? ` (${essai.unite})` : ""}`}><SaisieNombre valeur={criteres.max} onChange={(v) => setCriteres({ ...criteres, max: v })} /></Champ>
        </>}
      </div>
      {!modifiable && !criteresModifiables && essai.statut === "a_faire" && <Bandeau>La saisie des mesures s'ouvre quand la campagne est en exécution.</Bandeau>}

      {(modifiable || essai.statut !== "a_faire") && (
        <>
          <div className="mb-3 grid gap-3 md:grid-cols-3">
            <Champ libelle="Date de réalisation"><Saisie type="datetime-local" disabled={!modifiable} value={general.date} onChange={(e) => setGeneral({ ...general, date: e.target.value })} /></Champ>
            <Champ libelle="Instrument" aide="Seuls les instruments étalonnés à cette date sont proposés."><ChoixInstrument instruments={d.instruments} etalonnages={d.etalonnages} date={dateIso} valeur={general.instrument_id} onChange={(id) => setGeneral({ ...general, instrument_id: id })} /></Champ>
            <Champ libelle="Réalisé par"><Saisie disabled={!modifiable} value={general.realise_par} onChange={(e) => setGeneral({ ...general, realise_par: e.target.value })} /></Champ>
          </div>

          {classification && (
            <div className="mb-3">
              <p className="mb-2 text-sm">Concentration moyenne par point (particules/m³), état {essai.etat_occupation ? LIBELLES_ETATS[essai.etat_occupation].toLowerCase() : "—"}. Limites : {[...limites.entries()].map(([t, l]) => `≥ ${String(t).replace(".", ",")} µm ≤ ${formatNombre(l)}`).join(" ; ")}.</p>
              <TableauDefilant>
                <table className="tableau">
                  <thead><tr><th>Point</th>{tailles.map((t) => <th key={t} className="nombre">≥ {String(t).replace(".", ",")} µm</th>)}<th>Point</th></tr></thead>
                  <tbody>
                    {grille.map((g, i) => {
                      const detail = vClassif?.points.find((p) => p.point === g.point);
                      return (
                        <tr key={i}>
                          <td className="w-32"><Saisie aria-label="Point" disabled={!modifiable} value={g.point} onChange={(e) => setGrille(grille.map((x, j) => (j === i ? { ...x, point: e.target.value } : x)))} /></td>
                          {tailles.map((t) => (
                            <td key={t}><SaisieNombre aria-label={`${g.point} ${t} µm`} disabled={!modifiable} valeur={g.valeurs[String(t)] ?? null} onChange={(v) => setGrille(grille.map((x, j) => (j === i ? { ...x, valeurs: { ...x.valeurs, [String(t)]: v } } : x)))} /></td>
                          ))}
                          <td>{detail ? <Badge ton={detail.conforme ? "ok" : "alerte"}>{detail.conforme ? "OK" : "Dépassement"}</Badge> : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableauDefilant>
              {modifiable && <Bouton className="mt-2" onClick={() => {
                const prefixe = zone?.code || "P";
                let n = grille.length + 1;
                while (grille.some((g) => g.point === `${prefixe}-${n}`)) n++;
                setGrille([...grille, { point: `${prefixe}-${n}`, valeurs: {} }]);
              }}>+ Point</Bouton>}
              {vClassif && (
                <div className="mt-2 text-sm">
                  {vClassif.pointsRequis != null && <p>Points : {vClassif.points.length} mesuré(s), {vClassif.pointsRequis} requis (tableau A.1).</p>}
                  {vClassif.messages.map((m) => <p key={m} className="text-amber-800">⚠ {m}</p>)}
                </div>
              )}
            </div>
          )}

          {!classification && !qualitatif && (
            <div className="mb-3">
              <TableauDefilant>
                <table className="tableau">
                  <thead><tr><th>Point / repère</th><th className="nombre">Valeur ({essai.unite || "—"})</th><th>Commentaire</th></tr></thead>
                  <tbody>{mesures.map((m, i) => (
                    <tr key={i}>
                      <td><Saisie aria-label="Repère" disabled={!modifiable} value={m.point} onChange={(e) => setMesures(mesures.map((x, j) => (j === i ? { ...x, point: e.target.value } : x)))} /></td>
                      <td className="w-40"><SaisieNombre aria-label={`Valeur ${m.point}`} disabled={!modifiable} valeur={m.valeur} onChange={(v) => setMesures(mesures.map((x, j) => (j === i ? { ...x, valeur: v } : x)))} /></td>
                      <td><Saisie aria-label="Commentaire" disabled={!modifiable} value={m.commentaire ?? ""} onChange={(e) => setMesures(mesures.map((x, j) => (j === i ? { ...x, commentaire: e.target.value } : x)))} /></td>
                    </tr>
                  ))}</tbody>
                </table>
              </TableauDefilant>
              {modifiable && <Bouton className="mt-2" onClick={() => setMesures([...mesures, { point: "", valeur: null }])}>+ Mesure</Bouton>}
              {vMesures && <p className="mt-2 text-sm">{vMesures.message}</p>}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            <Champ libelle={qualitatif ? "Verdict" : "Verdict (dérogation au calcul)"} aide={qualitatif ? "Appréciation de l'opérateur." : "Laisser vide pour retenir le verdict calculé ; une dérogation exige un commentaire."}>
              <Liste disabled={!modifiable} value={verdictManuel} onChange={(e) => setVerdictManuel(e.target.value)}>
                <option value="">{qualitatif ? "— Choisir —" : "Calculé"}</option>
                <option value="conforme">Conforme</option>
                <option value="non_conforme">Non conforme</option>
              </Liste>
            </Champ>
            <Champ libelle="Commentaire / observations" className="md:col-span-2"><ZoneTexte disabled={!modifiable} value={general.commentaire} onChange={(e) => setGeneral({ ...general, commentaire: e.target.value })} /></Champ>
          </div>
        </>
      )}
    </Modale>
  );
}

export function signaturesDePortee(signatures: Signature[], portee: string): Signature[] {
  return signatures.filter((x) => x.portee === portee);
}
