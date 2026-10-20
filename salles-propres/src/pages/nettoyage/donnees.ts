import { useSession } from "../../session";
import { useDonnees } from "../../ui/composants";
import type { Consommable, ProduitNettoyage } from "../../data/types";
import { MODELES_CONSOMMABLES, MODELES_PRODUITS } from "../../domain/nettoyage/referentiel";

export function useDonneesNettoyage() {
  const s = useSession();
  const org = s.org!.id;
  return useDonnees(async () => {
    const lire = <T,>(module: string, f: () => Promise<T[]>) => (s.peut(module, 1) ? f() : Promise.resolve([] as T[]));
    const [salles, zones, procedures, produits, consommables, interventions, validations, materiel, personnes, habilitations, resultats] = await Promise.all([
      s.depot.lister("salles_propres", org), s.depot.lister("zones", org),
      lire("nettoyage_procedures", () => s.depot.lister("procedures_nettoyage", org)),
      lire("nettoyage_procedures", () => s.depot.lister("produits_nettoyage", org)),
      lire("nettoyage_procedures", () => s.depot.lister("consommables", org)),
      lire("nettoyage_execution", () => s.depot.lister("interventions_nettoyage", org)),
      lire("nettoyage_execution", () => s.depot.lister("validations_nettoyage", org)),
      lire("nettoyage_procedures", () => s.depot.lister("materiel_nettoyage", org)),
      lire("personnel", () => s.depot.lister("personnes", org)),
      lire("personnel", () => s.depot.lister("habilitations", org)),
      lire("contamination_resultats", () => s.depot.lister("resultats", org)),
    ]);
    return { salles, zones, procedures, produits, consommables, interventions, validations, materiel, personnes, habilitations, resultats: resultats.filter((r) => r.validation_id) };
  }, [org]);
}

export type DonneesNettoyage = NonNullable<ReturnType<typeof useDonneesNettoyage>["donnees"]>;

/** Nom affiché d'un produit de la procédure : produit du catalogue s'il existe, sinon modèle générique. */
export function nomProduit(cle: string | null, produits: ProduitNettoyage[]): string {
  if (!cle) return "—";
  const p = produits.find((x) => x.modele_cle === cle && x.actif);
  return p ? p.nom : MODELES_PRODUITS[cle]?.nom ?? cle;
}

export function nomConsommable(cle: string | null, consommables: Consommable[]): string {
  if (!cle) return "—";
  const c = consommables.find((x) => x.modele_cle === cle && x.actif);
  return c ? c.nom : MODELES_CONSOMMABLES[cle]?.nom ?? cle;
}

export { completerCatalogue } from "../../data/catalogueNettoyage";
