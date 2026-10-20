import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useSession, nomUtilisateur } from "../session";
import type { AnalyseCauses, Capa, Ecart, StatutEcart } from "../data/types";
import { Badge, Bandeau, Bouton, Carte, Champ, EnTete, Liste, MessageErreur, Modale, Saisie, Vide, ZoneTexte, formatDate, telechargerFichier, useAction, useDonnees } from "../ui/composants";
import { versCsv } from "../domain/csv";
import { Formulaire, GestionEntites, champsManquants, optionsDe, type DefinitionChamp } from "../ui/entites";
import { FilDiscussion } from "../ui/discussion";
import { ListeSignatures, ModaleSignature } from "../ui/signature";

export const LIBELLES_STATUTS_ECART: Record<StatutEcart, string> = {
  ouvert: "Ouvert", en_analyse: "En analyse", capa_en_cours: "CAPA en cours", a_verifier: "À vérifier", cloture: "Clôturé", annule: "Annulé",
};
const TON_STATUT: Record<StatutEcart, "neutre" | "info" | "cuivre" | "attention" | "ok" | "alerte"> = {
  ouvert: "alerte", en_analyse: "attention", capa_en_cours: "cuivre", a_verifier: "info", cloture: "ok", annule: "neutre",
};
export const LIBELLES_ORIGINES_ECART: Record<string, string> = {
  qualification: "Qualification", surveillance: "Surveillance", nettoyage: "Nettoyage", audit: "Audit", etalonnage: "Étalonnage",
  reclamation: "Réclamation", maintenance: "Maintenance", autre: "Autre",
};
const LIBELLES_GRAVITE = { mineure: "Mineure", majeure: "Majeure", critique: "Critique" };
const TON_GRAVITE = { mineure: "neutre", majeure: "attention", critique: "alerte" } as const;
export const LIBELLES_STATUTS_CAPA: Record<Capa["statut"], string> = {
  a_faire: "À faire", en_cours: "En cours", realisee: "Réalisée", efficace: "Efficace", non_efficace: "Non efficace", annulee: "Annulée",
};
const TON_CAPA = { a_faire: "neutre", en_cours: "cuivre", realisee: "info", efficace: "ok", non_efficace: "alerte", annulee: "neutre" } as const;

const ISHIKAWA: Record<string, string> = { methode: "Méthode", milieu: "Milieu", main_oeuvre: "Main-d'œuvre", materiel: "Matériel", matiere: "Matière", mesure: "Mesure" };

function champsEcart(salles: { id: string; nom: string }[]): DefinitionChamp[] {
  return [
    { cle: "titre", libelle: "Titre", type: "texte", requis: true, large: true },
    { cle: "origine", libelle: "Origine", type: "liste", requis: true, options: optionsDe(LIBELLES_ORIGINES_ECART) },
    { cle: "gravite", libelle: "Gravité", type: "liste", requis: true, options: optionsDe(LIBELLES_GRAVITE) },
    { cle: "salle_id", libelle: "Salle propre concernée", type: "liste", options: salles.map((x) => ({ valeur: x.id, libelle: x.nom })) },
    { cle: "date_detection", libelle: "Date de détection", type: "date", requis: true },
    { cle: "detecte_par", libelle: "Détecté par", type: "texte" },
    { cle: "description", libelle: "Description", type: "zone_texte" },
    { cle: "impact", libelle: "Évaluation de l'impact (produit, patient, environnement)", type: "zone_texte" },
  ];
}

export function Ecarts() {
  const s = useSession();
  const org = s.org!.id;
  const naviguer = useNavigate();
  const { donnees, erreur, recharger } = useDonnees(async () => {
    const [ecarts, capa, salles] = await Promise.all([s.depot.lister("ecarts", org), s.depot.lister("capa", org), s.depot.lister("salles_propres", org)]);
    return { ecarts, capa, salles };
  }, [org]);
  const [filtres, setFiltres] = useState({ statut: "actifs", gravite: "", origine: "" });
  const lignes = useMemo(() => (donnees?.ecarts ?? [])
    .filter((e) => (filtres.statut === "actifs" ? !["cloture", "annule"].includes(e.statut) : !filtres.statut || e.statut === filtres.statut))
    .filter((e) => !filtres.gravite || e.gravite === filtres.gravite)
    .filter((e) => !filtres.origine || e.origine === filtres.origine), [donnees, filtres]);
  const jour = new Date().toISOString().slice(0, 10);
  const capaEnRetard = (donnees?.capa ?? []).filter((c) => (c.statut === "a_faire" || c.statut === "en_cours") && c.echeance && c.echeance < jour).length;

  return (
    <>
      <EnTete
        titre="Écarts et CAPA"
        sousTitre="Déviations détectées (automatiquement ou déclarées), analyse des causes, actions correctives et préventives, vérification d'efficacité."
        actions={<Bouton onClick={() => telechargerFichier(`ecarts-${jour}.csv`, versCsv(
          ["Numéro", "Titre", "Origine", "Gravité", "Statut", "Salle", "Détecté le", "Clôturé le", "Cause racine", "CAPA", "CAPA efficaces"],
          lignes.map((e) => {
            const capa = (donnees?.capa ?? []).filter((c) => c.ecart_id === e.id);
            return [e.numero, e.titre, LIBELLES_ORIGINES_ECART[e.origine], LIBELLES_GRAVITE[e.gravite], LIBELLES_STATUTS_ECART[e.statut], donnees?.salles.find((x) => x.id === e.salle_id)?.nom, e.date_detection, e.cloture_le,
              e.analyse_causes?.cause_racine ?? "", capa.length, capa.filter((c) => c.statut === "efficace").length];
          }),
        ), "text/csv")}>Exporter (CSV)</Bouton>}
      />
      <MessageErreur erreur={erreur} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Écarts ouverts", (donnees?.ecarts ?? []).filter((e) => !["cloture", "annule"].includes(e.statut)).length],
          ["Dont critiques", (donnees?.ecarts ?? []).filter((e) => e.gravite === "critique" && !["cloture", "annule"].includes(e.statut)).length],
          ["CAPA ouvertes", (donnees?.capa ?? []).filter((c) => ["a_faire", "en_cours", "realisee"].includes(c.statut)).length],
          ["CAPA en retard", capaEnRetard],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl border border-bord bg-white p-3"><div className="text-xs text-texte-2">{l}</div><div className="text-2xl font-bold text-navy-900">{v}</div></div>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Liste aria-label="Statut" className="!w-48" value={filtres.statut} onChange={(e) => setFiltres({ ...filtres, statut: e.target.value })}>
          <option value="actifs">Non clôturés</option><option value="">Tous</option>
          {Object.entries(LIBELLES_STATUTS_ECART).map(([c, l]) => <option key={c} value={c}>{l}</option>)}
        </Liste>
        <Liste aria-label="Gravité" className="!w-40" value={filtres.gravite} onChange={(e) => setFiltres({ ...filtres, gravite: e.target.value })}><option value="">Toutes gravités</option>{Object.entries(LIBELLES_GRAVITE).map(([c, l]) => <option key={c} value={c}>{l}</option>)}</Liste>
        <Liste aria-label="Origine" className="!w-44" value={filtres.origine} onChange={(e) => setFiltres({ ...filtres, origine: e.target.value })}><option value="">Toutes origines</option>{Object.entries(LIBELLES_ORIGINES_ECART).map(([c, l]) => <option key={c} value={c}>{l}</option>)}</Liste>
      </div>
      <GestionEntites
        table="ecarts"
        lignes={donnees ? lignes : null}
        recharger={recharger}
        champs={champsEcart(donnees?.salles ?? [])}
        valeursInitiales={() => ({ titre: "", origine: "autre", gravite: "mineure", date_detection: jour, detecte_par: s.utilisateur?.nom_complet ?? "", salle_id: null })}
        ouvrir={(e) => naviguer(`/ecarts/${e.id}`)}
        texteRecherche={(e) => `${e.numero} ${e.titre} ${e.description}`}
        trier={(a, b) => b.date_detection.localeCompare(a.date_detection) || (b.numero ?? "").localeCompare(a.numero ?? "")}
        colonnes={[
          { libelle: "N°", rendu: (e) => <span className="whitespace-nowrap font-mono text-xs">{e.numero}</span> },
          { libelle: "Écart", rendu: (e) => <><strong className="text-navy-700">{e.titre}</strong>{e.automatique && <Badge ton="info">auto</Badge>}<div className="text-xs text-texte-2">{donnees?.salles.find((x) => x.id === e.salle_id)?.nom}</div></> },
          { libelle: "Origine", rendu: (e) => LIBELLES_ORIGINES_ECART[e.origine] },
          { libelle: "Gravité", rendu: (e) => <Badge ton={TON_GRAVITE[e.gravite]}>{LIBELLES_GRAVITE[e.gravite]}</Badge> },
          { libelle: "Détecté le", rendu: (e) => formatDate(e.date_detection) },
          { libelle: "CAPA", rendu: (e) => { const l = donnees!.capa.filter((c) => c.ecart_id === e.id); return l.length ? `${l.filter((c) => c.statut === "efficace" || c.statut === "annulee").length}/${l.length}` : "—"; } },
          { libelle: "Statut", rendu: (e) => <Badge ton={TON_STATUT[e.statut]}>{LIBELLES_STATUTS_ECART[e.statut]}</Badge> },
        ]}
        vide="Aucun écart pour ces critères."
      />
    </>
  );
}

export function EcartDetail() {
  const { id = "" } = useParams();
  const s = useSession();
  const org = s.org!.id;
  const { donnees, erreur, recharger } = useDonnees(async () => {
    const [ecarts, capa, salles, signatures] = await Promise.all([
      s.depot.lister("ecarts", org, { id }), s.depot.lister("capa", org, { ecart_id: id }), s.depot.lister("salles_propres", org), s.depot.signatures(org, "ecart", id),
    ]);
    return { ecart: ecarts[0] ?? null, capa, salles, signatures };
  }, [org, id]);
  const [edition, setEdition] = useState<Record<string, unknown> | null>(null);
  const [analyse, setAnalyse] = useState<AnalyseCauses | null>(null);
  const [capaAction, setCapaAction] = useState<{ capa: Capa; mode: "realisee" | "verification" } | null>(null);
  const [cloture, setCloture] = useState<string | null>(null);
  const [signer, setSigner] = useState(false);
  const action = useAction();

  if (erreur) return <MessageErreur erreur={erreur} />;
  if (!donnees) return <p className="text-texte-2">Chargement…</p>;
  if (!donnees.ecart) return <Vide>Écart introuvable.</Vide>;
  const e: Ecart = donnees.ecart;
  const ecriture = s.peut("ecarts_capa", 2);
  const validation = s.peut("ecarts_capa", 3);
  const fige = e.statut === "cloture" || e.statut === "annule";
  const champs = champsEcart(donnees.salles);
  const capaSoldees = donnees.capa.length > 0 && donnees.capa.every((c) => c.statut === "efficace" || c.statut === "annulee");
  const capaRealisees = donnees.capa.length > 0 && donnees.capa.every((c) => ["realisee", "efficace", "annulee"].includes(c.statut));
  const a = analyse ?? e.analyse_causes ?? {};
  const statut = (st: StatutEcart) => action.executer(async () => { await s.depot.modifier("ecarts", e.id, { statut: st }); recharger(); });
  const majCapa = (c: Capa, valeurs: Partial<Capa>) => action.executer(async () => { await s.depot.modifier("capa", c.id, valeurs); recharger(); });

  return (
    <>
      <EnTete
        titre={<><span className="mr-2 font-mono text-base text-texte-2">{e.numero}</span>{e.titre}</>}
        sousTitre={<>{LIBELLES_ORIGINES_ECART[e.origine]} · détecté le {formatDate(e.date_detection)}{e.detecte_par && ` par ${e.detecte_par}`}{e.automatique && " · créé automatiquement"} · <Link to="/ecarts" className="text-navy-700 hover:underline">tous les écarts</Link></>}
        actions={<>
          <Badge ton={TON_GRAVITE[e.gravite]}>{LIBELLES_GRAVITE[e.gravite]}</Badge>
          <Badge ton={TON_STATUT[e.statut]}>{LIBELLES_STATUTS_ECART[e.statut]}</Badge>
          {e.lien && <Link to={e.lien}><Bouton>Voir l'origine</Bouton></Link>}
          {!fige && ecriture && <Bouton onClick={() => setEdition({ ...e })}>Modifier</Bouton>}
          {!fige && validation && <Bouton variante="danger" onClick={() => { if (window.confirm("Annuler cet écart (déclaré à tort) ?")) void statut("annule"); }}>Annuler l'écart</Bouton>}
        </>}
      />
      <MessageErreur erreur={action.erreur} />

      <Carte className="mb-4" titre="Étape en cours">
        {e.statut === "ouvert" && <div className="flex flex-wrap items-center gap-3"><p className="flex-1 text-sm">Évaluez l'impact puis analysez les causes.</p>{ecriture && <Bouton variante="principal" onClick={() => void statut("en_analyse")}>Démarrer l'analyse</Bouton>}</div>}
        {e.statut === "en_analyse" && <div className="flex flex-wrap items-center gap-3"><p className="flex-1 text-sm">Renseignez la cause racine et définissez au moins une CAPA.</p>{ecriture && <Bouton variante="principal" disabled={donnees.capa.length === 0 || !a.cause_racine?.trim()} onClick={() => void statut("capa_en_cours")}>Lancer les CAPA</Bouton>}</div>}
        {e.statut === "capa_en_cours" && <div className="flex flex-wrap items-center gap-3"><p className="flex-1 text-sm">Les propriétaires réalisent leurs actions et joignent une preuve.</p>{ecriture && <Bouton variante="principal" disabled={!capaRealisees} onClick={() => void statut("a_verifier")}>Passer à la vérification</Bouton>}</div>}
        {e.statut === "a_verifier" && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-sm">L'assurance qualité vérifie l'efficacité de chaque CAPA, puis clôture l'écart par signature.</p>
            {validation && <Bouton variante="principal" disabled={!capaSoldees} onClick={() => setCloture(e.conclusion)}>Clôturer l'écart</Bouton>}
          </div>
        )}
        {e.statut === "cloture" && <p className="text-sm">Clôturé le {formatDate(e.cloture_le)}. {e.conclusion}</p>}
        {e.statut === "annule" && <p className="text-sm">Écart annulé.</p>}
      </Carte>

      <div className="grid gap-4 lg:grid-cols-2">
        <Carte titre="Description et impact">
          <p className="mb-2 whitespace-pre-line text-sm">{e.description || <span className="text-texte-2">Aucune description.</span>}</p>
          <h3 className="mt-3 text-sm font-semibold">Évaluation de l'impact</h3>
          <p className="whitespace-pre-line text-sm">{e.impact || <span className="text-texte-2">À évaluer.</span>}</p>
          {e.salle_id && <p className="mt-2 text-sm">Salle : <Link to={`/salles/${e.salle_id}`} className="text-navy-700 hover:underline">{donnees.salles.find((x) => x.id === e.salle_id)?.nom}</Link></p>}
        </Carte>

        <Carte
          titre="Analyse des causes"
          actions={!fige && ecriture && analyse && <Bouton variante="principal" disabled={action.enCours} onClick={() => void action.executer(async () => { await s.depot.modifier("ecarts", e.id, { analyse_causes: analyse }); setAnalyse(null); recharger(); })}>Enregistrer l'analyse</Bouton>}
        >
          <h3 className="mb-1 text-sm font-semibold">5 pourquoi</h3>
          <ol className="mb-3 space-y-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <li key={i} className="flex items-center gap-2 text-sm"><span className="w-20 shrink-0 text-texte-2">Pourquoi {i + 1}</span>
                <Saisie aria-label={`Pourquoi ${i + 1}`} disabled={fige || !ecriture} value={a.pourquoi?.[i] ?? ""} onChange={(ev) => { const p = [...(a.pourquoi ?? [])]; p[i] = ev.target.value; setAnalyse({ ...a, pourquoi: p }); }} />
              </li>
            ))}
          </ol>
          <h3 className="mb-1 text-sm font-semibold">Diagramme d'Ishikawa (6M)</h3>
          <div className="mb-3 grid gap-2 md:grid-cols-2">
            {Object.entries(ISHIKAWA).map(([cle, l]) => (
              <Champ key={cle} libelle={l}><Saisie disabled={fige || !ecriture} value={a.ishikawa?.[cle as keyof NonNullable<AnalyseCauses["ishikawa"]>] ?? ""} onChange={(ev) => setAnalyse({ ...a, ishikawa: { ...a.ishikawa, [cle]: ev.target.value } })} /></Champ>
            ))}
          </div>
          <Champ libelle="Cause racine retenue"><ZoneTexte disabled={fige || !ecriture} value={a.cause_racine ?? ""} onChange={(ev) => setAnalyse({ ...a, cause_racine: ev.target.value })} /></Champ>
        </Carte>
      </div>

      <Carte className="mt-4">
        <GestionEntites
          table="capa"
          titre="Actions correctives et préventives"
          lignes={donnees.capa}
          lectureSeule={fige}
          recharger={recharger}
          champs={[
            { cle: "type", libelle: "Type", type: "liste", requis: true, options: optionsDe({ corrective: "Corrective", preventive: "Préventive" }) },
            { cle: "proprietaire", libelle: "Propriétaire", type: "liste", options: s.profils.map((p) => ({ valeur: p.id, libelle: p.nom_complet || p.email })) },
            { cle: "action", libelle: "Action", type: "zone_texte", requis: true },
            { cle: "echeance", libelle: "Échéance", type: "date" },
            { cle: "verification_prevue", libelle: "Vérification d'efficacité prévue le", type: "date" },
          ]}
          valeursInitiales={() => ({ ecart_id: e.id, type: "corrective", action: "", proprietaire: s.utilisateur?.id ?? null, echeance: null, verification_prevue: null })}
          colonnes={[
            { libelle: "N°", rendu: (c) => <span className="font-mono text-xs">{c.numero}</span> },
            { libelle: "Action", rendu: (c) => <><Badge>{c.type === "corrective" ? "Corrective" : "Préventive"}</Badge> {c.action}{c.preuve && <div className="text-xs text-texte-2">Preuve : {c.preuve}</div>}{c.verification_resultat && <div className="text-xs text-texte-2">Vérification : {c.verification_resultat}</div>}</> },
            { libelle: "Propriétaire", rendu: (c) => (c.proprietaire ? nomUtilisateur(s.profils, c.proprietaire) : "—") },
            { libelle: "Échéance", rendu: (c) => <span className={c.echeance && c.echeance < new Date().toISOString().slice(0, 10) && ["a_faire", "en_cours"].includes(c.statut) ? "font-semibold text-red-700" : ""}>{formatDate(c.echeance)}</span> },
            { libelle: "Statut", rendu: (c) => <Badge ton={TON_CAPA[c.statut]}>{LIBELLES_STATUTS_CAPA[c.statut]}</Badge> },
          ]}
          actionsLigne={(c) => fige ? null : <>
            {c.statut === "a_faire" && ecriture && <Bouton variante="discret" onClick={() => void majCapa(c, { statut: "en_cours" })}>Démarrer</Bouton>}
            {(c.statut === "a_faire" || c.statut === "en_cours" || c.statut === "non_efficace") && ecriture && <Bouton variante="discret" onClick={() => setCapaAction({ capa: c, mode: "realisee" })}>Déclarer réalisée</Bouton>}
            {c.statut === "realisee" && validation && <Bouton variante="discret" onClick={() => setCapaAction({ capa: c, mode: "verification" })}>Vérifier l'efficacité</Bouton>}
          </>}
          vide="Aucune CAPA définie."
        />
      </Carte>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
        <Carte titre="Discussion"><FilDiscussion objetType="ecart" objetId={e.id} objetLibelle={`${e.numero} ${e.titre}`} lien={`/ecarts/${e.id}`} /></Carte>
        <Carte titre="Signatures"><ListeSignatures signatures={donnees.signatures} /></Carte>
      </div>

      {edition && (
        <Modale large titre="Modifier l'écart" onFermer={() => setEdition(null)} pied={<>
          <Bouton onClick={() => setEdition(null)}>Annuler</Bouton>
          <Bouton variante="principal" disabled={action.enCours || champsManquants(champs, edition).length > 0} onClick={() => void action.executer(async () => {
            await s.depot.modifier("ecarts", e.id, Object.fromEntries(champs.map((c) => [c.cle, edition[c.cle]])));
            setEdition(null); recharger();
          })}>Enregistrer</Bouton>
        </>}>
          <Formulaire champs={champs} valeurs={edition} onChange={setEdition} />
        </Modale>
      )}
      {capaAction && <ModaleCapa capa={capaAction.capa} mode={capaAction.mode} onFermer={() => { setCapaAction(null); recharger(); }} />}
      {cloture !== null && (
        <Modale titre="Clôture de l'écart" onFermer={() => setCloture(null)} pied={<>
          <Bouton onClick={() => setCloture(null)}>Annuler</Bouton>
          <Bouton variante="principal" disabled={!cloture.trim() || action.enCours} onClick={() => void action.executer(async () => { await s.depot.modifier("ecarts", e.id, { conclusion: cloture }); setSigner(true); })}>Signer et clôturer</Bouton>
        </>}>
          <MessageErreur erreur={action.erreur} />
          <Bandeau>Toutes les CAPA sont vérifiées efficaces ou annulées. La clôture est définitive.</Bandeau>
          <Champ libelle="Conclusion" className="mt-3"><ZoneTexte rows={5} value={cloture} onChange={(ev) => setCloture(ev.target.value)} /></Champ>
        </Modale>
      )}
      {signer && (
        <ModaleSignature
          objetType="ecart" objetId={e.id} objet={`la clôture de l'écart ${e.numero}`} module="ecarts_capa" significations={["approuve"]} portee="cloture"
          apres={async () => { await s.depot.modifier("ecarts", e.id, { statut: "cloture" }); }}
          onFermer={(ok) => { setSigner(false); if (ok) setCloture(null); recharger(); }}
        />
      )}
    </>
  );
}

function ModaleCapa({ capa, mode, onFermer }: { capa: Capa; mode: "realisee" | "verification"; onFermer: () => void }) {
  const s = useSession();
  const [texte, setTexte] = useState(mode === "realisee" ? capa.preuve : capa.verification_resultat);
  const action = useAction();
  const enregistrer = (statut: Capa["statut"]) => action.executer(async () => {
    await s.depot.modifier("capa", capa.id, mode === "realisee" ? { statut, preuve: texte } : { statut, verification_resultat: texte });
    onFermer();
  });
  return (
    <Modale titre={mode === "realisee" ? `${capa.numero} — action réalisée` : `${capa.numero} — vérification d'efficacité`} onFermer={onFermer} pied={<>
      <Bouton onClick={onFermer}>Annuler</Bouton>
      {mode === "realisee" ? <Bouton variante="principal" disabled={!texte.trim() || action.enCours} onClick={() => void enregistrer("realisee")}>Déclarer réalisée</Bouton> : <>
        <Bouton variante="danger" disabled={!texte.trim() || action.enCours} onClick={() => void enregistrer("non_efficace")}>Non efficace</Bouton>
        <Bouton variante="principal" disabled={!texte.trim() || action.enCours} onClick={() => void enregistrer("efficace")}>Efficace</Bouton>
      </>}
    </>}>
      <MessageErreur erreur={action.erreur} />
      <p className="mb-3 text-sm">{capa.action}</p>
      <Champ libelle={mode === "realisee" ? "Preuve de réalisation (document, relevé, photo…)" : "Résultat de la vérification (indicateur, période observée)"}>
        <ZoneTexte value={texte} onChange={(e) => setTexte(e.target.value)} />
      </Champ>
      {mode === "verification" && <p className="mt-2 text-xs text-texte-2">« Non efficace » renvoie l'action au propriétaire, qui devra la reprendre.</p>}
    </Modale>
  );
}
