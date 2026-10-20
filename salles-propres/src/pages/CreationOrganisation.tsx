import { useState } from "react";
import { useSession } from "../session";
import { Bouton, Carte, Champ, MessageErreur, Saisie, useAction } from "../ui/composants";
import { rolesParDefaut } from "../data/rolesParDefaut";

export function CreationOrganisation() {
  const s = useSession();
  const [nom, setNom] = useState("");
  const action = useAction();
  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <Carte titre="Créer votre organisation" className="w-full max-w-lg">
        <p className="mb-4 text-sm text-texte-2">
          Vous n'êtes rattaché à aucune organisation. Créez la vôtre : vous en serez l'administrateur, et les sept rôles par défaut
          (qualité, technique, qualificateur, nettoyage, opérateur, lecteur) seront créés avec la matrice de droits du plan.
          Si vous attendez une invitation, demandez à l'administrateur de l'envoyer à {s.utilisateur?.email}, puis reconnectez-vous.
        </p>
        <MessageErreur erreur={action.erreur} />
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void action.executer(async () => {
              await s.depot.creerOrganisation(nom, rolesParDefaut());
              await s.apresConnexion();
            });
          }}
        >
          <Champ libelle="Nom de l'organisation"><Saisie required value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex. Société de qualification ABC" /></Champ>
          <div className="flex justify-between">
            <Bouton variante="discret" onClick={() => void s.deconnecter()}>Se déconnecter</Bouton>
            <Bouton type="submit" variante="principal" disabled={action.enCours}>Créer l'organisation</Bouton>
          </div>
        </form>
      </Carte>
    </div>
  );
}
