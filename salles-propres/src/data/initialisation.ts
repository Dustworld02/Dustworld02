import type { Depot } from "./depot";
import { DepotDemo, FichiersIndexedDb } from "./depotDemo";
import { DepotSupabase } from "./depotSupabase";
import { creerJeuDemo } from "./jeuDemo";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const cle = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const MODE_SUPABASE = !!(url && cle);

let instance: Depot | null = null;

/** Choisit le dépôt : Supabase si configuré, sinon démonstration locale. */
export async function obtenirDepot(): Promise<Depot> {
  if (instance) return instance;
  if (MODE_SUPABASE) {
    instance = new DepotSupabase(url!, cle!);
  } else {
    const demo = new DepotDemo(window.localStorage, new FichiersIndexedDb());
    if (demo.estVide()) await creerJeuDemo(demo);
    instance = demo;
  }
  return instance;
}

/** Mode démo : efface les données locales et recrée le jeu de démonstration. */
export async function reinitialiserDemo(): Promise<void> {
  const depot = await obtenirDepot();
  if (!(depot instanceof DepotDemo)) return;
  depot.reinitialiser();
  await creerJeuDemo(depot);
}
