import type { Depot } from "./depot";
import type { Modification, NomTable } from "./types";

/**
 * File d'attente des enregistrements faits sur le terrain sans réseau.
 * Les opérations sont rejouées dans l'ordre au retour de la connexion ;
 * une opération refusée par la base (droits, habilitation…) reste dans la
 * file avec son motif, pour être corrigée à la main.
 */

const CLE = "salles-propres-file-hors-ligne";

export interface OperationEnAttente {
  id: string;
  table: NomTable;
  idLigne: string;
  valeurs: Record<string, unknown>;
  libelle: string;
  enregistreLe: string;
  erreur?: string;
}

function lire(): OperationEnAttente[] {
  try { return JSON.parse(window.localStorage.getItem(CLE) ?? "[]") as OperationEnAttente[]; } catch { return []; }
}

function ecrire(l: OperationEnAttente[]): void {
  try { window.localStorage.setItem(CLE, JSON.stringify(l)); } catch { /* stockage indisponible */ }
  window.dispatchEvent(new Event("file-hors-ligne"));
}

export function operationsEnAttente(): OperationEnAttente[] {
  return lire();
}

export function estErreurReseau(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e);
  return (typeof navigator !== "undefined" && navigator.onLine === false) || /Failed to fetch|NetworkError|Load failed|réseau/i.test(m);
}

/** Modifie tout de suite si possible, sinon met l'opération en file. Retourne « file » si différée. */
export async function modifierOuDifferer<T extends NomTable>(depot: Depot, table: T, id: string, valeurs: Modification<T>, libelle: string): Promise<"fait" | "file"> {
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) throw new Error("Failed to fetch");
    await depot.modifier(table, id, valeurs);
    return "fait";
  } catch (e) {
    if (!estErreurReseau(e)) throw e;
    ecrire([...lire(), { id: crypto.randomUUID(), table, idLigne: id, valeurs: valeurs as Record<string, unknown>, libelle, enregistreLe: new Date().toISOString() }]);
    return "file";
  }
}

/** Rejoue la file ; retourne le nombre d'opérations synchronisées. */
export async function synchroniser(depot: Depot): Promise<number> {
  const file = lire();
  if (file.length === 0) return 0;
  const restantes: OperationEnAttente[] = [];
  let faites = 0;
  for (const op of file) {
    try {
      await depot.modifier(op.table, op.idLigne, op.valeurs as Modification<NomTable>);
      faites++;
    } catch (e) {
      if (estErreurReseau(e)) { restantes.push(op, ...file.slice(file.indexOf(op) + 1)); break; }
      restantes.push({ ...op, erreur: e instanceof Error ? e.message : String(e) });
    }
  }
  ecrire(restantes);
  return faites;
}

export function retirerOperation(id: string): void {
  ecrire(lire().filter((o) => o.id !== id));
}
