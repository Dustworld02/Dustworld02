import { Link } from "react-router";
import { useSession } from "../session";
import type { SallePropre } from "../data/types";
import { Badge, Carte, EnTete, MessageErreur, useDonnees } from "../ui/composants";
import { GestionEntites, optionsDe, useTable, type DefinitionChamp } from "../ui/entites";
import { MATERIAUX, NETTOYABILITE, STATUTS_EQUIPEMENTS, TYPES_EQUIPEMENTS, TYPES_MOBILIER } from "../domain/libelles";

function champsEquipement(zones: { id: string; code: string; nom: string }[], salles?: { id: string; nom: string }[]): DefinitionChamp[] {
  return [
    ...(salles ? [{ cle: "salle_id", libelle: "Salle propre", type: "liste" as const, requis: true, options: salles.map((x) => ({ valeur: x.id, libelle: x.nom })) }] : []),
    { cle: "libelle", libelle: "Libellé", type: "texte", requis: true },
    { cle: "type", libelle: "Type", type: "liste", options: optionsDe(TYPES_EQUIPEMENTS), requis: true },
    { cle: "repere", libelle: "Repère", type: "texte" },
    { cle: "zone_id", libelle: "Zone", type: "liste", options: zones.map((z) => ({ valeur: z.id, libelle: `${z.code} ${z.nom}` })) },
    { cle: "marque", libelle: "Marque", type: "texte" },
    { cle: "modele", libelle: "Modèle", type: "texte" },
    { cle: "numero_serie", libelle: "N° de série", type: "texte" },
    { cle: "date_mise_service", libelle: "Mise en service", type: "date" },
    { cle: "statut", libelle: "Statut", type: "liste", options: optionsDe(STATUTS_EQUIPEMENTS), requis: true },
    { cle: "notes", libelle: "Notes", type: "zone_texte" },
  ];
}

const TON = { en_service: "ok", en_qualification: "info", hors_service: "alerte" } as const;

/** Onglet « Équipements et mobilier » d'une salle propre. */
export function EquipementsSalle({ salle }: { salle: SallePropre }) {
  const zones = useTable("zones", { salle_id: salle.id });
  const equipements = useTable("equipements", { salle_id: salle.id });
  const mobilier = useTable("mobilier", { salle_id: salle.id });
  const listeZones = zones.donnees ?? [];
  const nomZone = (id: string | null) => listeZones.find((z) => z.id === id)?.nom ?? "—";
  return (
    <div className="grid gap-6">
      <Carte>
        <GestionEntites
          table="equipements"
          titre="Équipements"
          lignes={equipements.donnees}
          recharger={equipements.recharger}
          champs={champsEquipement(listeZones)}
          valeursInitiales={() => ({ salle_id: salle.id, type: "psm", statut: "en_service", libelle: "", zone_id: null, x: null, y: null })}
          texteRecherche={(e) => `${e.libelle} ${e.repere} ${e.numero_serie}`}
          colonnes={[
            { libelle: "Équipement", rendu: (e) => <><strong>{e.libelle}</strong>{e.repere && <span className="text-texte-2"> · {e.repere}</span>}</> },
            { libelle: "Type", rendu: (e) => TYPES_EQUIPEMENTS[e.type] ?? e.type },
            { libelle: "Zone", rendu: (e) => nomZone(e.zone_id) },
            { libelle: "Statut", rendu: (e) => <Badge ton={TON[e.statut]}>{STATUTS_EQUIPEMENTS[e.statut]}</Badge> },
            { libelle: "Sur le plan", rendu: (e) => (e.x != null ? "Oui" : <span className="text-texte-2">Non</span>) },
          ]}
          vide="Aucun équipement. Ajoutez-en ici ou posez-les directement sur le plan."
        />
      </Carte>
      <Carte>
        <GestionEntites
          table="mobilier"
          titre="Mobilier"
          lignes={mobilier.donnees}
          recharger={mobilier.recharger}
          champs={[
            { cle: "libelle", libelle: "Libellé", type: "texte" },
            { cle: "type", libelle: "Type", type: "liste", options: optionsDe(TYPES_MOBILIER), requis: true },
            { cle: "materiau", libelle: "Matériau", type: "liste", options: optionsDe(MATERIAUX) },
            { cle: "nettoyabilite", libelle: "Nettoyabilité", type: "liste", options: optionsDe(NETTOYABILITE), requis: true, aide: "Arêtes, recoins, roulettes, matériau poreux : à prendre en compte dans le plan de nettoyage." },
            { cle: "zone_id", libelle: "Zone", type: "liste", options: listeZones.map((z) => ({ valeur: z.id, libelle: `${z.code} ${z.nom}` })) },
            { cle: "largeur", libelle: "Largeur (m)", type: "nombre" },
            { cle: "profondeur", libelle: "Profondeur (m)", type: "nombre" },
            { cle: "notes", libelle: "Notes", type: "zone_texte" },
          ]}
          valeursInitiales={() => ({ salle_id: salle.id, type: "paillasse", nettoyabilite: "bonne", x: 1, y: 1, zone_id: null, largeur: 1.5, profondeur: 0.7 })}
          colonnes={[
            { libelle: "Meuble", rendu: (m) => m.libelle || TYPES_MOBILIER[m.type] },
            { libelle: "Matériau", rendu: (m) => MATERIAUX[m.materiau] ?? "—" },
            { libelle: "Zone", rendu: (m) => nomZone(m.zone_id) },
            { libelle: "Nettoyabilité", rendu: (m) => <Badge ton={m.nettoyabilite === "bonne" ? "ok" : m.nettoyabilite === "moyenne" ? "attention" : "alerte"}>{NETTOYABILITE[m.nettoyabilite]}</Badge> },
          ]}
          vide="Aucun meuble."
        />
      </Carte>
    </div>
  );
}

/** Page « Équipements » : tous les équipements de l'organisation. */
export function Equipements() {
  const s = useSession();
  const org = s.org!.id;
  const { donnees, erreur, recharger } = useDonnees(async () => {
    const [equipements, salles, zones] = await Promise.all([
      s.depot.lister("equipements", org), s.depot.lister("salles_propres", org), s.depot.lister("zones", org),
    ]);
    return { equipements, salles, zones };
  }, [org]);
  const salle = (id: string) => donnees?.salles.find((x) => x.id === id);
  return (
    <>
      <EnTete titre="Équipements" sousTitre="PSM, isolateurs, hottes, autoclaves… rattachés aux salles propres. Ils seront qualifiés depuis le module Qualification." />
      <MessageErreur erreur={erreur} />
      <GestionEntites
        table="equipements"
        lignes={donnees?.equipements ?? null}
        recharger={recharger}
        champs={champsEquipement(donnees?.zones ?? [], donnees?.salles ?? [])}
        valeursInitiales={() => ({ salle_id: donnees?.salles[0]?.id ?? "", type: "psm", statut: "en_service", libelle: "", zone_id: null, x: null, y: null })}
        texteRecherche={(e) => `${e.libelle} ${e.repere} ${e.numero_serie} ${salle(e.salle_id)?.nom ?? ""}`}
        trier={(a, b) => a.libelle.localeCompare(b.libelle)}
        colonnes={[
          { libelle: "Équipement", rendu: (e) => <><strong>{e.libelle}</strong>{e.repere && <span className="text-texte-2"> · {e.repere}</span>}</> },
          { libelle: "Type", rendu: (e) => TYPES_EQUIPEMENTS[e.type] ?? e.type },
          { libelle: "Salle propre", rendu: (e) => <Link to={`/salles/${e.salle_id}`} onClick={(ev) => ev.stopPropagation()} className="text-navy-700 hover:underline">{salle(e.salle_id)?.nom}</Link> },
          { libelle: "N° de série", rendu: (e) => e.numero_serie || "—" },
          { libelle: "Statut", rendu: (e) => <Badge ton={TON[e.statut]}>{STATUTS_EQUIPEMENTS[e.statut]}</Badge> },
        ]}
        vide="Aucun équipement."
      />
    </>
  );
}
