import { Link } from "react-router";
import { useSession, nomUtilisateur } from "../session";
import { Badge, Carte, EnTete, Vide, formatDate, useDonnees } from "../ui/composants";
import { libelleTable, libelleAction } from "./Journal";
import { echeancesAPlanifier, type EcheanceAPlanifier } from "../domain/echeances";
import { echeancesPhase6, etatGamme } from "../domain/maintenance";
import { prelevementsDus } from "../domain/surveillance";
import { statutEcheance } from "../domain/personnel";
import { syntheseSalles, type SyntheseSalle } from "../domain/tableauDeBord";

type Ton = "ok" | "attention" | "alerte" | "neutre" | "info";

function Indicateur({ libelle, valeur, detail, lien, ton = "neutre" }: { libelle: string; valeur: number | string; detail?: string; lien?: string; ton?: Ton }) {
  const bord = { ok: "border-l-emerald-500", attention: "border-l-amber-500", alerte: "border-l-red-500", neutre: "border-l-bord", info: "border-l-navy-600" }[ton];
  const contenu = (
    <div className={`h-full rounded-xl border border-l-4 border-bord bg-white p-4 shadow-sm transition hover:border-navy-600 ${bord}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-texte-2">{libelle}</div>
      <div className="mt-1 text-2xl font-bold text-navy-900">{valeur}</div>
      {detail && <div className="mt-0.5 text-xs text-texte-2">{detail}</div>}
    </div>
  );
  return lien ? <Link to={lien} className="block">{contenu}</Link> : contenu;
}

const LIBELLE_QUALIF = { a_jour: "Qualifiée", a_echeance: "Requalification à prévoir", en_retard: "Requalification dépassée", jamais: "Jamais qualifiée", incomplete: "Qualification incomplète" } as const;
const TON_QUALIF = { a_jour: "ok", a_echeance: "attention", en_retard: "alerte", jamais: "neutre", incomplete: "attention" } as const;
const TON_PRIORITE = { urgente: "alerte", haute: "attention", normale: "info", basse: "neutre" } as const;

export function Accueil() {
  const s = useSession();
  const org = s.org!.id;
  const { donnees } = useDonnees(async () => {
    const lire = <T,>(module: string, f: () => Promise<T[]>) => (s.peut(module, 1) ? f() : Promise.resolve([] as T[]));
    const [salles, zones, documents, journal, essais, resultats, interventions, ecarts, capa, releves, instruments, etalonnages, filtres, relevesFiltres,
      gammes, interventionsMaint, changements, plans, habilitations, personnes, taches, colonnes, ctas, equipements] = await Promise.all([
      lire("installations", () => s.depot.lister("salles_propres", org)), lire("installations", () => s.depot.lister("zones", org)),
      lire("documents", () => s.depot.lister("documents", org)), s.peut("audit", 1) ? s.depot.journal(org, { limite: 8 }) : Promise.resolve([]),
      lire("qualification_execution", () => s.depot.lister("essais", org)), lire("contamination_resultats", () => s.depot.lister("resultats", org)),
      lire("nettoyage_execution", () => s.depot.lister("interventions_nettoyage", org)), lire("ecarts_capa", () => s.depot.lister("ecarts", org)),
      lire("ecarts_capa", () => s.depot.lister("capa", org)), lire("cta", () => s.depot.lister("releves_ambiance", org)),
      lire("instruments", () => s.depot.lister("instruments", org)), lire("instruments", () => s.depot.lister("etalonnages", org)),
      lire("cta", () => s.depot.lister("filtres", org)), lire("cta", () => s.depot.lister("releves_filtres", org)),
      lire("maintenance", () => s.depot.lister("gammes_maintenance", org)), lire("maintenance", () => s.depot.lister("interventions_maintenance", org)),
      lire("maintenance", () => s.depot.lister("changements", org)), lire("contamination_resultats", () => s.depot.lister("plans_echantillonnage", org)),
      lire("personnel", () => s.depot.lister("habilitations", org)), lire("personnel", () => s.depot.lister("personnes", org)),
      lire("kanban", () => s.depot.lister("taches", org)), lire("kanban", () => s.depot.lister("colonnes_kanban", org)),
      lire("cta", () => s.depot.lister("ctas", org)), lire("installations", () => s.depot.lister("equipements", org)),
    ]);
    return { salles, zones, documents, journal, essais, resultats, interventions, ecarts, capa, releves, instruments, etalonnages, filtres, relevesFiltres,
      gammes, interventionsMaint, changements, plans, habilitations, personnes, taches, colonnes, ctas, equipements };
  }, [org]);

  if (!donnees) return <p className="text-texte-2">Chargement…</p>;
  const d = donnees;
  const jour = new Date().toISOString().slice(0, 10);
  const syntheses = syntheseSalles({ salles: d.salles, zones: d.zones, essais: d.essais, periodicites: s.referentiels.periodicites, resultats: d.resultats, interventions: d.interventions, ecarts: d.ecarts, releves: d.releves });
  const ecartsOuverts = d.ecarts.filter((e) => !["cloture", "annule"].includes(e.statut));
  const capaRetard = d.capa.filter((c) => (c.statut === "a_faire" || c.statut === "en_cours") && c.echeance && c.echeance < jour);
  const evalues = syntheses.reduce((a, x) => a + x.resultats, 0);
  const excursions = syntheses.reduce((a, x) => a + x.excursions, 0);
  const prevus = syntheses.reduce((a, x) => a + x.nettoyagesPrevus, 0);
  const faits = syntheses.reduce((a, x) => a + x.nettoyagesFaits, 0);
  const tauxNettoyage = prevus ? Math.round((faits / prevus) * 100) : null;
  const conformite = evalues ? Math.round(((evalues - excursions) / evalues) * 1000) / 10 : null;
  const requalif = syntheses.filter((x) => x.qualification === "en_retard" || x.qualification === "a_echeance");
  const actives = new Set(d.personnes.filter((p) => p.actif).map((p) => p.id));
  const habilitationsARenouveler = d.habilitations.filter((h) => actives.has(h.personne_id) && statutEcheance(h.date_expiration) !== "valide");
  const maintenanceRetard = d.gammes.filter((g) => g.actif && etatGamme(g, d.interventionsMaint).statut === "en_retard");
  const prelevementsRetard = prelevementsDus(d.plans, d.resultats).filter((p) => p.statut === "en_retard");

  const aTraiter: EcheanceAPlanifier[] = [
    ...echeancesAPlanifier({
      zones: d.zones, essais: d.essais, periodicites: s.referentiels.periodicites, instruments: d.instruments, etalonnages: d.etalonnages, filtres: d.filtres, releves: d.relevesFiltres,
      capa: d.capa, salles: d.salles,
      nettoyagesEnRetard: d.interventions.filter((n) => n.statut === "a_faire" && n.date_prevue < jour).map((n) => ({ id: n.id, titre: n.titre, date: n.date_prevue, salle_id: n.salle_id, lien: "/nettoyage?onglet=planning" })),
    }),
    ...echeancesPhase6({
      gammes: d.gammes, interventions: d.interventionsMaint, changements: d.changements, plans: d.plans, resultats: d.resultats,
      libelleObjet: (g) => (g.cta_id ? d.ctas.find((c) => c.id === g.cta_id)?.nom : d.equipements.find((e) => e.id === g.equipement_id)?.libelle ?? d.salles.find((x) => x.id === g.salle_id)?.nom) ?? "",
    }),
  ].sort((a, b) => (["urgente", "haute", "normale", "basse"].indexOf(a.priorite) - ["urgente", "haute", "normale", "basse"].indexOf(b.priorite)) || (a.echeance ?? "9").localeCompare(b.echeance ?? "9"));
  const documentsAApprouver = d.documents.filter((x) => x.statut === "en_revue");
  const documentsExpires = d.documents.filter((x) => x.valide_jusqu_au && x.statut !== "perime" && x.valide_jusqu_au < jour);
  const terminales = new Set(d.colonnes.filter((c) => c.terminale).map((c) => c.id));
  const mesTaches = d.taches.filter((t) => t.proprietaire === s.utilisateur?.id && !terminales.has(t.colonne_id)).sort((a, b) => (a.echeance ?? "9").localeCompare(b.echeance ?? "9"));

  return (
    <>
      <EnTete titre="Tableau de bord" sousTitre={`${s.org?.nom} · ${s.utilisateur?.nom_complet ?? ""}`} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {s.peut("ecarts_capa", 1) && <Indicateur libelle="Écarts ouverts" valeur={ecartsOuverts.length} detail={`${ecartsOuverts.filter((e) => e.gravite !== "mineure").length} majeur(s) ou critique(s) · ${capaRetard.length} CAPA en retard`} lien="/ecarts" ton={capaRetard.length ? "alerte" : ecartsOuverts.length ? "attention" : "ok"} />}
        {s.peut("contamination_resultats", 1) && <Indicateur libelle="Surveillance (30 j)" valeur={conformite != null ? `${conformite} %` : "—"} detail={`${evalues} résultat(s), ${excursions} dépassement(s) · ${prelevementsRetard.length} prélèvement(s) en retard`} lien="/contaminations?onglet=plan" ton={conformite == null ? "neutre" : conformite >= 95 && !prelevementsRetard.length ? "ok" : conformite >= 85 ? "attention" : "alerte"} />}
        {s.peut("nettoyage_execution", 1) && <Indicateur libelle="Nettoyage réalisé (30 j)" valeur={tauxNettoyage != null ? `${tauxNettoyage} %` : "—"} detail={`${faits} / ${prevus} interventions`} lien="/nettoyage?onglet=planning" ton={tauxNettoyage == null ? "neutre" : tauxNettoyage >= 95 ? "ok" : tauxNettoyage >= 85 ? "attention" : "alerte"} />}
        {s.peut("installations", 1) && <Indicateur libelle="Requalifications" valeur={requalif.length} detail={requalif.length ? requalif.map((x) => x.salle.nom).join(", ") : "toutes les salles à jour"} lien="/qualification" ton={requalif.some((x) => x.qualification === "en_retard") ? "alerte" : requalif.length ? "attention" : "ok"} />}
        {s.peut("personnel", 1) && <Indicateur libelle="Habilitations à renouveler" valeur={habilitationsARenouveler.length} detail="expirées ou dans les 60 jours" lien="/personnel" ton={habilitationsARenouveler.some((h) => statutEcheance(h.date_expiration) === "expiree") ? "alerte" : habilitationsARenouveler.length ? "attention" : "ok"} />}
        {s.peut("maintenance", 1) && <Indicateur libelle="Maintenance en retard" valeur={maintenanceRetard.length} detail={`${d.changements.filter((c) => !["cloture", "refuse"].includes(c.statut)).length} changement(s) en cours`} lien="/maintenance" ton={maintenanceRetard.length ? "alerte" : "ok"} />}
        {s.peut("documents", 1) && <Indicateur libelle="Documents" valeur={d.documents.length} detail={`${documentsAApprouver.length} à approuver · ${documentsExpires.length} expiré(s)`} lien="/documents" ton={documentsExpires.length ? "alerte" : documentsAApprouver.length ? "attention" : "neutre"} />}
        {s.peut("kanban", 1) && <Indicateur libelle="Mes tâches" valeur={mesTaches.length} detail={`${mesTaches.filter((t) => t.echeance && t.echeance < jour).length} en retard`} lien="/taches?vue=moi" ton={mesTaches.some((t) => t.echeance && t.echeance < jour) ? "alerte" : "info"} />}
      </div>

      {syntheses.length > 0 && (
        <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {syntheses.map((x) => <CarteSalle key={x.salle.id} x={x} />)}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Carte titre="À traiter en priorité" actions={s.peut("kanban", 2) && <Link to="/taches" className="text-sm text-navy-700 hover:underline">Planifier dans le Kanban</Link>}>
          {aTraiter.length + documentsAApprouver.length === 0 ? <Vide>Rien d'urgent.</Vide> : (
            <ul className="space-y-2 text-sm">
              {documentsAApprouver.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-2"><Link to="/documents" className="hover:underline">Document à approuver : {x.titre}</Link><Badge ton="info">En revue</Badge></li>
              ))}
              {aTraiter.slice(0, 12).map((x) => (
                <li key={x.source_cle} className="flex items-center justify-between gap-2">
                  <Link to={x.lien} className="hover:underline">{x.titre}</Link>
                  <span className="flex shrink-0 items-center gap-1">{x.echeance && <span className="text-xs text-texte-2">{formatDate(x.echeance)}</span>}<Badge ton={TON_PRIORITE[x.priorite]}>{x.priorite}</Badge></span>
                </li>
              ))}
              {aTraiter.length > 12 && <li className="text-xs text-texte-2">… et {aTraiter.length - 12} autre(s).</li>}
            </ul>
          )}
        </Carte>

        {s.peut("kanban", 1) && (
          <Carte titre="Mes tâches" actions={<Link to="/taches" className="text-sm text-navy-700 hover:underline">Tableau des tâches</Link>}>
            {mesTaches.length === 0 ? <Vide>Aucune tâche ouverte à votre nom.</Vide> : (
              <ul className="space-y-1.5 text-sm">
                {mesTaches.slice(0, 10).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <Link to={`/taches?carte=${t.id}`} className="hover:underline">{t.titre}</Link>
                    {t.echeance && <Badge ton={t.echeance < jour ? "alerte" : "neutre"}>{formatDate(t.echeance)}</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Carte>
        )}

        {s.peut("audit", 1) && (
          <Carte titre="Dernières modifications" actions={<Link to="/journal" className="text-sm text-navy-700 hover:underline">Tout le journal</Link>}>
            <ul className="space-y-1.5 text-sm">
              {d.journal.map((j) => (
                <li key={j.id} className="flex gap-2">
                  <span className="w-28 shrink-0 text-texte-2">{formatDate(j.horodatage, true)}</span>
                  <span>{nomUtilisateur(s.profils, j.auteur)} — {libelleAction(j.action)} · {libelleTable(j.table_nom)}</span>
                </li>
              ))}
            </ul>
          </Carte>
        )}

        {s.peut("installations", 2) && (
          <Carte titre="Parcours de mise en service" className="lg:col-span-2">
            <ol className="grid gap-2 text-sm md:grid-cols-5">
              {[
                ["1. Entreprise et site", "/entreprises"],
                ["2. Salle propre via l'assistant (choix du secteur)", "/salles/nouvelle"],
                ["3. Compléter les zones, le plan et les points", "/salles"],
                ["4. Procédures de nettoyage et plan d'échantillonnage", "/nettoyage"],
                ["5. Inviter les utilisateurs", "/configuration"],
              ].map(([texte, lien]) => (
                <li key={lien}><Link to={lien} className="block h-full rounded-lg border border-bord p-3 hover:border-navy-600 hover:bg-navy-050">{texte}</Link></li>
              ))}
            </ol>
          </Carte>
        )}
      </div>
    </>
  );
}

function CarteSalle({ x }: { x: SyntheseSalle }) {
  const s = useSession();
  return (
    <Link to={`/salles/${x.salle.id}`} className="block rounded-xl border border-bord bg-white p-4 shadow-sm transition hover:border-navy-600">
      <div className="mb-2 flex items-start justify-between gap-2">
        <strong className="text-navy-900">{x.salle.nom}</strong>
        {x.qualification && <Badge ton={TON_QUALIF[x.qualification]}>{LIBELLE_QUALIF[x.qualification]}</Badge>}
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
        {x.prochaineRequalification && <><dt className="text-texte-2">Prochaine requalification</dt><dd>{formatDate(x.prochaineRequalification)}</dd></>}
        {s.peut("contamination_resultats", 1) && <><dt className="text-texte-2">Surveillance 30 j</dt><dd>{x.conformite != null ? `${x.conformite} % conforme` : "—"}{x.excursions > 0 && <span className="text-amber-700"> · {x.excursions} dép.</span>}</dd></>}
        {s.peut("nettoyage_execution", 1) && <><dt className="text-texte-2">Nettoyage 30 j</dt><dd>{x.nettoyagesPrevus ? `${x.nettoyagesFaits} / ${x.nettoyagesPrevus}` : "—"}</dd></>}
        {s.peut("ecarts_capa", 1) && <><dt className="text-texte-2">Écarts ouverts</dt><dd>{x.ecartsOuverts}</dd></>}
        {s.peut("cta", 1) && x.ambianceHorsLimites > 0 && <><dt className="text-texte-2">Ambiance hors limites</dt><dd className="text-red-700">{x.ambianceHorsLimites} relevé(s)</dd></>}
      </dl>
    </Link>
  );
}
