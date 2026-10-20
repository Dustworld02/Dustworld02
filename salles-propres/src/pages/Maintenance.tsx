import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useSession } from "../session";
import type { Changement, EvaluationChangement, GammeMaintenance, InterventionMaintenance } from "../data/types";
import { Badge, Bandeau, Bouton, Carte, Champ, EnTete, Liste, MessageErreur, Modale, Onglets, ZoneTexte, formatDate, useAction, useDonnees } from "../ui/composants";
import { Formulaire, GestionEntites, optionsDe, type DefinitionChamp } from "../ui/entites";
import { ListeSignatures, ModaleSignature } from "../ui/signature";
import { CATEGORIES_CHANGEMENT, IMPACTS_CHANGEMENT, STATUTS_CHANGEMENT, etatGamme, requalificationSuggeree } from "../domain/maintenance";

const TON_GAMME = { en_retard: "alerte", a_echeance: "attention", a_jour: "ok" } as const;
const LIBELLE_GAMME = { en_retard: "En retard", a_echeance: "À échéance", a_jour: "À jour" };
const STATUTS_INTERVENTION = { planifiee: "Planifiée", realisee: "Réalisée", annulee: "Annulée" };
const TON_CHANGEMENT = { brouillon: "neutre", en_evaluation: "info", approuve: "cuivre", realise: "attention", cloture: "ok", refuse: "alerte" } as const;

function useDonneesMaintenance() {
  const s = useSession();
  const org = s.org!.id;
  return useDonnees(async () => {
    const [gammes, interventions, changements, ctas, salles, equipements, campagnes] = await Promise.all([
      s.depot.lister("gammes_maintenance", org), s.depot.lister("interventions_maintenance", org), s.depot.lister("changements", org),
      s.peut("cta", 1) ? s.depot.lister("ctas", org) : [], s.depot.lister("salles_propres", org), s.depot.lister("equipements", org),
      s.peut("qualification_protocoles", 1) ? s.depot.lister("campagnes_qualification", org) : [],
    ]);
    return { gammes, interventions, changements, ctas, salles, equipements, campagnes };
  }, [org]);
}
type Donnees = NonNullable<ReturnType<typeof useDonneesMaintenance>["donnees"]>;

/** Libellé de l'objet maintenu (CTA, salle, équipement). */
function libelleObjet(d: Pick<Donnees, "ctas" | "salles" | "equipements">, o: Pick<GammeMaintenance, "cta_id" | "salle_id" | "equipement_id">): string {
  if (o.cta_id) return d.ctas.find((c) => c.id === o.cta_id)?.nom ?? "CTA";
  const salle = d.salles.find((x) => x.id === o.salle_id)?.nom ?? "salle";
  const eq = d.equipements.find((e) => e.id === o.equipement_id);
  return eq ? `${eq.libelle} (${salle})` : salle;
}

function champsCible(d: Donnees): DefinitionChamp[] {
  const cible = (v: Record<string, unknown>) => (v.cible as string) ?? (v.cta_id ? "cta" : "salle");
  return [
    { cle: "cible", libelle: "Porte sur", type: "liste", requis: true, options: optionsDe({ cta: "Une centrale de traitement d'air", salle: "Une salle propre ou un équipement" }) },
    { cle: "cta_id", libelle: "CTA", type: "liste", requis: true, options: d.ctas.map((c) => ({ valeur: c.id, libelle: c.nom })), visible: (v) => cible(v) === "cta" },
    { cle: "salle_id", libelle: "Salle propre", type: "liste", requis: true, options: d.salles.map((x) => ({ valeur: x.id, libelle: x.nom })), visible: (v) => cible(v) === "salle" },
    { cle: "equipement_id", libelle: "Équipement (facultatif)", type: "liste", visible: (v) => cible(v) === "salle", options: d.equipements.map((e) => ({ valeur: e.id, libelle: `${e.libelle} — ${d.salles.find((x) => x.id === e.salle_id)?.nom ?? ""}` })) },
  ];
}

function nettoyerCible(v: Record<string, unknown>): Record<string, unknown> {
  const { cible, ...reste } = v;
  const c = (cible as string) ?? (reste.cta_id ? "cta" : "salle");
  return c === "cta" ? { ...reste, salle_id: null, equipement_id: null } : { ...reste, cta_id: null };
}

type Onglet = "gammes" | "interventions" | "changements";

export function Maintenance() {
  const s = useSession();
  const [params] = useSearchParams();
  const { donnees, erreur, recharger } = useDonneesMaintenance();
  const [onglet, setOnglet] = useState<Onglet>((params.get("onglet") as Onglet) ?? "gammes");
  const [changement, setChangement] = useState<string | null>(params.get("id"));
  const [nouveauCc, setNouveauCc] = useState<Partial<Changement> | null>(null);
  const action = useAction();
  const ouvrirCc = changement ? donnees?.changements.find((c) => c.id === changement) : null;
  const ecriture = s.peut("maintenance", 2);

  const planifier = (g: GammeMaintenance, date: string) => action.executer(async () => {
    await s.depot.creer("interventions_maintenance", {
      org_id: s.org!.id, gamme_id: g.id, cta_id: g.cta_id, salle_id: g.salle_id, equipement_id: g.equipement_id, type: "preventive", titre: g.libelle, date_prevue: date, intervenant: g.prestataire,
    });
    recharger();
  });

  return (
    <>
      <EnTete titre="Maintenance et change control" sousTitre="Gammes préventives, interventions préventives et correctives, maîtrise des changements avec évaluation d'impact et requalification." />
      <MessageErreur erreur={erreur ?? action.erreur} />
      <Onglets
        actif={onglet}
        onChange={setOnglet}
        onglets={[
          { cle: "gammes", libelle: "Gammes et échéances" },
          { cle: "interventions", libelle: "Interventions" },
          { cle: "changements", libelle: <>Change control {donnees && donnees.changements.filter((c) => !["cloture", "refuse"].includes(c.statut)).length > 0 && <Badge ton="info">{donnees.changements.filter((c) => !["cloture", "refuse"].includes(c.statut)).length}</Badge>}</> },
        ]}
      />
      {donnees && onglet === "gammes" && (
        <GestionEntites
          table="gammes_maintenance"
          lignes={donnees.gammes}
          recharger={recharger}
          champs={[
            ...champsCible(donnees),
            { cle: "libelle", libelle: "Gamme", type: "texte", requis: true },
            { cle: "periodicite_mois", libelle: "Périodicité (mois)", type: "nombre", requis: true },
            { cle: "date_debut", libelle: "Première échéance", type: "date", requis: true },
            { cle: "prestataire", libelle: "Prestataire / intervenant", type: "texte" },
            { cle: "duree_h", libelle: "Durée estimée (h)", type: "nombre" },
            { cle: "impact_requalification", libelle: "Impact sur l'état qualifié", type: "case", aide: "L'intervention peut modifier l'état qualifié (ouverture de la CTA, changement de filtres terminaux…)" },
            { cle: "actif", libelle: "Statut", type: "case", aide: "Gamme active" },
            { cle: "operations", libelle: "Opérations", type: "lignes", large: true },
            { cle: "notes", libelle: "Notes", type: "zone_texte" },
          ]}
          avantEnregistrement={nettoyerCible}
          valeursInitiales={() => ({ cible: "cta", libelle: "", periodicite_mois: 12, date_debut: new Date().toISOString().slice(0, 10), actif: true, operations: [], impact_requalification: false, cta_id: donnees.ctas[0]?.id ?? null })}
          trier={(a, b) => etatGamme(a, donnees.interventions).prochaine.localeCompare(etatGamme(b, donnees.interventions).prochaine)}
          texteRecherche={(g) => `${g.libelle} ${libelleObjet(donnees, g)} ${g.prestataire}`}
          colonnes={[
            { libelle: "Gamme", rendu: (g) => <><strong className="text-navy-700">{g.libelle}</strong><div className="text-xs text-texte-2">{libelleObjet(donnees, g)}{g.impact_requalification && " · impact qualification"}</div></> },
            { libelle: "Périodicité", rendu: (g) => `${g.periodicite_mois} mois` },
            { libelle: "Dernière", rendu: (g) => formatDate(etatGamme(g, donnees.interventions).derniere) },
            { libelle: "Prochaine", rendu: (g) => { const e = etatGamme(g, donnees.interventions); return g.actif ? <><Badge ton={TON_GAMME[e.statut]}>{LIBELLE_GAMME[e.statut]}</Badge> <span className="text-xs">{formatDate(e.prochaine)}</span></> : <span className="text-texte-2">Inactive</span>; } },
          ]}
          actionsLigne={(g) => {
            const planifiee = donnees.interventions.find((i) => i.gamme_id === g.id && i.statut === "planifiee");
            if (planifiee) return <span className="mr-2 text-xs text-texte-2">planifiée le {formatDate(planifiee.date_prevue)}</span>;
            return ecriture && g.actif ? <Bouton variante="discret" onClick={() => void planifier(g, etatGamme(g, donnees.interventions).prochaine)}>Planifier</Bouton> : null;
          }}
          vide="Aucune gamme de maintenance. Exemples : visite semestrielle CTA, changement des préfiltres, contrôle des portes asservies."
        />
      )}
      {donnees && onglet === "interventions" && (
        <Interventions d={donnees} recharger={recharger} ouvrirCc={(cc) => { setNouveauCc(cc); setOnglet("changements"); }} />
      )}
      {donnees && onglet === "changements" && (
        <GestionEntites
          table="changements"
          lignes={donnees.changements}
          recharger={recharger}
          ouvrir={(c) => setChangement(c.id)}
          champs={champsChangement(donnees)}
          valeursInitiales={() => ({ titre: "", categorie: "autre", type: "mineur" })}
          trier={(a, b) => b.cree_le.localeCompare(a.cree_le)}
          texteRecherche={(c) => `${c.numero} ${c.titre} ${c.description}`}
          colonnes={[
            { libelle: "Changement", rendu: (c) => <><strong className="text-navy-700">{c.numero}</strong> {c.titre}<div className="text-xs text-texte-2">{CATEGORIES_CHANGEMENT[c.categorie]} · {c.type === "majeur" ? "majeur" : "mineur"}{c.salle_id && ` · ${donnees.salles.find((x) => x.id === c.salle_id)?.nom}`}</div></> },
            { libelle: "Requalification", rendu: (c) => (c.requalification_requise ? <Badge ton="cuivre">Requise</Badge> : "—") },
            { libelle: "Échéance", rendu: (c) => formatDate(c.date_cible) },
            { libelle: "Statut", rendu: (c) => <Badge ton={TON_CHANGEMENT[c.statut]}>{STATUTS_CHANGEMENT[c.statut]}</Badge> },
          ]}
          vide="Aucun changement. Tout changement d'installation, de procédé, d'implantation ou de nettoyage passe par ici avant réalisation."
        />
      )}
      {donnees && nouveauCc && <NouveauChangement d={donnees} initial={nouveauCc} onFermer={(id) => { setNouveauCc(null); recharger(); if (id) setChangement(id); }} />}
      {donnees && ouvrirCc && <DetailChangement d={donnees} changement={ouvrirCc} recharger={recharger} onFermer={() => { setChangement(null); recharger(); }} />}
    </>
  );
}

function champsChangement(d: Donnees): DefinitionChamp[] {
  return [
    { cle: "titre", libelle: "Objet du changement", type: "texte", requis: true, large: true },
    { cle: "categorie", libelle: "Catégorie", type: "liste", requis: true, options: optionsDe(CATEGORIES_CHANGEMENT) },
    { cle: "type", libelle: "Importance", type: "liste", requis: true, options: optionsDe({ mineur: "Mineur", majeur: "Majeur" }) },
    { cle: "salle_id", libelle: "Salle propre concernée", type: "liste", options: d.salles.map((x) => ({ valeur: x.id, libelle: x.nom })) },
    { cle: "demandeur", libelle: "Demandeur", type: "texte" },
    { cle: "date_cible", libelle: "Réalisation prévue", type: "date" },
    { cle: "description", libelle: "Description", type: "zone_texte" },
    { cle: "justification", libelle: "Justification", type: "zone_texte" },
    { cle: "plan_actions", libelle: "Plan d'actions", type: "zone_texte" },
  ];
}

function NouveauChangement({ d, initial, onFermer }: { d: Donnees; initial: Partial<Changement>; onFermer: (id: string | null) => void }) {
  const s = useSession();
  const [v, setV] = useState<Record<string, unknown>>({ titre: "", categorie: "autre", type: "mineur", demandeur: s.utilisateur?.nom_complet ?? "", ...initial });
  const action = useAction();
  return (
    <Modale large titre="Nouveau changement" onFermer={() => onFermer(null)} pied={<>
      <Bouton onClick={() => onFermer(null)}>Annuler</Bouton>
      <Bouton variante="principal" disabled={action.enCours || !String(v.titre ?? "").trim()} onClick={() => void action.executer(async () => {
        const c = await s.depot.creer("changements", { ...(v as Partial<Changement>), org_id: s.org!.id, titre: String(v.titre) });
        onFermer(c.id);
      })}>Créer</Bouton>
    </>}>
      <MessageErreur erreur={action.erreur} />
      <Formulaire champs={champsChangement(d)} valeurs={v} onChange={setV} />
    </Modale>
  );
}

function DetailChangement({ d, changement: c, recharger, onFermer }: { d: Donnees; changement: Changement; recharger: () => void; onFermer: () => void }) {
  const s = useSession();
  const navigate = useNavigate();
  const org = s.org!.id;
  const { donnees: sig, recharger: rechargerSig } = useDonnees(() => s.depot.signatures(org, "changement", c.id), [org, c.id]);
  const [evaluation, setEvaluation] = useState<EvaluationChangement>(c.evaluation ?? {});
  const [requalif, setRequalif] = useState(c.requalification_requise);
  const [campagne, setCampagne] = useState(c.campagne_id ?? "");
  const [conclusion, setConclusion] = useState(c.conclusion);
  const [signature, setSignature] = useState<"approbation" | "cloture" | null>(null);
  const action = useAction();
  const modifiable = c.statut === "brouillon" || c.statut === "en_evaluation";
  const ecriture = s.peut("maintenance", 2);
  const validation = s.peut("maintenance", 3);
  const suggestion = requalificationSuggeree({ ...c, evaluation }) && !requalif;
  const campagnesSalle = d.campagnes.filter((x) => !c.salle_id || x.salle_id === c.salle_id);
  const campagneLiee = d.campagnes.find((x) => x.id === campagne);
  const interventions = d.interventions.filter((i) => i.changement_id === c.id);

  const enregistrer = (valeurs: Partial<Changement>) => action.executer(async () => {
    await s.depot.modifier("changements", c.id, { evaluation, requalification_requise: requalif, campagne_id: campagne || null, conclusion, ...valeurs });
    recharger();
  });

  return (
    <Modale large titre={`${c.numero} — ${c.titre}`} onFermer={onFermer} pied={<>
      <Badge ton={TON_CHANGEMENT[c.statut]}>{STATUTS_CHANGEMENT[c.statut]}</Badge>
      <span className="mr-auto" />
      {ecriture && modifiable && <Bouton disabled={action.enCours} onClick={() => void enregistrer({})}>Enregistrer l'évaluation</Bouton>}
      {ecriture && c.statut === "brouillon" && <Bouton variante="principal" onClick={() => void enregistrer({ statut: "en_evaluation" })}>Soumettre à évaluation</Bouton>}
      {validation && c.statut === "en_evaluation" && <>
        <Bouton variante="danger" disabled={!conclusion.trim()} title="Motiver le refus dans la conclusion" onClick={() => void enregistrer({ statut: "refuse" })}>Refuser</Bouton>
        <Bouton variante="principal" onClick={() => void action.executer(async () => { await s.depot.modifier("changements", c.id, { evaluation, requalification_requise: requalif, campagne_id: campagne || null }); setSignature("approbation"); })}>Approuver (signature)</Bouton>
      </>}
      {ecriture && c.statut === "approuve" && <Bouton variante="principal" onClick={() => void enregistrer({ statut: "realise" })}>Déclarer réalisé</Bouton>}
      {validation && c.statut === "realise" && <Bouton variante="principal" disabled={!conclusion.trim()} onClick={() => void action.executer(async () => { await s.depot.modifier("changements", c.id, { conclusion, campagne_id: campagne || null }); setSignature("cloture"); })}>Clôturer (signature)</Bouton>}
    </>}>
      <MessageErreur erreur={action.erreur} />
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="grid gap-4">
          <Carte titre="Description">
            <dl className="grid grid-cols-[160px_1fr] gap-y-1 text-sm">
              <dt className="text-texte-2">Catégorie</dt><dd>{CATEGORIES_CHANGEMENT[c.categorie]} · {c.type === "majeur" ? "majeur" : "mineur"}</dd>
              <dt className="text-texte-2">Salle</dt><dd>{d.salles.find((x) => x.id === c.salle_id)?.nom ?? "—"}</dd>
              <dt className="text-texte-2">Demandeur</dt><dd>{c.demandeur || "—"}</dd>
              <dt className="text-texte-2">Réalisation prévue</dt><dd>{formatDate(c.date_cible)}{c.realise_le && ` · réalisé le ${formatDate(c.realise_le)}`}</dd>
            </dl>
            {c.description && <p className="mt-2 whitespace-pre-line text-sm">{c.description}</p>}
            {c.justification && <p className="mt-2 whitespace-pre-line text-sm"><strong>Justification : </strong>{c.justification}</p>}
            {c.plan_actions && <p className="mt-2 whitespace-pre-line text-sm"><strong>Plan d'actions : </strong>{c.plan_actions}</p>}
          </Carte>
          <Carte titre="Évaluation d'impact">
            <div className="grid gap-1.5 text-sm md:grid-cols-2">
              {(Object.keys(IMPACTS_CHANGEMENT) as (keyof typeof IMPACTS_CHANGEMENT)[]).map((k) => (
                <label key={k} className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1" disabled={!modifiable || !ecriture} checked={!!evaluation[k]} onChange={(e) => setEvaluation({ ...evaluation, [k]: e.target.checked })} />
                  <span>{IMPACTS_CHANGEMENT[k]}</span>
                </label>
              ))}
            </div>
            <Champ libelle="Analyse" className="mt-2"><ZoneTexte disabled={!modifiable || !ecriture} value={evaluation.commentaire ?? ""} onChange={(e) => setEvaluation({ ...evaluation, commentaire: e.target.value })} /></Champ>
            <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" disabled={!modifiable || !ecriture} checked={requalif} onChange={(e) => setRequalif(e.target.checked)} /> Requalification requise avant clôture
            </label>
            {suggestion && <div className="mt-2"><Bandeau ton="attention">Ce changement touche l'état qualifié ou est majeur : une requalification (au minimum partielle) est recommandée.</Bandeau></div>}
          </Carte>
          {(requalif || campagneLiee) && (
            <Carte titre="Requalification">
              <div className="flex flex-wrap items-end gap-2">
                <Champ libelle="Campagne liée">
                  <Liste disabled={!ecriture || c.statut === "cloture"} value={campagne} onChange={(e) => setCampagne(e.target.value)}>
                    <option value="">—</option>
                    {campagnesSalle.map((x) => <option key={x.id} value={x.id}>{x.numero} {x.titre}</option>)}
                  </Liste>
                </Champ>
                {c.salle_id && s.peut("qualification_protocoles", 2) && !campagne && <Bouton onClick={() => navigate(`/qualification/nouvelle?salle=${c.salle_id}`)}>Préparer la campagne</Bouton>}
                {campagneLiee && <Link className="text-sm text-navy-700 underline" to={`/qualification/${campagneLiee.id}`}>ouvrir la campagne ({campagneLiee.statut.replace("_", " ")})</Link>}
              </div>
              {requalif && campagneLiee?.statut !== "cloturee" && <p className="mt-2 text-xs text-texte-2">La clôture du changement sera possible une fois la campagne clôturée.</p>}
            </Carte>
          )}
          {(c.statut === "realise" || c.statut === "en_evaluation" || c.statut === "cloture" || c.statut === "refuse") && (
            <Carte titre="Conclusion">
              <ZoneTexte aria-label="Conclusion" disabled={!validation || c.statut === "cloture" || c.statut === "refuse"} value={conclusion} onChange={(e) => setConclusion(e.target.value)} placeholder="Vérifications réalisées, résultats, documents mis à jour, efficacité…" />
            </Carte>
          )}
        </div>
        <div className="grid content-start gap-4">
          <Carte titre="Signatures"><ListeSignatures signatures={sig ?? []} /></Carte>
          <Carte titre="Interventions liées">
            {interventions.length === 0 ? <p className="text-sm text-texte-2">Aucune.</p> : <ul className="text-sm">{interventions.map((i) => <li key={i.id}>{formatDate(i.date_realisation ?? i.date_prevue)} — {i.titre} ({STATUTS_INTERVENTION[i.statut]})</li>)}</ul>}
          </Carte>
        </div>
      </div>
      {signature && (
        <ModaleSignature
          objetType="changement" objetId={c.id} module="maintenance" significations={["approuve"]} portee={signature}
          objet={`${signature === "approbation" ? "l'approbation" : "la clôture"} du changement ${c.numero}`}
          apres={async () => { await s.depot.modifier("changements", c.id, { statut: signature === "approbation" ? "approuve" : "cloture" }); }}
          onFermer={(ok) => { setSignature(null); rechargerSig(); if (ok) recharger(); }}
        />
      )}
    </Modale>
  );
}

function Interventions({ d, recharger, ouvrirCc }: { d: Donnees; recharger: () => void; ouvrirCc: (cc: Partial<Changement>) => void }) {
  const s = useSession();
  const [filtre, setFiltre] = useState<"" | InterventionMaintenance["statut"]>("planifiee");
  const lignes = d.interventions.filter((i) => !filtre || i.statut === filtre);
  const impact = (i: InterventionMaintenance) => !!d.gammes.find((g) => g.id === i.gamme_id)?.impact_requalification || i.type === "corrective";
  return (
    <GestionEntites
      table="interventions_maintenance"
      lignes={lignes}
      recharger={recharger}
      actions={<Liste aria-label="Statut" className="!w-44" value={filtre} onChange={(e) => setFiltre(e.target.value as typeof filtre)}><option value="">Toutes</option>{Object.entries(STATUTS_INTERVENTION).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Liste>}
      champs={[
        ...champsCible(d),
        { cle: "type", libelle: "Type", type: "liste", requis: true, options: optionsDe({ preventive: "Préventive", corrective: "Corrective" }) },
        { cle: "titre", libelle: "Intitulé", type: "texte", requis: true },
        { cle: "gamme_id", libelle: "Gamme", type: "liste", options: d.gammes.map((g) => ({ valeur: g.id, libelle: g.libelle })) },
        { cle: "date_prevue", libelle: "Date prévue", type: "date", requis: true },
        { cle: "statut", libelle: "Statut", type: "liste", requis: true, options: optionsDe(STATUTS_INTERVENTION) },
        { cle: "date_realisation", libelle: "Réalisée le", type: "date", visible: (v) => v.statut === "realisee" },
        { cle: "intervenant", libelle: "Intervenant", type: "texte" },
        { cle: "compte_rendu", libelle: "Compte rendu", type: "zone_texte", requis: false, aide: "Obligatoire pour une intervention réalisée" },
        { cle: "remise_en_service", libelle: "Vérifications avant remise en service", type: "zone_texte", aide: "Ex. pressions vérifiées, nettoyage de remise en service, comptage particulaire" },
        { cle: "changement_id", libelle: "Change control", type: "liste", options: d.changements.map((c) => ({ valeur: c.id, libelle: `${c.numero} ${c.titre}` })) },
      ]}
      avantEnregistrement={nettoyerCible}
      valeursInitiales={() => ({ cible: "salle", type: "corrective", titre: "", date_prevue: new Date().toISOString().slice(0, 10), statut: "planifiee", salle_id: d.salles[0]?.id ?? null, gamme_id: null, changement_id: null })}
      trier={(a, b) => b.date_prevue.localeCompare(a.date_prevue)}
      texteRecherche={(i) => `${i.titre} ${libelleObjet(d, i)} ${i.intervenant}`}
      colonnes={[
        { libelle: "Intervention", rendu: (i) => <><strong className="text-navy-700">{i.titre}</strong><div className="text-xs text-texte-2">{libelleObjet(d, i)} · {i.type === "corrective" ? "corrective" : "préventive"}</div></> },
        { libelle: "Date", rendu: (i) => formatDate(i.date_realisation ?? i.date_prevue) },
        { libelle: "Intervenant", rendu: (i) => i.intervenant || "—" },
        { libelle: "Statut", rendu: (i) => <Badge ton={i.statut === "realisee" ? "ok" : i.statut === "annulee" ? "neutre" : i.date_prevue < new Date().toISOString().slice(0, 10) ? "alerte" : "info"}>{STATUTS_INTERVENTION[i.statut]}</Badge> },
      ]}
      actionsLigne={(i) => (i.statut === "realisee" && impact(i) && !i.changement_id && s.peut("maintenance", 2)
        ? <Bouton variante="discret" title="L'intervention peut avoir modifié l'état qualifié" onClick={() => ouvrirCc({ titre: `Suite intervention : ${i.titre}`, categorie: i.cta_id ? "traitement_air" : "installation", salle_id: i.salle_id, description: i.compte_rendu })}>Ouvrir un change control</Bouton>
        : null)}
      vide="Aucune intervention pour ce filtre."
    />
  );
}
