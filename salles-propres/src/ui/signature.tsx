import { useState } from "react";
import { useSession } from "../session";
import { Bouton, Champ, Liste, MessageErreur, Modale, Saisie, ZoneTexte, useAction } from "./composants";
import { LIBELLES_SIGNIFICATIONS, niveauSignature, type Signification } from "../domain/permissions";
import type { Signature } from "../data/types";
import { formatDate } from "./composants";

/**
 * Signature électronique : ressaisie du mot de passe, signification,
 * commentaire. `apres` s'exécute une fois la signature enregistrée
 * (ex. passage au statut approuvé).
 */
export function ModaleSignature({ objetType, objetId, objet, module, significations, portee = "", apres, onFermer }: {
  objetType: string;
  objetId: string;
  /** Description de ce qui est signé (titre, version). */
  objet: string;
  module: string;
  significations: Signification[];
  portee?: string;
  apres?: () => Promise<void>;
  onFermer: (signe: boolean) => void;
}) {
  const s = useSession();
  const permises = significations.filter((x) => s.peut(module, niveauSignature(x)));
  const [signification, setSignification] = useState<Signification>(permises[0] ?? significations[0]);
  const [motDePasse, setMotDePasse] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const action = useAction();

  const signer = () => action.executer(async () => {
    if (!(await s.depot.verifierMotDePasse(motDePasse))) throw new Error("Mot de passe incorrect : signature refusée.");
    await s.depot.signer(objetType, objetId, signification, commentaire, portee);
    if (apres) await apres();
    onFermer(true);
  });

  return (
    <Modale
      titre={`Signature électronique — ${LIBELLES_SIGNIFICATIONS[signification]}`}
      onFermer={() => onFermer(false)}
      pied={<><Bouton onClick={() => onFermer(false)}>Annuler</Bouton><Bouton variante="principal" disabled={action.enCours || !motDePasse || permises.length === 0} onClick={() => void signer()}>Signer</Bouton></>}
    >
      <MessageErreur erreur={action.erreur ?? (permises.length === 0 ? "Votre rôle ne permet pas cette signature." : null)} />
      <p className="mb-3 text-sm">
        Vous signez <strong>{objet}</strong> en tant que <strong>{s.utilisateur?.nom_complet || s.utilisateur?.email}</strong>.
        La signature est horodatée par le serveur, enregistrée dans le journal d'audit et ne peut pas être modifiée.
      </p>
      <div className="grid gap-3">
        <Champ libelle="Signification">
          <Liste value={signification} disabled={permises.length < 2} onChange={(e) => setSignification(e.target.value as Signification)}>
            {permises.map((x) => <option key={x} value={x}>{LIBELLES_SIGNIFICATIONS[x]}</option>)}
          </Liste>
        </Champ>
        <Champ libelle="Commentaire"><ZoneTexte value={commentaire} onChange={(e) => setCommentaire(e.target.value)} /></Champ>
        <Champ libelle="Mot de passe (confirmation d'identité)"><Saisie type="password" autoFocus value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} autoComplete="current-password" /></Champ>
      </div>
    </Modale>
  );
}

export function ListeSignatures({ signatures, vide = "Aucune signature." }: { signatures: Signature[]; vide?: string }) {
  if (signatures.length === 0) return <p className="text-sm text-texte-2">{vide}</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {signatures.map((x) => (
        <li key={x.id} className="rounded-lg border border-bord px-3 py-2">
          <div><strong>{LIBELLES_SIGNIFICATIONS[x.signification]}</strong> {x.nom_signataire}{x.portee && <span className="text-texte-2"> · {x.portee}</span>}</div>
          <div className="text-xs text-texte-2">{formatDate(x.signe_le, true)}{x.commentaire && ` — ${x.commentaire}`}</div>
        </li>
      ))}
    </ul>
  );
}
