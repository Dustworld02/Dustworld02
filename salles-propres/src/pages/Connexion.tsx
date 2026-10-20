import { useState } from "react";
import { useSession } from "../session";
import { Bouton, Champ, MessageErreur, Onglets, Saisie, useAction } from "../ui/composants";
import { COMPTES_DEMO, MOT_DE_PASSE_DEMO } from "../data/jeuDemo";
import { ROLES_SYSTEME } from "../domain/permissions";

export function Connexion() {
  const s = useSession();
  const [onglet, setOnglet] = useState<"connexion" | "inscription">("connexion");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [nom, setNom] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const action = useAction();
  const demo = s.depot.mode === "demo";

  const connecter = (e: string, m: string) => action.executer(async () => {
    await s.depot.connecter(e, m);
    await s.apresConnexion();
  });

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-navy-900 to-navy-700 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cuivre-500 to-cuivre-400 font-extrabold text-white">SP</div>
          <div>
            <h1 className="text-lg font-bold text-navy-900">Salles Propres</h1>
            <p className="text-sm text-texte-2">Gestion des salles propres et zones à atmosphère contrôlée</p>
          </div>
        </div>

        {!demo && (
          <Onglets
            onglets={[{ cle: "connexion", libelle: "Connexion" }, { cle: "inscription", libelle: "Créer un compte" }]}
            actif={onglet}
            onChange={(o) => { setOnglet(o); action.effacer(); setInfo(null); }}
          />
        )}
        <MessageErreur erreur={action.erreur} />
        {info && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</div>}

        <form
          className="flex flex-col gap-3"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (onglet === "connexion") void connecter(email, motDePasse);
            else void action.executer(async () => {
              const u = await s.depot.inscrire(email, motDePasse, nom);
              if (u) await s.apresConnexion();
              else setInfo("Compte créé. Confirmez votre adresse e-mail grâce au lien reçu, puis connectez-vous.");
            });
          }}
        >
          {onglet === "inscription" && (
            <Champ libelle="Nom complet"><Saisie required value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="name" /></Champ>
          )}
          <Champ libelle="Adresse e-mail"><Saisie required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Champ>
          <Champ libelle="Mot de passe"><Saisie required type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} autoComplete={onglet === "connexion" ? "current-password" : "new-password"} /></Champ>
          <Bouton type="submit" variante="principal" disabled={action.enCours}>
            {onglet === "connexion" ? "Se connecter" : "Créer le compte"}
          </Bouton>
          {onglet === "inscription" && (
            <p className="text-xs text-texte-2">Si un administrateur vous a invité, utilisez l'adresse de l'invitation : vous serez rattaché à son organisation dès la connexion.</p>
          )}
        </form>

        {demo && (
          <div className="mt-6 border-t border-bord pt-4">
            <p className="mb-2 text-sm font-semibold">Mode démonstration : choisissez un profil</p>
            <p className="mb-3 text-xs text-texte-2">
              Chaque compte a un rôle différent, pour voir comment les droits changent l'outil. Mot de passe : <code>{MOT_DE_PASSE_DEMO}</code> (il sert aussi à signer).
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {ROLES_SYSTEME.map((r) => (
                <button
                  key={r.cle}
                  type="button"
                  disabled={action.enCours}
                  onClick={() => void connecter(COMPTES_DEMO[r.cle].email, MOT_DE_PASSE_DEMO)}
                  className="flex items-center justify-between rounded-lg border border-bord px-3 py-2 text-left text-sm hover:border-navy-600 hover:bg-navy-050"
                >
                  <span><strong>{r.libelle}</strong><span className="block text-xs text-texte-2">{COMPTES_DEMO[r.cle].nom} — {r.description}</span></span>
                  <span aria-hidden>→</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
