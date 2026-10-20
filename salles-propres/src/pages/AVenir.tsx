import { useParams } from "react-router";
import { Bandeau, Carte, EnTete } from "../ui/composants";
import { A_VENIR } from "../ui/Coquille";

const CONTENU: Record<string, { plan: string; points: string[] }> = {
  modelisation: {
    plan: "§4.1 et §4.2, phase 2",
    points: [
      "Éditeur de plan 2D : zones, portes et SAS, bouches, mobilier, équipements, points de prélèvement",
      "Cascade de pression déduite des consignes, incohérences signalées",
      "CTA, réseaux, filtres (Δp, échéances), taux de renouvellement calculé",
      "Cartographie des classes imprimable",
    ],
  },
  qualification: {
    plan: "§4.3, phase 3",
    points: [
      "Assistant pas à pas : objet, campagne, protocole, exécution, écarts, rapport, clôture",
      "Essais ISO 14644-3 et essais d'équipements (PSM, isolateurs) avec verdict calculé",
      "Échéancier des requalifications à partir des périodicités du référentiel",
    ],
  },
  contaminations: {
    plan: "§4.4, phases 3 et 6",
    points: [
      "Parc d'instruments et étalonnages, blocage des instruments périmés",
      "Résultats air, surfaces, gants et liquides ; particulaire, microbiologique, chimique",
      "Courbes d'évolution, règles de dérive, cartographie de contamination sur le plan",
    ],
  },
  pilotage: {
    plan: "§4.5, §4.6 et §4.11, phase 4",
    points: [
      "Écarts et CAPA avec vérification d'efficacité",
      "Tableau Kanban : glisser-déposer, propriétaire, échéance, cartes automatiques",
      "Fils de discussion sur chaque objet, avec historique",
    ],
  },
  nettoyage: {
    plan: "§4.7 et §4.8, phase 5",
    points: [
      "Procédures générées par le gabarit du secteur : lingettes, produits, techniques, fréquences",
      "Planning, mode terrain tablette, enregistrements, validation du nettoyage",
      "Habilitations, habillage et formations du personnel",
    ],
  },
  maintenance: {
    plan: "§4.9, phase 6",
    points: [
      "Maintenance préventive des CTA, filtres, PSM et instruments",
      "Change control : évaluation d'impact et requalification",
      "Carnet sanitaire de l'air généré",
    ],
  },
};

export function AVenir() {
  const { cle = "" } = useParams();
  const module = A_VENIR.find((m) => m.cle === cle);
  const contenu = CONTENU[cle];
  if (!module || !contenu) return <Bandeau>Module inconnu.</Bandeau>;
  return (
    <>
      <EnTete titre={`${module.icone} ${module.libelle}`} sousTitre={`Prévu en phase ${module.phase} du plan de développement (${contenu.plan}).`} />
      <Carte titre="Ce que contiendra ce module">
        <ul className="list-disc space-y-1 pl-5">{contenu.points.map((p) => <li key={p}>{p}</li>)}</ul>
        <p className="mt-4 text-sm text-texte-2">Le détail figure dans docs/PLAN_DEVELOPPEMENT_SALLES_PROPRES.md, à la racine du dépôt.</p>
      </Carte>
    </>
  );
}
