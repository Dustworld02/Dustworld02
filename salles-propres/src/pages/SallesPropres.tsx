import { Link } from "react-router";
import { useSession } from "../session";
import { Badge, Bouton, EnTete, MessageErreur, TableauDefilant, Vide, useDonnees } from "../ui/composants";
import { libelleSecteur } from "./Entreprises";
import { libelleClasse } from "../domain/referentiels/classesIso";

export function SallesPropres() {
  const s = useSession();
  const org = s.org!.id;
  const { donnees, erreur } = useDonnees(async () => {
    const [salles, zones, sites, entreprises] = await Promise.all([
      s.depot.lister("salles_propres", org), s.depot.lister("zones", org),
      s.depot.lister("sites", org), s.depot.lister("entreprises", org),
    ]);
    return { salles, zones, sites, entreprises };
  }, [org]);

  return (
    <>
      <EnTete
        titre="Salles propres"
        sousTitre="Chaque salle propre regroupe ses zones (salles, SAS, postes sous flux) avec leur classification."
        actions={s.peut("installations", 2) && <Link to="/salles/nouvelle"><Bouton variante="principal">+ Nouvelle salle propre</Bouton></Link>}
      />
      <MessageErreur erreur={erreur} />
      {donnees && donnees.salles.length === 0 && <Vide>Aucune salle propre. Créez la première avec l'assistant : le choix du secteur pré-remplit les zones.</Vide>}
      {donnees && donnees.salles.length > 0 && (
        <TableauDefilant>
          <table className="tableau bg-white">
            <thead><tr><th>Salle propre</th><th>Entreprise / site</th><th>Secteur</th><th className="nombre">Zones</th><th>Classes</th><th>Gabarit</th></tr></thead>
            <tbody>
              {donnees.salles.map((salle) => {
                const site = donnees.sites.find((x) => x.id === salle.site_id);
                const entreprise = donnees.entreprises.find((x) => x.id === site?.entreprise_id);
                const zones = donnees.zones.filter((z) => z.salle_id === salle.id);
                const classes = [...new Set(zones.map((z) => z.iso_repos).filter((c): c is number => c != null))].sort((a, b) => a - b);
                return (
                  <tr key={salle.id}>
                    <td><Link to={`/salles/${salle.id}`} className="font-medium text-navy-700 hover:underline">{salle.nom}</Link>
                      {(salle.batiment || salle.etage) && <div className="text-xs text-texte-2">{[salle.batiment && `Bât. ${salle.batiment}`, salle.etage].filter(Boolean).join(" · ")}</div>}</td>
                    <td>{entreprise?.nom}<div className="text-xs text-texte-2">{site?.nom}</div></td>
                    <td><Badge ton="cuivre">{libelleSecteur(salle.secteur)}</Badge></td>
                    <td className="nombre">{zones.length}</td>
                    <td className="whitespace-nowrap">{classes.map((c) => libelleClasse(c)).join(", ") || "—"}</td>
                    <td className="text-xs text-texte-2">{salle.gabarit_cle ? `${salle.gabarit_cle} v${salle.gabarit_version}` : "Saisie libre"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableauDefilant>
      )}
    </>
  );
}
