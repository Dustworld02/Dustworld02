import { useEffect, useState } from "react";
import { useSession } from "../session";
import type { Gabarit, TypeZoneGabarit, TypeZone } from "../domain/secteurs/types";
import { LIBELLES_TYPES_ZONES } from "../domain/secteurs/types";
import { versionSuivante } from "../domain/secteurs/generation";
import { LIBELLES_NIVEAUX, MODULES, type Niveau } from "../domain/permissions";
import { GRADES_BPF, type GradeBpf } from "../domain/referentiels/gradesBpf";
import { libelleClasse } from "../domain/referentiels/classesIso";
import { TABLES_EXPORTEES } from "../data/types";
import { DepotDemo, type EtatDemo } from "../data/depotDemo";
import { Badge, Bandeau, Bouton, Carte, Champ, EnTete, Liste, MessageErreur, Modale, Onglets, Saisie, SaisieNombre, TableauDefilant, formatDate, telechargerFichier, useAction, useDonnees } from "../ui/composants";

type Onglet = "organisation" | "utilisateurs" | "droits" | "gabarits" | "sauvegarde";

export function Configuration() {
  const s = useSession();
  const voirConfig = s.peut("configuration", 1);
  const onglets = [
    voirConfig && { cle: "organisation" as const, libelle: "Organisation" },
    voirConfig && { cle: "utilisateurs" as const, libelle: "Utilisateurs" },
    voirConfig && { cle: "droits" as const, libelle: "Rôles et droits" },
    s.peut("gabarits", 1) && { cle: "gabarits" as const, libelle: "Secteurs et gabarits" },
    s.peut("configuration", 4) && { cle: "sauvegarde" as const, libelle: "Sauvegarde" },
  ].filter((o): o is { cle: Onglet; libelle: string } => !!o);
  const [onglet, setOnglet] = useState<Onglet>(onglets[0]?.cle ?? "gabarits");
  return (
    <>
      <EnTete titre="Configuration" sousTitre={s.peut("configuration", 4) ? "Paramètres de l'organisation, utilisateurs et droits d'accès." : "Consultation des paramètres (modification réservée à l'administration)."} />
      <Onglets onglets={onglets} actif={onglet} onChange={setOnglet} />
      {onglet === "organisation" && <OngletOrganisation />}
      {onglet === "utilisateurs" && <OngletUtilisateurs />}
      {onglet === "droits" && <OngletDroits />}
      {onglet === "gabarits" && <OngletGabarits />}
      {onglet === "sauvegarde" && <OngletSauvegarde />}
    </>
  );
}

function OngletOrganisation() {
  const s = useSession();
  const [nom, setNom] = useState(s.org!.nom);
  const action = useAction();
  const admin = s.peut("configuration", 4);
  return (
    <Carte titre="Organisation">
      <MessageErreur erreur={action.erreur} />
      <div className="flex flex-wrap items-end gap-3">
        <Champ libelle="Nom" className="min-w-72 flex-1"><Saisie disabled={!admin} value={nom} onChange={(e) => setNom(e.target.value)} /></Champ>
        {admin && <Bouton variante="principal" disabled={action.enCours || !nom.trim() || nom === s.org!.nom} onClick={() => void action.executer(async () => { await s.depot.renommerOrganisation(s.org!.id, nom); await s.rafraichir(); })}>Enregistrer</Bouton>}
      </div>
      <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-texte-2">Créée le</dt><dd>{formatDate(s.org!.cree_le)}</dd>
        <dt className="text-texte-2">Membres</dt><dd>{s.membres.length}</dd>
        <dt className="text-texte-2">Stockage des données</dt><dd>{s.depot.mode === "demo" ? "Ce navigateur (démonstration)" : "Base Supabase hébergée"}</dd>
      </dl>
    </Carte>
  );
}

function SelecteurSites({ valeur, onChange, sites, desactive }: { valeur: string[] | null; onChange: (v: string[] | null) => void; sites: { id: string; nom: string }[]; desactive?: boolean }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label className="flex items-center gap-2"><input type="checkbox" disabled={desactive} checked={valeur === null} onChange={(e) => onChange(e.target.checked ? null : [])} /> Tous les sites</label>
      {valeur !== null && sites.map((x) => (
        <label key={x.id} className="flex items-center gap-2 pl-5">
          <input type="checkbox" disabled={desactive} checked={valeur.includes(x.id)} onChange={(e) => onChange(e.target.checked ? [...valeur, x.id] : valeur.filter((v) => v !== x.id))} /> {x.nom}
        </label>
      ))}
    </div>
  );
}

function OngletUtilisateurs() {
  const s = useSession();
  const org = s.org!.id;
  const admin = s.peut("configuration", 4);
  const { donnees, recharger } = useDonnees(async () => {
    const [invitations, sites] = await Promise.all([s.depot.lister("invitations", org), s.peut("installations", 1) ? s.depot.lister("sites", org) : []]);
    return { invitations, sites };
  }, [org]);
  const [invitation, setInvitation] = useState<{ email: string; nom_complet: string; role_id: string; sites: string[] | null } | null>(null);
  const action = useAction();
  const sites = donnees?.sites ?? [];
  const roleLecteur = s.roles.find((r) => r.cle === "lecteur")?.id ?? s.roles[0]?.id ?? "";

  const modifierMembre = (id: string, valeurs: Parameters<typeof s.depot.modifier<"membres">>[2]) =>
    action.executer(async () => { await s.depot.modifier("membres", id, valeurs); await s.rafraichir(); });

  return (
    <div className="grid gap-4">
      <MessageErreur erreur={invitation ? null : action.erreur} />
      <Carte titre="Membres" actions={admin && <Bouton variante="principal" onClick={() => { action.effacer(); setInvitation({ email: "", nom_complet: "", role_id: roleLecteur, sites: null }); }}>+ Inviter un utilisateur</Bouton>}>
        <TableauDefilant>
          <table className="tableau">
            <thead><tr><th>Utilisateur</th><th>Rôle</th><th>Périmètre</th><th>Statut</th></tr></thead>
            <tbody>
              {s.membres.map((m) => {
                const p = s.profils.find((x) => x.id === m.user_id);
                const moi = m.user_id === s.utilisateur?.id;
                return (
                  <tr key={m.id}>
                    <td>{p?.nom_complet || "—"}{moi && <Badge ton="info">vous</Badge>}<div className="text-xs text-texte-2">{p?.email}</div></td>
                    <td className="w-64">
                      <Liste aria-label="Rôle" disabled={!admin || action.enCours} value={m.role_id} onChange={(e) => void modifierMembre(m.id, { role_id: e.target.value })}>
                        {s.roles.map((r) => <option key={r.id} value={r.id}>{r.libelle}</option>)}
                      </Liste>
                    </td>
                    <td><SelecteurSites desactive={!admin || action.enCours} valeur={m.sites} sites={sites} onChange={(v) => void modifierMembre(m.id, { sites: v })} /></td>
                    <td>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!admin || action.enCours} checked={m.actif} onChange={(e) => void modifierMembre(m.id, { actif: e.target.checked })} /> Actif</label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableauDefilant>
        <p className="mt-2 text-xs text-texte-2">Un membre désactivé perd immédiatement tout accès ; son historique reste dans le journal. L'organisation garde toujours au moins un administrateur actif.</p>
      </Carte>

      <Carte titre="Invitations">
        {(donnees?.invitations ?? []).length === 0 ? <p className="text-sm text-texte-2">Aucune invitation.</p> : (
          <TableauDefilant>
            <table className="tableau">
              <thead><tr><th>Adresse</th><th>Rôle</th><th>Envoyée le</th><th>Statut</th><th /></tr></thead>
              <tbody>{donnees!.invitations.map((i) => (
                <tr key={i.id}>
                  <td>{i.email}<div className="text-xs text-texte-2">{i.nom_complet}</div></td>
                  <td>{s.roles.find((r) => r.id === i.role_id)?.libelle}</td>
                  <td>{formatDate(i.cree_le)}</td>
                  <td>{i.acceptee_le ? <Badge ton="ok">Acceptée le {formatDate(i.acceptee_le)}</Badge> : <Badge ton="attention">En attente</Badge>}</td>
                  <td>{admin && !i.acceptee_le && <Bouton variante="discret" onClick={() => void action.executer(async () => { await s.depot.supprimer("invitations", i.id); recharger(); })}>Annuler</Bouton>}</td>
                </tr>
              ))}</tbody>
            </table>
          </TableauDefilant>
        )}
        <p className="mt-2 text-xs text-texte-2">
          {s.depot.mode === "demo"
            ? "Démonstration : la personne invitée se connecte avec cette adresse et le mot de passe de son choix, son compte est créé à la première connexion."
            : "La personne crée son compte avec cette adresse (ou se connecte si elle en a déjà un) : elle est rattachée à l'organisation dès sa connexion. Envoyez-lui le lien de l'application."}
        </p>
      </Carte>

      {invitation && (
        <Modale
          titre="Inviter un utilisateur"
          onFermer={() => setInvitation(null)}
          pied={<><Bouton onClick={() => setInvitation(null)}>Annuler</Bouton><Bouton variante="principal" disabled={action.enCours || !/^\S+@\S+\.\S+$/.test(invitation.email)} onClick={() => void action.executer(async () => {
            await s.depot.creer("invitations", { org_id: org, email: invitation.email.trim().toLowerCase(), nom_complet: invitation.nom_complet.trim(), role_id: invitation.role_id, sites: invitation.sites, acceptee_le: null });
            setInvitation(null);
            recharger();
          })}>Inviter</Bouton></>}
        >
          <MessageErreur erreur={action.erreur} />
          <div className="grid gap-3">
            <Champ libelle="Adresse e-mail"><Saisie type="email" autoFocus value={invitation.email} onChange={(e) => setInvitation({ ...invitation, email: e.target.value })} /></Champ>
            <Champ libelle="Nom complet"><Saisie value={invitation.nom_complet} onChange={(e) => setInvitation({ ...invitation, nom_complet: e.target.value })} /></Champ>
            <Champ libelle="Rôle">
              <Liste value={invitation.role_id} onChange={(e) => setInvitation({ ...invitation, role_id: e.target.value })}>
                {s.roles.map((r) => <option key={r.id} value={r.id}>{r.libelle} — {r.description}</option>)}
              </Liste>
            </Champ>
            <Champ libelle="Périmètre"><SelecteurSites valeur={invitation.sites} sites={sites} onChange={(v) => setInvitation({ ...invitation, sites: v })} /></Champ>
          </div>
        </Modale>
      )}
    </div>
  );
}

function OngletDroits() {
  const s = useSession();
  const org = s.org!.id;
  const admin = s.peut("configuration", 4);
  const valeursInitiales = () => {
    const v: Record<string, number> = {};
    for (const d of s.droits) v[`${d.role_id}|${d.module}`] = d.niveau;
    return v;
  };
  const [valeurs, setValeurs] = useState<Record<string, number>>(valeursInitiales);
  const [nouveauRole, setNouveauRole] = useState<{ libelle: string; modele: string } | null>(null);
  const action = useAction();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setValeurs(valeursInitiales()), [s.droits]);

  const niveauDe = (roleId: string, module: string) => valeurs[`${roleId}|${module}`] ?? 0;
  const modifies = Object.entries(valeurs).filter(([cle, n]) => {
    const [roleId, module] = cle.split("|");
    return (s.droits.find((d) => d.role_id === roleId && d.module === module)?.niveau ?? 0) !== n;
  });

  const enregistrer = () => action.executer(async () => {
    for (const [cle, niveau] of modifies) {
      const [roleId, module] = cle.split("|");
      const existant = s.droits.find((d) => d.role_id === roleId && d.module === module);
      if (existant) await s.depot.modifier("droits_roles", existant.id, { niveau });
      else await s.depot.creer("droits_roles", { org_id: org, role_id: roleId, module, niveau });
    }
    await s.rafraichir();
  });

  const creerRole = () => action.executer(async () => {
    const libelle = nouveauRole!.libelle.trim();
    const cle = libelle.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const role = await s.depot.creer("roles", { org_id: org, cle: `perso_${cle}`, libelle, description: "Rôle personnalisé", systeme: false });
    await s.depot.creerPlusieurs("droits_roles", MODULES.map((m) => ({ org_id: org, role_id: role.id, module: m.cle, niveau: niveauDe(nouveauRole!.modele, m.cle) })));
    setNouveauRole(null);
    await s.rafraichir();
  });

  const roleAdmin = s.roles.find((r) => r.cle === "admin");

  return (
    <Carte
      titre="Matrice des droits"
      actions={admin && <>
        <Bouton onClick={() => { action.effacer(); setNouveauRole({ libelle: "", modele: s.roles.find((r) => r.cle === "lecteur")?.id ?? "" }); }}>+ Rôle personnalisé</Bouton>
        <Bouton variante="discret" disabled={modifies.length === 0} onClick={() => setValeurs(valeursInitiales())}>Annuler</Bouton>
        <Bouton variante="principal" disabled={action.enCours || modifies.length === 0} onClick={() => void enregistrer()}>Enregistrer {modifies.length > 0 && `(${modifies.length})`}</Bouton>
      </>}
    >
      <MessageErreur erreur={nouveauRole ? null : action.erreur} />
      <p className="mb-3 text-sm text-texte-2">
        {Object.entries(LIBELLES_NIVEAUX).map(([n, l]) => <span key={n} className="mr-4"><strong>{l.court}</strong> {l.long}</span>)}
      </p>
      <TableauDefilant>
        <table className="tableau">
          <thead>
            <tr><th>Module</th>{s.roles.map((r) => <th key={r.id} className="min-w-20 max-w-28 !whitespace-normal text-center align-bottom" title={r.description}>{r.libelle}</th>)}</tr>
          </thead>
          <tbody>
            {MODULES.map((m) => (
              <tr key={m.cle}>
                <td className="whitespace-nowrap">{m.libelle}{m.phase > 1 && <span className="ml-1 text-xs text-texte-2">(phase {m.phase})</span>}</td>
                {s.roles.map((r) => {
                  const n = niveauDe(r.id, m.cle) as Niveau;
                  const verrouille = !admin || r.id === roleAdmin?.id;
                  return (
                    <td key={r.id} className="text-center">
                      <select
                        aria-label={`${m.libelle} — ${r.libelle}`}
                        disabled={verrouille}
                        value={n}
                        onChange={(e) => setValeurs({ ...valeurs, [`${r.id}|${m.cle}`]: Number(e.target.value) })}
                        className={`rounded border px-1 py-0.5 text-xs ${n === 0 ? "border-bord text-texte-2" : n >= 3 ? "border-cuivre-400 bg-cuivre-050" : "border-navy-100 bg-navy-050"}`}
                      >
                        {Object.entries(LIBELLES_NIVEAUX).map(([v, l]) => <option key={v} value={v}>{l.court}</option>)}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </TableauDefilant>
      <p className="mt-2 text-xs text-texte-2">La colonne Administrateur est verrouillée pour éviter de perdre l'accès à la configuration. Les droits sont appliqués par la base de données, pas seulement par l'interface.</p>

      {nouveauRole && (
        <Modale
          titre="Nouveau rôle personnalisé"
          onFermer={() => setNouveauRole(null)}
          pied={<><Bouton onClick={() => setNouveauRole(null)}>Annuler</Bouton><Bouton variante="principal" disabled={action.enCours || !nouveauRole.libelle.trim()} onClick={() => void creerRole()}>Créer</Bouton></>}
        >
          <MessageErreur erreur={action.erreur} />
          <div className="grid gap-3">
            <Champ libelle="Nom du rôle"><Saisie autoFocus value={nouveauRole.libelle} onChange={(e) => setNouveauRole({ ...nouveauRole, libelle: e.target.value })} placeholder="ex. Prestataire de nettoyage" /></Champ>
            <Champ libelle="Droits de départ copiés depuis">
              <Liste value={nouveauRole.modele} onChange={(e) => setNouveauRole({ ...nouveauRole, modele: e.target.value })}>
                {s.roles.map((r) => <option key={r.id} value={r.id}>{r.libelle}</option>)}
              </Liste>
            </Champ>
          </div>
        </Modale>
      )}
    </Carte>
  );
}

function OngletGabarits() {
  const s = useSession();
  const org = s.org!.id;
  const [ouvert, setOuvert] = useState<Gabarit | null>(null);
  const [edition, setEdition] = useState<Gabarit | null>(null);
  const action = useAction();
  const ecriture = s.peut("gabarits", 2);

  const dupliquer = (g: Gabarit) => action.executer(async () => {
    let cle = `org_${g.cle}`;
    let n = 2;
    while (s.gabarits.some((x) => x.cle === cle)) cle = `org_${g.cle}_${n++}`;
    const copie: Gabarit = { ...structuredClone(g), cle, version: "1.0.0", libelle: `${g.libelle} (copie)`, natif: false, baseSur: { cle: g.cle, version: g.version } };
    await s.depot.creer("gabarits_org", { org_id: org, cle: copie.cle, version: copie.version, libelle: copie.libelle, donnees: copie });
    await s.rafraichir();
    setEdition(copie);
  });

  const enregistrer = () => action.executer(async () => {
    const ligne = s.gabaritsOrg.find((x) => x.cle === edition!.cle)!;
    const precedent = ligne.donnees as Gabarit;
    const version = JSON.stringify({ ...precedent, version: "" }) === JSON.stringify({ ...edition!, version: "" }) ? precedent.version : versionSuivante(precedent.version);
    const g = { ...edition!, version };
    await s.depot.modifier("gabarits_org", ligne.id, { libelle: g.libelle, version, donnees: g });
    await s.rafraichir();
    setEdition(null);
  });

  const supprimer = (g: Gabarit) => {
    const ligne = s.gabaritsOrg.find((x) => x.cle === g.cle);
    if (!ligne || !window.confirm(`Supprimer le gabarit « ${g.libelle} » ? Les salles déjà créées ne sont pas modifiées.`)) return;
    void action.executer(async () => { await s.depot.supprimer("gabarits_org", ligne.id); await s.rafraichir(); });
  };

  return (
    <div className="grid gap-4">
      <Bandeau ton="cuivre">Un gabarit est un point de départ : il pré-remplit une nouvelle salle propre selon le secteur, sans valeur de procédure validée. Les gabarits livrés ne sont pas modifiables ; dupliquez-les pour les adapter.</Bandeau>
      <MessageErreur erreur={edition ? null : action.erreur} />
      <Carte titre="Gabarits disponibles">
        <TableauDefilant>
          <table className="tableau">
            <thead><tr><th>Gabarit</th><th>Origine</th><th className="nombre">Zones types</th><th>Version</th><th /></tr></thead>
            <tbody>{s.gabarits.map((g) => (
              <tr key={g.cle}>
                <td><button type="button" className="text-left font-medium text-navy-700 hover:underline" onClick={() => setOuvert(g)}>{g.libelle}</button><div className="text-xs text-texte-2">{g.referentiels.join(" · ")}</div></td>
                <td>{g.natif ? <Badge>Livré avec l'outil</Badge> : <Badge ton="info">Entreprise{g.baseSur ? ` (base ${g.baseSur.cle})` : ""}</Badge>}</td>
                <td className="nombre">{g.typesZones.length}</td>
                <td>v{g.version}</td>
                <td className="whitespace-nowrap">
                  {ecriture && <Bouton variante="discret" onClick={() => void dupliquer(g)}>Dupliquer</Bouton>}
                  {ecriture && !g.natif && <Bouton variante="discret" onClick={() => { action.effacer(); setEdition(structuredClone(g)); }}>Modifier</Bouton>}
                  {s.peut("gabarits", 3) && !g.natif && <Bouton variante="danger" onClick={() => supprimer(g)}>Supprimer</Bouton>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </TableauDefilant>
        <p className="mt-2 text-xs text-texte-2">Phase 1 : les gabarits portent les zones types et leurs classes. Les procédures de nettoyage (lingettes, produits, techniques, fréquences), l'habillage et les plans d'échantillonnage s'y ajouteront avec leurs modules.</p>
      </Carte>

      {ouvert && (
        <Modale large titre={`${ouvert.libelle} — v${ouvert.version}`} onFermer={() => setOuvert(null)}>
          <p className="mb-2 text-sm">{ouvert.description}</p>
          <ul className="mb-3 list-disc pl-5 text-sm text-texte-2">{ouvert.specificites.map((x) => <li key={x}>{x}</li>)}</ul>
          <TableauDefilant>
            <table className="tableau">
              <thead><tr><th>Zone type</th><th>Type</th><th>Classification</th><th className="nombre">Pression</th><th>Cochée par défaut</th></tr></thead>
              <tbody>{ouvert.typesZones.map((t) => (
                <tr key={t.cle}>
                  <td>{t.libelle}</td>
                  <td className="text-texte-2">{LIBELLES_TYPES_ZONES[t.type]}</td>
                  <td>{libelleClasse(t.isoAuRepos)} / {libelleClasse(t.isoEnActivite)}{t.gradeBpf && ` · grade ${t.gradeBpf}`}{t.zoneRisque && ` · zone ${t.zoneRisque}`}</td>
                  <td className="nombre">{t.pressionPa != null ? `${t.pressionPa} Pa` : "—"}</td>
                  <td>{t.parDefaut ? "Oui" : "Non"}</td>
                </tr>
              ))}</tbody>
            </table>
          </TableauDefilant>
        </Modale>
      )}

      {edition && <EditeurGabarit gabarit={edition} setGabarit={setEdition} erreur={action.erreur} enCours={action.enCours} onEnregistrer={() => void enregistrer()} />}
    </div>
  );
}

function EditeurGabarit({ gabarit, setGabarit, erreur, enCours, onEnregistrer }: { gabarit: Gabarit; setGabarit: (g: Gabarit | null) => void; erreur: string | null; enCours: boolean; onEnregistrer: () => void }) {
  const majType = (i: number, champ: Partial<TypeZoneGabarit>) =>
    setGabarit({ ...gabarit, typesZones: gabarit.typesZones.map((t, j) => (j === i ? { ...t, ...champ } : t)) });
  const ajouter = () => {
    let n = gabarit.typesZones.length + 1;
    while (gabarit.typesZones.some((t) => t.cle === `zone_${n}`)) n++;
    setGabarit({ ...gabarit, typesZones: [...gabarit.typesZones, { cle: `zone_${n}`, libelle: "Nouvelle zone", type: "salle", isoAuRepos: 8, isoEnActivite: null, parDefaut: true }] });
  };
  return (
    <Modale
      large
      titre={`Modifier le gabarit — v${gabarit.version}`}
      onFermer={() => setGabarit(null)}
      pied={<><Bouton onClick={() => setGabarit(null)}>Annuler</Bouton><Bouton variante="principal" disabled={enCours || !gabarit.libelle.trim() || gabarit.typesZones.length === 0} onClick={onEnregistrer}>Enregistrer (nouvelle version)</Bouton></>}
    >
      <MessageErreur erreur={erreur} />
      <div className="mb-3 grid gap-3 md:grid-cols-2">
        <Champ libelle="Nom"><Saisie value={gabarit.libelle} onChange={(e) => setGabarit({ ...gabarit, libelle: e.target.value })} /></Champ>
        <Champ libelle="Description"><Saisie value={gabarit.description} onChange={(e) => setGabarit({ ...gabarit, description: e.target.value })} /></Champ>
      </div>
      <TableauDefilant>
        <table className="tableau">
          <thead><tr><th>Défaut</th><th>Libellé</th><th>Type</th><th>ISO repos</th><th>ISO activité</th><th>Grade</th><th>Pression</th><th /></tr></thead>
          <tbody>{gabarit.typesZones.map((t, i) => (
            <tr key={t.cle}>
              <td className="text-center"><input type="checkbox" aria-label="Cochée par défaut" checked={t.parDefaut} onChange={(e) => majType(i, { parDefaut: e.target.checked })} /></td>
              <td className="min-w-48"><Saisie aria-label="Libellé" value={t.libelle} onChange={(e) => majType(i, { libelle: e.target.value })} /></td>
              <td><Liste aria-label="Type" value={t.type} onChange={(e) => majType(i, { type: e.target.value as TypeZone })}>{Object.entries(LIBELLES_TYPES_ZONES).map(([c, l]) => <option key={c} value={c}>{l}</option>)}</Liste></td>
              <td className="w-20"><SaisieNombre aria-label="ISO repos" valeur={t.isoAuRepos} onChange={(v) => majType(i, { isoAuRepos: v })} /></td>
              <td className="w-20"><SaisieNombre aria-label="ISO activité" valeur={t.isoEnActivite} onChange={(v) => majType(i, { isoEnActivite: v })} /></td>
              <td className="w-20"><Liste aria-label="Grade" value={t.gradeBpf ?? ""} onChange={(e) => majType(i, { gradeBpf: (e.target.value || null) as GradeBpf | null })}><option value="">—</option>{GRADES_BPF.map((g) => <option key={g} value={g}>{g}</option>)}</Liste></td>
              <td className="w-20"><SaisieNombre aria-label="Pression" valeur={t.pressionPa ?? null} onChange={(v) => majType(i, { pressionPa: v })} /></td>
              <td><Bouton variante="discret" onClick={() => setGabarit({ ...gabarit, typesZones: gabarit.typesZones.filter((_, j) => j !== i) })}>Retirer</Bouton></td>
            </tr>
          ))}</tbody>
        </table>
      </TableauDefilant>
      <Bouton className="mt-2" onClick={ajouter}>+ Zone type</Bouton>
      <p className="mt-2 text-xs text-texte-2">Chaque enregistrement crée une nouvelle version. Les salles déjà créées gardent la référence de la version qui les a générées.</p>
    </Modale>
  );
}

function OngletSauvegarde() {
  const s = useSession();
  const org = s.org!.id;
  const action = useAction();
  const demo = s.depot instanceof DepotDemo ? s.depot : null;

  const exporter = () => action.executer(async () => {
    const tables: Record<string, unknown[]> = {};
    for (const t of TABLES_EXPORTEES) tables[t] = await s.depot.lister(t, org);
    const documents = tables.documents as { id: string }[];
    const signatures = (await Promise.all(documents.map((d) => s.depot.signatures(org, "document", d.id)))).flat();
    const contenu = {
      format: "salles-propres-export", version: 1, exporte_le: new Date().toISOString(), organisation: s.org,
      profils: s.profils, tables, signatures, journal_audit: await s.depot.journal(org, { limite: 100000 }),
    };
    telechargerFichier(`salles-propres-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(contenu, null, 2));
  });

  return (
    <div className="grid gap-4">
      <Carte titre="Exporter les données de l'organisation">
        <MessageErreur erreur={action.erreur} />
        <p className="mb-3 text-sm text-texte-2">
          Un fichier JSON avec toutes les tables, les signatures et le journal d'audit. Les fichiers déposés dans la GED ne sont pas inclus (seulement leurs références).
          {s.depot.mode === "supabase" && " La base hébergée a en plus ses propres sauvegardes automatiques."}
        </p>
        <Bouton variante="principal" disabled={action.enCours} onClick={() => void exporter()}>Télécharger l'export</Bouton>
      </Carte>
      {demo && (
        <Carte titre="Démonstration : sauvegarder et restaurer l'état complet">
          <p className="mb-3 text-sm text-texte-2">Pour transférer une démonstration vers un autre navigateur. La restauration remplace toutes les données locales.</p>
          <div className="flex flex-wrap gap-2">
            <Bouton onClick={() => telechargerFichier(`salles-propres-demo-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(demo.exporterEtat()))}>Sauvegarder l'état de démo</Bouton>
            <label className="inline-flex cursor-pointer items-center rounded-lg border border-bord bg-white px-3 py-1.5 text-sm font-medium hover:bg-navy-050">
              Restaurer…
              <input type="file" accept="application/json" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f || !window.confirm("Remplacer toutes les données de démonstration par ce fichier ?")) return;
                void action.executer(async () => {
                  demo.importerEtat(JSON.parse(await f.text()) as EtatDemo);
                  window.location.reload();
                });
              }} />
            </label>
          </div>
        </Carte>
      )}
    </div>
  );
}
