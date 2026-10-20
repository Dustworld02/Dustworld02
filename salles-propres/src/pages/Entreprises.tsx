import { useState } from "react";
import { Link } from "react-router";
import { useSession } from "../session";
import type { Entreprise, Site } from "../data/types";
import { Badge, Bouton, Carte, Champ, EnTete, Liste, MessageErreur, Modale, Saisie, Vide, ZoneTexte, useAction, useDonnees } from "../ui/composants";
import { GABARITS_NATIFS } from "../domain/secteurs/gabaritsNatifs";

export function libelleSecteur(cle: string | null | undefined): string {
  if (!cle) return "Secteur non précisé";
  return GABARITS_NATIFS.find((g) => g.cle === cle)?.libelle ?? cle;
}

type EditionEntreprise = Pick<Entreprise, "nom" | "secteur" | "adresse" | "contact" | "notes"> & { id?: string };
type EditionSite = Pick<Site, "nom" | "adresse" | "entreprise_id"> & { id?: string };

export function Entreprises() {
  const s = useSession();
  const org = s.org!.id;
  const ecriture = s.peut("installations", 2);
  const suppression = s.peut("installations", 3);
  const { donnees, erreur, recharger } = useDonnees(async () => {
    const [entreprises, sites, salles] = await Promise.all([
      s.depot.lister("entreprises", org), s.depot.lister("sites", org), s.depot.lister("salles_propres", org),
    ]);
    return { entreprises, sites, salles };
  }, [org]);
  const [entreprise, setEntreprise] = useState<EditionEntreprise | null>(null);
  const [site, setSite] = useState<EditionSite | null>(null);
  const action = useAction();

  const enregistrerEntreprise = () => action.executer(async () => {
    const { id, ...valeurs } = entreprise!;
    if (id) await s.depot.modifier("entreprises", id, valeurs);
    else await s.depot.creer("entreprises", { ...valeurs, org_id: org });
    setEntreprise(null);
    recharger();
  });

  const enregistrerSite = () => action.executer(async () => {
    const { id, ...valeurs } = site!;
    if (id) await s.depot.modifier("sites", id, valeurs);
    else await s.depot.creer("sites", { ...valeurs, org_id: org });
    setSite(null);
    recharger();
  });

  const supprimer = (table: "entreprises" | "sites", id: string, nom: string) => {
    if (!window.confirm(`Supprimer « ${nom} » ? L'opération est tracée dans le journal d'audit.`)) return;
    void action.executer(async () => { await s.depot.supprimer(table, id); recharger(); });
  };

  return (
    <>
      <EnTete
        titre="Entreprises et sites"
        sousTitre="Les entreprises propriétaires des salles propres et leurs sites géographiques."
        actions={ecriture && <Bouton variante="principal" onClick={() => { action.effacer(); setEntreprise({ nom: "", secteur: null, adresse: "", contact: "", notes: "" }); }}>+ Nouvelle entreprise</Bouton>}
      />
      <MessageErreur erreur={erreur ?? (entreprise || site ? null : action.erreur)} />
      {donnees && donnees.entreprises.length === 0 && <Vide>Aucune entreprise. {ecriture && "Commencez par en créer une."}</Vide>}
      <div className="grid gap-4">
        {donnees?.entreprises.map((e) => {
          const sites = donnees.sites.filter((x) => x.entreprise_id === e.id);
          return (
            <Carte
              key={e.id}
              titre={<span className="flex flex-wrap items-center gap-2">{e.nom} <Badge ton="cuivre">{libelleSecteur(e.secteur)}</Badge></span>}
              actions={<>
                {ecriture && <Bouton onClick={() => { action.effacer(); setSite({ nom: "", adresse: e.adresse, entreprise_id: e.id }); }}>+ Site</Bouton>}
                {ecriture && <Bouton variante="discret" onClick={() => { action.effacer(); setEntreprise({ id: e.id, nom: e.nom, secteur: e.secteur, adresse: e.adresse, contact: e.contact, notes: e.notes }); }}>Modifier</Bouton>}
                {suppression && <Bouton variante="danger" onClick={() => supprimer("entreprises", e.id, e.nom)}>Supprimer</Bouton>}
              </>}
            >
              <div className="mb-3 grid gap-1 text-sm text-texte-2 md:grid-cols-2">
                {e.adresse && <div>📍 {e.adresse}</div>}
                {e.contact && <div>👤 {e.contact}</div>}
                {e.notes && <div className="md:col-span-2">{e.notes}</div>}
              </div>
              {sites.length === 0 ? <p className="text-sm text-texte-2">Aucun site.</p> : (
                <ul className="divide-y divide-bord rounded-lg border border-bord">
                  {sites.map((x) => {
                    const salles = donnees.salles.filter((sp) => sp.site_id === x.id);
                    return (
                      <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                        <div>
                          <div className="font-medium">{x.nom}</div>
                          <div className="text-xs text-texte-2">{x.adresse || "Adresse non renseignée"} · {salles.length} salle(s) propre(s)</div>
                        </div>
                        <div className="flex gap-1">
                          {ecriture && <Link to={`/salles/nouvelle?site=${x.id}`}><Bouton variante="discret">+ Salle propre</Bouton></Link>}
                          {ecriture && <Bouton variante="discret" onClick={() => { action.effacer(); setSite({ id: x.id, nom: x.nom, adresse: x.adresse, entreprise_id: x.entreprise_id }); }}>Modifier</Bouton>}
                          {suppression && <Bouton variante="danger" onClick={() => supprimer("sites", x.id, x.nom)}>Supprimer</Bouton>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Carte>
          );
        })}
      </div>

      {entreprise && (
        <Modale
          titre={entreprise.id ? "Modifier l'entreprise" : "Nouvelle entreprise"}
          onFermer={() => setEntreprise(null)}
          pied={<><Bouton onClick={() => setEntreprise(null)}>Annuler</Bouton><Bouton variante="principal" disabled={action.enCours || !entreprise.nom.trim()} onClick={() => void enregistrerEntreprise()}>Enregistrer</Bouton></>}
        >
          <MessageErreur erreur={action.erreur} />
          <div className="grid gap-3">
            <Champ libelle="Nom"><Saisie value={entreprise.nom} onChange={(e) => setEntreprise({ ...entreprise, nom: e.target.value })} autoFocus /></Champ>
            <Champ libelle="Secteur d'activité principal" aide="Proposé par défaut à la création de ses salles propres ; chaque salle peut avoir son propre secteur.">
              <Liste value={entreprise.secteur ?? ""} onChange={(e) => setEntreprise({ ...entreprise, secteur: e.target.value || null })}>
                <option value="">— Non précisé —</option>
                {GABARITS_NATIFS.map((g) => <option key={g.cle} value={g.cle}>{g.libelle}</option>)}
              </Liste>
            </Champ>
            <Champ libelle="Adresse"><Saisie value={entreprise.adresse} onChange={(e) => setEntreprise({ ...entreprise, adresse: e.target.value })} /></Champ>
            <Champ libelle="Contact"><Saisie value={entreprise.contact} onChange={(e) => setEntreprise({ ...entreprise, contact: e.target.value })} /></Champ>
            <Champ libelle="Notes"><ZoneTexte value={entreprise.notes} onChange={(e) => setEntreprise({ ...entreprise, notes: e.target.value })} /></Champ>
          </div>
        </Modale>
      )}

      {site && (
        <Modale
          titre={site.id ? "Modifier le site" : "Nouveau site"}
          onFermer={() => setSite(null)}
          pied={<><Bouton onClick={() => setSite(null)}>Annuler</Bouton><Bouton variante="principal" disabled={action.enCours || !site.nom.trim()} onClick={() => void enregistrerSite()}>Enregistrer</Bouton></>}
        >
          <MessageErreur erreur={action.erreur} />
          <div className="grid gap-3">
            <Champ libelle="Nom du site"><Saisie value={site.nom} onChange={(e) => setSite({ ...site, nom: e.target.value })} autoFocus /></Champ>
            <Champ libelle="Adresse"><Saisie value={site.adresse} onChange={(e) => setSite({ ...site, adresse: e.target.value })} /></Champ>
          </div>
        </Modale>
      )}
    </>
  );
}
