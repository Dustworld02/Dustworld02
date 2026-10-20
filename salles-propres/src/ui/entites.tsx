import { useMemo, useState, type ReactNode } from "react";
import { useSession } from "../session";
import type { Modification, NomTable, Nouveau, Tables } from "../data/types";
import { META, niveauEcritureTable, niveauSuppressionTable } from "../data/schema";
import { Bouton, Champ, Liste, MessageErreur, Modale, Saisie, SaisieNombre, TableauDefilant, Vide, ZoneTexte, useAction, useDonnees } from "./composants";

export interface Option {
  valeur: string;
  libelle: string;
}

export interface DefinitionChamp {
  cle: string;
  libelle: string;
  type: "texte" | "nombre" | "date" | "dateheure" | "liste" | "zone_texte" | "case" | "multiple" | "lignes";
  options?: Option[];
  requis?: boolean;
  aide?: string;
  /** Occupe toute la largeur du formulaire. */
  large?: boolean;
  /** Masque le champ selon les autres valeurs. */
  visible?: (valeurs: Record<string, unknown>) => boolean;
  lectureSeule?: boolean;
}

function versDateHeureLocale(iso: unknown): string {
  if (typeof iso !== "string" || !iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Formulaire généré à partir d'une liste de champs. */
export function Formulaire({ champs, valeurs, onChange, lectureSeule, uneColonne }: {
  champs: DefinitionChamp[];
  valeurs: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  lectureSeule?: boolean;
  uneColonne?: boolean;
}) {
  const maj = (cle: string, v: unknown) => onChange({ ...valeurs, [cle]: v });
  return (
    <div className={`grid gap-3 ${uneColonne ? "" : "md:grid-cols-2"}`}>
      {champs.filter((c) => !c.visible || c.visible(valeurs)).map((c) => {
        const desactive = lectureSeule || c.lectureSeule;
        const v = valeurs[c.cle];
        let saisie: ReactNode;
        switch (c.type) {
          case "nombre":
            saisie = <SaisieNombre disabled={desactive} valeur={(v as number | null) ?? null} onChange={(n) => maj(c.cle, n)} />;
            break;
          case "date":
            saisie = <Saisie type="date" disabled={desactive} value={typeof v === "string" ? v.slice(0, 10) : ""} onChange={(e) => maj(c.cle, e.target.value || null)} />;
            break;
          case "dateheure":
            saisie = <Saisie type="datetime-local" disabled={desactive} value={versDateHeureLocale(v)} onChange={(e) => maj(c.cle, e.target.value ? new Date(e.target.value).toISOString() : null)} />;
            break;
          case "liste":
            saisie = (
              <Liste disabled={desactive} value={(v as string | null) ?? ""} onChange={(e) => maj(c.cle, e.target.value || null)}>
                {!c.requis && <option value="">—</option>}
                {c.options?.map((o) => <option key={o.valeur} value={o.valeur}>{o.libelle}</option>)}
              </Liste>
            );
            break;
          case "multiple": {
            const liste = Array.isArray(v) ? (v as string[]) : [];
            saisie = (
              <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-bord px-2.5 py-1.5 text-sm">
                {c.options?.map((o) => (
                  <label key={o.valeur} className="flex items-center gap-1.5">
                    <input type="checkbox" disabled={desactive} checked={liste.includes(o.valeur)} onChange={(e) => maj(c.cle, e.target.checked ? [...liste, o.valeur] : liste.filter((x) => x !== o.valeur))} />
                    {o.libelle}
                  </label>
                ))}
              </div>
            );
            break;
          }
          case "lignes":
            saisie = <ZoneTexte disabled={desactive} rows={4} value={Array.isArray(v) ? (v as string[]).join("\n") : ""} onChange={(e) => maj(c.cle, e.target.value.split("\n"))} placeholder="Une ligne par élément" />;
            break;
          case "zone_texte":
            saisie = <ZoneTexte disabled={desactive} value={(v as string) ?? ""} onChange={(e) => maj(c.cle, e.target.value)} />;
            break;
          case "case":
            saisie = (
              <label className="flex items-center gap-2 py-1.5 text-sm">
                <input type="checkbox" disabled={desactive} checked={!!v} onChange={(e) => maj(c.cle, e.target.checked)} /> {c.aide ?? "Oui"}
              </label>
            );
            break;
          default:
            saisie = <Saisie disabled={desactive} value={(v as string) ?? ""} onChange={(e) => maj(c.cle, e.target.value)} />;
        }
        return (
          <Champ key={c.cle} libelle={`${c.libelle}${c.requis ? " *" : ""}`} aide={c.type === "case" ? undefined : c.aide} className={c.large || c.type === "zone_texte" || c.type === "multiple" || c.type === "lignes" ? "md:col-span-2" : ""}>
            {saisie}
          </Champ>
        );
      })}
    </div>
  );
}

export function champsManquants(champs: DefinitionChamp[], valeurs: Record<string, unknown>): string[] {
  return champs
    .filter((c) => c.requis && (!c.visible || c.visible(valeurs)))
    .filter((c) => { const v = valeurs[c.cle]; return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0); })
    .map((c) => c.libelle);
}

export interface DefinitionColonne<T> {
  libelle: ReactNode;
  rendu: (ligne: T) => ReactNode;
  classe?: string;
}

/** Charge les lignes d'une table de l'organisation courante. */
export function useTable<T extends NomTable>(table: T, filtre?: Partial<Tables[T]>, actif = true) {
  const s = useSession();
  const org = s.org!.id;
  const cle = JSON.stringify(filtre ?? {});
  return useDonnees<Tables[T][]>(
    async () => (actif && (s.peut(META[table].module, 1) || META[table].portee === "membre" || META[table].portee === "personnel") ? s.depot.lister(table, org, filtre) : []),
    [org, table, cle, actif],
  );
}

/**
 * Liste + formulaire de création / modification / suppression d'une table,
 * avec les droits du module appliqués à l'interface.
 */
export function GestionEntites<T extends NomTable>({
  table, titre, champs, colonnes, lignes, recharger, valeursInitiales, actions, actionsLigne, texteRecherche, vide, ouvrir, avantEnregistrement, trier, lectureSeule,
}: {
  table: T;
  titre?: ReactNode;
  champs: DefinitionChamp[];
  colonnes: DefinitionColonne<Tables[T]>[];
  lignes: Tables[T][] | null;
  recharger: () => void;
  valeursInitiales: () => Record<string, unknown>;
  actions?: ReactNode;
  actionsLigne?: (ligne: Tables[T]) => ReactNode;
  texteRecherche?: (ligne: Tables[T]) => string;
  vide?: ReactNode;
  /** Clic sur une ligne : par défaut, ouvre le formulaire. */
  ouvrir?: (ligne: Tables[T]) => void;
  avantEnregistrement?: (valeurs: Record<string, unknown>) => Record<string, unknown>;
  trier?: (a: Tables[T], b: Tables[T]) => number;
  /** Force la lecture seule (ex. objet parent clôturé). */
  lectureSeule?: boolean;
}) {
  const s = useSession();
  const org = s.org!.id;
  const module = META[table].module;
  const ecriture = !lectureSeule && s.peut(module, niveauEcritureTable(table));
  const suppression = !lectureSeule && s.peut(module, niveauSuppressionTable(table));
  const [edition, setEdition] = useState<{ id?: string; valeurs: Record<string, unknown> } | null>(null);
  const [recherche, setRecherche] = useState("");
  const action = useAction();

  const visibles = useMemo(() => {
    let l = lignes ?? [];
    if (recherche && texteRecherche) l = l.filter((x) => texteRecherche(x).toLowerCase().includes(recherche.toLowerCase()));
    return trier ? [...l].sort(trier) : l;
  }, [lignes, recherche, texteRecherche, trier]);

  const manquants = edition ? champsManquants(champs, edition.valeurs) : [];

  const enregistrer = () => action.executer(async () => {
    const brutes = Object.fromEntries(Object.entries(edition!.valeurs).map(([k, v]) => [k, champs.find((c) => c.cle === k)?.type === "lignes" && Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : v]));
    const valeurs = avantEnregistrement ? avantEnregistrement(brutes) : brutes;
    const propres: Record<string, unknown> = {};
    for (const c of champs) if (c.cle in valeurs) propres[c.cle] = valeurs[c.cle];
    if (edition!.id) await s.depot.modifier(table, edition!.id, propres as Modification<T>);
    else await s.depot.creer(table, { ...valeurs, org_id: org } as Nouveau<T>);
    setEdition(null);
    recharger();
  });

  const supprimer = (ligne: Tables[T]) => {
    if (!window.confirm("Supprimer cet enregistrement ? L'opération est tracée dans le journal d'audit.")) return;
    void action.executer(async () => { await s.depot.supprimer(table, ligne.id); recharger(); });
  };

  const ouvrirFormulaire = (ligne: Tables[T]) => {
    action.effacer();
    setEdition({ id: ligne.id, valeurs: { ...(ligne as unknown as Record<string, unknown>) } });
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {titre && <h2 className="mr-auto text-[15px] font-semibold">{titre}</h2>}
        {texteRecherche && <Saisie placeholder="Rechercher…" className="!w-56" value={recherche} onChange={(e) => setRecherche(e.target.value)} />}
        {actions}
        {ecriture && <Bouton variante="principal" onClick={() => { action.effacer(); setEdition({ valeurs: valeursInitiales() }); }}>+ Ajouter</Bouton>}
      </div>
      <MessageErreur erreur={edition ? null : action.erreur} />
      {lignes && visibles.length === 0 ? <Vide>{vide ?? "Aucun enregistrement."}</Vide> : (
        <TableauDefilant>
          <table className="tableau bg-white">
            <thead><tr>{colonnes.map((c, i) => <th key={i} className={c.classe}>{c.libelle}</th>)}<th /></tr></thead>
            <tbody>
              {visibles.map((l) => (
                <tr key={l.id} className="cursor-pointer" onClick={() => (ouvrir ? ouvrir(l) : ouvrirFormulaire(l))}>
                  {colonnes.map((c, i) => <td key={i} className={c.classe}>{c.rendu(l)}</td>)}
                  <td className="whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                    {actionsLigne?.(l)}
                    {ouvrir && <Bouton variante="discret" onClick={() => ouvrirFormulaire(l)}>{ecriture ? "Modifier" : "Voir"}</Bouton>}
                    {suppression && <Bouton variante="discret" onClick={() => supprimer(l)}>Supprimer</Bouton>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableauDefilant>
      )}
      {edition && (
        <Modale
          titre={edition.id ? (ecriture ? "Modifier" : "Détail") : "Ajouter"}
          onFermer={() => setEdition(null)}
          large={champs.length > 8}
          pied={ecriture ? <>
            {manquants.length > 0 && <span className="mr-auto text-xs text-texte-2">Obligatoire : {manquants.join(", ")}</span>}
            <Bouton onClick={() => setEdition(null)}>Annuler</Bouton>
            <Bouton variante="principal" disabled={action.enCours || manquants.length > 0} onClick={() => void enregistrer()}>Enregistrer</Bouton>
          </> : <Bouton onClick={() => setEdition(null)}>Fermer</Bouton>}
        >
          <MessageErreur erreur={action.erreur} />
          <Formulaire champs={champs} valeurs={edition.valeurs} lectureSeule={!ecriture} onChange={(v) => setEdition({ ...edition, valeurs: v })} />
        </Modale>
      )}
    </div>
  );
}

/** Options d'une liste à partir de lignes. */
export function options<T extends { id: string }>(lignes: T[] | null | undefined, libelle: (l: T) => string): Option[] {
  return (lignes ?? []).map((l) => ({ valeur: l.id, libelle: libelle(l) }));
}

export function optionsDe(dictionnaire: Record<string, string>): Option[] {
  return Object.entries(dictionnaire).map(([valeur, libelle]) => ({ valeur, libelle }));
}
