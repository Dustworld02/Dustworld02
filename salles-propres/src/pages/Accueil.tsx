import { Link } from "react-router";
import { useSession, nomUtilisateur } from "../session";
import { Badge, Carte, EnTete, formatDate, useDonnees } from "../ui/composants";
import { libelleTable, libelleAction } from "./Journal";

function Indicateur({ libelle, valeur, lien }: { libelle: string; valeur: number | string; lien?: string }) {
  const contenu = (
    <div className="rounded-xl border border-bord bg-white p-4 shadow-sm transition hover:border-navy-600">
      <div className="text-xs font-semibold uppercase tracking-wide text-texte-2">{libelle}</div>
      <div className="mt-1 text-2xl font-bold text-navy-900">{valeur}</div>
    </div>
  );
  return lien ? <Link to={lien}>{contenu}</Link> : contenu;
}

export function Accueil() {
  const s = useSession();
  const org = s.org!.id;
  const { donnees } = useDonnees(async () => {
    const lire = s.peut("installations", 1);
    const [entreprises, salles, zones, documents, journal] = await Promise.all([
      lire ? s.depot.lister("entreprises", org) : [],
      lire ? s.depot.lister("salles_propres", org) : [],
      lire ? s.depot.lister("zones", org) : [],
      s.peut("documents", 1) ? s.depot.lister("documents", org) : [],
      s.peut("audit", 1) ? s.depot.journal(org, { limite: 8 }) : [],
    ]);
    return { entreprises, salles, zones, documents, journal };
  }, [org]);

  const aujourdhui = new Date();
  const dans60j = new Date(aujourdhui.getTime() + 60 * 86400000);
  const echeances = (donnees?.documents ?? [])
    .filter((d) => d.valide_jusqu_au && d.statut !== "perime" && new Date(d.valide_jusqu_au) <= dans60j)
    .sort((a, b) => (a.valide_jusqu_au ?? "").localeCompare(b.valide_jusqu_au ?? ""));
  const enRevue = (donnees?.documents ?? []).filter((d) => d.statut === "en_revue");
  const sansSurface = (donnees?.zones ?? []).filter((z) => z.surface_m2 == null);

  return (
    <>
      <EnTete titre={`Bonjour ${s.utilisateur?.nom_complet?.split(" ")[0] ?? ""}`} sousTitre={s.org?.nom} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicateur libelle="Entreprises" valeur={donnees?.entreprises.length ?? "…"} lien="/entreprises" />
        <Indicateur libelle="Salles propres" valeur={donnees?.salles.length ?? "…"} lien="/salles" />
        <Indicateur libelle="Zones" valeur={donnees?.zones.length ?? "…"} lien="/salles" />
        <Indicateur libelle="Documents" valeur={donnees?.documents.length ?? "…"} lien="/documents" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Carte titre="À traiter">
          <ul className="space-y-2 text-sm">
            {echeances.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2">
                <Link to="/documents" className="hover:underline">{d.titre}</Link>
                <Badge ton={new Date(d.valide_jusqu_au!) < aujourdhui ? "alerte" : "attention"}>
                  {new Date(d.valide_jusqu_au!) < aujourdhui ? "Expiré le" : "Expire le"} {formatDate(d.valide_jusqu_au)}
                </Badge>
              </li>
            ))}
            {enRevue.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2">
                <Link to="/documents" className="hover:underline">{d.titre}</Link>
                <Badge ton="info">En revue : à approuver</Badge>
              </li>
            ))}
            {sansSurface.length > 0 && (
              <li className="flex items-center justify-between gap-2">
                <Link to="/salles" className="hover:underline">{sansSurface.length} zone(s) sans surface renseignée</Link>
                <Badge ton="attention">Points de prélèvement non calculables</Badge>
              </li>
            )}
            {echeances.length + enRevue.length + sansSurface.length === 0 && <li className="text-texte-2">Rien d'urgent.</li>}
          </ul>
        </Carte>

        {s.peut("audit", 1) ? (
          <Carte titre="Dernières modifications" actions={<Link to="/journal" className="text-sm text-navy-700 hover:underline">Tout le journal</Link>}>
            <ul className="space-y-1.5 text-sm">
              {(donnees?.journal ?? []).map((j) => (
                <li key={j.id} className="flex gap-2">
                  <span className="w-28 shrink-0 text-texte-2">{formatDate(j.horodatage, true)}</span>
                  <span>{nomUtilisateur(s.profils, j.auteur)} — {libelleAction(j.action)} · {libelleTable(j.table_nom)}</span>
                </li>
              ))}
            </ul>
          </Carte>
        ) : (
          <Carte titre="Démarrer">
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>Consultez les salles propres et leurs zones.</li>
              <li>Ouvrez les documents qui vous concernent.</li>
            </ol>
          </Carte>
        )}

        {s.peut("installations", 2) && (
          <Carte titre="Parcours de mise en service" className="lg:col-span-2">
            <ol className="grid gap-2 text-sm md:grid-cols-5">
              {[
                ["1. Entreprise et site", "/entreprises"],
                ["2. Salle propre via l'assistant (choix du secteur)", "/salles/nouvelle"],
                ["3. Compléter les zones : surfaces, hauteurs, consignes", "/salles"],
                ["4. Déposer URS, plans et procédures", "/documents"],
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
