import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useSession } from "../session";
import { Badge, Bandeau, Bouton, Carte, Champ, EnTete, Liste, MessageErreur, Saisie, SaisieNombre, TableauDefilant, ZoneTexte, useAction, useDonnees } from "../ui/composants";
import { genererZones, MENTION_POINT_DE_DEPART, type SelectionTypeZone } from "../domain/secteurs/generation";
import { LIBELLES_TYPES_ZONES, type Gabarit, type TypeZoneGabarit } from "../domain/secteurs/types";
import { GRADES_BPF, type GradeBpf } from "../domain/referentiels/gradesBpf";
import { libelleClasse } from "../domain/referentiels/classesIso";

const ETAPES = ["Emplacement", "Identité", "Secteur", "Zones", "Récapitulatif"] as const;
const NOUVEAU = "__nouveau__";

interface LigneSelection extends SelectionTypeZone {
  surcharge: Partial<TypeZoneGabarit>;
}

export function AssistantSalle() {
  const s = useSession();
  const org = s.org!.id;
  const naviguer = useNavigate();
  const [parametres] = useSearchParams();
  const action = useAction();
  const { donnees } = useDonnees(async () => {
    const [entreprises, sites] = await Promise.all([s.depot.lister("entreprises", org), s.depot.lister("sites", org)]);
    return { entreprises, sites };
  }, [org]);

  const [etape, setEtape] = useState(0);
  const [entrepriseId, setEntrepriseId] = useState("");
  const [nouvelleEntreprise, setNouvelleEntreprise] = useState({ nom: "", secteur: "" });
  const [siteId, setSiteId] = useState("");
  const [nouveauSite, setNouveauSite] = useState({ nom: "", adresse: "" });
  const [identite, setIdentite] = useState({ nom: "", batiment: "", etage: "", description: "" });
  const [gabaritCle, setGabaritCle] = useState("");
  const [lignes, setLignes] = useState<LigneSelection[]>([]);

  // Pré-sélection depuis « + Salle propre » d'un site.
  useEffect(() => {
    if (!donnees) return;
    const site = donnees.sites.find((x) => x.id === parametres.get("site"));
    if (site) { setEntrepriseId(site.entreprise_id); setSiteId(site.id); }
    else if (donnees.entreprises.length === 0) { setEntrepriseId(NOUVEAU); setSiteId(NOUVEAU); }
  }, [donnees, parametres]);

  const entreprise = donnees?.entreprises.find((e) => e.id === entrepriseId);
  const sitesEntreprise = donnees?.sites.filter((x) => x.entreprise_id === entrepriseId) ?? [];
  const secteurEntreprise = entrepriseId === NOUVEAU ? nouvelleEntreprise.secteur : entreprise?.secteur ?? "";
  const gabarit: Gabarit | undefined = s.gabarits.find((g) => g.cle === gabaritCle);

  const choisirGabarit = (g: Gabarit) => {
    setGabaritCle(g.cle);
    setLignes(g.typesZones.map((t) => ({ cleType: t.cle, quantite: t.parDefaut ? 1 : 0, surcharge: {} })));
  };

  // Le secteur de l'entreprise est proposé par défaut à l'étape 3.
  useEffect(() => {
    if (etape === 2 && !gabaritCle && secteurEntreprise) {
      const g = s.gabarits.find((x) => x.cle === secteurEntreprise);
      if (g) choisirGabarit(g);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etape]);

  const zones = useMemo(() => {
    if (!gabarit) return [];
    return genererZones(gabarit, lignes.filter((l) => l.quantite > 0).map((l) => ({
      cleType: l.cleType, quantite: l.quantite, surcharge: l.surcharge,
    })));
  }, [gabarit, lignes]);

  const etapeValide = [
    (entrepriseId === NOUVEAU ? !!nouvelleEntreprise.nom.trim() : !!entrepriseId)
      && (siteId === NOUVEAU ? !!nouveauSite.nom.trim() : !!siteId),
    !!identite.nom.trim(),
    !!gabarit,
    zones.length > 0,
    true,
  ];

  const modifierLigne = (cle: string, changement: Partial<LigneSelection>) =>
    setLignes((ls) => ls.map((l) => (l.cleType === cle ? { ...l, ...changement } : l)));
  const surcharger = (cle: string, champ: keyof TypeZoneGabarit, valeur: unknown) =>
    setLignes((ls) => ls.map((l) => (l.cleType === cle ? { ...l, surcharge: { ...l.surcharge, [champ]: valeur } } : l)));

  const creer = () => action.executer(async () => {
    let idEntreprise = entrepriseId;
    if (entrepriseId === NOUVEAU) {
      idEntreprise = (await s.depot.creer("entreprises", {
        org_id: org, nom: nouvelleEntreprise.nom.trim(), secteur: nouvelleEntreprise.secteur || gabarit!.cle, adresse: "", contact: "", notes: "",
      })).id;
      setEntrepriseId(idEntreprise);
    }
    let idSite = siteId;
    if (siteId === NOUVEAU) {
      idSite = (await s.depot.creer("sites", { org_id: org, entreprise_id: idEntreprise, nom: nouveauSite.nom.trim(), adresse: nouveauSite.adresse })).id;
      setSiteId(idSite);
    }
    const id = await s.depot.creerSalleAvecZones(
      {
        org_id: org, site_id: idSite, nom: identite.nom.trim(), batiment: identite.batiment, etage: identite.etage,
        description: identite.description, secteur: gabarit!.natif ? gabarit!.cle : gabarit!.baseSur?.cle ?? gabarit!.cle,
        gabarit_cle: gabarit!.cle, gabarit_version: gabarit!.version,
      },
      zones,
    );
    naviguer(`/salles/${id}`);
  });

  if (!s.peut("installations", 2)) return <Bandeau ton="attention">Votre rôle ne permet pas de créer une salle propre.</Bandeau>;

  return (
    <>
      <EnTete titre="Nouvelle salle propre" sousTitre="Le secteur choisi pré-remplit les zones types et leurs exigences. Tout reste modifiable." />
      <ol className="mb-5 flex flex-wrap gap-2">
        {ETAPES.map((nom, i) => (
          <li key={nom}>
            <button
              type="button"
              disabled={i > etape && !etapeValide.slice(0, i).every(Boolean)}
              onClick={() => setEtape(i)}
              className={`rounded-full border px-3 py-1 text-sm ${i === etape ? "border-navy-700 bg-navy-700 text-white" : i < etape ? "border-navy-100 bg-navy-050 text-navy-700" : "border-bord bg-white text-texte-2"} disabled:opacity-50`}
            >
              {i + 1}. {nom}
            </button>
          </li>
        ))}
      </ol>
      <MessageErreur erreur={action.erreur} />

      {etape === 0 && (
        <Carte titre="Où se trouve la salle propre ?">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-3">
              <Champ libelle="Entreprise">
                <Liste value={entrepriseId} onChange={(e) => { setEntrepriseId(e.target.value); setSiteId(e.target.value === NOUVEAU ? NOUVEAU : ""); }}>
                  <option value="">— Choisir —</option>
                  {donnees?.entreprises.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
                  <option value={NOUVEAU}>+ Nouvelle entreprise…</option>
                </Liste>
              </Champ>
              {entrepriseId === NOUVEAU && (
                <>
                  <Champ libelle="Nom de la nouvelle entreprise"><Saisie value={nouvelleEntreprise.nom} onChange={(e) => setNouvelleEntreprise({ ...nouvelleEntreprise, nom: e.target.value })} /></Champ>
                  <Champ libelle="Secteur d'activité">
                    <Liste value={nouvelleEntreprise.secteur} onChange={(e) => setNouvelleEntreprise({ ...nouvelleEntreprise, secteur: e.target.value })}>
                      <option value="">— Choisir à l'étape Secteur —</option>
                      {s.gabarits.filter((g) => g.natif).map((g) => <option key={g.cle} value={g.cle}>{g.libelle}</option>)}
                    </Liste>
                  </Champ>
                </>
              )}
            </div>
            <div className="grid content-start gap-3">
              <Champ libelle="Site">
                <Liste value={siteId} disabled={!entrepriseId} onChange={(e) => setSiteId(e.target.value)}>
                  <option value="">— Choisir —</option>
                  {sitesEntreprise.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
                  <option value={NOUVEAU}>+ Nouveau site…</option>
                </Liste>
              </Champ>
              {siteId === NOUVEAU && (
                <>
                  <Champ libelle="Nom du nouveau site"><Saisie value={nouveauSite.nom} onChange={(e) => setNouveauSite({ ...nouveauSite, nom: e.target.value })} /></Champ>
                  <Champ libelle="Adresse"><Saisie value={nouveauSite.adresse} onChange={(e) => setNouveauSite({ ...nouveauSite, adresse: e.target.value })} /></Champ>
                </>
              )}
            </div>
          </div>
        </Carte>
      )}

      {etape === 1 && (
        <Carte titre="Identité de la salle propre">
          <div className="grid gap-3 md:grid-cols-3">
            <Champ libelle="Nom" className="md:col-span-3"><Saisie autoFocus value={identite.nom} onChange={(e) => setIdentite({ ...identite, nom: e.target.value })} placeholder="ex. Salle propre assemblage" /></Champ>
            <Champ libelle="Bâtiment"><Saisie value={identite.batiment} onChange={(e) => setIdentite({ ...identite, batiment: e.target.value })} /></Champ>
            <Champ libelle="Étage"><Saisie value={identite.etage} onChange={(e) => setIdentite({ ...identite, etage: e.target.value })} /></Champ>
            <Champ libelle="Description" className="md:col-span-3"><ZoneTexte value={identite.description} onChange={(e) => setIdentite({ ...identite, description: e.target.value })} placeholder="Activité, produits, contraintes particulières…" /></Champ>
          </div>
        </Carte>
      )}

      {etape === 2 && (
        <div className="grid gap-3 md:grid-cols-2">
          {s.gabarits.map((g) => (
            <button
              key={g.cle}
              type="button"
              onClick={() => choisirGabarit(g)}
              aria-pressed={g.cle === gabaritCle}
              className={`rounded-xl border bg-white p-4 text-left shadow-sm transition ${g.cle === gabaritCle ? "border-cuivre-500 ring-2 ring-cuivre-050" : "border-bord hover:border-navy-600"}`}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-semibold">{g.libelle}</span>
                {!g.natif && <Badge ton="info">Gabarit d'entreprise</Badge>}
                {g.cle === secteurEntreprise && <Badge ton="cuivre">Secteur de l'entreprise</Badge>}
                <span className="ml-auto text-xs text-texte-2">v{g.version}</span>
              </div>
              <p className="mb-2 text-sm text-texte-2">{g.description}</p>
              <div className="mb-2 flex flex-wrap gap-1">{g.referentiels.map((r) => <Badge key={r}>{r}</Badge>)}</div>
              <ul className="list-disc pl-5 text-xs text-texte-2">{g.specificites.map((x) => <li key={x}>{x}</li>)}</ul>
            </button>
          ))}
        </div>
      )}

      {etape === 3 && gabarit && (
        <Carte titre={`Zones proposées — ${gabarit.libelle}`}>
          <Bandeau ton="cuivre">{MENTION_POINT_DE_DEPART} Les quantités à 0 ne sont pas créées.</Bandeau>
          <div className="mt-3">
            <TableauDefilant>
              <table className="tableau">
                <thead><tr><th>Qté</th><th>Zone type</th><th>Type</th><th>ISO repos</th><th>ISO activité</th>{gabarit.vocabulaire === "grade" && <th>Grade</th>}<th>Pression (Pa)</th></tr></thead>
                <tbody>
                  {lignes.map((l) => {
                    const t = { ...gabarit.typesZones.find((x) => x.cle === l.cleType)!, ...l.surcharge };
                    return (
                      <tr key={l.cleType} className={l.quantite === 0 ? "opacity-50" : ""}>
                        <td className="w-20"><SaisieNombre aria-label={`Quantité ${t.libelle}`} valeur={l.quantite} onChange={(v) => modifierLigne(l.cleType, { quantite: Math.max(0, Math.min(20, Math.floor(v ?? 0))) })} /></td>
                        <td className="min-w-56"><Saisie aria-label="Libellé" value={t.libelle} onChange={(e) => surcharger(l.cleType, "libelle", e.target.value)} /></td>
                        <td className="whitespace-nowrap text-texte-2">{LIBELLES_TYPES_ZONES[t.type]}</td>
                        <td className="w-24"><SaisieNombre aria-label="Classe ISO au repos" valeur={t.isoAuRepos} onChange={(v) => surcharger(l.cleType, "isoAuRepos", v)} /></td>
                        <td className="w-24"><SaisieNombre aria-label="Classe ISO en activité" valeur={t.isoEnActivite} onChange={(v) => surcharger(l.cleType, "isoEnActivite", v)} /></td>
                        {gabarit.vocabulaire === "grade" && (
                          <td className="w-24">
                            <Liste aria-label="Grade BPF" value={t.gradeBpf ?? ""} onChange={(e) => surcharger(l.cleType, "gradeBpf", (e.target.value || null) as GradeBpf | null)}>
                              <option value="">—</option>
                              {GRADES_BPF.map((g) => <option key={g} value={g}>{g}</option>)}
                            </Liste>
                          </td>
                        )}
                        <td className="w-24"><SaisieNombre aria-label="Pression" valeur={t.pressionPa ?? null} onChange={(v) => surcharger(l.cleType, "pressionPa", v)} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableauDefilant>
          </div>
          <p className="mt-3 text-sm text-texte-2">{zones.length} zone(s) seront créées. Surfaces, hauteurs et autres consignes se complètent ensuite dans la fiche de la salle.</p>
        </Carte>
      )}

      {etape === 4 && gabarit && (
        <Carte titre="Récapitulatif">
          <dl className="mb-4 grid gap-x-6 gap-y-1 text-sm md:grid-cols-[max-content_1fr]">
            <dt className="text-texte-2">Entreprise</dt><dd>{entrepriseId === NOUVEAU ? `${nouvelleEntreprise.nom} (nouvelle)` : entreprise?.nom}</dd>
            <dt className="text-texte-2">Site</dt><dd>{siteId === NOUVEAU ? `${nouveauSite.nom} (nouveau)` : donnees?.sites.find((x) => x.id === siteId)?.nom}</dd>
            <dt className="text-texte-2">Salle propre</dt><dd>{identite.nom}{identite.batiment && ` — bâtiment ${identite.batiment}`}{identite.etage && `, ${identite.etage}`}</dd>
            <dt className="text-texte-2">Gabarit</dt><dd>{gabarit.libelle} v{gabarit.version}</dd>
          </dl>
          <ul className="divide-y divide-bord rounded-lg border border-bord text-sm">
            {zones.map((z) => (
              <li key={z.code} className="flex flex-wrap items-center gap-2 px-3 py-1.5">
                <span className="w-10 font-mono text-xs text-texte-2">{z.code}</span>
                <span className="flex-1">{z.nom}</span>
                <Badge ton="info">{libelleClasse(z.iso_repos)} repos</Badge>
                {z.iso_activite != null && <Badge>{libelleClasse(z.iso_activite)} activité</Badge>}
                {z.grade_bpf && <Badge ton="cuivre">Grade {z.grade_bpf}</Badge>}
                {z.zone_risque && <Badge ton="cuivre">Zone {z.zone_risque}</Badge>}
                {z.pression_pa != null && <span className="text-xs text-texte-2">{z.pression_pa} Pa</span>}
              </li>
            ))}
          </ul>
        </Carte>
      )}

      <div className="mt-5 flex justify-between">
        <Bouton onClick={() => (etape === 0 ? naviguer("/salles") : setEtape(etape - 1))}>{etape === 0 ? "Annuler" : "← Précédent"}</Bouton>
        {etape < ETAPES.length - 1 ? (
          <Bouton variante="principal" disabled={!etapeValide[etape]} onClick={() => setEtape(etape + 1)}>Suivant →</Bouton>
        ) : (
          <Bouton variante="principal" disabled={action.enCours} onClick={() => void creer()}>Créer la salle propre</Bouton>
        )}
      </div>
    </>
  );
}
