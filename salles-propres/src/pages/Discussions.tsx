import { Link } from "react-router";
import { useSession, nomUtilisateur } from "../session";
import { Carte, EnTete, formatDate, useDonnees } from "../ui/composants";
import { FilDiscussion } from "../ui/discussion";

const TYPES: Record<string, string> = {
  general: "Général", salle: "Salle propre", ecart: "Écart", tache: "Tâche", campagne: "Qualification", document: "Document", procedure: "Procédure",
};

export function Discussions() {
  const s = useSession();
  const org = s.org!.id;
  const { donnees } = useDonnees(() => s.depot.lister("messages", org), [org]);
  const fils = new Map<string, { type: string; libelle: string; lien: string; dernier: string; auteur: string; texte: string; nombre: number }>();
  for (const m of [...(donnees ?? [])].filter((x) => x.objet_type !== "general" && !x.archive).sort((a, b) => b.cree_le.localeCompare(a.cree_le))) {
    const cle = `${m.objet_type}:${m.objet_id}`;
    const f = fils.get(cle);
    if (f) f.nombre++;
    else fils.set(cle, { type: m.objet_type, libelle: m.objet_libelle, lien: m.lien, dernier: m.cree_le, auteur: nomUtilisateur(s.profils, m.auteur), texte: m.contenu, nombre: 1 });
  }
  return (
    <>
      <EnTete titre="Discussions" sousTitre="Espace d'échange commun et fils rattachés aux objets (salles, écarts, tâches, campagnes). Les messages sont conservés avec leur historique." />
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Carte titre="Espace général"><FilDiscussion objetType="general" objetId={null} objetLibelle="Espace général" lien="/discussions" hauteur="max-h-[60vh]" /></Carte>
        <Carte titre="Conversations récentes">
          {fils.size === 0 ? <p className="text-sm text-texte-2">Aucune conversation sur un objet.</p> : (
            <ul className="space-y-2">
              {[...fils.values()].slice(0, 30).map((f) => (
                <li key={`${f.type}${f.libelle}${f.dernier}`}>
                  <Link to={f.lien || "/discussions"} className="block rounded-lg border border-bord p-2 hover:bg-fond">
                    <div className="flex justify-between gap-2 text-xs text-texte-2"><span>{TYPES[f.type] ?? f.type} · {f.nombre} message(s)</span><span>{formatDate(f.dernier, true)}</span></div>
                    <div className="text-sm font-medium">{f.libelle || "—"}</div>
                    <div className="truncate text-xs text-texte-2">{f.auteur} : {f.texte}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>
    </>
  );
}
