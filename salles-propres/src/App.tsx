import { HashRouter, Route, Routes, Navigate } from "react-router";
import { FournisseurSession } from "./session";
import { Coquille } from "./ui/Coquille";
import { Connexion } from "./pages/Connexion";
import { CreationOrganisation } from "./pages/CreationOrganisation";
import { Accueil } from "./pages/Accueil";
import { Entreprises } from "./pages/Entreprises";
import { SallesPropres } from "./pages/SallesPropres";
import { AssistantSalle } from "./pages/AssistantSalle";
import { SalleDetail } from "./pages/SalleDetail";
import { Documents } from "./pages/Documents";
import { Referentiels } from "./pages/Referentiels";
import { Configuration } from "./pages/Configuration";
import { Journal } from "./pages/Journal";
import { AVenir } from "./pages/AVenir";
import { TraitementAir, CtaDetail } from "./pages/TraitementAir";
import { Equipements } from "./pages/Equipements";

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
            <Routes>
              <Route element={<Coquille />}>
                <Route index element={<Accueil />} />
                <Route path="entreprises" element={<Entreprises />} />
                <Route path="salles" element={<SallesPropres />} />
                <Route path="salles/nouvelle" element={<AssistantSalle />} />
                <Route path="salles/:id" element={<SalleDetail />} />
                <Route path="traitement-air" element={<TraitementAir />} />
                <Route path="traitement-air/:id" element={<CtaDetail />} />
                <Route path="equipements" element={<Equipements />} />
                <Route path="documents" element={<Documents />} />
                <Route path="referentiels" element={<Referentiels />} />
                <Route path="configuration" element={<Configuration />} />
                <Route path="journal" element={<Journal />} />
                <Route path="a-venir/:cle" element={<AVenir />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </HashRouter>
        );
      }}
    </FournisseurSession>
  );
}
