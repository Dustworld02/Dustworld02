import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useSession } from "../../session";
import { Bouton, EnTete, MessageErreur, Onglets, useDonnees } from "../../ui/composants";
import { ListeResultats, type DonneesContamination } from "./Resultats";
import { Cartographie, PlanSurveillance, Tendances } from "./Surveillance";

export function useDonneesContamination(salleId?: string) {
  const s = useSession();
  const org = s.org!.id;
  return useDonnees<DonneesContamination>(async () => {
    const f = salleId ? { salle_id: salleId } : undefined;
    const [salles, zones, points, resultats, instruments, etalonnages, plans] = await Promise.all([
      s.depot.lister("salles_propres", org, salleId ? { id: salleId } : undefined), s.depot.lister("zones", org, f), s.depot.lister("points_prelevement", org, f),
      s.peut("contamination_resultats", 1) ? s.depot.lister("resultats", org, f) : [],
      s.peut("instruments", 1) ? s.depot.lister("instruments", org) : [], s.peut("instruments", 1) ? s.depot.lister("etalonnages", org) : [],
      s.peut("contamination_resultats", 1) ? s.depot.lister("plans_echantillonnage", org, f) : [],
    ]);
    return { salles, zones, points, resultats, instruments, etalonnages, plans };
  }, [org, salleId]);
}

type Onglet = "resultats" | "plan" | "tendances" | "cartographie";

export function Contaminations() {
  const s = useSession();
  const [params] = useSearchParams();
  const { donnees, erreur, recharger } = useDonneesContamination();
  const [onglet, setOnglet] = useState<Onglet>((params.get("onglet") as Onglet) ?? "resultats");
  const tendances = s.peut("contamination_tendances", 1);
  return (
    <>
      <EnTete
        titre="Suivi des contaminations"
        sousTitre="Entrepôt unique des résultats : air, surfaces, gants et liquides ; particulaire, microbiologique et chimique."
        actions={tendances && <Link to="/contaminations/rapport"><Bouton>Rapport périodique</Bouton></Link>}
      />
      <MessageErreur erreur={erreur} />
      <Onglets
        onglets={[
          { cle: "resultats" as const, libelle: "Résultats" },
          { cle: "plan" as const, libelle: "Plan d'échantillonnage" },
          ...(tendances ? [{ cle: "tendances" as const, libelle: "Tendances et dérives" }, { cle: "cartographie" as const, libelle: "Cartographie" }] : []),
        ]}
        actif={onglet}
        onChange={setOnglet}
      />
      {donnees && onglet === "resultats" && <ListeResultats d={donnees} recharger={recharger} />}
      {donnees && onglet === "plan" && <PlanSurveillance d={donnees} recharger={recharger} />}
      {donnees && onglet === "tendances" && <Tendances d={donnees} />}
      {donnees && onglet === "cartographie" && <Cartographie d={donnees} />}
    </>
  );
}
