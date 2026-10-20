import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useSession } from "../session";
import type { SallePropre, Zone } from "../data/types";
import { Badge, Bandeau, Bouton, Carte, Champ, EnTete, Liste, MessageErreur, Modale, Saisie, SaisieNombre, TableauDefilant, Vide, ZoneTexte, formatDate, useAction, useDonnees } from "../ui/composants";
import { libelleSecteur } from "./Entreprises";
import { LIBELLES_TYPES_ZONES, type TypeZone } from "../domain/secteurs/types";
import { gabaritDepuisZones, MENTION_POINT_DE_DEPART } from "../domain/secteurs/generation";
import { GRADES_BPF, type GradeBpf } from "../domain/referentiels/gradesBpf";
import { libelleClasse } from "../domain/referentiels/classesIso";
import { formatNombre, incoherencesZone, limitesMicrobio, limitesParticulaires, pointsPrelevementZone, volumeM3 } from "../domain/exigencesZone";
import { LIBELLES_STATUTS } from "./Documents";

type EditionZone = Omit<Zone, "id" | "org_id" | "cree_le" | "cree_par" | "modifie_le" | "modifie_par" | "site_id"> & { id?: string };

function zoneVide(salleId: string, code: string): EditionZone {
  return {
    salle_id: salleId, code, nom: "", type_zone: "salle", iso_repos: null, iso_activite: null, grade_bpf: null, zone_risque: null,
    surface_m2: null, hauteur_m: null, pression_pa: null, tolerance_pression_pa: null, renouvellement_vol_h: null,
    temperature_min: null, temperature_max: null, hr_min: null, hr_max: null, gabarit_ref: null, notes: "",
  };
}

export function SalleDetail() {
  const { id = "" } = useParams();
  const s = useSession();
  const org = s.org!.id;
  const naviguer = useNavigate();
  const ecriture = s.peut("installations", 2);
  const suppression = s.peut("installations", 3);
  const { donnees, erreur, recharger } = useDonnees(async () => {
    const [salles, zones, sites, entreprises, documents] = await Promise.all([
      s.depot.lister("salles_propres", org, { id }), s.depot.lister("zones", org, { salle_id: id }),
      s.depot.lister("sites", org), s.depot.lister("entreprises", org),
      s.peut("documents", 1) ? s.depot.lister("documents", org, { objet_type: "salle_propre", objet_id: id }) : [],
    ]);
    return { salle: salles[0] ?? null, zones: zones.sort((a, b) => a.code.localeCompare(b.code, "fr", { numeric: true })), sites, entreprises, documents };
  }, [org, id]);
  const [zone, setZone] = useState<EditionZone | null>(null);
  const [salle, setSalle] = useState<Pick<SallePropre, "nom" | "batiment" | "etage" | "description"> | null>(null);
  const [gabaritNom, setGabaritNom] = useState<string | null>(null);
  const action = useAction();

  if (erreur) return <MessageErreur erreur={erreur} />;
  if (!donnees) return <p className="text-texte-2">Chargement…</p>;
  if (!donnees.salle) return <Vide>Salle propre introuvable ou hors de votre périmètre.</Vide>;
  const sp = donnees.salle;
  const site = donnees.sites.find((x) => x.id === sp.site_id);
  const entreprise = donnees.entreprises.find((x) => x.id === site?.entreprise_id);
  const gabarit = s.gabarits.find((g) => g.cle === sp.gabarit_cle);
  const surfaceTotale = donnees.zones.reduce((t, z) => t + (z.surface_m2 ?? 0), 0);

  const prochainCode = () => {
    const max = donnees.zones.reduce((m, z) => Math.max(m, parseInt(z.code.replace(/\D/g, ""), 10) || 0), 0);
    return `Z${String(max + 1).padStart(2, "0")}`;
  };

  const enregistrerZone = () => action.executer(async () => {
    const { id: zoneId, ...valeurs } = zone!;
    if (zoneId) await s.depot.modifier("zones", zoneId, valeurs);
    else await s.depot.creer("zones", { ...valeurs, org_id: org, site_id: null });
    setZone(null);
    recharger();
  });

  const supprimerZone = (z: Zone) => {
    if (!window.confirm(`Supprimer la zone « ${z.nom} » ? L'opération est tracée dans le journal d'audit.`)) return;
    void action.executer(async () => { await s.depot.supprimer("zones", z.id); recharger(); });
  };

  const supprimerSalle = () => {
    if (!window.confirm(`Supprimer la salle « ${sp.nom} » et ses ${donnees.zones.length} zone(s) ?`)) return;
    void action.executer(async () => { await s.depot.supprimer("salles_propres", sp.id); naviguer("/salles"); });
  };

  const enregistrerGabarit = () => action.executer(async () => {
    const libelle = gabaritNom!.trim();
    const cle = `org_${libelle.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
    if (s.gabarits.some((g) => g.cle === cle)) throw new Error("Un gabarit porte déjà ce nom.");
    const g = gabaritDepuisZones(cle, libelle, gabarit, donnees.zones);
    await s.depot.creer("gabarits_org", { org_id: org, cle: g.cle, version: g.version, libelle: g.libelle, donnees: g });
    await s.rafraichir();
    setGabaritNom(null);
  });

  return (
    <>
      <EnTete
        titre={sp.nom}
        sousTitre={<>{entreprise?.nom} · {site?.nom}{sp.batiment && ` · bâtiment ${sp.batiment}`}{sp.etage && ` · ${sp.etage}`}</>}
        actions={<>
          <Bouton className="no-print" onClick={() => window.print()}>Imprimer la fiche</Bouton>
          {s.peut("gabarits", 2) && <Bouton className="no-print" onClick={() => { action.effacer(); setGabaritNom(`${entreprise?.nom ?? ""} — ${sp.nom}`); }}>Enregistrer comme gabarit</Bouton>}
          {ecriture && <Bouton className="no-print" onClick={() => { action.effacer(); setSalle({ nom: sp.nom, batiment: sp.batiment, etage: sp.etage, description: sp.description }); }}>Modifier</Bouton>}
          {suppression && <Bouton className="no-print" variante="danger" onClick={supprimerSalle}>Supprimer</Bouton>}
        </>}
      />
      <MessageErreur erreur={zone || salle || gabaritNom ? null : action.erreur} />

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Carte titre="Secteur et gabarit">
          <div className="space-y-2 text-sm">
            <Badge ton="cuivre">{libelleSecteur(sp.secteur)}</Badge>
            <p>{gabarit ? <>Généré depuis <strong>{gabarit.libelle}</strong> v{sp.gabarit_version}{gabarit.version !== sp.gabarit_version && <> — <Badge ton="attention">gabarit passé en v{gabarit.version}</Badge></>}</> : "Saisie libre, sans gabarit."}</p>
            {gabarit && <div className="flex flex-wrap gap-1">{gabarit.referentiels.map((r) => <Badge key={r}>{r}</Badge>)}</div>}
          </div>
        </Carte>
        <Carte titre="Synthèse">
          <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
            <dt className="text-texte-2">Zones</dt><dd className="nombre">{donnees.zones.length}</dd>
            <dt className="text-texte-2">Surface renseignée</dt><dd className="nombre">{formatNombre(surfaceTotale)} m²</dd>
            <dt className="text-texte-2">Créée le</dt><dd className="nombre">{formatDate(sp.cree_le)}</dd>
          </dl>
          {s.peut("audit", 1) && <Link className="no-print mt-2 inline-block text-sm text-navy-700 hover:underline" to={`/journal?table=salles_propres&id=${sp.id}`}>Historique de la salle</Link>}
        </Carte>
        <Carte titre="Description">
          <p className="whitespace-pre-line text-sm">{sp.description || <span className="text-texte-2">Aucune description.</span>}</p>
        </Carte>
      </div>

      <Carte
        titre="Zones"
        actions={ecriture && <Bouton className="no-print" variante="principal" onClick={() => { action.effacer(); setZone(zoneVide(sp.id, prochainCode())); }}>+ Zone</Bouton>}
      >
        {donnees.zones.length === 0 ? <Vide>Aucune zone.</Vide> : (
          <TableauDefilant>
            <table className="tableau">
              <thead><tr><th>Code</th><th>Zone</th><th>Type</th><th>Classification</th><th className="nombre">Pression</th><th className="nombre">Surface</th><th className="nombre">Volume</th><th className="nombre">Points min.</th><th className="no-print" /></tr></thead>
              <tbody>
                {donnees.zones.map((z) => {
                  const alertes = incoherencesZone(z);
                  return (
                    <tr key={z.id}>
                      <td className="font-mono text-xs">{z.code}</td>
                      <td>
                        <button type="button" className="text-left font-medium text-navy-700 hover:underline" onClick={() => { action.effacer(); setZone({ ...z }); }}>{z.nom}</button>
                        {alertes.length > 0 && <div><Badge ton="attention" title={alertes.map((a) => a.message).join("\n")}>⚠ {alertes.length} incohérence(s)</Badge></div>}
                      </td>
                      <td className="whitespace-nowrap text-texte-2">{LIBELLES_TYPES_ZONES[z.type_zone] ?? z.type_zone}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {z.iso_repos != null && <Badge ton="info">{libelleClasse(z.iso_repos)} repos</Badge>}
                          {z.iso_activite != null && <Badge>{libelleClasse(z.iso_activite)} activité</Badge>}
                          {z.grade_bpf && <Badge ton="cuivre">Grade {z.grade_bpf}</Badge>}
                          {z.zone_risque && <Badge ton="cuivre">Zone {z.zone_risque}</Badge>}
                        </div>
                      </td>
                      <td className="nombre whitespace-nowrap">{z.pression_pa != null ? `${formatNombre(z.pression_pa)} Pa` : "—"}</td>
                      <td className="nombre whitespace-nowrap">{z.surface_m2 != null ? `${formatNombre(z.surface_m2)} m²` : <Badge ton="attention">à saisir</Badge>}</td>
                      <td className="nombre whitespace-nowrap">{volumeM3(z) != null ? `${formatNombre(volumeM3(z))} m³` : "—"}</td>
                      <td className="nombre">{pointsPrelevementZone(z) ?? "—"}</td>
                      <td className="no-print whitespace-nowrap">{suppression && <Bouton variante="discret" onClick={() => supprimerZone(z)}>Supprimer</Bouton>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableauDefilant>
        )}
        <p className="mt-2 text-xs text-texte-2">Points min. : nombre minimal de points de prélèvement pour la classification (ISO 14644-1, tableau A.1), calculé sur la surface.</p>
      </Carte>

      {s.peut("documents", 1) && (
        <Carte titre="Documents rattachés" className="mt-4" actions={<Link to={`/documents?objet=${sp.id}`} className="no-print text-sm text-navy-700 hover:underline">Gérer dans la GED</Link>}>
          {donnees.documents.length === 0 ? <p className="text-sm text-texte-2">Aucun document rattaché à cette salle.</p> : (
            <ul className="space-y-1 text-sm">
              {donnees.documents.map((d) => <li key={d.id} className="flex items-center gap-2">{d.titre} <Badge>{LIBELLES_STATUTS[d.statut]}</Badge> <span className="text-xs text-texte-2">v{d.version_courante}</span></li>)}
            </ul>
          )}
        </Carte>
      )}

      {zone && <EditeurZone zone={zone} setZone={setZone} lectureSeule={!ecriture} enCours={action.enCours} erreur={action.erreur} onEnregistrer={() => void enregistrerZone()} />}

      {salle && (
        <Modale
          titre="Modifier la salle propre"
          onFermer={() => setSalle(null)}
          pied={<><Bouton onClick={() => setSalle(null)}>Annuler</Bouton><Bouton variante="principal" disabled={action.enCours || !salle.nom.trim()} onClick={() => void action.executer(async () => { await s.depot.modifier("salles_propres", sp.id, salle); setSalle(null); recharger(); })}>Enregistrer</Bouton></>}
        >
          <MessageErreur erreur={action.erreur} />
          <div className="grid gap-3 md:grid-cols-2">
            <Champ libelle="Nom" className="md:col-span-2"><Saisie value={salle.nom} onChange={(e) => setSalle({ ...salle, nom: e.target.value })} /></Champ>
            <Champ libelle="Bâtiment"><Saisie value={salle.batiment} onChange={(e) => setSalle({ ...salle, batiment: e.target.value })} /></Champ>
            <Champ libelle="Étage"><Saisie value={salle.etage} onChange={(e) => setSalle({ ...salle, etage: e.target.value })} /></Champ>
            <Champ libelle="Description" className="md:col-span-2"><ZoneTexte value={salle.description} onChange={(e) => setSalle({ ...salle, description: e.target.value })} /></Champ>
          </div>
        </Modale>
      )}

      {gabaritNom !== null && (
        <Modale
          titre="Enregistrer comme gabarit d'entreprise"
          onFermer={() => setGabaritNom(null)}
          pied={<><Bouton onClick={() => setGabaritNom(null)}>Annuler</Bouton><Bouton variante="principal" disabled={action.enCours || !gabaritNom.trim()} onClick={() => void enregistrerGabarit()}>Créer le gabarit</Bouton></>}
        >
          <MessageErreur erreur={action.erreur} />
          <p className="mb-3 text-sm text-texte-2">Les {donnees.zones.length} zones de cette salle, avec leurs classes et consignes, deviennent un gabarit proposé dans l'assistant. La prochaine salle de cette entreprise démarrera avec ses propres valeurs.</p>
          <Champ libelle="Nom du gabarit"><Saisie value={gabaritNom} onChange={(e) => setGabaritNom(e.target.value)} autoFocus /></Champ>
        </Modale>
      )}
    </>
  );
}

function EditeurZone({ zone, setZone, lectureSeule, enCours, erreur, onEnregistrer }: {
  zone: EditionZone;
  setZone: (z: EditionZone | null) => void;
  lectureSeule: boolean;
  enCours: boolean;
  erreur: string | null;
  onEnregistrer: () => void;
}) {
  const maj = (champ: Partial<EditionZone>) => setZone({ ...zone, ...champ });
  const nombre = (cle: keyof EditionZone, libelle: string, unite?: string) => (
    <Champ libelle={unite ? `${libelle} (${unite})` : libelle}>
      <SaisieNombre disabled={lectureSeule} valeur={zone[cle] as number | null} onChange={(v) => maj({ [cle]: v } as Partial<EditionZone>)} />
    </Champ>
  );
  const s = useSession();
  const gabaritZone = zone.gabarit_ref ? s.gabarits.find((g) => g.cle === zone.gabarit_ref!.gabarit) : undefined;
  const typeGabarit = gabaritZone?.typesZones.find((t) => t.cle === zone.gabarit_ref!.type_zone_gabarit);
  const limites = limitesParticulaires(zone);
  const microbio = limitesMicrobio(zone);
  const alertes = incoherencesZone(zone);
  const formatMicro = (v: number | null) => (v === null ? "—" : v === 0 ? "pas de croissance" : `< ${v}`);

  return (
    <Modale
      large
      titre={zone.id ? `Zone ${zone.code} — ${zone.nom}` : "Nouvelle zone"}
      onFermer={() => setZone(null)}
      pied={lectureSeule ? <Bouton onClick={() => setZone(null)}>Fermer</Bouton> : <><Bouton onClick={() => setZone(null)}>Annuler</Bouton><Bouton variante="principal" disabled={enCours || !zone.nom.trim()} onClick={onEnregistrer}>Enregistrer</Bouton></>}
    >
      <MessageErreur erreur={erreur} />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="grid content-start gap-3 md:grid-cols-3">
          <Champ libelle="Code"><Saisie disabled={lectureSeule} value={zone.code} onChange={(e) => maj({ code: e.target.value })} /></Champ>
          <Champ libelle="Nom" className="md:col-span-2"><Saisie disabled={lectureSeule} value={zone.nom} onChange={(e) => maj({ nom: e.target.value })} autoFocus /></Champ>
          <Champ libelle="Type">
            <Liste disabled={lectureSeule} value={zone.type_zone} onChange={(e) => maj({ type_zone: e.target.value as TypeZone })}>
              {Object.entries(LIBELLES_TYPES_ZONES).map(([cle, l]) => <option key={cle} value={cle}>{l}</option>)}
            </Liste>
          </Champ>
          {nombre("iso_repos", "Classe ISO au repos")}
          {nombre("iso_activite", "Classe ISO en activité")}
          <Champ libelle="Grade BPF">
            <Liste disabled={lectureSeule} value={zone.grade_bpf ?? ""} onChange={(e) => maj({ grade_bpf: (e.target.value || null) as GradeBpf | null })}>
              <option value="">—</option>
              {GRADES_BPF.map((g) => <option key={g} value={g}>{g}</option>)}
            </Liste>
          </Champ>
          <Champ libelle="Zone à risque (NF S 90-351)">
            <Liste disabled={lectureSeule} value={zone.zone_risque ?? ""} onChange={(e) => maj({ zone_risque: e.target.value ? Number(e.target.value) : null })}>
              <option value="">—</option>
              {[2, 3, 4].map((n) => <option key={n} value={n}>Zone {n}</option>)}
            </Liste>
          </Champ>
          {nombre("renouvellement_vol_h", "Renouvellement cible", "vol/h")}
          {nombre("surface_m2", "Surface", "m²")}
          {nombre("hauteur_m", "Hauteur sous plafond", "m")}
          <div />
          {nombre("pression_pa", "Consigne de pression", "Pa")}
          {nombre("tolerance_pression_pa", "Tolérance", "± Pa")}
          <div />
          {nombre("temperature_min", "Température min.", "°C")}
          {nombre("temperature_max", "Température max.", "°C")}
          <div />
          {nombre("hr_min", "HR min.", "%")}
          {nombre("hr_max", "HR max.", "%")}
          <div />
          <Champ libelle="Notes" className="md:col-span-3"><ZoneTexte disabled={lectureSeule} value={zone.notes} onChange={(e) => maj({ notes: e.target.value })} /></Champ>
        </div>

        <aside className="space-y-3 rounded-lg bg-fond p-3 text-sm">
          {zone.gabarit_ref && (
            <Bandeau ton="cuivre">Issue du gabarit « {gabaritZone?.libelle ?? zone.gabarit_ref.gabarit} » v{zone.gabarit_ref.version}, zone type « {typeGabarit?.libelle ?? zone.gabarit_ref.type_zone_gabarit} ». {zone.notes === MENTION_POINT_DE_DEPART ? "Valeurs à valider." : ""}</Bandeau>
          )}
          {alertes.map((a) => <Bandeau key={a.message} ton="attention">⚠ {a.message}</Bandeau>)}
          <div>
            <div className="mb-1 font-semibold">Grandeurs calculées</div>
            <div>Volume : {volumeM3(zone) != null ? `${formatNombre(volumeM3(zone))} m³` : "surface et hauteur requises"}</div>
            <div>Points de prélèvement (A.1) : {pointsPrelevementZone(zone) ?? "surface requise"}</div>
          </div>
          <div>
            <div className="mb-1 font-semibold">Limites particulaires (particules/m³)</div>
            {limites.length === 0 ? <p className="text-texte-2">Renseignez une classe ISO ou un grade.</p> : (
              <table className="w-full text-xs">
                <thead><tr className="text-texte-2"><th className="text-left">Taille</th><th className="text-right">Repos</th><th className="text-right">Activité</th></tr></thead>
                <tbody>{limites.map((l) => <tr key={l.taille}><td>≥ {String(l.taille).replace(".", ",")} µm</td><td className="nombre">{formatNombre(l.auRepos)}</td><td className="nombre">{formatNombre(l.enActivite)}</td></tr>)}</tbody>
              </table>
            )}
            {zone.grade_bpf && <p className="mt-1 text-xs text-texte-2">0,5 et 5 µm : limites de l'Annexe 1 (grade {zone.grade_bpf}).</p>}
          </div>
          {microbio && (
            <div>
              <div className="mb-1 font-semibold">Limites microbiologiques en activité (Annexe 1)</div>
              <ul className="text-xs">
                <li>Air : {formatMicro(microbio.airUfcM3)} UFC/m³</li>
                <li>Sédimentation : {formatMicro(microbio.sedimentationUfc4h)} UFC/4 h</li>
                <li>Contact : {formatMicro(microbio.contactUfcBoite)} UFC/boîte</li>
                <li>Gants : {formatMicro(microbio.gantsUfcGant)} UFC/gant</li>
              </ul>
            </div>
          )}
        </aside>
      </div>
    </Modale>
  );
}
