import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useSession } from "../../session";
import type { PlanEchantillonnage, Resultat } from "../../data/types";
import { Badge, Bandeau, Bouton, Carte, Champ, Liste, MessageErreur, Modale, Saisie, TableauDefilant, Vide, formatDate, useAction } from "../../ui/composants";
import { GestionEntites, optionsDe } from "../../ui/entites";
import { Courbe, type Seuil } from "../../ui/graphique";
import { LIBELLES_MILIEUX, LIBELLES_NATURES, LIBELLES_VERDICTS, PARAMETRES } from "../../domain/contamination";
import { LIBELLES_ETATS } from "../../domain/qualification";
import { FREQUENCES_PRELEVEMENT, REGLES_TENDANCE, pireVerdict, prelevementsDus, proposerPlan, signauxTendance } from "../../domain/surveillance";
import { centroide } from "../../domain/geometrie";
import { formatNombre } from "../../domain/exigencesZone";
import { SaisieResultat, cleParametre, libellePoint, type DonneesContamination } from "./Resultats";

const TON_DU = { en_retard: "alerte", aujourdhui: "attention", a_venir: "neutre" } as const;
const LIBELLE_DU = { en_retard: "En retard", aujourdhui: "Aujourd'hui", a_venir: "À venir" };
const COULEUR_VERDICT: Record<string, string> = { conforme: "#059669", alerte: "#d97706", action: "#dc2626", non_evalue: "#94a3b8" };

function useSalle(d: DonneesContamination, salleFixe?: string) {
  return useState(salleFixe ?? d.salles[0]?.id ?? "");
}

function ChoixSalle({ d, valeur, onChange }: { d: DonneesContamination; valeur: string; onChange: (v: string) => void }) {
  return (
    <Champ libelle="Salle propre">
      <Liste value={valeur} onChange={(e) => onChange(e.target.value)}>{d.salles.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</Liste>
    </Champ>
  );
}

// ---------------------------------------------------------------------
// Plan d'échantillonnage
// ---------------------------------------------------------------------

export function PlanSurveillance({ d, recharger, salleFixe }: { d: DonneesContamination; recharger: () => void; salleFixe?: string }) {
  const s = useSession();
  const [salle, setSalle] = useSalle(d, salleFixe);
  const [saisie, setSaisie] = useState<PlanEchantillonnage | null>(null);
  const [proposition, setProposition] = useState(false);
  const plans = d.plans.filter((p) => p.salle_id === salle);
  const dus = prelevementsDus(plans, d.resultats);
  const aFaire = dus.filter((x) => x.statut !== "a_venir");
  const zonesSalle = d.zones.filter((z) => z.salle_id === salle);
  const pointsSalle = d.points.filter((p) => p.salle_id === salle);
  const lieu = (p: PlanEchantillonnage) => {
    const pt = pointsSalle.find((x) => x.id === p.point_id);
    const z = zonesSalle.find((x) => x.id === p.zone_id);
    return [z && `${z.code} ${z.nom}`, pt && `point ${pt.code}`].filter(Boolean).join(" · ") || "—";
  };
  const saisieResultat = s.peut("contamination_resultats", 2);

  return (
    <div className="grid gap-4">
      {!salleFixe && <div className="max-w-sm"><ChoixSalle d={d} valeur={salle} onChange={setSalle} /></div>}
      <Carte titre={<>Prélèvements à réaliser {aFaire.length > 0 && <Badge ton={aFaire.some((x) => x.statut === "en_retard") ? "alerte" : "attention"}>{aFaire.length}</Badge>}</>}>
        {dus.length === 0 ? <Vide>Aucune ligne active dans le plan d'échantillonnage de cette salle.</Vide> : (
          <TableauDefilant>
            <table className="tableau">
              <thead><tr><th>Lieu</th><th>Paramètre</th><th>Fréquence</th><th>Dernier</th><th>Prochain</th><th /></tr></thead>
              <tbody>{dus.slice(0, 60).map((x) => (
                <tr key={x.plan.id}>
                  <td>{lieu(x.plan)}</td>
                  <td>{x.plan.parametre}<div className="text-xs text-texte-2">{LIBELLES_MILIEUX[x.plan.milieu]} · {LIBELLES_NATURES[x.plan.nature]}</div></td>
                  <td>{FREQUENCES_PRELEVEMENT[x.plan.frequence]}</td>
                  <td>{formatDate(x.dernier)}</td>
                  <td><Badge ton={TON_DU[x.statut]}>{LIBELLE_DU[x.statut]}</Badge> <span className="text-xs">{formatDate(x.prochain)}</span></td>
                  <td className="text-right">{saisieResultat && <Bouton variante="discret" aria-label={`Saisir ${x.plan.parametre} ${lieu(x.plan)}`} onClick={() => setSaisie(x.plan)}>Saisir</Bouton>}</td>
                </tr>
              ))}</tbody>
            </table>
          </TableauDefilant>
        )}
      </Carte>
      <Carte>
        <GestionEntites
          table="plans_echantillonnage"
          titre="Plan d'échantillonnage"
          lignes={plans}
          recharger={recharger}
          actions={s.peut("contamination_resultats", 3) && pointsSalle.length > 0 ? <Bouton onClick={() => setProposition(true)}>Proposer un plan type</Bouton> : undefined}
          champs={[
            { cle: "zone_id", libelle: "Zone", type: "liste", options: zonesSalle.map((z) => ({ valeur: z.id, libelle: `${z.code} ${z.nom}` })) },
            { cle: "point_id", libelle: "Point de prélèvement", type: "liste", options: pointsSalle.map((p) => ({ valeur: p.id, libelle: p.code })) },
            { cle: "parametre", libelle: "Paramètre", type: "liste", requis: true, options: PARAMETRES.map((p) => ({ valeur: p.libelle, libelle: `${p.libelle} (${p.unite})` })) },
            { cle: "etat_occupation", libelle: "État d'occupation", type: "liste", options: optionsDe(LIBELLES_ETATS) },
            { cle: "frequence", libelle: "Fréquence", type: "liste", requis: true, options: optionsDe(FREQUENCES_PRELEVEMENT) },
            { cle: "date_debut", libelle: "À partir du", type: "date", requis: true },
            { cle: "limite_alerte", libelle: "Limite d'alerte", type: "nombre" },
            { cle: "limite_action", libelle: "Limite d'action", type: "nombre" },
            { cle: "actif", libelle: "Statut", type: "case", aide: "Ligne active" },
            { cle: "notes", libelle: "Justification (analyse de risque)", type: "zone_texte", large: true },
            ...["milieu", "nature", "methode", "unite", "taille_um"].map((cle) => ({ cle, libelle: cle, type: "texte" as const, visible: () => false })),
          ]}
          avantEnregistrement={(v) => {
            const p = PARAMETRES.find((x) => x.cle === cleParametre(String(v.parametre)));
            const zone = v.point_id ? pointsSalle.find((x) => x.id === v.point_id)?.zone_id ?? v.zone_id : v.zone_id;
            return p ? { ...v, zone_id: zone || null, point_id: v.point_id || null, milieu: p.milieu, nature: p.nature, methode: p.methode, unite: p.unite, taille_um: p.taille_um ?? null } : v;
          }}
          valeursInitiales={() => ({ salle_id: salle, parametre: PARAMETRES[0].libelle, frequence: "hebdomadaire", etat_occupation: "activite", date_debut: new Date().toISOString().slice(0, 10), actif: true, zone_id: null, point_id: null })}
          trier={(a, b) => lieu(a).localeCompare(lieu(b)) || a.parametre.localeCompare(b.parametre)}
          colonnes={[
            { libelle: "Lieu", rendu: lieu },
            { libelle: "Paramètre", rendu: (p) => p.parametre },
            { libelle: "Fréquence", rendu: (p) => FREQUENCES_PRELEVEMENT[p.frequence] },
            { libelle: "Alerte / action", rendu: (p) => (p.limite_action == null && p.limite_alerte == null ? <Badge ton="attention" title="Sans limite, les résultats ne sont pas évalués et aucune dérive n'est détectée">À définir</Badge> : `${formatNombre(p.limite_alerte)} / ${formatNombre(p.limite_action)} ${p.unite}`) },
            { libelle: "Statut", rendu: (p) => (p.actif ? "Actif" : <span className="text-texte-2">Inactif</span>) },
          ]}
          vide="Aucune ligne. « Proposer un plan type » part des points de prélèvement posés sur le plan et du niveau de chaque zone."
        />
      </Carte>
      {saisie && <SaisieResultat d={d} plan={saisie} onFermer={(ok) => { setSaisie(null); if (ok) recharger(); }} />}
      {proposition && <PropositionPlan d={d} salleId={salle} onFermer={(ok) => { setProposition(false); if (ok) recharger(); }} />}
    </div>
  );
}

function PropositionPlan({ d, salleId, onFermer }: { d: DonneesContamination; salleId: string; onFermer: (ok: boolean) => void }) {
  const s = useSession();
  const action = useAction();
  const [debut, setDebut] = useState(new Date().toISOString().slice(0, 10));
  const existants = new Set(d.plans.filter((p) => p.salle_id === salleId).map((p) => `${p.point_id}|${p.parametre}`));
  const lignes = proposerPlan(salleId, d.zones, d.points, debut, d.resultats).filter((l) => !existants.has(`${l.point_id}|${l.parametre}`));
  const point = (id: string | null) => d.points.find((p) => p.id === id)?.code ?? "—";
  return (
    <Modale large titre="Proposer un plan d'échantillonnage type" onFermer={() => onFermer(false)} pied={<>
      <Bouton onClick={() => onFermer(false)}>Annuler</Bouton>
      <Bouton variante="principal" disabled={action.enCours || lignes.length === 0} onClick={() => void action.executer(async () => {
        await s.depot.creerPlusieurs("plans_echantillonnage", lignes.map((l) => ({ ...l, org_id: s.org!.id })));
        onFermer(true);
      })}>Créer {lignes.length} ligne(s)</Bouton>
    </>}>
      <MessageErreur erreur={action.erreur} />
      <Bandeau ton="cuivre">
        Fréquences selon le niveau de la zone (critique, très propre, propre, contrôlé) et paramètres selon les natures déclarées pour chaque point.
        Limites reprises des derniers résultats du point s'il y en a ; sinon issues de la classe ou du grade (en zone ISO sans grade, limites microbiologiques empruntées au grade BPF équivalent) ; alerte proposée à 60 % de l'action.
        Point de départ à confirmer par l'analyse de risque et l'historique des résultats.
      </Bandeau>
      <div className="my-3 max-w-xs"><Champ libelle="Premier prélèvement le"><Saisie type="date" value={debut} onChange={(e) => setDebut(e.target.value)} /></Champ></div>
      {lignes.length === 0 ? <Vide>Le plan couvre déjà tous les points et natures déclarés.</Vide> : (
        <TableauDefilant>
          <table className="tableau">
            <thead><tr><th>Point</th><th>Paramètre</th><th>Fréquence</th><th className="nombre">Alerte</th><th className="nombre">Action</th></tr></thead>
            <tbody>{lignes.map((l, i) => (
              <tr key={i}><td>{point(l.point_id)}</td><td>{l.parametre}</td><td>{FREQUENCES_PRELEVEMENT[l.frequence]}</td><td className="nombre">{formatNombre(l.limite_alerte)}</td><td className="nombre">{formatNombre(l.limite_action)} {l.unite}</td></tr>
            ))}</tbody>
          </table>
        </TableauDefilant>
      )}
    </Modale>
  );
}

// ---------------------------------------------------------------------
// Tendances et règles de dérive
// ---------------------------------------------------------------------

export function Tendances({ d, salleFixe }: { d: DonneesContamination; salleFixe?: string }) {
  const s = useSession();
  const [salle, setSalle] = useSalle(d, salleFixe);
  const resultatsSalle = useMemo(() => d.resultats.filter((r) => r.salle_id === salle), [d.resultats, salle]);
  const series = useMemo(() => {
    const m = new Map<string, Resultat[]>();
    for (const r of resultatsSalle) m.set(`${r.point_id ?? r.point_libre}|${r.parametre}`, [...(m.get(`${r.point_id ?? r.point_libre}|${r.parametre}`) ?? []), r]);
    return [...m.entries()].map(([cle, l]) => ({ cle, libelle: `${libellePoint(l[0], d.points)} — ${l[0].parametre}`, resultats: l })).filter((x) => x.resultats.length >= 2).sort((a, b) => a.libelle.localeCompare(b.libelle));
  }, [resultatsSalle, d.points]);
  const signaux = useMemo(() => signauxTendance(resultatsSalle, (r) => libellePoint(r, d.points)), [resultatsSalle, d.points]);
  const [choix, setChoix] = useState<string>("");
  const serie = series.find((x) => x.cle === choix) ?? series.find((x) => signaux.some((sg) => x.cle.startsWith(`${sg.point_id ?? ""}|`) && x.resultats[0].parametre === sg.parametre)) ?? series[0];
  const tri = serie ? [...serie.resultats].sort((a, b) => a.date_prelevement.localeCompare(b.date_prelevement)) : [];
  const derniere = tri.at(-1);
  const seuils: Seuil[] = [
    ...(derniere?.limite_alerte != null ? [{ valeur: derniere.limite_alerte, libelle: "Alerte", couleur: "#d97706" }] : []),
    ...(derniere?.limite_action != null ? [{ valeur: derniere.limite_action, libelle: "Action", couleur: "#dc2626" }] : []),
  ];
  const ecartOuvert = (pointId: string | null) => s.peut("ecarts_capa", 1) && pointId;

  return (
    <div className="grid gap-4">
      {!salleFixe && <div className="max-w-sm"><ChoixSalle d={d} valeur={salle} onChange={setSalle} /></div>}
      <Carte titre="Signaux de dérive">
        <p className="mb-2 text-xs text-texte-2">Règles appliquées à chaque série (point × paramètre) de surveillance : {Object.values(REGLES_TENDANCE).join(" ; ")}.</p>
        {signaux.length === 0 ? <Vide>Aucun signal de dérive.</Vide> : (
          <ul className="space-y-1.5">
            {signaux.map((sg) => (
              <li key={sg.cle} className="flex flex-wrap items-center gap-2 text-sm">
                <Badge ton={sg.regle === "consecutifs" ? "alerte" : "attention"}>{sg.regle === "consecutifs" ? "Dérive" : sg.regle === "croissance" ? "Tendance" : "Fréquence"}</Badge>
                <button type="button" className="font-semibold text-navy-700 underline" onClick={() => setChoix(series.find((x) => x.resultats.some((r) => r.point_id === sg.point_id && r.parametre === sg.parametre))?.cle ?? "")}>{sg.serie}</button>
                <span className="text-texte-2">{sg.libelle} · dernier résultat le {formatDate(sg.date)}</span>
                {sg.regle === "consecutifs" && ecartOuvert(sg.point_id) && <Link to="/ecarts" className="text-xs text-navy-700 underline">voir les écarts</Link>}
              </li>
            ))}
          </ul>
        )}
      </Carte>
      <Carte titre="Évolution" actions={series.length > 0 && (
        <Liste aria-label="Série" className="!w-80" value={serie?.cle ?? ""} onChange={(e) => setChoix(e.target.value)}>
          {series.map((x) => <option key={x.cle} value={x.cle}>{x.libelle}</option>)}
        </Liste>
      )}>
        {!serie ? <Vide>Pas encore assez de résultats pour tracer une évolution.</Vide> : (
          <>
            <Courbe
              unite={derniere?.unite}
              seuils={seuils}
              series={[{ nom: serie.libelle, couleur: "#1e3a5f", points: tri.map((r) => ({ date: r.date_prelevement, valeur: r.valeur, couleur: COULEUR_VERDICT[r.verdict], info: `${formatDate(r.date_prelevement, true)} : ${r.valeur} ${r.unite} (${LIBELLES_VERDICTS[r.verdict]})` })) }]}
            />
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge>{tri.length} résultat(s)</Badge>
              <Badge ton="attention">{tri.filter((r) => r.verdict === "alerte").length} alerte(s)</Badge>
              <Badge ton="alerte">{tri.filter((r) => r.verdict === "action").length} action(s)</Badge>
              <span className="text-texte-2">Moyenne {formatNombre(tri.reduce((a, r) => a + r.valeur, 0) / tri.length)} {derniere?.unite} · max {formatNombre(Math.max(...tri.map((r) => r.valeur)))}</span>
            </div>
          </>
        )}
      </Carte>
    </div>
  );
}

// ---------------------------------------------------------------------
// Cartographie de contamination
// ---------------------------------------------------------------------

export function Cartographie({ d, salleFixe }: { d: DonneesContamination; salleFixe?: string }) {
  const [salle, setSalle] = useSalle(d, salleFixe);
  const [periode, setPeriode] = useState(90);
  const [nature, setNature] = useState("");
  const sp = d.salles.find((x) => x.id === salle);
  const depuis = new Date(Date.now() - periode * 86400000).toISOString();
  const resultats = d.resultats.filter((r) => r.salle_id === salle && r.date_prelevement >= depuis && (!nature || r.nature === nature) && r.origine !== "qualification");
  const zones = d.zones.filter((z) => z.salle_id === salle && z.geometrie && z.geometrie.length >= 3);
  const points = d.points.filter((p) => p.salle_id === salle);
  if (!sp) return <Vide>Aucune salle.</Vide>;
  const L = sp.plan_largeur_m, H = sp.plan_hauteur_m, t = Math.max(L, H) / 40;
  const parZone = (id: string) => resultats.filter((r) => r.zone_id === id);
  const parPoint = (id: string) => resultats.filter((r) => r.point_id === id);
  const hors = (l: Resultat[]) => l.filter((r) => r.verdict === "alerte" || r.verdict === "action").length;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        {!salleFixe && <div className="w-72"><ChoixSalle d={d} valeur={salle} onChange={setSalle} /></div>}
        <Champ libelle="Période"><Liste value={periode} onChange={(e) => setPeriode(Number(e.target.value))}>{[30, 90, 180, 365].map((n) => <option key={n} value={n}>{n} derniers jours</option>)}</Liste></Champ>
        <Champ libelle="Nature"><Liste value={nature} onChange={(e) => setNature(e.target.value)}><option value="">Toutes</option>{Object.entries(LIBELLES_NATURES).map(([c, l]) => <option key={c} value={c}>{l}</option>)}</Liste></Champ>
        <div className="flex gap-3 text-xs">{(["conforme", "alerte", "action"] as const).map((v) => <span key={v} className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: COULEUR_VERDICT[v] }} />{LIBELLES_VERDICTS[v]}</span>)}</div>
      </div>
      {zones.length === 0 ? <Vide>Les zones de cette salle ne sont pas encore dessinées sur le plan.</Vide> : (
        <Carte>
          <svg role="img" aria-label={`Cartographie de contamination de ${sp.nom}`} viewBox={`-0.5 -0.5 ${L + 1} ${H + 1}`} className="w-full" style={{ minWidth: 600 }}>
            <rect x={0} y={0} width={L} height={H} fill="#fff" />
            {zones.map((z) => {
              const l = parZone(z.id);
              const taux = l.length ? hors(l) / l.length : 0;
              const c = centroide(z.geometrie!);
              return (
                <g key={z.id}>
                  <polygon points={z.geometrie!.map((p) => p.join(",")).join(" ")} fill={l.length ? `rgba(220,38,38,${0.05 + taux * 0.6})` : "#f1f5f9"} stroke="#334155" strokeWidth={t * 0.06} />
                  <text x={c[0]} y={c[1] - t * 0.6} fontSize={t * 0.75} textAnchor="middle" fill="#0f172a" fontWeight={700}>{z.code} {z.nom}</text>
                  <text x={c[0]} y={c[1] + t * 0.4} fontSize={t * 0.6} textAnchor="middle" fill="#334155">{l.length ? `${hors(l)} / ${l.length} hors limite` : "aucun résultat"}</text>
                </g>
              );
            })}
            {points.map((p) => {
              const l = parPoint(p.id);
              const v = pireVerdict(l);
              return (
                <g key={p.id}>
                  <circle cx={p.x} cy={p.y} r={t * 0.45} fill={v ? COULEUR_VERDICT[v] : "#fff"} stroke="#0f172a" strokeWidth={t * 0.05}>
                    <title>{`${p.code} : ${l.length} résultat(s), ${hors(l)} hors limite`}</title>
                  </circle>
                  <text x={p.x + t * 0.6} y={p.y + t * 0.25} fontSize={t * 0.6} fill="#0f172a" fontWeight={600}>{p.code}</text>
                </g>
              );
            })}
          </svg>
          <p className="mt-2 text-xs text-texte-2">Intensité des zones : part des résultats au-delà de la limite d'alerte sur la période. Couleur des points : pire verdict de la période.</p>
        </Carte>
      )}
    </div>
  );
}
