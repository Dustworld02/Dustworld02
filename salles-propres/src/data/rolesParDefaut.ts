import { ROLES_SYSTEME, matriceParDefaut } from "../domain/permissions";
import type { DefinitionRoleAvecDroits } from "./depot";

export function rolesParDefaut(): DefinitionRoleAvecDroits[] {
  const matrice = matriceParDefaut();
  return ROLES_SYSTEME.map((r) => ({ cle: r.cle, libelle: r.libelle, description: r.description, droits: matrice[r.cle] }));
}
