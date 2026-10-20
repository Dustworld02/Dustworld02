import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useSession, nomUtilisateur } from "../session";
import type { EntreeJournal } from "../data/types";
import { Badge, Bouton, EnTete, Liste, MessageErreur, TableauDefilant, Vide, formatDate, telechargerFichier, useDonnees } from "../ui/composants";

const TABLES: Record<string, string> = {
  organisations: "Organisation",
  roles: "Rôle",
  droits_roles: "Droit",
  membres: "Membre",
  invitations: "Invitation",
  referentiels_org: "Référentiel",
  gabarits_org: "Gabarit",
  entreprises: "Entreprise",
  sites: "Site",
  salles_propres: "Salle propre",
  zones: "Zone",
  documents: "Document",
  versions_documents: "Version de document",
  signatures: "Signature",
  portes: "Porte", ctas: "CTA", bouches: "Bouche", filtres: "Filtre", releves_filtres: "Relevé de filtre", equipements: "Équipement", mobilier: "Mobilier",
  points_prelevement: "Point de prélèvement", flux: "Flux", notifications: "Notification", instruments: "Instrument", etalonnages: "Étalonnage",
  campagnes_qualification: "Campagne de qualification", essais: "Essai", resultats: "Résultat", ecarts: "Écart", capa: "CAPA", colonnes_kanban: "Colonne du Kanban",
  taches: "Tâche", messages: "Message", produits_nettoyage: "Produit de nettoyage", consommables: "Consommable", procedures_nettoyage: "Procédure de nettoyage",
  personnes: "Personne", habilitations: "Habilitation", formations: "Formation", interventions_nettoyage: "Intervention de nettoyage",
  validations_nettoyage: "Validation du nettoyage", materiel_nettoyage: "Matériel de nettoyage", plans_echantillonnage: "Plan d'échantillonnage",
  releves_ambiance: "Relevé d'ambiance", gammes_maintenance: "Gamme de maintenance", interventions_maintenance: "Intervention de maintenance", changements: "Changement",
};

export function libelleTable(t: string): string {
  return TABLES[t] ?? t;
}

export function libelleAction(a: EntreeJournal["action"]): string {
  return a === "insert" ? "création" : a === "update" ? "modification" : "suppression";
}

const IGNORES = new Set(["modifie_le", "modifie_par", "cree_le", "cree_par", "id", "org_id"]);

function valeur(v: unknown): string {
  if (v === null || v === undefined || v === "") return "∅";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Champs modifiés entre deux états d'un enregistrement. */
export function differences(e: EntreeJournal): { champ: string; avant: string; apres: string }[] {
  const avant = e.anciennes ?? {};
  const apres = e.nouvelles ?? {};
  const champs = new Set([...Object.keys(avant), ...Object.keys(apres)]);
  return [...champs]
    .filter((c) => !IGNORES.has(c))
    .filter((c) => JSON.stringify(avant[c] ?? null) !== JSON.stringify(apres[c] ?? null))
    .map((c) => ({ champ: c, avant: valeur(avant[c]), apres: valeur(apres[c]) }));
}

function titre(e: EntreeJournal): string {
  const l = e.nouvelles ?? e.anciennes ?? {};
  return String(l.nom ?? l.titre ?? l.libelle ?? l.email ?? l.module ?? l.nom_fichier ?? l.cle ?? "");
}

export function Journal() {
  const s = useSession();
  const org = s.org!.id;
  const [parametres] = useSearchParams();
  const [table, setTable] = useState(parametres.get("table") ?? "");
  const enregistrement = parametres.get("id") ?? "";
  const { donnees, erreur } = useDonnees(
    () => s.depot.journal(org, { table: table || undefined, enregistrementId: enregistrement || undefined, limite: 500 }),
    [org, table, enregistrement],
  );
  const lignes = useMemo(() => donnees ?? [], [donnees]);

  const exporter = () => {
    const echapper = (t: string) => `"${t.replace(/"/g, '""')}"`;
    const csv = ["horodatage;auteur;action;objet;libellé;modifications"]
      .concat(lignes.map((e) => [
        e.horodatage, nomUtilisateur(s.profils, e.auteur), libelleAction(e.action), libelleTable(e.table_nom), titre(e),
        differences(e).map((d) => `${d.champ}: ${d.avant} → ${d.apres}`).join(" | "),
      ].map((x) => echapper(String(x))).join(";")))
      .join("\n");
    telechargerFichier(`journal-audit-${new Date().toISOString().slice(0, 10)}.csv`, "﻿" + csv, "text/csv;charset=utf-8");
  };

  return (
    <>
      <EnTete
        titre="Journal d'audit"
        sousTitre="Chaque création, modification et suppression : qui, quand, valeurs avant et après. Le journal ne peut être ni modifié ni effacé."
        actions={<Bouton onClick={exporter} disabled={lignes.length === 0}>Exporter en CSV</Bouton>}
      />
      <MessageErreur erreur={erreur} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Liste aria-label="Type d'objet" className="!w-auto" value={table} onChange={(e) => setTable(e.target.value)}>
          <option value="">Tous les objets</option>
          {Object.entries(TABLES).map(([cle, l]) => <option key={cle} value={cle}>{l}</option>)}
        </Liste>
        {enregistrement && <Badge ton="info">Filtré sur un enregistrement</Badge>}
        <span className="text-sm text-texte-2">{lignes.length} entrée(s), les 500 plus récentes au maximum.</span>
      </div>
      {donnees && lignes.length === 0 && <Vide>Aucune entrée.</Vide>}
      {lignes.length > 0 && (
        <TableauDefilant>
          <table className="tableau bg-white">
            <thead><tr><th>Horodatage</th><th>Auteur</th><th>Action</th><th>Objet</th><th>Détail</th></tr></thead>
            <tbody>
              {lignes.map((e) => {
                const diff = e.action === "update" ? differences(e) : [];
                return (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap">{formatDate(e.horodatage, true)}</td>
                    <td className="whitespace-nowrap">{nomUtilisateur(s.profils, e.auteur)}</td>
                    <td><Badge ton={e.action === "delete" ? "alerte" : e.action === "insert" ? "ok" : "info"}>{libelleAction(e.action)}</Badge></td>
                    <td className="whitespace-nowrap">{libelleTable(e.table_nom)}<div className="text-xs text-texte-2">{titre(e)}</div></td>
                    <td className="text-xs">
                      {diff.map((d) => <div key={d.champ}><span className="font-mono text-texte-2">{d.champ}</span> : <span className="line-through opacity-60">{d.avant}</span> → <strong>{d.apres}</strong></div>)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableauDefilant>
      )}
    </>
  );
}
