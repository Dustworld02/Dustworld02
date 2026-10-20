import { useState } from "react";
import { useSearchParams } from "react-router";
import { useSession } from "../../session";
import { EnTete, MessageErreur, Onglets } from "../../ui/composants";
import { useDonneesNettoyage } from "./donnees";
import { ListeProcedures } from "./Procedures";
import { PlanningNettoyage, Terrain } from "./Planning";
import { ValidationsNettoyage } from "./Validation";
import { CatalogueNettoyage } from "./Catalogue";

type Onglet = "procedures" | "planning" | "terrain" | "validation" | "catalogue";

export function Nettoyage() {
  const s = useSession();
  const [parametres] = useSearchParams();
  const { donnees, erreur, recharger } = useDonneesNettoyage();
  const onglets = [
    s.peut("nettoyage_procedures", 1) && { cle: "procedures" as const, libelle: "Procédures" },
    s.peut("nettoyage_execution", 1) && { cle: "planning" as const, libelle: "Planning" },
    s.peut("nettoyage_execution", 1) && { cle: "terrain" as const, libelle: "Mode terrain" },
    s.peut("nettoyage_execution", 1) && { cle: "validation" as const, libelle: "Validation" },
    s.peut("nettoyage_procedures", 1) && { cle: "catalogue" as const, libelle: "Produits, consommables, matériel" },
  ].filter((o): o is { cle: Onglet; libelle: string } => !!o);
  const [onglet, setOnglet] = useState<Onglet>((parametres.get("onglet") as Onglet) ?? onglets[0]?.cle ?? "procedures");
  return (
    <>
      <EnTete titre="Nettoyage" sousTitre="Procédures générées selon le secteur et la classe, planning, enregistrements terrain, validation du nettoyage, produits et matériel." />
      <MessageErreur erreur={erreur} />
      <Onglets onglets={onglets} actif={onglet} onChange={setOnglet} />
      {donnees && onglet === "procedures" && <ListeProcedures d={donnees} recharger={recharger} />}
      {donnees && onglet === "planning" && <PlanningNettoyage d={donnees} recharger={recharger} />}
      {donnees && onglet === "terrain" && <Terrain d={donnees} recharger={recharger} />}
      {donnees && onglet === "validation" && <ValidationsNettoyage d={donnees} recharger={recharger} />}
      {donnees && onglet === "catalogue" && <CatalogueNettoyage d={donnees} recharger={recharger} />}
    </>
  );
}
