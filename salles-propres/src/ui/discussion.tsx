import { useMemo, useRef, useState } from "react";
import { useSession, nomUtilisateur } from "../session";
import type { Message, Profil } from "../data/types";
import { Bouton, MessageErreur, formatDate, useAction, useDonnees } from "./composants";

function initiales(nom: string): string {
  return nom.split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0]?.toUpperCase()).join("") || "?";
}

export function Avatar({ nom, petit }: { nom: string; petit?: boolean }) {
  let h = 0;
  for (const c of nom) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span title={nom} style={{ background: `hsl(${h}, 45%, 42%)` }} className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${petit ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs"}`}>
      {initiales(nom)}
    </span>
  );
}

/** Affiche le contenu en mettant en évidence les mentions. */
function Contenu({ texte, profils, mentions }: { texte: string; profils: Profil[]; mentions: string[] }) {
  const noms = profils.filter((p) => mentions.includes(p.id)).map((p) => `@${p.nom_complet || p.email}`);
  if (noms.length === 0) return <>{texte}</>;
  const motif = new RegExp(`(${noms.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return <>{texte.split(motif).map((morceau, i) => (noms.includes(morceau) ? <strong key={i} className="text-navy-700">{morceau}</strong> : <span key={i}>{morceau}</span>))}</>;
}

/**
 * Fil de discussion rattaché à un objet (ou espace général).
 * Les messages ne sont jamais supprimés ; ils peuvent être archivés.
 */
export function FilDiscussion({ objetType, objetId, objetLibelle, lien, hauteur = "max-h-96" }: {
  objetType: string;
  objetId: string | null;
  objetLibelle: string;
  lien: string;
  hauteur?: string;
}) {
  const s = useSession();
  const org = s.org!.id;
  const { donnees, recharger } = useDonnees(
    () => (s.peut("discussions", 1) ? s.depot.lister("messages", org, objetId ? { objet_type: objetType, objet_id: objetId } : { objet_type: objetType }) : Promise.resolve([] as Message[])),
    [org, objetType, objetId],
  );
  const [texte, setTexte] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [reponseA, setReponseA] = useState<Message | null>(null);
  const [voirArchives, setVoirArchives] = useState(false);
  const zone = useRef<HTMLTextAreaElement>(null);
  const action = useAction();
  const ecriture = s.peut("discussions", 2);

  const messages = useMemo(() => [...(donnees ?? [])].filter((m) => voirArchives || !m.archive).sort((a, b) => a.cree_le.localeCompare(b.cree_le)), [donnees, voirArchives]);
  const recherche = texte.match(/@([\p{L}\p{N}' -]{0,30})$/u)?.[1]?.toLowerCase();
  const suggestions = recherche !== undefined ? s.profils.filter((p) => (p.nom_complet || p.email).toLowerCase().includes(recherche.trim())).slice(0, 6) : [];

  const mentionner = (p: Profil) => {
    const nom = p.nom_complet || p.email;
    setTexte(texte.replace(/@([\p{L}\p{N}' -]{0,30})$/u, `@${nom} `));
    if (!mentions.includes(p.id)) setMentions([...mentions, p.id]);
    zone.current?.focus();
  };

  const publier = () => action.executer(async () => {
    const retenues = mentions.filter((id) => texte.includes(`@${nomUtilisateur(s.profils, id)}`));
    await s.depot.creer("messages", {
      org_id: org, objet_type: objetType, objet_id: objetId, objet_libelle: objetLibelle, lien, contenu: texte.trim(), mentions: retenues, reponse_a: reponseA?.id ?? null,
    });
    setTexte(""); setMentions([]); setReponseA(null);
    recharger();
  });

  if (!s.peut("discussions", 1)) return <p className="text-sm text-texte-2">Discussions non accessibles avec votre rôle.</p>;

  return (
    <div>
      <div className={`${hauteur} space-y-3 overflow-y-auto pr-1`}>
        {messages.length === 0 && <p className="text-sm text-texte-2">Aucun message. Lancez l'échange ; utilisez @ pour mentionner quelqu'un.</p>}
        {messages.map((m) => {
          const auteur = nomUtilisateur(s.profils, m.auteur);
          const parent = m.reponse_a ? donnees?.find((x) => x.id === m.reponse_a) : null;
          return (
            <div key={m.id} className={`flex gap-2 ${m.archive ? "opacity-50" : ""}`}>
              <Avatar nom={auteur} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2 text-xs"><strong className="text-sm">{auteur}</strong><span className="text-texte-2">{formatDate(m.cree_le, true)}</span>{m.archive && <span className="text-texte-2">archivé</span>}</div>
                {parent && <div className="my-1 border-l-2 border-bord pl-2 text-xs text-texte-2">↪ {nomUtilisateur(s.profils, parent.auteur)} : {parent.contenu.slice(0, 100)}</div>}
                <p className="whitespace-pre-line text-sm"><Contenu texte={m.contenu} profils={s.profils} mentions={m.mentions} /></p>
                <div className="flex gap-3 text-xs text-texte-2">
                  {ecriture && !m.archive && <button type="button" className="hover:text-navy-700" onClick={() => { setReponseA(m); zone.current?.focus(); }}>Répondre</button>}
                  {ecriture && (m.auteur === s.utilisateur?.id || s.peut("discussions", 3)) && (
                    <button type="button" className="hover:text-navy-700" onClick={() => void action.executer(async () => { await s.depot.modifier("messages", m.id, { archive: !m.archive }); recharger(); })}>{m.archive ? "Désarchiver" : "Archiver"}</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {(donnees ?? []).some((m) => m.archive) && <button type="button" className="mt-2 text-xs text-texte-2 underline" onClick={() => setVoirArchives(!voirArchives)}>{voirArchives ? "Masquer" : "Afficher"} les messages archivés</button>}
      <MessageErreur erreur={action.erreur} />
      {ecriture && (
        <div className="relative mt-3">
          {reponseA && <div className="mb-1 flex items-center justify-between rounded bg-fond px-2 py-1 text-xs">Réponse à {nomUtilisateur(s.profils, reponseA.auteur)} <button type="button" onClick={() => setReponseA(null)}>✕</button></div>}
          <textarea
            ref={zone}
            aria-label="Nouveau message"
            rows={2}
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && texte.trim()) void publier(); }}
            placeholder="Écrire un message… (@ pour mentionner, Ctrl+Entrée pour envoyer)"
            className="w-full rounded-lg border border-bord px-2.5 py-1.5 text-sm outline-none focus:border-navy-600"
          />
          {suggestions.length > 0 && (
            <ul className="absolute bottom-full left-0 z-10 mb-1 w-64 rounded-lg border border-bord bg-white py-1 shadow-lg" role="listbox">
              {suggestions.map((p) => (
                <li key={p.id}><button type="button" role="option" aria-selected={false} className="flex w-full items-center gap-2 px-2 py-1 text-left text-sm hover:bg-navy-050" onClick={() => mentionner(p)}><Avatar petit nom={p.nom_complet || p.email} />{p.nom_complet || p.email}</button></li>
              ))}
            </ul>
          )}
          <div className="mt-1 flex justify-end"><Bouton variante="principal" disabled={action.enCours || !texte.trim()} onClick={() => void publier()}>Envoyer</Bouton></div>
        </div>
      )}
    </div>
  );
}
