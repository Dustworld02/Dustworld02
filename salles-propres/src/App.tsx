import { lazy, useEffect } from "react";
import { HashRouter, Route, Routes, Navigate } from "react-router";
import { FournisseurSession } from "./session";
import { Coquille } from "./ui/Coquille";
import { Connexion } from "./pages/Connexion";
import { CreationOrganisation } from "./pages/CreationOrganisation";
import { Accueil } from "./pages/Accueil";

// Pages chargées à la demande ; toutes sont préchargées en arrière-plan après le démarrage
// pour rester disponibles hors ligne (mode terrain).
const CHARGEURS = {
  Entreprises: () => import("./pages/Entreprises").then((m) => ({ default: m.Entreprises })),
  SallesPropres: () => import("./pages/SallesPropres").then((m) => ({ default: m.SallesPropres })),
  AssistantSalle: () => import("./pages/AssistantSalle").then((m) => ({ default: m.AssistantSalle })),
  SalleDetail: () => import("./pages/SalleDetail").then((m) => ({ default: m.SalleDetail })),
  Documents: () => import("./pages/Documents").then((m) => ({ default: m.Documents })),
  Referentiels: () => import("./pages/Referentiels").then((m) => ({ default: m.Referentiels })),
  Configuration: () => import("./pages/Configuration").then((m) => ({ default: m.Configuration })),
  Journal: () => import("./pages/Journal").then((m) => ({ default: m.Journal })),
  TraitementAir: () => import("./pages/TraitementAir").then((m) => ({ default: m.TraitementAir })),
  CtaDetail: () => import("./pages/TraitementAir").then((m) => ({ default: m.CtaDetail })),
  Equipements: () => import("./pages/Equipements").then((m) => ({ default: m.Equipements })),
  Instruments: () => import("./pages/Instruments").then((m) => ({ default: m.Instruments })),
  Contaminations: () => import("./pages/contaminations/Contaminations").then((m) => ({ default: m.Contaminations })),
  RapportContamination: () => import("./pages/contaminations/Rapport").then((m) => ({ default: m.RapportContamination })),
  Qualification: () => import("./pages/qualification/Qualification").then((m) => ({ default: m.Qualification })),
  AssistantCampagne: () => import("./pages/qualification/AssistantCampagne").then((m) => ({ default: m.AssistantCampagne })),
  CampagneDetail: () => import("./pages/qualification/CampagneDetail").then((m) => ({ default: m.CampagneDetail })),
  ImpressionCampagne: () => import("./pages/qualification/ImpressionCampagne").then((m) => ({ default: m.ImpressionCampagne })),
  Ecarts: () => import("./pages/Ecarts").then((m) => ({ default: m.Ecarts })),
  EcartDetail: () => import("./pages/Ecarts").then((m) => ({ default: m.EcartDetail })),
  Taches: () => import("./pages/Taches").then((m) => ({ default: m.Taches })),
  Discussions: () => import("./pages/Discussions").then((m) => ({ default: m.Discussions })),
  Nettoyage: () => import("./pages/nettoyage/Nettoyage").then((m) => ({ default: m.Nettoyage })),
  Personnel: () => import("./pages/Personnel").then((m) => ({ default: m.Personnel })),
  Maintenance: () => import("./pages/Maintenance").then((m) => ({ default: m.Maintenance })),
  CarnetSanitaire: () => import("./pages/CarnetSanitaire").then((m) => ({ default: m.CarnetSanitaire })),
  RevuePeriodique: () => import("./pages/RevuePeriodique").then((m) => ({ default: m.RevuePeriodique })),
};
const Entreprises = lazy(CHARGEURS.Entreprises);
const SallesPropres = lazy(CHARGEURS.SallesPropres);
const AssistantSalle = lazy(CHARGEURS.AssistantSalle);
const SalleDetail = lazy(CHARGEURS.SalleDetail);
const Documents = lazy(CHARGEURS.Documents);
const Referentiels = lazy(CHARGEURS.Referentiels);
const Configuration = lazy(CHARGEURS.Configuration);
const Journal = lazy(CHARGEURS.Journal);
const TraitementAir = lazy(CHARGEURS.TraitementAir);
const CtaDetail = lazy(CHARGEURS.CtaDetail);
const Equipements = lazy(CHARGEURS.Equipements);
const Instruments = lazy(CHARGEURS.Instruments);
const Contaminations = lazy(CHARGEURS.Contaminations);
const RapportContamination = lazy(CHARGEURS.RapportContamination);
const Qualification = lazy(CHARGEURS.Qualification);
const AssistantCampagne = lazy(CHARGEURS.AssistantCampagne);
const CampagneDetail = lazy(CHARGEURS.CampagneDetail);
const ImpressionCampagne = lazy(CHARGEURS.ImpressionCampagne);
const Ecarts = lazy(CHARGEURS.Ecarts);
const EcartDetail = lazy(CHARGEURS.EcartDetail);
const Taches = lazy(CHARGEURS.Taches);
const Discussions = lazy(CHARGEURS.Discussions);
const Nettoyage = lazy(CHARGEURS.Nettoyage);
const Personnel = lazy(CHARGEURS.Personnel);
const Maintenance = lazy(CHARGEURS.Maintenance);
const CarnetSanitaire = lazy(CHARGEURS.CarnetSanitaire);
const RevuePeriodique = lazy(CHARGEURS.RevuePeriodique);

function Prechargement() {
  useEffect(() => {
    const t = window.setTimeout(() => { for (const charger of Object.values(CHARGEURS)) void charger(); }, 1500);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}

function Ecran({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-full items-center justify-center p-6 text-texte-2">{children}</div>;
}

export function App() {
  return (
    <FournisseurSession
      chargement={<Ecran>Chargement…</Ecran>}
      erreur={(m) => <Ecran>Erreur au démarrage : {m}</Ecran>}
    >
      {(etat) => {
        if (etat === "deconnecte") return <Connexion />;
        if (etat === "sans_org") return <CreationOrganisation />;
        return (
          <HashRouter>
            <Prechargement />
            <Routes>
              <Route element={<Coquille />}>
                <Route index element={<Accueil />} />
                <Route path="entreprises" element={<Entreprises />} />
                <Route path="salles" element={<SallesPropres />} />
                <Route path="salles/nouvelle" element={<AssistantSalle />} />
                <Route path="salles/:id" element={<SalleDetail />} />
                <Route path="traitement-air" element={<TraitementAir />} />
                <Route path="traitement-air/:id" element={<CtaDetail />} />
                <Route path="traitement-air/:id/carnet" element={<CarnetSanitaire />} />
                <Route path="equipements" element={<Equipements />} />
                <Route path="qualification" element={<Qualification />} />
                <Route path="qualification/nouvelle" element={<AssistantCampagne />} />
                <Route path="qualification/:id" element={<CampagneDetail />} />
                <Route path="qualification/:id/imprimer/:doc" element={<ImpressionCampagne />} />
                <Route path="instruments" element={<Instruments />} />
                <Route path="contaminations" element={<Contaminations />} />
                <Route path="contaminations/rapport" element={<RapportContamination />} />
                <Route path="ecarts" element={<Ecarts />} />
                <Route path="ecarts/:id" element={<EcartDetail />} />
                <Route path="nettoyage" element={<Nettoyage />} />
                <Route path="personnel" element={<Personnel />} />
                <Route path="maintenance" element={<Maintenance />} />
                <Route path="revue" element={<RevuePeriodique />} />
                <Route path="taches" element={<Taches />} />
                <Route path="discussions" element={<Discussions />} />
                <Route path="documents" element={<Documents />} />
                <Route path="referentiels" element={<Referentiels />} />
                <Route path="configuration" element={<Configuration />} />
                <Route path="journal" element={<Journal />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </HashRouter>
        );
      }}
    </FournisseurSession>
  );
}
