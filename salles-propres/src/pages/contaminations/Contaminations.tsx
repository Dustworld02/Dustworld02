import { useState } from "react";
import { useSession } from "../../session";
import { EnTete, MessageErreur, Onglets, useDonnees } from "../../ui/composants";
import { ListeResultats, type DonneesContamination } from "./Resultats";

export function useDonneesContamination(salleId?: string) {
  const s = useSession();
  const org = s.org!.id;
  return useDonnees<DonneesContamination>(async () => {
    const f = salleId ? { salle_id: salleId } : undefined;
    const [salles, zones, points, resultats, instruments, etalonnages] = await Promise.all([
      s.depot.lister("salles_propres", org, salleId ? { id: salleId } : undefined), s.depot.lister("zones", org, f), s.depot.lister("points_prelevement", org, f),
      s.peut("contamination_resultats", 1) ? s.depot.lister("resultats", org, f) : [],
      s.peut("instruments", 1) ? s.depot.lister("instruments", org) : [], s.peut("instruments", 1) ? s.depot.lister("etalonnages", org) : [],
    ]);
    return { salles, zones, points, resultats, instruments, etalonnages };
  }, [org, salleId]);
}

type Onglet = "resultats";

export function Contaminations() {
  const { donnees, erreur, recharger } = useDonneesContamination();
  const [onglet, setOnglet] = useState<Onglet>("resultats");
  return (
    <>
      <EnTete titre="Suivi des contaminations" sousTitre="Entrepôt unique des résultats : air, surfaces, gants et liquides ; particulaire, microbiologique et chimique." />
      <MessageErreur erreur={erreur} />
      <Onglets onglets={[{ cle: "resultats", libelle: "Résultats" }]} actif={onglet} onChange={setOnglet} />
      {donnees && onglet === "resultats" && <ListeResultats d={donnees} recharger={recharger} />}
    </>
  );
}
