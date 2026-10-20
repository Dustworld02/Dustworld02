import { useState } from "react";
import { useSession } from "../session";
import { Bandeau, Bouton, Carte, Champ, EnTete, MessageErreur, Onglets, Saisie, SaisieNombre, TableauDefilant, useAction } from "../ui/composants";
import { CLASSES_ISO, POINTS_PRELEVEMENT_A1, TAILLES_PARTICULES, limiteIso, pointsMinimaux } from "../domain/referentiels/classesIso";
import { DEFINITIONS_GRADES, GRADES_BPF } from "../domain/referentiels/gradesBpf";
import { CATALOGUE_ESSAIS } from "../domain/referentiels/essais";
import { PERIODICITES_DEFAUT, type Periodicite } from "../domain/referentiels/periodicites";
import { TYPES_DOCUMENTS_DEFAUT, type TypeDocument } from "../domain/referentiels/typesDocuments";
import { formatNombre } from "../domain/exigencesZone";

type Onglet = "iso" | "points" | "bpf" | "periodicites" | "essais" | "documents";

export function Referentiels() {
  const [onglet, setOnglet] = useState<Onglet>("iso");
  return (
    <>
      <EnTete titre="Référentiels" sousTitre="Tables normatives utilisées pour calculer les exigences des zones et les échéances." />
      <Onglets
        onglets={[
          { cle: "iso", libelle: "Classes ISO 14644-1" },
          { cle: "points", libelle: "Points de prélèvement" },
          { cle: "bpf", libelle: "Grades BPF" },
          { cle: "periodicites", libelle: "Périodicités" },
          { cle: "essais", libelle: "Catalogue d'essais" },
          { cle: "documents", libelle: "Types de documents" },
        ]}
        actif={onglet}
        onChange={setOnglet}
      />
      {onglet === "iso" && <ClassesIso />}
      {onglet === "points" && <Points />}
      {onglet === "bpf" && <GradesBpf />}
      {onglet === "periodicites" && <Periodicites />}
      {onglet === "essais" && <Essais />}
      {onglet === "documents" && <TypesDocuments />}
    </>
  );
}

function ClassesIso() {
  const [classe, setClasse] = useState<number | null>(6.5);
  return (
    <div className="grid gap-4">
      <Carte titre="Concentrations maximales admissibles (particules/m³) — ISO 14644-1:2015, tableau 1">
        <TableauDefilant>
          <table className="tableau">
            <thead><tr><th>Classe</th>{TAILLES_PARTICULES.map((t) => <th key={t} className="nombre">≥ {String(t).replace(".", ",")} µm</th>)}</tr></thead>
            <tbody>{CLASSES_ISO.map((c) => <tr key={c}><td className="font-semibold">ISO {c}</td>{TAILLES_PARTICULES.map((t) => <td key={t} className="nombre">{formatNombre(limiteIso(c, t))}</td>)}</tr>)}</tbody>
          </table>
        </TableauDefilant>
        <p className="mt-2 text-xs text-texte-2">« — » : taille non applicable à la classe. Table normative, non modifiable.</p>
      </Carte>
      <Carte titre="Classe intermédiaire">
        <div className="flex flex-wrap items-end gap-4">
          <Champ libelle="Classe (pas de 0,1)" className="w-40"><SaisieNombre valeur={classe} onChange={setClasse} /></Champ>
          <div className="text-sm">
            {classe != null && classe >= 1 && classe <= 9 ? TAILLES_PARTICULES.map((t) => (
              <span key={t} className="mr-4 inline-block">≥ {String(t).replace(".", ",")} µm : <strong>{formatNombre(limiteIso(classe, t))}</strong></span>
            )) : <span className="text-texte-2">Classe entre 1 et 9.</span>}
          </div>
        </div>
        <p className="mt-2 text-xs text-texte-2">Cn = 10<sup>N</sup> × (0,1 / D)<sup>2,08</sup>, arrondi à trois chiffres significatifs.</p>
      </Carte>
    </div>
  );
}

function Points() {
  const [surface, setSurface] = useState<number | null>(60);
  return (
    <Carte titre="Nombre minimal de points de prélèvement — ISO 14644-1:2015, tableau A.1">
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <Champ libelle="Surface de la zone (m²)" className="w-48"><SaisieNombre valeur={surface} onChange={setSurface} /></Champ>
        <div className="text-sm">Points minimaux : <strong>{surface != null ? pointsMinimaux(surface) ?? "—" : "—"}</strong></div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 text-sm sm:grid-cols-3 md:grid-cols-5">
        {POINTS_PRELEVEMENT_A1.map(([max, n], i) => (
          <div key={max} className="flex justify-between border-b border-bord py-1"><span className="text-texte-2">{i === 0 ? "≤" : `${formatNombre(POINTS_PRELEVEMENT_A1[i - 1][0])} – `} {formatNombre(max)} m²</span><strong>{n}</strong></div>
        ))}
      </div>
      <p className="mt-2 text-xs text-texte-2">Au-delà de 1 000 m² : NL = 27 × (A / 1 000), arrondi à l'entier supérieur.</p>
    </Carte>
  );
}

function GradesBpf() {
  const micro = (v: number | null) => (v === null ? "—" : v === 0 ? "pas de croissance" : `< ${v}`);
  return (
    <div className="grid gap-4">
      <Carte titre="Grades A à D — BPF Annexe 1 (2022)">
        <TableauDefilant>
          <table className="tableau">
            <thead><tr><th>Grade</th><th>ISO repos</th><th>ISO activité</th><th className="nombre">0,5 µm repos</th><th className="nombre">5 µm repos</th><th className="nombre">0,5 µm activité</th><th className="nombre">5 µm activité</th><th>Usage type</th></tr></thead>
            <tbody>{GRADES_BPF.map((g) => { const d = DEFINITIONS_GRADES[g]; return (
              <tr key={g}><td className="font-semibold">{g}</td><td>ISO {d.isoAuRepos}</td><td>{d.isoEnActivite ? `ISO ${d.isoEnActivite}` : "non prédéterminé"}</td>
                <td className="nombre">{formatNombre(d.particulesAuRepos["0.5"])}</td><td className="nombre">{formatNombre(d.particulesAuRepos["5"])}</td>
                <td className="nombre">{formatNombre(d.particulesEnActivite["0.5"])}</td><td className="nombre">{formatNombre(d.particulesEnActivite["5"])}</td>
                <td className="text-texte-2">{d.usage}</td></tr>
            ); })}</tbody>
          </table>
        </TableauDefilant>
      </Carte>
      <Carte titre="Limites microbiologiques en activité">
        <TableauDefilant>
          <table className="tableau">
            <thead><tr><th>Grade</th><th>Air (UFC/m³)</th><th>Sédimentation Ø 90 mm (UFC/4 h)</th><th>Contact Ø 55 mm (UFC/boîte)</th><th>Gants (UFC/gant)</th></tr></thead>
            <tbody>{GRADES_BPF.map((g) => { const m = DEFINITIONS_GRADES[g].microbio; return (
              <tr key={g}><td className="font-semibold">{g}</td><td>{micro(m.airUfcM3)}</td><td>{micro(m.sedimentationUfc4h)}</td><td>{micro(m.contactUfcBoite)}</td><td>{micro(m.gantsUfcGant)}</td></tr>
            ); })}</tbody>
          </table>
        </TableauDefilant>
        <p className="mt-2 text-xs text-texte-2">Les limites d'alerte et d'action propres à chaque zone seront définies dans le module de suivi des contaminations (phase 3).</p>
      </Carte>
    </div>
  );
}

/** Enregistre une surcharge d'organisation pour un référentiel modifiable. */
function useSurcharge<T>(cle: string, defaut: T) {
  const s = useSession();
  const action = useAction();
  const existante = s.referentiels.surcharges.find((x) => x.cle === cle);
  const modifiable = s.peut("referentiels", 3);
  const enregistrer = (donnees: T) => action.executer(async () => {
    if (existante) await s.depot.modifier("referentiels_org", existante.id, { donnees });
    else await s.depot.creer("referentiels_org", { org_id: s.org!.id, cle, donnees });
    await s.rafraichir();
  });
  const restaurer = () => action.executer(async () => {
    if (existante && window.confirm("Revenir aux valeurs par défaut de l'outil ?")) {
      await s.depot.supprimer("referentiels_org", existante.id);
      await s.rafraichir();
    }
  });
  return { action, modifiable, personnalise: !!existante, enregistrer, restaurer, defaut };
}

function Periodicites() {
  const s = useSession();
  const [lignes, setLignes] = useState<Periodicite[]>(s.referentiels.periodicites);
  const r = useSurcharge("periodicites", PERIODICITES_DEFAUT);
  const maj = (i: number, champ: Partial<Periodicite>) => setLignes(lignes.map((l, j) => (j === i ? { ...l, ...champ } : l)));
  return (
    <Carte
      titre="Périodicités maximales des essais (mois) — ISO 14644-2:2015"
      actions={r.modifiable && <>
        {r.personnalise && <Bouton variante="discret" onClick={() => void r.restaurer()}>Valeurs par défaut</Bouton>}
        <Bouton variante="principal" disabled={r.action.enCours} onClick={() => void r.enregistrer(lignes)}>Enregistrer</Bouton>
      </>}
    >
      <MessageErreur erreur={r.action.erreur} />
      {r.personnalise && <div className="mb-3"><Bandeau ton="cuivre">Périodicités personnalisées pour l'organisation.</Bandeau></div>}
      <TableauDefilant>
        <table className="tableau">
          <thead><tr><th>Essai</th><th>Classes ≤ ISO 5</th><th>Classes &gt; ISO 5</th><th>Obligatoire</th></tr></thead>
          <tbody>{lignes.map((l, i) => (
            <tr key={l.essai}>
              <td>{l.libelle}</td>
              <td className="w-32"><SaisieNombre disabled={!r.modifiable} aria-label="Mois ISO ≤ 5" valeur={l.moisIsoInf5} onChange={(v) => maj(i, { moisIsoInf5: v ?? 0 })} /></td>
              <td className="w-32"><SaisieNombre disabled={!r.modifiable} aria-label="Mois ISO > 5" valeur={l.moisIsoSup5} onChange={(v) => maj(i, { moisIsoSup5: v ?? 0 })} /></td>
              <td>{l.obligatoire ? "Oui" : "Optionnel"}</td>
            </tr>
          ))}</tbody>
        </table>
      </TableauDefilant>
      <p className="mt-2 text-xs text-texte-2">Valeurs maximales de la norme : on peut les resserrer sur analyse de risque, pas les allonger sans justification. Elles alimenteront l'échéancier de requalification (phase 3).</p>
    </Carte>
  );
}

function Essais() {
  return (
    <Carte titre="Catalogue initial des essais de qualification">
      <TableauDefilant>
        <table className="tableau">
          <thead><tr><th>Essai</th><th>Référence</th><th>Applicable à</th><th>Statut</th></tr></thead>
          <tbody>{CATALOGUE_ESSAIS.map((e) => (
            <tr key={e.cle}><td>{e.libelle}</td><td className="text-texte-2">{e.reference}</td><td>{e.cibles.join(", ")}</td><td>{e.optionnel ? "Optionnel" : "Requis"}</td></tr>
          ))}</tbody>
        </table>
      </TableauDefilant>
      <p className="mt-2 text-xs text-texte-2">Utilisé par l'assistant de qualification (phase 3) pour pré-cocher les essais d'un protocole.</p>
    </Carte>
  );
}

function TypesDocuments() {
  const s = useSession();
  const [lignes, setLignes] = useState<TypeDocument[]>(s.referentiels.typesDocuments);
  const r = useSurcharge("types_documents", TYPES_DOCUMENTS_DEFAUT);
  const maj = (i: number, champ: Partial<TypeDocument>) => setLignes(lignes.map((l, j) => (j === i ? { ...l, ...champ } : l)));
  const valide = lignes.every((l) => l.cle.trim() && l.libelle.trim()) && new Set(lignes.map((l) => l.cle)).size === lignes.length;
  return (
    <Carte
      titre="Types de documents"
      actions={r.modifiable && <>
        {r.personnalise && <Bouton variante="discret" onClick={() => void r.restaurer()}>Valeurs par défaut</Bouton>}
        <Bouton onClick={() => setLignes([...lignes, { cle: `type_${lignes.length + 1}`, libelle: "", validiteMois: null }])}>+ Type</Bouton>
        <Bouton variante="principal" disabled={r.action.enCours || !valide} onClick={() => void r.enregistrer(lignes)}>Enregistrer</Bouton>
      </>}
    >
      <MessageErreur erreur={r.action.erreur} />
      <TableauDefilant>
        <table className="tableau">
          <thead><tr><th>Code</th><th>Libellé</th><th>Validité par défaut (mois)</th></tr></thead>
          <tbody>{lignes.map((l, i) => (
            <tr key={i}>
              <td className="w-48"><Saisie disabled={!r.modifiable || TYPES_DOCUMENTS_DEFAUT.some((d) => d.cle === l.cle)} value={l.cle} onChange={(e) => maj(i, { cle: e.target.value.replace(/[^a-z0-9_]/g, "") })} /></td>
              <td><Saisie disabled={!r.modifiable} value={l.libelle} onChange={(e) => maj(i, { libelle: e.target.value })} /></td>
              <td className="w-48"><SaisieNombre disabled={!r.modifiable} valeur={l.validiteMois} onChange={(v) => maj(i, { validiteMois: v })} /></td>
            </tr>
          ))}</tbody>
        </table>
      </TableauDefilant>
      <p className="mt-2 text-xs text-texte-2">La validité préremplit la date d'échéance à la création d'un document (vide = sans échéance).</p>
    </Carte>
  );
}
