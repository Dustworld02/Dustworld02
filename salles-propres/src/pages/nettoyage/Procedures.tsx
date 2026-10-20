import { useMemo, useState } from "react";
import { useSession } from "../../session";
import type { ProcedureNettoyage } from "../../data/types";
import { Badge, Bandeau, Bouton, Carte, Champ, Liste, MessageErreur, Modale, Saisie, SaisieNombre, TableauDefilant, Vide, ZoneTexte, formatDate, useAction, useDonnees } from "../../ui/composants";
import { ListeSignatures, ModaleSignature } from "../../ui/signature";
import { FREQUENCES, MODELES_CONSOMMABLES, MODELES_PRODUITS, SURFACES, TECHNIQUES, type CleFrequence, type CleSurface } from "../../domain/nettoyage/referentiel";
import { LIBELLES_NIVEAUX, type ContenuProcedure, type EtapeProcedure } from "../../domain/nettoyage/generation";
import { groupesDeZones, type Groupe } from "../../domain/nettoyage/groupes";
import { LIBELLES_TYPES_ZONES } from "../../domain/secteurs/types";
import { libelleSecteur } from "../Entreprises";
import { completerCatalogue, nomConsommable, nomProduit, type DonneesNettoyage } from "./donnees";

const STATUTS = { brouillon: "Brouillon", approuvee: "Approuvée", perimee: "Périmée" };
const TON = { brouillon: "neutre", approuvee: "ok", perimee: "alerte" } as const;
const SURFACES_ETAPES: Record<string, string> = { preparation: "Préparation", dechets: "Déchets", cloture: "Clôture", ...SURFACES };

export function ListeProcedures({ d, recharger, salleFixe }: { d: DonneesNettoyage; recharger: () => void; salleFixe?: string }) {
  const s = useSession();
  const [salle, setSalle] = useState(salleFixe ?? d.salles[0]?.id ?? "");
  const [generateur, setGenerateur] = useState(false);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const procedures = d.procedures.filter((p) => p.salle_id === salle).sort((a, b) => a.categorie.localeCompare(b.categorie) || a.titre.localeCompare(b.titre));
  const zonesSalle = d.zones.filter((z) => z.salle_id === salle);
  const sansProcedure = zonesSalle.filter((z) => !d.procedures.some((p) => p.categorie === "nettoyage" && p.statut !== "perimee" && p.zones.includes(z.id)));
  const ouv = d.procedures.find((p) => p.id === ouverte);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {!salleFixe && <Liste aria-label="Salle propre" className="!w-72" value={salle} onChange={(e) => setSalle(e.target.value)}>{d.salles.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</Liste>}
        <span className="text-sm text-texte-2">Secteur : {libelleSecteur(d.salles.find((x) => x.id === salle)?.secteur)}</span>
        {s.peut("nettoyage_procedures", 2) && <Bouton variante="principal" className="ml-auto" onClick={() => setGenerateur(true)}>Générer depuis le gabarit du secteur</Bouton>}
      </div>
      {sansProcedure.length > 0 && <div className="mb-3"><Bandeau ton="attention">{sansProcedure.length} zone(s) sans procédure de nettoyage : {sansProcedure.map((z) => `${z.code} ${z.nom}`).join(", ")}.</Bandeau></div>}
      {procedures.length === 0 ? <Vide>Aucune procédure. Le générateur propose des procédures adaptées au secteur, au type et à la classe de chaque zone.</Vide> : (
        <TableauDefilant>
          <table className="tableau bg-white">
            <thead><tr><th>Procédure</th><th>Zones</th><th>Version</th><th>Statut</th></tr></thead>
            <tbody>{procedures.map((p) => (
              <tr key={p.id} className="cursor-pointer" onClick={() => setOuverte(p.id)}>
                <td><strong className="text-navy-700">{p.titre}</strong><div className="text-xs text-texte-2">{p.categorie === "habillage" ? "Habillage" : "Nettoyage"}{p.gabarit_ref && ` · généré (${LIBELLES_NIVEAUX[p.gabarit_ref.niveau as keyof typeof LIBELLES_NIVEAUX] ?? p.gabarit_ref.niveau})`}</div></td>
                <td className="text-sm">{p.zones.map((id) => zonesSalle.find((z) => z.id === id)?.code).filter(Boolean).join(", ")}</td>
                <td>v{p.version}</td>
                <td><Badge ton={TON[p.statut]}>{STATUTS[p.statut]}</Badge></td>
              </tr>
            ))}</tbody>
          </table>
        </TableauDefilant>
      )}
      {generateur && <GenerateurProcedures d={d} salleId={salle} onFermer={() => { setGenerateur(false); recharger(); }} />}
      {ouv && <DetailProcedure procedure={ouv} d={d} onFermer={() => { setOuverte(null); recharger(); }} />}
    </div>
  );
}


function GenerateurProcedures({ d, salleId, onFermer }: { d: DonneesNettoyage; salleId: string; onFermer: () => void }) {
  const s = useSession();
  const salle = d.salles.find((x) => x.id === salleId);
  const zones = d.zones.filter((z) => z.salle_id === salleId);
  const [groupes, setGroupes] = useState(() => groupesDeZones(salle?.secteur ?? "", zones));
  const [apercu, setApercu] = useState<Groupe | null>(null);
  const action = useAction();
  const retenus = groupes.filter((g) => g.retenu);
  const creer = () => action.executer(async () => {
    await completerCatalogue(s.depot, s.org!.id, retenus.flatMap((g) => g.contenu.produits), retenus.flatMap((g) => g.contenu.consommables), d.produits, d.consommables);
    await s.depot.creerPlusieurs("procedures_nettoyage", retenus.map((g) => ({
      org_id: s.org!.id, salle_id: salleId, categorie: g.categorie, titre: g.titre, zones: g.zones.map((z) => z.id), contenu: g.contenu,
      gabarit_ref: { secteur: salle?.secteur ?? "", niveau: g.niveau },
    })));
    onFermer();
  });
  return (
    <Modale large titre={`Générer les procédures — ${salle?.nom}`} onFermer={onFermer} pied={<>
      <Bouton onClick={onFermer}>Annuler</Bouton>
      <Bouton variante="principal" disabled={action.enCours || retenus.length === 0} onClick={() => void creer()}>Créer {retenus.length} procédure(s) en brouillon</Bouton>
    </>}>
      <MessageErreur erreur={action.erreur} />
      <Bandeau ton="cuivre">
        Secteur {libelleSecteur(salle?.secteur)} : lingettes, produits, techniques et fréquences sont proposés selon le type et la classe de chaque groupe de zones.
        C'est un point de départ : confirmez les produits avec leurs FDS et validez le nettoyage avant usage officiel. Les produits et consommables absents du catalogue y seront ajoutés « à compléter ».
      </Bandeau>
      <ul className="mt-3 space-y-2">
        {groupes.map((g, i) => (
          <li key={g.cle} className="flex items-start gap-3 rounded-lg border border-bord p-3">
            <input type="checkbox" aria-label={`Retenir ${g.titre}`} checked={g.retenu} onChange={(e) => setGroupes(groupes.map((x, j) => (j === i ? { ...x, retenu: e.target.checked } : x)))} className="mt-1" />
            <div className="flex-1 text-sm">
              <div className="font-semibold">{g.titre}</div>
              <div className="text-xs text-texte-2">{g.zones.map((z) => `${z.code} ${z.nom}`).join(", ")} · {LIBELLES_NIVEAUX[g.niveau as keyof typeof LIBELLES_NIVEAUX]}</div>
              {g.categorie === "nettoyage" ? (
                <div className="mt-1 text-xs">Lingette : <strong>{MODELES_CONSOMMABLES[g.contenu.consommables.find((c) => c.startsWith("lingette")) ?? ""]?.nom ?? "—"}</strong> · sols : {FREQUENCES[g.contenu.frequences.find((f) => f.surface === "sols")!.frequence].toLowerCase()} · surfaces : {FREQUENCES[g.contenu.frequences.find((f) => f.surface === "surfaces_travail")!.frequence].toLowerCase()}</div>
              ) : <div className="mt-1 text-xs">Tenue : {g.contenu.tenue?.join(", ")}</div>}
            </div>
            <Bouton variante="discret" onClick={() => setApercu(g)}>Aperçu</Bouton>
          </li>
        ))}
      </ul>
      {apercu && (
        <Modale large titre={apercu.titre} onFermer={() => setApercu(null)}>
          <VueContenu contenu={apercu.contenu} d={d} />
        </Modale>
      )}
    </Modale>
  );
}

/** Lecture d'une procédure (aperçu, impression). */
export function VueContenu({ contenu, d }: { contenu: ContenuProcedure; d: Pick<DonneesNettoyage, "produits" | "consommables"> }) {
  return (
    <div className="grid gap-4 text-sm">
      {contenu.tenue && <div><h3 className="mb-1 font-semibold">Tenue</h3><ul className="list-disc pl-5">{contenu.tenue.map((t) => <li key={t}>{t}</li>)}</ul></div>}
      {contenu.frequences.length > 0 && (
        <div>
          <h3 className="mb-1 font-semibold">Fréquences</h3>
          <table className="w-full text-xs"><tbody>{contenu.frequences.map((f) => <tr key={f.surface} className="border-b border-bord"><td className="py-1 pr-2">{SURFACES[f.surface]}</td><td className="py-1 font-semibold">{FREQUENCES[f.frequence]}</td></tr>)}</tbody></table>
        </div>
      )}
      <div>
        <h3 className="mb-1 font-semibold">Étapes</h3>
        <ol className="space-y-1.5">
          {contenu.etapes.map((e) => (
            <li key={e.ordre} className="flex gap-2">
              <span className="w-6 shrink-0 text-right font-semibold text-cuivre-600">{e.ordre}.</span>
              <div>
                <div>{e.action}</div>
                <div className="text-xs text-texte-2">
                  {[e.technique && TECHNIQUES[e.technique]?.libelle, e.produit && nomProduit(e.produit, d.produits), e.consommable && nomConsommable(e.consommable, d.consommables), e.temps_contact_min != null && `contact ${e.temps_contact_min} min`].filter(Boolean).join(" · ")}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
      {contenu.rotation && <div><h3 className="mb-1 font-semibold">Produits et rotation</h3><p>{contenu.rotation}</p></div>}
      <div><h3 className="mb-1 font-semibold">Matériel</h3><p>{contenu.materiel}</p></div>
      <div><h3 className="mb-1 font-semibold">Contrôles</h3><p>{contenu.controles}</p></div>
      {contenu.remarques.length > 0 && <div><h3 className="mb-1 font-semibold">Points d'attention</h3><ul className="list-disc pl-5">{contenu.remarques.map((r) => <li key={r}>{r}</li>)}</ul></div>}
      <div className="text-xs text-texte-2">
        <strong>Techniques de référence :</strong>{" "}
        {[...new Set(contenu.etapes.map((e) => e.technique).filter((t): t is string => !!t))].map((t) => `${TECHNIQUES[t].libelle} — ${TECHNIQUES[t].description}`).join(" ")}
      </div>
    </div>
  );
}

function DetailProcedure({ procedure, d, onFermer }: { procedure: ProcedureNettoyage; d: DonneesNettoyage; onFermer: () => void }) {
  const s = useSession();
  const org = s.org!.id;
  const { donnees: signatures, recharger: rechargerSignatures } = useDonnees(() => s.depot.signatures(org, "procedure", procedure.id), [org, procedure.id, procedure.version]);
  const [mode, setMode] = useState<"lecture" | "edition">("lecture");
  const [contenu, setContenu] = useState<ContenuProcedure>(procedure.contenu);
  const [titre, setTitre] = useState(procedure.titre);
  const [signer, setSigner] = useState(false);
  const action = useAction();
  const ecriture = s.peut("nettoyage_procedures", 2);
  const zonesSalle = d.zones.filter((z) => z.salle_id === procedure.salle_id);
  const [zones, setZones] = useState(procedure.zones);
  const sigVersion = (signatures ?? []).filter((x) => x.version_objet === procedure.version);
  const majEtape = (i: number, e: Partial<EtapeProcedure>) => setContenu({ ...contenu, etapes: contenu.etapes.map((x, j) => (j === i ? { ...x, ...e } : x)) });
  const optionsProduits = useMemo(() => Object.values(MODELES_PRODUITS).map((m) => ({ cle: m.cle, nom: nomProduit(m.cle, d.produits) })), [d.produits]);
  const optionsConsommables = useMemo(() => Object.values(MODELES_CONSOMMABLES).map((m) => ({ cle: m.cle, nom: nomConsommable(m.cle, d.consommables) })), [d.consommables]);

  const enregistrer = () => action.executer(async () => {
    const etapes = contenu.etapes.map((e, i) => ({ ...e, ordre: i + 1 }));
    const nouveau = { ...contenu, etapes, produits: [...new Set(etapes.map((e) => e.produit).filter((x): x is string => !!x))], consommables: [...new Set(etapes.map((e) => e.consommable).filter((x): x is string => !!x))] };
    await completerCatalogue(s.depot, org, nouveau.produits, nouveau.consommables, d.produits, d.consommables);
    await s.depot.modifier("procedures_nettoyage", procedure.id, { contenu: nouveau, titre, zones });
    setMode("lecture");
    onFermer();
  });

  return (
    <Modale large titre={`${procedure.titre} — v${procedure.version}`} onFermer={onFermer} pied={<>
      <Badge ton={TON[procedure.statut]}>{STATUTS[procedure.statut]}</Badge>
      <span className="mr-auto" />
      <Bouton onClick={() => window.print()}>Imprimer la fiche</Bouton>
      {mode === "lecture" && ecriture && procedure.statut !== "perimee" && <Bouton onClick={() => setMode("edition")}>Modifier</Bouton>}
      {mode === "edition" && <><Bouton onClick={() => { setMode("lecture"); setContenu(procedure.contenu); }}>Annuler</Bouton><Bouton variante="principal" disabled={action.enCours} onClick={() => void enregistrer()}>Enregistrer{procedure.statut === "approuvee" ? " (nouvelle version)" : ""}</Bouton></>}
      {mode === "lecture" && procedure.statut === "brouillon" && s.peut("nettoyage_procedures", 3) && <Bouton variante="principal" onClick={() => setSigner(true)}>Approuver (signature)</Bouton>}
      {mode === "lecture" && procedure.statut === "approuvee" && s.peut("nettoyage_procedures", 3) && <Bouton variante="danger" onClick={() => void action.executer(async () => { await s.depot.modifier("procedures_nettoyage", procedure.id, { statut: "perimee" }); onFermer(); })}>Déclarer périmée</Bouton>}
    </>}>
      <MessageErreur erreur={action.erreur} />
      {procedure.gabarit_ref && <div className="mb-3"><Bandeau ton="cuivre">Générée depuis le gabarit {libelleSecteur(procedure.gabarit_ref.secteur)} : point de départ à valider (FDS, validation du nettoyage).</Bandeau></div>}
      {procedure.statut === "approuvee" && mode === "edition" && <div className="mb-3"><Bandeau ton="attention">Enregistrer crée la version {procedure.version + 1} en brouillon, à faire approuver de nouveau.</Bandeau></div>}
      {mode === "lecture" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <VueContenu contenu={procedure.contenu} d={d} />
          <aside className="grid content-start gap-3">
            <Carte titre="Zones"><ul className="text-sm">{procedure.zones.map((id) => { const z = zonesSalle.find((x) => x.id === id); return <li key={id}>{z ? `${z.code} ${z.nom} — ${LIBELLES_TYPES_ZONES[z.type_zone]}` : "zone supprimée"}</li>; })}</ul></Carte>
            <Carte titre="Signatures (version courante)"><ListeSignatures signatures={sigVersion} /></Carte>
          </aside>
        </div>
      ) : (
        <div className="grid gap-4">
          <Champ libelle="Titre"><Saisie value={titre} onChange={(e) => setTitre(e.target.value)} /></Champ>
          <div>
            <div className="mb-1 text-xs font-semibold text-texte-2">Zones concernées</div>
            <div className="flex flex-wrap gap-3 text-sm">{zonesSalle.map((z) => <label key={z.id} className="flex items-center gap-1.5"><input type="checkbox" checked={zones.includes(z.id)} onChange={(e) => setZones(e.target.checked ? [...zones, z.id] : zones.filter((x) => x !== z.id))} />{z.code} {z.nom}</label>)}</div>
          </div>
          {contenu.frequences.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold text-texte-2">Fréquences</div>
              <div className="grid gap-2 md:grid-cols-2">
                {contenu.frequences.map((f, i) => (
                  <label key={f.surface} className="flex items-center gap-2 text-sm"><span className="flex-1">{SURFACES[f.surface]}</span>
                    <Liste aria-label={`Fréquence ${SURFACES[f.surface]}`} className="!w-56" value={f.frequence} onChange={(e) => setContenu({ ...contenu, frequences: contenu.frequences.map((x, j) => (j === i ? { ...x, frequence: e.target.value as CleFrequence } : x)) })}>
                      {Object.entries(FREQUENCES).map(([c, l]) => <option key={c} value={c}>{l}</option>)}
                    </Liste>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="mb-1 text-xs font-semibold text-texte-2">Étapes</div>
            <TableauDefilant>
              <table className="tableau">
                <thead><tr><th>#</th><th>Action</th><th>Surface</th><th>Technique</th><th>Produit</th><th>Consommable</th><th>Contact (min)</th><th /></tr></thead>
                <tbody>{contenu.etapes.map((e, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td className="min-w-64"><ZoneTexte aria-label={`Action ${i + 1}`} rows={2} value={e.action} onChange={(ev) => majEtape(i, { action: ev.target.value })} /></td>
                    <td><Liste aria-label="Surface" value={e.surface} onChange={(ev) => majEtape(i, { surface: ev.target.value as CleSurface })}>{Object.entries(SURFACES_ETAPES).map(([c, l]) => <option key={c} value={c}>{l}</option>)}</Liste></td>
                    <td><Liste aria-label="Technique" value={e.technique ?? ""} onChange={(ev) => majEtape(i, { technique: ev.target.value || null })}><option value="">—</option>{Object.values(TECHNIQUES).map((t) => <option key={t.cle} value={t.cle}>{t.libelle}</option>)}</Liste></td>
                    <td><Liste aria-label="Produit" value={e.produit ?? ""} onChange={(ev) => majEtape(i, { produit: ev.target.value || null, temps_contact_min: ev.target.value ? MODELES_PRODUITS[ev.target.value]?.temps_contact_min ?? null : null })}><option value="">—</option>{optionsProduits.map((p) => <option key={p.cle} value={p.cle}>{p.nom}</option>)}</Liste></td>
                    <td><Liste aria-label="Consommable" value={e.consommable ?? ""} onChange={(ev) => majEtape(i, { consommable: ev.target.value || null })}><option value="">—</option>{optionsConsommables.map((c) => <option key={c.cle} value={c.cle}>{c.nom}</option>)}</Liste></td>
                    <td className="w-24"><SaisieNombre aria-label="Temps de contact" valeur={e.temps_contact_min} onChange={(v) => majEtape(i, { temps_contact_min: v })} /></td>
                    <td className="whitespace-nowrap">
                      <Bouton variante="discret" disabled={i === 0} onClick={() => { const l = [...contenu.etapes]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; setContenu({ ...contenu, etapes: l }); }}>↑</Bouton>
                      <Bouton variante="discret" onClick={() => setContenu({ ...contenu, etapes: contenu.etapes.filter((_, j) => j !== i) })}>✕</Bouton>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </TableauDefilant>
            <Bouton className="mt-2" onClick={() => setContenu({ ...contenu, etapes: [...contenu.etapes, { ordre: contenu.etapes.length + 1, action: "", surface: "surfaces_travail", technique: "essuyage_s", produit: null, consommable: null, temps_contact_min: null }] })}>+ Étape</Bouton>
          </div>
          <Champ libelle="Produits et rotation"><ZoneTexte value={contenu.rotation} onChange={(e) => setContenu({ ...contenu, rotation: e.target.value })} /></Champ>
          <Champ libelle="Contrôles"><ZoneTexte value={contenu.controles} onChange={(e) => setContenu({ ...contenu, controles: e.target.value })} /></Champ>
        </div>
      )}
      {signer && (
        <ModaleSignature
          objetType="procedure" objetId={procedure.id} objet={`la procédure « ${procedure.titre} » version ${procedure.version}`} module="nettoyage_procedures" significations={["approuve"]}
          apres={async () => { await s.depot.modifier("procedures_nettoyage", procedure.id, { statut: "approuvee" }); }}
          onFermer={(ok) => { setSigner(false); rechargerSignatures(); if (ok) onFermer(); }}
        />
      )}
      <p className="mt-3 text-xs text-texte-2">Créée le {formatDate(procedure.cree_le)} · modifiée le {formatDate(procedure.modifie_le, true)}</p>
    </Modale>
  );
}
