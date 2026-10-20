import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useSession } from "../../session";
import type { EtatOccupation } from "../../data/types";
import { Badge, Bandeau, Bouton, Carte, Champ, EnTete, Liste, MessageErreur, Saisie, SaisieNombre, TableauDefilant, ZoneTexte, useAction, useDonnees } from "../../ui/composants";
import { LIBELLES_ETATS, proposerEssais, type EssaiPropose } from "../../domain/qualification";
import { libelleClasse } from "../../domain/referentiels/classesIso";
import { TYPES_EQUIPEMENTS } from "../../domain/libelles";
import { TYPES_CAMPAGNE } from "./Qualification";

const ETAPES_QUALIF: Record<string, string> = {
  QC: "QC — qualification de conception",
  QI: "QI — qualification d'installation",
  QO: "QO — qualification opérationnelle",
  QP: "QP — qualification de performance",
};

const OBJECTIFS: Record<string, string> = {
  initiale: "Démontrer que les locaux et installations de traitement d'air répondent aux exigences de conception (URS) et aux classes de propreté visées, avant leur mise en service.",
  periodique: "Vérifier, à la périodicité définie par l'ISO 14644-2 et l'analyse de risque, que la salle propre reste conforme à sa classe et à ses consignes.",
  modification: "Évaluer l'impact d'une modification (travaux, changement de filtre, déplacement d'équipement) et requalifier les éléments concernés.",
};

export function AssistantCampagne() {
  const s = useSession();
  const org = s.org!.id;
  const naviguer = useNavigate();
  const [parametres] = useSearchParams();
  const action = useAction();
  const { donnees } = useDonnees(async () => {
    const [salles, zones, ctas, bouches, filtres, equipements] = await Promise.all([
      s.depot.lister("salles_propres", org), s.depot.lister("zones", org),
      s.peut("cta", 1) ? s.depot.lister("ctas", org) : [], s.peut("cta", 1) ? s.depot.lister("bouches", org) : [],
      s.peut("cta", 1) ? s.depot.lister("filtres", org) : [], s.depot.lister("equipements", org),
    ]);
    return { salles, zones, ctas, bouches, filtres, equipements };
  }, [org]);

  const [etape, setEtape] = useState(0);
  const [salleId, setSalleId] = useState(parametres.get("salle") ?? "");
  const [infos, setInfos] = useState({ type: "periodique", etapes: ["QO"] as string[], titre: "", responsable: s.utilisateur?.nom_complet ?? "", prestataire: "", objectif: OBJECTIFS.periodique, date_debut: "" });
  const [selection, setSelection] = useState<{ zones: string[]; ctas: string[]; equipements: string[]; etats: EtatOccupation[]; optionnels: boolean }>({ zones: [], ctas: [], equipements: [], etats: ["repos"], optionnels: false });
  const [essais, setEssais] = useState<(EssaiPropose & { retenu: boolean })[]>([]);

  const salle = donnees?.salles.find((x) => x.id === salleId);
  const zones = useMemo(() => donnees?.zones.filter((z) => z.salle_id === salleId) ?? [], [donnees, salleId]);
  const bouchesSalle = useMemo(() => donnees?.bouches.filter((b) => b.salle_id === salleId) ?? [], [donnees, salleId]);
  const ctas = useMemo(() => donnees?.ctas.filter((c) => bouchesSalle.some((b) => b.cta_id === c.id)) ?? [], [donnees, bouchesSalle]);
  const equipements = useMemo(() => donnees?.equipements.filter((e) => e.salle_id === salleId) ?? [], [donnees, salleId]);

  useEffect(() => {
    if (!salle) return;
    setInfos((i) => ({ ...i, titre: `Qualification ${TYPES_CAMPAGNE[i.type].toLowerCase()} — ${salle.nom}` }));
    setSelection((sel) => ({ ...sel, zones: zones.map((z) => z.id), ctas: ctas.map((c) => c.id), equipements: equipements.filter((e) => ["psm", "hotte_flux", "isolateur"].includes(e.type)).map((e) => e.id) }));
  }, [salle, zones, ctas, equipements]);

  const proposer = () => {
    const liste = proposerEssais({
      zones: zones.filter((z) => selection.zones.includes(z.id)),
      ctas: ctas.filter((c) => selection.ctas.includes(c.id)),
      equipements: equipements.filter((e) => selection.equipements.includes(e.id)),
      bouches: bouchesSalle, filtres: donnees?.filtres ?? [], etats: selection.etats, optionnels: selection.optionnels,
    });
    setEssais(liste.map((e) => ({ ...e, retenu: true })));
  };

  const basculer = <K extends "zones" | "ctas" | "equipements">(cle: K, id: string) =>
    setSelection({ ...selection, [cle]: selection[cle].includes(id) ? selection[cle].filter((x) => x !== id) : [...selection[cle], id] });

  const creer = () => action.executer(async () => {
    const campagne = await s.depot.creer("campagnes_qualification", {
      org_id: org, salle_id: salleId, titre: infos.titre.trim(), type_campagne: infos.type as "initiale", etapes: infos.etapes,
      objectif: infos.objectif, responsable: infos.responsable, prestataire: infos.prestataire, date_debut: infos.date_debut || null,
    });
    await s.depot.creerPlusieurs("essais", essais.filter((e) => e.retenu).map(({ retenu: _r, ...e }, i) => ({ ...e, org_id: org, campagne_id: campagne.id, ordre: i + 1 })));
    naviguer(`/qualification/${campagne.id}`);
  });

  if (!s.peut("qualification_protocoles", 2) || !s.peut("qualification_execution", 2)) {
    return <Bandeau ton="attention">Créer une campagne demande l'écriture sur les protocoles et sur l'exécution de la qualification.</Bandeau>;
  }

  const retenus = essais.filter((e) => e.retenu).length;
  const valide = [!!salleId && !!infos.titre.trim() && infos.etapes.length > 0, selection.zones.length + selection.ctas.length + selection.equipements.length > 0 && selection.etats.length > 0, retenus > 0];

  return (
    <>
      <EnTete titre="Nouvelle campagne de qualification" sousTitre="Les essais et leurs critères d'acceptation sont proposés à partir des exigences des zones, des CTA et des équipements." />
      <ol className="mb-5 flex flex-wrap gap-2">
        {["Campagne", "Objets qualifiés", "Essais et critères"].map((nom, i) => (
          <li key={nom}><span className={`rounded-full border px-3 py-1 text-sm ${i === etape ? "border-navy-700 bg-navy-700 text-white" : "border-bord bg-white text-texte-2"}`}>{i + 1}. {nom}</span></li>
        ))}
      </ol>
      <MessageErreur erreur={action.erreur} />

      {etape === 0 && (
        <Carte titre="Campagne">
          <div className="grid gap-3 md:grid-cols-2">
            <Champ libelle="Salle propre"><Liste value={salleId} onChange={(e) => setSalleId(e.target.value)}><option value="">— Choisir —</option>{donnees?.salles.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</Liste></Champ>
            <Champ libelle="Type de campagne">
              <Liste value={infos.type} onChange={(e) => setInfos({ ...infos, type: e.target.value, objectif: OBJECTIFS[e.target.value], titre: salle ? `Qualification ${TYPES_CAMPAGNE[e.target.value].toLowerCase()} — ${salle.nom}` : infos.titre })}>
                {Object.entries(TYPES_CAMPAGNE).map(([c, l]) => <option key={c} value={c}>{l}</option>)}
              </Liste>
            </Champ>
            <Champ libelle="Titre" className="md:col-span-2"><Saisie value={infos.titre} onChange={(e) => setInfos({ ...infos, titre: e.target.value })} /></Champ>
            <Champ libelle="Étapes de qualification" className="md:col-span-2">
              <div className="flex flex-wrap gap-4 text-sm">
                {Object.entries(ETAPES_QUALIF).map(([c, l]) => (
                  <label key={c} className="flex items-center gap-1.5"><input type="checkbox" checked={infos.etapes.includes(c)} onChange={(e) => setInfos({ ...infos, etapes: e.target.checked ? [...infos.etapes, c].sort((a, b) => Object.keys(ETAPES_QUALIF).indexOf(a) - Object.keys(ETAPES_QUALIF).indexOf(b)) : infos.etapes.filter((x) => x !== c) })} />{l}</label>
                ))}
              </div>
            </Champ>
            <Champ libelle="Responsable"><Saisie value={infos.responsable} onChange={(e) => setInfos({ ...infos, responsable: e.target.value })} /></Champ>
            <Champ libelle="Prestataire (si externe)"><Saisie value={infos.prestataire} onChange={(e) => setInfos({ ...infos, prestataire: e.target.value })} /></Champ>
            <Champ libelle="Date de début prévue"><Saisie type="date" value={infos.date_debut} onChange={(e) => setInfos({ ...infos, date_debut: e.target.value })} /></Champ>
            <Champ libelle="Objectif" className="md:col-span-2"><ZoneTexte value={infos.objectif} onChange={(e) => setInfos({ ...infos, objectif: e.target.value })} /></Champ>
          </div>
        </Carte>
      )}

      {etape === 1 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Carte titre={`Zones (${selection.zones.length}/${zones.length})`}>
            {zones.map((z) => <label key={z.id} className="flex items-center gap-2 py-0.5 text-sm"><input type="checkbox" checked={selection.zones.includes(z.id)} onChange={() => basculer("zones", z.id)} />{z.code} {z.nom} <Badge>{libelleClasse(z.iso_repos)}</Badge></label>)}
          </Carte>
          <Carte titre={`CTA desservant la salle (${selection.ctas.length}/${ctas.length})`}>
            {ctas.length === 0 && <p className="text-sm text-texte-2">Aucune CTA reliée par des bouches.</p>}
            {ctas.map((c) => <label key={c.id} className="flex items-center gap-2 py-0.5 text-sm"><input type="checkbox" checked={selection.ctas.includes(c.id)} onChange={() => basculer("ctas", c.id)} />{c.nom}</label>)}
          </Carte>
          <Carte titre={`Équipements (${selection.equipements.length}/${equipements.length})`}>
            {equipements.length === 0 && <p className="text-sm text-texte-2">Aucun équipement dans la salle.</p>}
            {equipements.map((q) => <label key={q.id} className="flex items-center gap-2 py-0.5 text-sm"><input type="checkbox" checked={selection.equipements.includes(q.id)} onChange={() => basculer("equipements", q.id)} />{q.libelle} <span className="text-xs text-texte-2">{TYPES_EQUIPEMENTS[q.type]}</span></label>)}
          </Carte>
          <Carte titre="États d'occupation et options" className="lg:col-span-3">
            <div className="flex flex-wrap gap-4 text-sm">
              {(Object.entries(LIBELLES_ETATS) as [EtatOccupation, string][]).map(([c, l]) => (
                <label key={c} className="flex items-center gap-1.5"><input type="checkbox" checked={selection.etats.includes(c)} onChange={(e) => setSelection({ ...selection, etats: e.target.checked ? [...selection.etats, c] : selection.etats.filter((x) => x !== c) })} />Classification {l.toLowerCase()}</label>
              ))}
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={selection.optionnels} onChange={(e) => setSelection({ ...selection, optionnels: e.target.checked })} />Inclure les essais optionnels (visualisation des flux, récupération, température, humidité)</label>
            </div>
          </Carte>
        </div>
      )}

      {etape === 2 && (
        <Carte titre={`Essais proposés (${retenus} retenus)`}>
          <p className="mb-3 text-sm text-texte-2">Décochez les essais non pertinents ; les critères restent modifiables jusqu'à l'approbation du protocole.</p>
          <TableauDefilant>
            <table className="tableau">
              <thead><tr><th /><th>Essai</th><th>Cible</th><th>État</th><th>Critère d'acceptation</th><th>Min</th><th>Max</th></tr></thead>
              <tbody>{essais.map((e, i) => (
                <tr key={i} className={e.retenu ? "" : "opacity-50"}>
                  <td><input type="checkbox" aria-label={`Retenir ${e.libelle}`} checked={e.retenu} onChange={(ev) => setEssais(essais.map((x, j) => (j === i ? { ...x, retenu: ev.target.checked } : x)))} /></td>
                  <td>{e.libelle}<div className="text-xs text-texte-2">{e.reference}</div></td>
                  <td>{e.cible_libelle}</td>
                  <td className="whitespace-nowrap">{e.etat_occupation ? LIBELLES_ETATS[e.etat_occupation] : "—"}</td>
                  <td className="min-w-64"><Saisie value={e.critere} onChange={(ev) => setEssais(essais.map((x, j) => (j === i ? { ...x, critere: ev.target.value } : x)))} /></td>
                  <td className="w-24"><SaisieNombre aria-label="Minimum" valeur={e.critere_min} onChange={(v) => setEssais(essais.map((x, j) => (j === i ? { ...x, critere_min: v } : x)))} /></td>
                  <td className="w-24"><SaisieNombre aria-label="Maximum" valeur={e.critere_max} onChange={(v) => setEssais(essais.map((x, j) => (j === i ? { ...x, critere_max: v } : x)))} /></td>
                </tr>
              ))}</tbody>
            </table>
          </TableauDefilant>
        </Carte>
      )}

      <div className="mt-5 flex justify-between">
        <Bouton onClick={() => (etape === 0 ? naviguer("/qualification") : setEtape(etape - 1))}>{etape === 0 ? "Annuler" : "← Précédent"}</Bouton>
        {etape < 2 ? (
          <Bouton variante="principal" disabled={!valide[etape]} onClick={() => { if (etape === 1) proposer(); setEtape(etape + 1); }}>Suivant →</Bouton>
        ) : (
          <Bouton variante="principal" disabled={action.enCours || !valide[2]} onClick={() => void creer()}>Créer la campagne</Bouton>
        )}
      </div>
    </>
  );
}
