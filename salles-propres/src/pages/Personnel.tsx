import { useMemo, useState } from "react";
import { useSession } from "../session";
import type { Habilitation, Personne } from "../data/types";
import { Badge, Bandeau, Carte, Champ, EnTete, Liste, MessageErreur, Modale, Onglets, TableauDefilant, Vide, formatDate, useDonnees } from "../ui/composants";
import { GestionEntites, optionsDe } from "../ui/entites";
import {
  THEMES_FORMATION, TYPES_HABILITATIONS, formationsARecycler, habilitationCouvre, libelleNiveauHabilitation, statutEcheance, type StatutValidite,
} from "../domain/personnel";

const EMPLOYEURS = { interne: "Interne", prestataire: "Prestataire", interimaire: "Intérimaire" };
const TON_VALIDITE: Record<StatutValidite, "ok" | "attention" | "alerte"> = { valide: "ok", a_renouveler: "attention", expiree: "alerte" };
const LIBELLE_VALIDITE: Record<StatutValidite, string> = { valide: "Valide", a_renouveler: "À renouveler", expiree: "Expirée" };

const nomPersonne = (p: Pick<Personne, "prenom" | "nom">) => `${p.prenom} ${p.nom}`.trim();

export function Personnel() {
  const s = useSession();
  const org = s.org!.id;
  const [onglet, setOnglet] = useState<"personnes" | "matrice" | "alertes">("personnes");
  const { donnees, erreur, recharger } = useDonnees(async () => {
    const [personnes, habilitations, formations, salles, zones] = await Promise.all([
      s.depot.lister("personnes", org), s.depot.lister("habilitations", org), s.depot.lister("formations", org),
      s.peut("installations", 1) ? s.depot.lister("salles_propres", org) : [],
      s.peut("installations", 1) ? s.depot.lister("zones", org) : [],
    ]);
    return { personnes, habilitations, formations, salles, zones };
  }, [org]);
  const [ouverte, setOuverte] = useState<Personne | null>(null);
  const jour = new Date().toISOString().slice(0, 10);

  const alertes = useMemo(() => {
    if (!donnees) return { habilitations: [], formations: [] };
    const actives = new Set(donnees.personnes.filter((p) => p.actif).map((p) => p.id));
    return {
      habilitations: donnees.habilitations.filter((h) => actives.has(h.personne_id) && statutEcheance(h.date_expiration) !== "valide"),
      formations: formationsARecycler(donnees.formations).filter((f) => actives.has(f.personne_id)),
    };
  }, [donnees]);
  const nbAlertes = alertes.habilitations.length + alertes.formations.length;

  const etatPersonne = (p: Personne): StatutValidite | null => {
    const hs = (donnees?.habilitations ?? []).filter((h) => h.personne_id === p.id && h.type === "acces_zone");
    if (!hs.length) return null;
    const statuts = hs.map((h) => statutEcheance(h.date_expiration));
    if (statuts.includes("valide")) return "valide";
    return statuts.includes("a_renouveler") ? "a_renouveler" : "expiree";
  };

  return (
    <>
      <EnTete
        titre="Personnel, habilitations et formations"
        sousTitre="Seule une personne habilitée pour le niveau de la zone, à la date prévue, peut se voir affecter une intervention de nettoyage."
      />
      <MessageErreur erreur={erreur} />
      <Onglets
        actif={onglet}
        onChange={setOnglet}
        onglets={[
          { cle: "personnes", libelle: "Personnes" },
          { cle: "matrice", libelle: "Matrice d'accès aux zones" },
          { cle: "alertes", libelle: <>Échéances {nbAlertes > 0 && <Badge ton="attention">{nbAlertes}</Badge>}</> },
        ]}
      />
      {onglet === "personnes" && (
        <GestionEntites
          table="personnes"
          lignes={donnees?.personnes ?? null}
          recharger={recharger}
          ouvrir={setOuverte}
          champs={[
            { cle: "prenom", libelle: "Prénom", type: "texte", requis: true },
            { cle: "nom", libelle: "Nom", type: "texte", requis: true },
            { cle: "fonction", libelle: "Fonction", type: "texte" },
            { cle: "employeur", libelle: "Employeur", type: "liste", requis: true, options: optionsDe(EMPLOYEURS) },
            { cle: "entreprise", libelle: "Entreprise (prestataire)", type: "texte", visible: (v) => v.employeur !== "interne" },
            { cle: "user_id", libelle: "Compte utilisateur", type: "liste", options: s.profils.map((m) => ({ valeur: m.id, libelle: m.nom_complet || m.email })), aide: "Facultatif : relie la fiche à un compte de l'application." },
            { cle: "actif", libelle: "Statut", type: "case", aide: "Personne active" },
            { cle: "notes", libelle: "Notes", type: "zone_texte" },
          ]}
          valeursInitiales={() => ({ prenom: "", nom: "", employeur: "interne", actif: true, user_id: null })}
          texteRecherche={(p) => `${p.prenom} ${p.nom} ${p.fonction} ${p.entreprise}`}
          trier={(a, b) => a.nom.localeCompare(b.nom)}
          colonnes={[
            { libelle: "Personne", rendu: (p) => <><strong className="text-navy-700">{nomPersonne(p)}</strong><div className="text-xs text-texte-2">{p.fonction}</div></> },
            { libelle: "Employeur", rendu: (p) => `${EMPLOYEURS[p.employeur]}${p.entreprise ? ` · ${p.entreprise}` : ""}` },
            { libelle: "Accès zones", rendu: (p) => { const e = etatPersonne(p); return e ? <Badge ton={TON_VALIDITE[e]}>{LIBELLE_VALIDITE[e]}</Badge> : <Badge>Aucune habilitation</Badge>; } },
            { libelle: "Formations", rendu: (p) => (donnees?.formations ?? []).filter((f) => f.personne_id === p.id).length },
            { libelle: "Statut", rendu: (p) => (p.actif ? "Actif" : <span className="text-texte-2">Inactif</span>) },
          ]}
          vide="Aucune personne enregistrée."
        />
      )}
      {onglet === "matrice" && donnees && <MatriceAcces {...donnees} jour={jour} />}
      {onglet === "alertes" && donnees && (
        <div className="grid gap-4">
          <Carte titre="Habilitations expirées ou à renouveler (60 jours)">
            {alertes.habilitations.length === 0 ? <Vide>Aucune habilitation à renouveler.</Vide> : (
              <TableauDefilant>
                <table className="tableau">
                  <thead><tr><th>Personne</th><th>Habilitation</th><th>Niveau</th><th>Expiration</th><th>État</th></tr></thead>
                  <tbody>{alertes.habilitations.map((h) => {
                    const p = donnees.personnes.find((x) => x.id === h.personne_id);
                    const st = statutEcheance(h.date_expiration);
                    return <tr key={h.id}><td>{p && nomPersonne(p)}</td><td>{TYPES_HABILITATIONS[h.type]}</td><td>{libelleNiveauHabilitation(h)}</td><td>{formatDate(h.date_expiration)}</td><td><Badge ton={TON_VALIDITE[st]}>{LIBELLE_VALIDITE[st]}</Badge></td></tr>;
                  })}</tbody>
                </table>
              </TableauDefilant>
            )}
          </Carte>
          <Carte titre="Formations à recycler">
            {alertes.formations.length === 0 ? <Vide>Aucune formation à recycler.</Vide> : (
              <TableauDefilant>
                <table className="tableau">
                  <thead><tr><th>Personne</th><th>Formation</th><th>Recyclage</th><th>État</th></tr></thead>
                  <tbody>{alertes.formations.map((f) => {
                    const p = donnees.personnes.find((x) => x.id === f.personne_id);
                    const st = statutEcheance(f.date_recyclage);
                    return <tr key={f.id}><td>{p && nomPersonne(p)}</td><td>{f.intitule}</td><td>{formatDate(f.date_recyclage)}</td><td><Badge ton={TON_VALIDITE[st]}>{LIBELLE_VALIDITE[st]}</Badge></td></tr>;
                  })}</tbody>
                </table>
              </TableauDefilant>
            )}
          </Carte>
        </div>
      )}
      {ouverte && <DetailPersonne personne={ouverte} onFermer={() => { setOuverte(null); recharger(); }} />}
    </>
  );
}

function MatriceAcces({ personnes, habilitations, salles, zones, jour }: {
  personnes: Personne[]; habilitations: Habilitation[]; salles: { id: string; nom: string }[]; zones: import("../data/types").Zone[]; jour: string;
}) {
  const [salleId, setSalleId] = useState(salles[0]?.id ?? "");
  const zonesSalle = zones.filter((z) => z.salle_id === salleId).sort((a, b) => a.code.localeCompare(b.code));
  const actives = personnes.filter((p) => p.actif).sort((a, b) => a.nom.localeCompare(b.nom));
  if (!salles.length) return <Vide>Aucune salle propre accessible.</Vide>;
  return (
    <Carte>
      <div className="mb-3 max-w-sm">
        <Champ libelle="Salle propre">
          <Liste value={salleId} onChange={(e) => setSalleId(e.target.value)}>
            {salles.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
          </Liste>
        </Champ>
      </div>
      <p className="mb-3 text-sm text-texte-2">Accès autorisé aujourd'hui selon les habilitations « accès en zone » ou « nettoyage » en cours de validité.</p>
      {zonesSalle.length === 0 || actives.length === 0 ? <Vide>Aucune zone ou aucune personne active.</Vide> : (
        <TableauDefilant>
          <table className="tableau">
            <thead>
              <tr>
                <th>Personne</th>
                {zonesSalle.map((z) => <th key={z.id} className="text-center" title={z.nom}>{z.code}<div className="text-[10px] font-normal text-texte-2">{z.grade_bpf ? `Grade ${z.grade_bpf}` : z.iso_repos != null ? `ISO ${z.iso_repos}` : "NC"}</div></th>)}
              </tr>
            </thead>
            <tbody>
              {actives.map((p) => {
                const hs = habilitations.filter((h) => h.personne_id === p.id);
                return (
                  <tr key={p.id}>
                    <td>{nomPersonne(p)}</td>
                    {zonesSalle.map((z) => {
                      const ok = hs.some((h) => habilitationCouvre(h, z, jour));
                      return <td key={z.id} className="text-center" aria-label={`${nomPersonne(p)} ${z.code} ${ok ? "autorisé" : "non autorisé"}`}>{ok ? <span className="text-emerald-700">●</span> : <span className="text-red-400">○</span>}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableauDefilant>
      )}
    </Carte>
  );
}

function DetailPersonne({ personne, onFermer }: { personne: Personne; onFermer: () => void }) {
  const s = useSession();
  const org = s.org!.id;
  const { donnees, recharger } = useDonnees(async () => {
    const [habilitations, formations, documents, interventions] = await Promise.all([
      s.depot.lister("habilitations", org, { personne_id: personne.id }),
      s.depot.lister("formations", org, { personne_id: personne.id }),
      s.peut("documents", 1) ? s.depot.lister("documents", org) : [],
      s.peut("nettoyage_execution", 1) ? s.depot.lister("interventions_nettoyage", org, { personne_id: personne.id }) : [],
    ]);
    return { habilitations, formations, documents, interventions };
  }, [org, personne.id]);
  const docs = (donnees?.documents ?? []).map((d) => ({ valeur: d.id, libelle: d.titre }));
  const jour = new Date().toISOString().slice(0, 10);
  const aVenir = (donnees?.interventions ?? []).filter((i) => i.statut === "a_faire" && i.date_prevue >= jour).length;
  const realisees = (donnees?.interventions ?? []).filter((i) => i.statut === "realisee").length;
  return (
    <Modale large titre={nomPersonne(personne)} onFermer={onFermer}>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Badge ton="info">{EMPLOYEURS[personne.employeur]}{personne.entreprise ? ` · ${personne.entreprise}` : ""}</Badge>
        {personne.fonction && <Badge>{personne.fonction}</Badge>}
        {s.peut("nettoyage_execution", 1) && <Badge>{realisees} nettoyage(s) réalisé(s) · {aVenir} à venir</Badge>}
      </div>
      {!personne.actif && <div className="mb-3"><Bandeau ton="attention">Personne inactive : elle n'apparaît plus dans les affectations.</Bandeau></div>}
      <GestionEntites
        table="habilitations"
        titre="Habilitations"
        lignes={donnees?.habilitations ?? null}
        recharger={recharger}
        champs={[
          { cle: "type", libelle: "Type", type: "liste", requis: true, options: optionsDe(TYPES_HABILITATIONS) },
          { cle: "grade_bpf", libelle: "Grade BPF maximal", type: "liste", options: optionsDe({ A: "Grade A", B: "Grade B", C: "Grade C", D: "Grade D" }), aide: "Le plus exigeant autorisé (A couvre B, C, D)." },
          { cle: "classe_iso_max", libelle: "Classe ISO la plus exigeante", type: "nombre", aide: "Ex. 5 couvre ISO 5 à 9." },
          { cle: "date_obtention", libelle: "Obtention", type: "date", requis: true },
          { cle: "date_expiration", libelle: "Expiration", type: "date" },
          { cle: "evaluateur", libelle: "Évaluateur", type: "texte" },
          { cle: "resultat", libelle: "Résultat de l'évaluation", type: "texte", aide: "Ex. boîtes contact gants et tenue conformes." },
          { cle: "document_id", libelle: "Preuve (GED)", type: "liste", options: docs },
        ]}
        valeursInitiales={() => ({ personne_id: personne.id, type: "acces_zone", date_obtention: jour, grade_bpf: null, classe_iso_max: null, date_expiration: null, document_id: null })}
        colonnes={[
          { libelle: "Type", rendu: (h) => TYPES_HABILITATIONS[h.type] },
          { libelle: "Niveau", rendu: (h) => libelleNiveauHabilitation(h) },
          { libelle: "Validité", rendu: (h) => `${formatDate(h.date_obtention)} → ${h.date_expiration ? formatDate(h.date_expiration) : "sans limite"}` },
          { libelle: "État", rendu: (h) => { const st = statutEcheance(h.date_expiration); return <Badge ton={TON_VALIDITE[st]}>{LIBELLE_VALIDITE[st]}</Badge>; } },
        ]}
        vide="Aucune habilitation : cette personne ne peut pas intervenir en zone classée."
      />
      <div className="mt-6">
        <GestionEntites
          table="formations"
          titre="Formations"
          lignes={donnees?.formations ?? null}
          recharger={recharger}
          champs={[
            { cle: "intitule", libelle: "Intitulé", type: "texte", requis: true },
            { cle: "theme", libelle: "Thème", type: "liste", requis: true, options: optionsDe(THEMES_FORMATION) },
            { cle: "organisme", libelle: "Organisme", type: "texte" },
            { cle: "date_formation", libelle: "Date", type: "date", requis: true },
            { cle: "duree_h", libelle: "Durée (h)", type: "nombre" },
            { cle: "date_recyclage", libelle: "Recyclage prévu", type: "date" },
            { cle: "document_id", libelle: "Attestation (GED)", type: "liste", options: docs },
          ]}
          valeursInitiales={() => ({ personne_id: personne.id, intitule: "", theme: "essentiel_salle_propre", date_formation: jour, duree_h: null, date_recyclage: null, document_id: null })}
          trier={(a, b) => b.date_formation.localeCompare(a.date_formation)}
          colonnes={[
            { libelle: "Formation", rendu: (f) => <><strong>{f.intitule}</strong><div className="text-xs text-texte-2">{THEMES_FORMATION[f.theme] ?? f.theme}</div></> },
            { libelle: "Organisme", rendu: (f) => f.organisme || "—" },
            { libelle: "Date", rendu: (f) => formatDate(f.date_formation) },
            { libelle: "Recyclage", rendu: (f) => { if (!f.date_recyclage) return "—"; const st = statutEcheance(f.date_recyclage); return <Badge ton={TON_VALIDITE[st]}>{formatDate(f.date_recyclage)}</Badge>; } },
          ]}
          vide="Aucune formation enregistrée."
        />
      </div>
    </Modale>
  );
}
