import { useEffect, useMemo, useState, type DragEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { useSession, nomUtilisateur } from "../session";
import type { ColonneKanban, Tache } from "../data/types";
import { Badge, Bandeau, Bouton, Champ, EnTete, Liste, MessageErreur, Modale, Onglets, Saisie, ZoneTexte, formatDate, useAction, useDonnees } from "../ui/composants";
import { Avatar, FilDiscussion } from "../ui/discussion";
import { echeancesAPlanifier, ordreEntre } from "../domain/echeances";

const PRIORITES = { basse: "Basse", normale: "Normale", haute: "Haute", urgente: "Urgente" } as const;
const TON_PRIORITE = { basse: "neutre", normale: "info", haute: "attention", urgente: "alerte" } as const;
const COLONNES_DEFAUT = [
  { libelle: "À faire", terminale: false }, { libelle: "En cours", terminale: false }, { libelle: "En attente", terminale: false },
  { libelle: "À vérifier", terminale: false }, { libelle: "Terminé", terminale: true },
];

function jourIso(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function Taches() {
  const s = useSession();
  const org = s.org!.id;
  const [parametres, setParametres] = useSearchParams();
  const { donnees, erreur, recharger } = useDonnees(async () => {
    const [colonnes, taches, salles] = await Promise.all([s.depot.lister("colonnes_kanban", org), s.depot.lister("taches", org), s.depot.lister("salles_propres", org)]);
    return { colonnes: colonnes.sort((a, b) => a.ordre - b.ordre), taches, salles };
  }, [org]);
  const [vue, setVue] = useState<"tableau" | "calendrier">("tableau");
  const [filtres, setFiltres] = useState({ texte: "", moi: false, retard: false, etiquette: "", salle: "" });
  const [ouverte, setOuverte] = useState<string | null>(parametres.get("carte"));
  const [creation, setCreation] = useState<string | null>(null);
  const [gestionColonnes, setGestionColonnes] = useState(false);
  const [glisse, setGlisse] = useState<string | null>(null);
  const [cible, setCible] = useState<{ colonne: string; index: number } | null>(null);
  const [local, setLocal] = useState<Tache[] | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const action = useAction();
  const ecriture = s.peut("kanban", 2);

  useEffect(() => setLocal(null), [donnees]);
  useEffect(() => { const c = parametres.get("carte"); if (c) setOuverte(c); }, [parametres]);

  const taches = local ?? donnees?.taches ?? [];
  const jour = jourIso();
  const etiquettes = [...new Set(taches.flatMap((t) => t.etiquettes))].sort();
  const visibles = useMemo(() => taches
    .filter((t) => !filtres.moi || t.proprietaire === s.utilisateur?.id)
    .filter((t) => !filtres.retard || (t.echeance && t.echeance < jour && !t.termine_le))
    .filter((t) => !filtres.etiquette || t.etiquettes.includes(filtres.etiquette))
    .filter((t) => !filtres.salle || t.salle_id === filtres.salle)
    .filter((t) => !filtres.texte || `${t.titre} ${t.description}`.toLowerCase().includes(filtres.texte.toLowerCase())), [taches, filtres, jour, s.utilisateur]);

  const creerColonnesDefaut = () => action.executer(async () => {
    await s.depot.creerPlusieurs("colonnes_kanban", COLONNES_DEFAUT.map((c, i) => ({ ...c, org_id: org, ordre: i + 1 })));
    recharger();
  });

  const genererCartes = () => action.executer(async () => {
    const lire = <T,>(module: string, f: () => Promise<T[]>) => (s.peut(module, 1) ? f() : Promise.resolve([] as T[]));
    const [zones, essais, instruments, etalonnages, filtresAir, releves, capa] = await Promise.all([
      lire("installations", () => s.depot.lister("zones", org)), lire("qualification_execution", () => s.depot.lister("essais", org)),
      lire("instruments", () => s.depot.lister("instruments", org)), lire("instruments", () => s.depot.lister("etalonnages", org)),
      lire("cta", () => s.depot.lister("filtres", org)), lire("cta", () => s.depot.lister("releves_filtres", org)), lire("ecarts_capa", () => s.depot.lister("capa", org)),
    ]);
    const nettoyages = await lire("nettoyage_execution", () => s.depot.lister("interventions_nettoyage", org));
    const sources = echeancesAPlanifier({
      zones, essais, periodicites: s.referentiels.periodicites, instruments, etalonnages, filtres: filtresAir, releves, capa, salles: donnees!.salles,
      nettoyagesEnRetard: nettoyages.filter((n) => n.statut === "a_faire" && n.date_prevue < jour).map((n) => ({ id: n.id, titre: n.titre, date: n.date_prevue, salle_id: n.salle_id, lien: "/nettoyage" })),
    });
    const existantes = new Set(taches.map((t) => t.source_cle).filter(Boolean));
    const nouvelles = sources.filter((x) => !existantes.has(x.source_cle));
    const premiere = donnees!.colonnes.find((c) => !c.terminale) ?? donnees!.colonnes[0];
    const min = Math.min(0, ...taches.filter((t) => t.colonne_id === premiere.id).map((t) => t.ordre));
    if (nouvelles.length) {
      await s.depot.creerPlusieurs("taches", nouvelles.map((x, i) => ({ ...x, org_id: org, colonne_id: premiere.id, ordre: min - 1000 * (nouvelles.length - i) })));
    }
    setInfo(nouvelles.length ? `${nouvelles.length} carte(s) créée(s) à partir des échéances.` : "Aucune nouvelle échéance à planifier.");
    recharger();
  });

  const deposer = (colonneId: string, index: number) => {
    if (!glisse) return;
    const tache = taches.find((t) => t.id === glisse);
    if (!tache) return;
    const liste = taches.filter((t) => t.colonne_id === colonneId && t.id !== glisse).sort((a, b) => a.ordre - b.ordre);
    const ordre = ordreEntre(liste[index - 1]?.ordre ?? null, liste[index]?.ordre ?? null);
    setLocal(taches.map((t) => (t.id === glisse ? { ...t, colonne_id: colonneId, ordre } : t)));
    setGlisse(null);
    setCible(null);
    void action.executer(async () => { await s.depot.modifier("taches", tache.id, { colonne_id: colonneId, ordre }); recharger(); });
  };

  const survol = (e: DragEvent<HTMLDivElement>, colonneId: string) => {
    if (!glisse) return;
    e.preventDefault();
    const cartes = [...e.currentTarget.querySelectorAll<HTMLElement>("[data-carte]")].filter((el) => el.dataset.carte !== glisse);
    let index = cartes.length;
    for (let i = 0; i < cartes.length; i++) {
      const r = cartes[i].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) { index = i; break; }
    }
    if (cible?.colonne !== colonneId || cible.index !== index) setCible({ colonne: colonneId, index });
  };

  if (erreur) return <MessageErreur erreur={erreur} />;
  if (!donnees) return <p className="text-texte-2">Chargement…</p>;

  if (donnees.colonnes.length === 0) {
    return (
      <>
        <EnTete titre="Tâches" />
        <Bandeau>Le tableau n'a pas encore de colonnes.</Bandeau>
        {s.peut("kanban", 3) ? <Bouton className="mt-3" variante="principal" onClick={() => void creerColonnesDefaut()}>Créer les colonnes par défaut (À faire → Terminé)</Bouton> : <p className="mt-2 text-sm">Demandez à un responsable de configurer le tableau.</p>}
      </>
    );
  }

  const tacheOuverte = taches.find((t) => t.id === ouverte);

  return (
    <>
      <EnTete
        titre="Tâches"
        sousTitre="Faites glisser les cartes d'une colonne à l'autre. Les échéances (requalifications, étalonnages, filtres, CAPA, nettoyages) peuvent être transformées en cartes."
        actions={<>
          {ecriture && <Bouton onClick={() => void genererCartes()} disabled={action.enCours}>Générer les cartes d'échéance</Bouton>}
          {s.peut("kanban", 3) && <Bouton onClick={() => setGestionColonnes(true)}>Colonnes</Bouton>}
        </>}
      />
      <MessageErreur erreur={action.erreur} />
      {info && <div className="mb-3"><Bandeau ton="ok">{info}</Bandeau></div>}
      <Onglets onglets={[{ cle: "tableau", libelle: "Tableau" }, { cle: "calendrier", libelle: "Calendrier" }]} actif={vue} onChange={setVue} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Saisie placeholder="Rechercher…" className="!w-56" value={filtres.texte} onChange={(e) => setFiltres({ ...filtres, texte: e.target.value })} />
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={filtres.moi} onChange={(e) => setFiltres({ ...filtres, moi: e.target.checked })} /> Mes tâches</label>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={filtres.retard} onChange={(e) => setFiltres({ ...filtres, retard: e.target.checked })} /> En retard</label>
        <Liste aria-label="Étiquette" className="!w-44" value={filtres.etiquette} onChange={(e) => setFiltres({ ...filtres, etiquette: e.target.value })}><option value="">Toutes étiquettes</option>{etiquettes.map((x) => <option key={x}>{x}</option>)}</Liste>
        <Liste aria-label="Salle" className="!w-56" value={filtres.salle} onChange={(e) => setFiltres({ ...filtres, salle: e.target.value })}><option value="">Toutes les salles</option>{donnees.salles.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</Liste>
      </div>

      {vue === "tableau" && (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {donnees.colonnes.map((col) => {
            const cartes = visibles.filter((t) => t.colonne_id === col.id).sort((a, b) => a.ordre - b.ordre);
            return (
              <section key={col.id} aria-label={col.libelle} className="flex w-72 shrink-0 flex-col rounded-xl bg-navy-050/70">
                <header className="flex items-center justify-between px-3 py-2">
                  <h2 className="text-sm font-semibold">{col.libelle} <span className="font-normal text-texte-2">{cartes.length}</span></h2>
                  {ecriture && <button type="button" aria-label={`Ajouter une carte dans ${col.libelle}`} className="rounded px-1.5 text-lg leading-none text-texte-2 hover:bg-white" onClick={() => setCreation(col.id)}>+</button>}
                </header>
                <div
                  className={`flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2 ${cible?.colonne === col.id ? "rounded-b-xl bg-cuivre-050" : ""}`}
                  onDragOver={(e) => survol(e, col.id)}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setCible(null); }}
                  onDrop={(e) => { e.preventDefault(); deposer(col.id, cible?.colonne === col.id ? cible.index : cartes.length); }}
                >
                  {cartes.map((t, i) => (
                    <div key={t.id}>
                      {cible?.colonne === col.id && cible.index === i && glisse !== t.id && <div className="mb-2 h-1 rounded bg-cuivre-500" />}
                      <Carte tache={t} glissee={glisse === t.id} deplacable={ecriture} onOuvrir={() => setOuverte(t.id)} onGlisser={() => setGlisse(t.id)} onFinGlisser={() => { setGlisse(null); setCible(null); }} />
                    </div>
                  ))}
                  {cible?.colonne === col.id && cible.index >= cartes.filter((t) => t.id !== glisse).length && <div className="h-1 rounded bg-cuivre-500" />}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {vue === "calendrier" && <Calendrier taches={visibles} onOuvrir={setOuverte} />}

      {tacheOuverte && <DetailTache tache={tacheOuverte} colonnes={donnees.colonnes} salles={donnees.salles} onFermer={() => { setOuverte(null); if (parametres.get("carte")) setParametres({}); recharger(); }} />}
      {creation && <NouvelleTache colonne={creation} ordre={Math.max(0, ...taches.filter((t) => t.colonne_id === creation).map((t) => t.ordre)) + 1000} salles={donnees.salles} onFermer={() => { setCreation(null); recharger(); }} />}
      {gestionColonnes && <GestionColonnes colonnes={donnees.colonnes} taches={taches} onFermer={() => { setGestionColonnes(false); recharger(); }} />}
    </>
  );
}

function Carte({ tache: t, glissee, deplacable, onOuvrir, onGlisser, onFinGlisser }: { tache: Tache; glissee: boolean; deplacable: boolean; onOuvrir: () => void; onGlisser: () => void; onFinGlisser: () => void }) {
  const s = useSession();
  const jour = jourIso();
  const enRetard = t.echeance && t.echeance < jour && !t.termine_le;
  const faits = t.checklist.filter((c) => c.fait).length;
  return (
    <article
      data-carte={t.id}
      draggable={deplacable}
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", t.id); e.dataTransfer.effectAllowed = "move"; onGlisser(); }}
      onDragEnd={onFinGlisser}
      onClick={onOuvrir}
      className={`cursor-pointer rounded-lg border border-bord bg-white p-2.5 text-sm shadow-sm hover:border-navy-600 ${glissee ? "opacity-40" : ""}`}
    >
      {t.etiquettes.length > 0 && <div className="mb-1 flex flex-wrap gap-1">{t.etiquettes.map((x) => <span key={x} className="rounded bg-navy-050 px-1.5 text-[11px] text-navy-700">{x}</span>)}</div>}
      <div className="font-medium">{t.titre}</div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        {t.priorite !== "normale" && <Badge ton={TON_PRIORITE[t.priorite]}>{PRIORITES[t.priorite]}</Badge>}
        {t.echeance && <Badge ton={enRetard ? "alerte" : t.termine_le ? "ok" : "neutre"}>📅 {formatDate(t.echeance)}</Badge>}
        {t.checklist.length > 0 && <Badge ton={faits === t.checklist.length ? "ok" : "neutre"}>☑ {faits}/{t.checklist.length}</Badge>}
        {t.proprietaire && <span className="ml-auto"><Avatar petit nom={nomUtilisateur(s.profils, t.proprietaire)} /></span>}
      </div>
    </article>
  );
}

function Calendrier({ taches, onOuvrir }: { taches: Tache[]; onOuvrir: (id: string) => void }) {
  const [mois, setMois] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const premier = new Date(mois);
  const decalage = (premier.getDay() + 6) % 7;
  const debut = new Date(premier.getFullYear(), premier.getMonth(), 1 - decalage);
  const jours = Array.from({ length: 42 }, (_, i) => new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + i));
  const cle = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const aujourdhui = cle(new Date());
  const sansDate = taches.filter((t) => !t.echeance && !t.termine_le).length;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Bouton onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() - 1, 1))}>←</Bouton>
        <strong className="w-40 text-center capitalize">{mois.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</strong>
        <Bouton onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() + 1, 1))}>→</Bouton>
        {sansDate > 0 && <span className="text-sm text-texte-2">{sansDate} tâche(s) sans échéance non affichée(s).</span>}
      </div>
      <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-bord bg-white text-xs">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((j) => <div key={j} className="border-b border-bord bg-fond px-2 py-1 font-semibold">{j}</div>)}
        {jours.map((d) => {
          const c = cle(d);
          const liste = taches.filter((t) => t.echeance === c);
          return (
            <div key={c} className={`min-h-24 border-b border-r border-bord p-1 ${d.getMonth() !== mois.getMonth() ? "bg-fond/60 text-texte-2" : ""}`}>
              <div className={`mb-1 text-right ${c === aujourdhui ? "font-bold text-cuivre-600" : ""}`}>{d.getDate()}</div>
              {liste.map((t) => (
                <button key={t.id} type="button" onClick={() => onOuvrir(t.id)} className={`mb-0.5 block w-full truncate rounded px-1 text-left ${t.termine_le ? "bg-emerald-50 line-through" : c < aujourdhui ? "bg-red-50 text-red-800" : "bg-navy-050"}`}>{t.titre}</button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NouvelleTache({ colonne, ordre, salles, onFermer }: { colonne: string; ordre: number; salles: { id: string; nom: string }[]; onFermer: () => void }) {
  const s = useSession();
  const [v, setV] = useState({ titre: "", proprietaire: "", echeance: "", priorite: "normale", salle_id: "" });
  const action = useAction();
  return (
    <Modale titre="Nouvelle carte" onFermer={onFermer} pied={<>
      <Bouton onClick={onFermer}>Annuler</Bouton>
      <Bouton variante="principal" disabled={!v.titre.trim() || action.enCours} onClick={() => void action.executer(async () => {
        await s.depot.creer("taches", { org_id: s.org!.id, colonne_id: colonne, titre: v.titre.trim(), ordre, proprietaire: v.proprietaire || null, echeance: v.echeance || null, priorite: v.priorite as Tache["priorite"], salle_id: v.salle_id || null });
        onFermer();
      })}>Créer</Bouton>
    </>}>
      <MessageErreur erreur={action.erreur} />
      <div className="grid gap-3 md:grid-cols-2">
        <Champ libelle="Titre" className="md:col-span-2"><Saisie autoFocus value={v.titre} onChange={(e) => setV({ ...v, titre: e.target.value })} /></Champ>
        <Champ libelle="Propriétaire"><Liste value={v.proprietaire} onChange={(e) => setV({ ...v, proprietaire: e.target.value })}><option value="">—</option>{s.profils.map((p) => <option key={p.id} value={p.id}>{p.nom_complet || p.email}</option>)}</Liste></Champ>
        <Champ libelle="Échéance"><Saisie type="date" value={v.echeance} onChange={(e) => setV({ ...v, echeance: e.target.value })} /></Champ>
        <Champ libelle="Priorité"><Liste value={v.priorite} onChange={(e) => setV({ ...v, priorite: e.target.value })}>{Object.entries(PRIORITES).map(([c, l]) => <option key={c} value={c}>{l}</option>)}</Liste></Champ>
        <Champ libelle="Salle propre"><Liste value={v.salle_id} onChange={(e) => setV({ ...v, salle_id: e.target.value })}><option value="">—</option>{salles.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</Liste></Champ>
      </div>
    </Modale>
  );
}

function DetailTache({ tache, colonnes, salles, onFermer }: { tache: Tache; colonnes: ColonneKanban[]; salles: { id: string; nom: string }[]; onFermer: () => void }) {
  const s = useSession();
  const [v, setV] = useState({ ...tache, etiquettesTexte: tache.etiquettes.join(", ") });
  const [nouvelElement, setNouvelElement] = useState("");
  const action = useAction();
  const ecriture = s.peut("kanban", 2);
  const enregistrer = () => action.executer(async () => {
    await s.depot.modifier("taches", tache.id, {
      titre: v.titre, description: v.description, colonne_id: v.colonne_id, proprietaire: v.proprietaire, echeance: v.echeance || null,
      priorite: v.priorite, etiquettes: v.etiquettesTexte.split(",").map((x) => x.trim()).filter(Boolean), checklist: v.checklist, salle_id: v.salle_id,
    });
    onFermer();
  });
  return (
    <Modale large titre={tache.titre} onFermer={onFermer} pied={<>
      {s.peut("kanban", 3) && <Bouton variante="danger" className="mr-auto" onClick={() => { if (window.confirm("Supprimer cette carte ?")) void action.executer(async () => { await s.depot.supprimer("taches", tache.id); onFermer(); }); }}>Supprimer</Bouton>}
      <Bouton onClick={onFermer}>Fermer</Bouton>
      {ecriture && <Bouton variante="principal" disabled={!v.titre.trim() || action.enCours} onClick={() => void enregistrer()}>Enregistrer</Bouton>}
    </>}>
      <MessageErreur erreur={action.erreur} />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="grid content-start gap-3">
          <Champ libelle="Titre"><Saisie disabled={!ecriture} value={v.titre} onChange={(e) => setV({ ...v, titre: e.target.value })} /></Champ>
          <Champ libelle="Description"><ZoneTexte disabled={!ecriture} rows={4} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Champ>
          <div>
            <div className="mb-1 text-xs font-semibold text-texte-2">Checklist</div>
            <ul className="space-y-1">
              {v.checklist.map((c, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" aria-label={c.texte} disabled={!ecriture} checked={c.fait} onChange={(e) => setV({ ...v, checklist: v.checklist.map((x, j) => (j === i ? { ...x, fait: e.target.checked } : x)) })} />
                  <span className={c.fait ? "text-texte-2 line-through" : ""}>{c.texte}</span>
                  {ecriture && <button type="button" aria-label="Retirer" className="ml-auto text-texte-2" onClick={() => setV({ ...v, checklist: v.checklist.filter((_, j) => j !== i) })}>✕</button>}
                </li>
              ))}
            </ul>
            {ecriture && (
              <form className="mt-1 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (nouvelElement.trim()) { setV({ ...v, checklist: [...v.checklist, { texte: nouvelElement.trim(), fait: false }] }); setNouvelElement(""); } }}>
                <Saisie aria-label="Nouvel élément de checklist" placeholder="Ajouter un élément…" value={nouvelElement} onChange={(e) => setNouvelElement(e.target.value)} />
                <Bouton type="submit">Ajouter</Bouton>
              </form>
            )}
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-texte-2">Discussion</div>
            <FilDiscussion objetType="tache" objetId={tache.id} objetLibelle={tache.titre} lien={`/taches?carte=${tache.id}`} hauteur="max-h-64" />
          </div>
        </div>
        <aside className="grid content-start gap-3">
          <Champ libelle="Colonne"><Liste disabled={!ecriture} value={v.colonne_id} onChange={(e) => setV({ ...v, colonne_id: e.target.value })}>{colonnes.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}</Liste></Champ>
          <Champ libelle="Propriétaire"><Liste disabled={!ecriture} value={v.proprietaire ?? ""} onChange={(e) => setV({ ...v, proprietaire: e.target.value || null })}><option value="">—</option>{s.profils.map((p) => <option key={p.id} value={p.id}>{p.nom_complet || p.email}</option>)}</Liste></Champ>
          <Champ libelle="Échéance"><Saisie disabled={!ecriture} type="date" value={v.echeance ?? ""} onChange={(e) => setV({ ...v, echeance: e.target.value || null })} /></Champ>
          <Champ libelle="Priorité"><Liste disabled={!ecriture} value={v.priorite} onChange={(e) => setV({ ...v, priorite: e.target.value as Tache["priorite"] })}>{Object.entries(PRIORITES).map(([c, l]) => <option key={c} value={c}>{l}</option>)}</Liste></Champ>
          <Champ libelle="Étiquettes" aide="Séparées par des virgules"><Saisie disabled={!ecriture} value={v.etiquettesTexte} onChange={(e) => setV({ ...v, etiquettesTexte: e.target.value })} /></Champ>
          <Champ libelle="Salle propre"><Liste disabled={!ecriture} value={v.salle_id ?? ""} onChange={(e) => setV({ ...v, salle_id: e.target.value || null })}><option value="">—</option>{salles.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</Liste></Champ>
          {tache.lien && <Link to={tache.lien} className="text-sm text-navy-700 hover:underline">Ouvrir l'objet lié →</Link>}
          <p className="text-xs text-texte-2">Créée le {formatDate(tache.cree_le, true)} par {nomUtilisateur(s.profils, tache.cree_par)}{tache.termine_le && ` · terminée le ${formatDate(tache.termine_le, true)}`}</p>
        </aside>
      </div>
    </Modale>
  );
}

function GestionColonnes({ colonnes, taches, onFermer }: { colonnes: ColonneKanban[]; taches: Tache[]; onFermer: () => void }) {
  const s = useSession();
  const [liste, setListe] = useState(colonnes.map((c) => ({ ...c })));
  const [nouvelle, setNouvelle] = useState("");
  const action = useAction();
  const deplacer = (i: number, d: number) => { const l = [...liste]; const [x] = l.splice(i, 1); l.splice(i + d, 0, x); setListe(l); };
  return (
    <Modale titre="Colonnes du tableau" onFermer={onFermer} pied={<>
      <Bouton onClick={onFermer}>Fermer</Bouton>
      <Bouton variante="principal" disabled={action.enCours} onClick={() => void action.executer(async () => {
        for (const [i, c] of liste.entries()) {
          const avant = colonnes.find((x) => x.id === c.id)!;
          if (avant.libelle !== c.libelle || avant.terminale !== c.terminale || avant.ordre !== i + 1) await s.depot.modifier("colonnes_kanban", c.id, { libelle: c.libelle, terminale: c.terminale, ordre: i + 1 });
        }
        onFermer();
      })}>Enregistrer</Bouton>
    </>}>
      <MessageErreur erreur={action.erreur} />
      <ul className="space-y-2">
        {liste.map((c, i) => (
          <li key={c.id} className="flex items-center gap-2">
            <Saisie aria-label="Libellé de colonne" value={c.libelle} onChange={(e) => setListe(liste.map((x, j) => (j === i ? { ...x, libelle: e.target.value } : x)))} />
            <label className="flex items-center gap-1 whitespace-nowrap text-xs"><input type="checkbox" checked={c.terminale} onChange={(e) => setListe(liste.map((x, j) => (j === i ? { ...x, terminale: e.target.checked } : x)))} /> terminale</label>
            <Bouton variante="discret" disabled={i === 0} onClick={() => deplacer(i, -1)}>↑</Bouton>
            <Bouton variante="discret" disabled={i === liste.length - 1} onClick={() => deplacer(i, 1)}>↓</Bouton>
            <Bouton variante="discret" disabled={taches.some((t) => t.colonne_id === c.id)} title="Une colonne qui contient des cartes ne peut pas être supprimée" onClick={() => void action.executer(async () => { await s.depot.supprimer("colonnes_kanban", c.id); setListe(liste.filter((x) => x.id !== c.id)); })}>Supprimer</Bouton>
          </li>
        ))}
      </ul>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!nouvelle.trim()) return; void action.executer(async () => {
        const c = await s.depot.creer("colonnes_kanban", { org_id: s.org!.id, libelle: nouvelle.trim(), ordre: liste.length + 1 });
        setListe([...liste, c]); setNouvelle("");
      }); }}>
        <Saisie placeholder="Nouvelle colonne" value={nouvelle} onChange={(e) => setNouvelle(e.target.value)} />
        <Bouton type="submit">Ajouter</Bouton>
      </form>
      <p className="mt-2 text-xs text-texte-2">Une colonne « terminale » horodate la fin des cartes qui y arrivent.</p>
    </Modale>
  );
}
