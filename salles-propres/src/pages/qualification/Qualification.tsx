import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useSession } from "../../session";
import type { CampagneQualification, Essai, SallePropre, Zone } from "../../data/types";
import { Badge, Bouton, EnTete, MessageErreur, Onglets, TableauDefilant, Vide, formatDate, useDonnees } from "../../ui/composants";
import { LIBELLES_STATUTS_CAMPAGNE, LIBELLES_VERDICTS_CAMPAGNE, echeancier, type StatutEcheance } from "../../domain/qualification";
import { libelleClasse } from "../../domain/referentiels/classesIso";

export const TON_STATUT_CAMPAGNE: Record<string, "neutre" | "info" | "ok" | "attention" | "alerte" | "cuivre"> = {
  brouillon: "neutre", protocole_approuve: "info", en_execution: "cuivre", rapport_redige: "info", cloturee: "ok", annulee: "alerte",
};
export const TON_VERDICT_CAMPAGNE = { qualifie: "ok", qualifie_reserves: "attention", non_qualifie: "alerte" } as const;
const TON_ECHEANCE: Record<StatutEcheance, "ok" | "attention" | "alerte" | "neutre"> = { a_jour: "ok", a_echeance: "attention", en_retard: "alerte", jamais: "neutre" };
const LIBELLES_ECHEANCE: Record<StatutEcheance, string> = { a_jour: "À jour", a_echeance: "À échéance", en_retard: "En retard", jamais: "Jamais réalisé" };

export const TYPES_CAMPAGNE: Record<string, string> = { initiale: "Initiale", periodique: "Périodique", modification: "Après modification" };

export function useDonneesQualification(salleId?: string) {
  const s = useSession();
  const org = s.org!.id;
  return useDonnees(async () => {
    const f = salleId ? { salle_id: salleId } : undefined;
    const [campagnes, essais, salles, zones] = await Promise.all([
      s.peut("qualification_protocoles", 1) ? s.depot.lister("campagnes_qualification", org, f) : [],
      s.peut("qualification_execution", 1) ? s.depot.lister("essais", org) : [],
      s.depot.lister("salles_propres", org, salleId ? { id: salleId } : undefined), s.depot.lister("zones", org, f),
    ]);
    const ids = new Set(campagnes.map((c) => c.id));
    return { campagnes, essais: essais.filter((e) => ids.has(e.campagne_id)), tousEssais: essais, salles, zones };
  }, [org, salleId]);
}

export function ListeCampagnes({ campagnes, essais, salles }: { campagnes: CampagneQualification[]; essais: Essai[]; salles: SallePropre[] }) {
  const naviguer = useNavigate();
  if (campagnes.length === 0) return <Vide>Aucune campagne de qualification.</Vide>;
  return (
    <TableauDefilant>
      <table className="tableau bg-white">
        <thead><tr><th>N°</th><th>Campagne</th><th>Salle</th><th>Type</th><th>Avancement</th><th>Statut</th><th>Verdict</th></tr></thead>
        <tbody>
          {[...campagnes].sort((a, b) => b.cree_le.localeCompare(a.cree_le)).map((c) => {
            const liste = essais.filter((e) => e.campagne_id === c.id && e.statut !== "non_applicable");
            const faits = liste.filter((e) => e.statut === "realise").length;
            return (
              <tr key={c.id} className="cursor-pointer" onClick={() => naviguer(`/qualification/${c.id}`)}>
                <td className="whitespace-nowrap font-mono text-xs">{c.numero}</td>
                <td><strong className="text-navy-700">{c.titre}</strong><div className="text-xs text-texte-2">{c.etapes.join(" · ")}</div></td>
                <td>{salles.find((x) => x.id === c.salle_id)?.nom}</td>
                <td>{TYPES_CAMPAGNE[c.type_campagne]}</td>
                <td className="whitespace-nowrap">{faits} / {liste.length} essai(s)</td>
                <td><Badge ton={TON_STATUT_CAMPAGNE[c.statut]}>{LIBELLES_STATUTS_CAMPAGNE[c.statut]}</Badge></td>
                <td>{c.verdict ? <Badge ton={TON_VERDICT_CAMPAGNE[c.verdict]}>{LIBELLES_VERDICTS_CAMPAGNE[c.verdict]}</Badge> : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableauDefilant>
  );
}

export function Echeancier({ zones, essais, salles }: { zones: Zone[]; essais: Essai[]; salles: SallePropre[] }) {
  const s = useSession();
  const lignes = echeancier(zones, essais, s.referentiels.periodicites);
  if (lignes.length === 0) return <Vide>Aucune zone classée.</Vide>;
  const ordre: Record<StatutEcheance, number> = { en_retard: 0, jamais: 1, a_echeance: 2, a_jour: 3 };
  return (
    <TableauDefilant>
      <table className="tableau bg-white">
        <thead><tr><th>Zone</th><th>Classe</th><th>Essai</th><th>Dernier essai conforme</th><th>Prochaine échéance</th><th>Statut</th></tr></thead>
        <tbody>
          {[...lignes].sort((a, b) => ordre[a.statut] - ordre[b.statut] || (a.prochaine ?? "").localeCompare(b.prochaine ?? "")).map((l) => (
            <tr key={`${l.zone.id}-${l.essai.essai}`}>
              <td><Link to={`/salles/${l.zone.salle_id}`} className="text-navy-700 hover:underline">{l.zone.code} {l.zone.nom}</Link><div className="text-xs text-texte-2">{salles.find((x) => x.id === l.zone.salle_id)?.nom}</div></td>
              <td>{libelleClasse(l.zone.iso_repos)}{l.zone.grade_bpf && ` · ${l.zone.grade_bpf}`}</td>
              <td>{l.essai.libelle}</td>
              <td>{formatDate(l.dernier)}</td>
              <td>{formatDate(l.prochaine)}</td>
              <td><Badge ton={TON_ECHEANCE[l.statut]}>{LIBELLES_ECHEANCE[l.statut]}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableauDefilant>
  );
}

export function Qualification() {
  const s = useSession();
  const { donnees, erreur } = useDonneesQualification();
  const [onglet, setOnglet] = useState<"campagnes" | "echeancier">("campagnes");
  return (
    <>
      <EnTete
        titre="Qualification"
        sousTitre="Démarche pas à pas : protocole approuvé, exécution des essais, rapport signé, échéancier de requalification."
        actions={s.peut("qualification_protocoles", 2) && s.peut("qualification_execution", 2) && <Link to="/qualification/nouvelle"><Bouton variante="principal">+ Nouvelle campagne</Bouton></Link>}
      />
      <MessageErreur erreur={erreur} />
      <Onglets onglets={[{ cle: "campagnes", libelle: "Campagnes" }, { cle: "echeancier", libelle: "Échéancier de requalification" }]} actif={onglet} onChange={setOnglet} />
      {donnees && onglet === "campagnes" && <ListeCampagnes campagnes={donnees.campagnes} essais={donnees.essais} salles={donnees.salles} />}
      {donnees && onglet === "echeancier" && <Echeancier zones={donnees.zones} essais={donnees.tousEssais} salles={donnees.salles} />}
    </>
  );
}
