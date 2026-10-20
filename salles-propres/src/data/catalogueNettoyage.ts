import type { Consommable, ProduitNettoyage } from "./types";
import type { Depot } from "./depot";
import { MODELES_CONSOMMABLES, MODELES_PRODUITS } from "../domain/nettoyage/referentiel";

/**
 * Crée dans le catalogue de l'organisation les produits et consommables
 * génériques utilisés par des procédures et encore absents, marqués
 * « à compléter » (fournisseur, référence, FDS).
 */
export async function completerCatalogue(depot: Depot, org: string, produitsCles: string[], consommablesCles: string[], produits: ProduitNettoyage[], consommables: Consommable[]): Promise<number> {
  const manquantsP = [...new Set(produitsCles)].filter((c) => MODELES_PRODUITS[c] && !produits.some((p) => p.modele_cle === c));
  const manquantsC = [...new Set(consommablesCles)].filter((c) => MODELES_CONSOMMABLES[c] && !consommables.some((p) => p.modele_cle === c));
  if (manquantsP.length) {
    await depot.creerPlusieurs("produits_nettoyage", manquantsP.map((c) => {
      const m = MODELES_PRODUITS[c];
      return {
        org_id: org, nom: m.nom, famille: m.famille, spectre: m.spectre, dilution: m.dilution, temps_contact_min: m.temps_contact_min, rincage: m.rincage,
        sterile: m.sterile, groupe_rotation: m.groupe_rotation, peremption_solution_h: m.peremption_solution_h, modele_cle: c, a_completer: true,
      };
    }));
  }
  if (manquantsC.length) {
    await depot.creerPlusieurs("consommables", manquantsC.map((c) => {
      const m = MODELES_CONSOMMABLES[c];
      return { org_id: org, nom: m.nom, type: m.type, matiere: m.matiere, sterile: m.sterile, preimpregne: m.preimpregne, classe_iso_min: m.classe_iso_min, modele_cle: c, a_completer: true };
    }));
  }
  return manquantsP.length + manquantsC.length;
}
