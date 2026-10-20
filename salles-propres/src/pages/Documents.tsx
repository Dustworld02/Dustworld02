import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useSession, nomUtilisateur } from "../session";
import type { DocumentGed, StatutDocument } from "../data/types";
import { Badge, Bouton, Champ, EnTete, Liste, MessageErreur, Modale, Saisie, TableauDefilant, Vide, ZoneTexte, formatDate, useAction, useDonnees } from "../ui/composants";
import { LIBELLES_SIGNIFICATIONS, niveauSignature, type Signification } from "../domain/permissions";

export const LIBELLES_STATUTS: Record<StatutDocument, string> = {
  brouillon: "Brouillon",
  en_revue: "En revue",
  approuve: "Approuvé",
  perime: "Périmé",
};
const TON_STATUT = { brouillon: "neutre", en_revue: "info", approuve: "ok", perime: "alerte" } as const;

function nomFichierSur(nom: string): string {
  return nom.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-120);
}

function ajouterMois(mois: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + mois);
  return d.toISOString().slice(0, 10);
}

export function Documents() {
  const s = useSession();
  const org = s.org!.id;
  const [parametres] = useSearchParams();
  const ecriture = s.peut("documents", 2);
  const { donnees, erreur, recharger } = useDonnees(async () => {
    const [documents, salles] = await Promise.all([
      s.depot.lister("documents", org),
      s.peut("installations", 1) ? s.depot.lister("salles_propres", org) : [],
    ]);
    return { documents, salles };
  }, [org]);
  const [filtres, setFiltres] = useState({ texte: "", type: "", statut: "", objet: parametres.get("objet") ?? "" });
  const [creation, setCreation] = useState(false);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const types = s.referentiels.typesDocuments;
  const libelleType = (cle: string) => types.find((t) => t.cle === cle)?.libelle ?? cle;
  const libelleObjet = (d: DocumentGed) => d.objet_type === "salle_propre" ? donnees?.salles.find((x) => x.id === d.objet_id)?.nom ?? "Salle propre" : "—";

  const liste = useMemo(() => (donnees?.documents ?? [])
    .filter((d) => !filtres.type || d.type_document === filtres.type)
    .filter((d) => !filtres.statut || d.statut === filtres.statut)
    .filter((d) => !filtres.objet || d.objet_id === filtres.objet)
    .filter((d) => !filtres.texte || d.titre.toLowerCase().includes(filtres.texte.toLowerCase()))
    .sort((a, b) => b.modifie_le.localeCompare(a.modifie_le)), [donnees, filtres]);

  const aujourdhui = new Date().toISOString().slice(0, 10);

  return (
    <>
      <EnTete
        titre="Documents"
        sousTitre="Protocoles, rapports, certificats, procédures : versionnés, rattachés aux salles, approuvés par signature électronique."
        actions={ecriture && <Bouton variante="principal" onClick={() => setCreation(true)}>+ Nouveau document</Bouton>}
      />
      <MessageErreur erreur={erreur} />
      <div className="mb-3 grid gap-2 md:grid-cols-4">
        <Saisie placeholder="Rechercher un titre…" value={filtres.texte} onChange={(e) => setFiltres({ ...filtres, texte: e.target.value })} />
        <Liste aria-label="Type" value={filtres.type} onChange={(e) => setFiltres({ ...filtres, type: e.target.value })}>
          <option value="">Tous les types</option>
          {types.map((t) => <option key={t.cle} value={t.cle}>{t.libelle}</option>)}
        </Liste>
        <Liste aria-label="Statut" value={filtres.statut} onChange={(e) => setFiltres({ ...filtres, statut: e.target.value })}>
          <option value="">Tous les statuts</option>
          {Object.entries(LIBELLES_STATUTS).map(([cle, l]) => <option key={cle} value={cle}>{l}</option>)}
        </Liste>
        <Liste aria-label="Rattachement" value={filtres.objet} onChange={(e) => setFiltres({ ...filtres, objet: e.target.value })}>
          <option value="">Tous les rattachements</option>
          {donnees?.salles.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
        </Liste>
      </div>
      {donnees && liste.length === 0 && <Vide>Aucun document.</Vide>}
      {liste.length > 0 && (
        <TableauDefilant>
          <table className="tableau bg-white">
            <thead><tr><th>Titre</th><th>Type</th><th>Rattachement</th><th>Statut</th><th className="nombre">Version</th><th>Valide jusqu'au</th></tr></thead>
            <tbody>
              {liste.map((d) => (
                <tr key={d.id}>
                  <td><button type="button" className="text-left font-medium text-navy-700 hover:underline" onClick={() => setOuvert(d.id)}>{d.titre}</button></td>
                  <td className="text-texte-2">{libelleType(d.type_document)}</td>
                  <td>{libelleObjet(d)}</td>
                  <td><Badge ton={TON_STATUT[d.statut]}>{LIBELLES_STATUTS[d.statut]}</Badge></td>
                  <td className="nombre">{d.version_courante || "—"}</td>
                  <td>{d.valide_jusqu_au ? <Badge ton={d.valide_jusqu_au < aujourdhui ? "alerte" : "neutre"}>{formatDate(d.valide_jusqu_au)}</Badge> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableauDefilant>
      )}
      {creation && <CreationDocument salles={donnees?.salles ?? []} objetParDefaut={filtres.objet} onFermer={() => setCreation(false)} onCree={(id) => { setCreation(false); recharger(); setOuvert(id); }} />}
      {ouvert && <DetailDocument id={ouvert} libelleType={libelleType} onFermer={() => { setOuvert(null); recharger(); }} />}
    </>
  );
}

function CreationDocument({ salles, objetParDefaut, onFermer, onCree }: {
  salles: { id: string; nom: string }[];
  objetParDefaut: string;
  onFermer: () => void;
  onCree: (id: string) => void;
}) {
  const s = useSession();
  const org = s.org!.id;
  const types = s.referentiels.typesDocuments;
  const [valeurs, setValeurs] = useState({ titre: "", type_document: types[0]?.cle ?? "autre", objet_id: objetParDefaut, valide_jusqu_au: "" });
  const [fichier, setFichier] = useState<File | null>(null);
  const action = useAction();

  const changerType = (cle: string) => {
    const t = types.find((x) => x.cle === cle);
    setValeurs({ ...valeurs, type_document: cle, valide_jusqu_au: t?.validiteMois ? ajouterMois(t.validiteMois) : "" });
  };

  const creer = () => action.executer(async () => {
    const doc = await s.depot.creer("documents", {
      org_id: org, titre: valeurs.titre.trim(), type_document: valeurs.type_document, statut: "brouillon",
      objet_type: valeurs.objet_id ? "salle_propre" : null, objet_id: valeurs.objet_id || null,
      valide_jusqu_au: valeurs.valide_jusqu_au || null, version_courante: 0,
    });
    await deposerVersion(s, doc.id, fichier!, "Version initiale");
    onCree(doc.id);
  });

  return (
    <Modale
      titre="Nouveau document"
      onFermer={onFermer}
      pied={<><Bouton onClick={onFermer}>Annuler</Bouton><Bouton variante="principal" disabled={action.enCours || !valeurs.titre.trim() || !fichier} onClick={() => void creer()}>Déposer</Bouton></>}
    >
      <MessageErreur erreur={action.erreur} />
      <div className="grid gap-3">
        <Champ libelle="Titre"><Saisie autoFocus value={valeurs.titre} onChange={(e) => setValeurs({ ...valeurs, titre: e.target.value })} /></Champ>
        <Champ libelle="Type">
          <Liste value={valeurs.type_document} onChange={(e) => changerType(e.target.value)}>
            {types.map((t) => <option key={t.cle} value={t.cle}>{t.libelle}</option>)}
          </Liste>
        </Champ>
        <Champ libelle="Rattaché à">
          <Liste value={valeurs.objet_id} onChange={(e) => setValeurs({ ...valeurs, objet_id: e.target.value })}>
            <option value="">— Aucun (document général) —</option>
            {salles.map((x) => <option key={x.id} value={x.id}>Salle propre : {x.nom}</option>)}
          </Liste>
        </Champ>
        <Champ libelle="Valide jusqu'au" aide="Prérempli selon la durée de validité du type (référentiel des types de documents).">
          <Saisie type="date" value={valeurs.valide_jusqu_au} onChange={(e) => setValeurs({ ...valeurs, valide_jusqu_au: e.target.value })} />
        </Champ>
        <Champ libelle="Fichier"><input type="file" onChange={(e) => setFichier(e.target.files?.[0] ?? null)} className="text-sm" /></Champ>
      </div>
    </Modale>
  );
}

export async function deposerVersion(s: ReturnType<typeof useSession>, documentId: string, fichier: File, commentaire: string) {
  const org = s.org!.id;
  const chemin = `${org}/${documentId}/${crypto.randomUUID()}-${nomFichierSur(fichier.name)}`;
  await s.depot.deposerFichier(chemin, fichier);
  await s.depot.creer("versions_documents", {
    org_id: org, document_id: documentId, version: 0, chemin_stockage: chemin, nom_fichier: fichier.name,
    taille_octets: fichier.size, type_mime: fichier.type, commentaire,
  });
}

function DetailDocument({ id, libelleType, onFermer }: { id: string; libelleType: (cle: string) => string; onFermer: () => void }) {
  const s = useSession();
  const org = s.org!.id;
  const { donnees, erreur, recharger } = useDonnees(async () => {
    const [docs, versions, signatures] = await Promise.all([
      s.depot.lister("documents", org, { id }),
      s.depot.lister("versions_documents", org, { document_id: id }),
      s.depot.signatures(org, "document", id),
    ]);
    return { doc: docs[0], versions: versions.sort((a, b) => b.version - a.version), signatures };
  }, [org, id]);
  const [signature, setSignature] = useState<{ signification: Signification; motDePasse: string; commentaire: string; puisApprouver: boolean } | null>(null);
  const [nouvelleVersion, setNouvelleVersion] = useState<{ fichier: File | null; commentaire: string } | null>(null);
  const action = useAction();

  if (!donnees) return <Modale titre="Document" onFermer={onFermer}><MessageErreur erreur={erreur} />Chargement…</Modale>;
  const { doc, versions, signatures } = donnees;
  if (!doc) return <Modale titre="Document" onFermer={onFermer}>Document introuvable.</Modale>;
  const ecriture = s.peut("documents", 2);
  const validation = s.peut("documents", 3);
  const signaturesVersion = signatures.filter((x) => x.version_objet === doc.version_courante);

  const ouvrir = (chemin: string) => action.executer(async () => { window.open(await s.depot.urlFichier(chemin), "_blank", "noopener"); });
  const changerStatut = (statut: StatutDocument) => action.executer(async () => { await s.depot.modifier("documents", doc.id, { statut }); recharger(); });

  const signer = () => action.executer(async () => {
    if (!(await s.depot.verifierMotDePasse(signature!.motDePasse))) throw new Error("Mot de passe incorrect : signature refusée.");
    await s.depot.signer("document", doc.id, signature!.signification, signature!.commentaire);
    if (signature!.puisApprouver) await s.depot.modifier("documents", doc.id, { statut: "approuve" });
    setSignature(null);
    recharger();
  });

  if (signature) {
    return (
      <Modale
        titre={`Signature électronique — ${LIBELLES_SIGNIFICATIONS[signature.signification]}`}
        onFermer={() => setSignature(null)}
        pied={<><Bouton onClick={() => setSignature(null)}>Annuler</Bouton><Bouton variante="principal" disabled={action.enCours || !signature.motDePasse} onClick={() => void signer()}>Signer</Bouton></>}
      >
        <MessageErreur erreur={action.erreur} />
        <p className="mb-3 text-sm">
          Vous signez <strong>{doc.titre}</strong>, version {doc.version_courante}, en tant que <strong>{s.utilisateur?.nom_complet || s.utilisateur?.email}</strong>.
          La signature est horodatée par le serveur, enregistrée dans le journal d'audit et ne peut pas être modifiée.
        </p>
        <div className="grid gap-3">
          <Champ libelle="Signification">
            <Liste value={signature.signification} disabled={signature.puisApprouver} onChange={(e) => setSignature({ ...signature, signification: e.target.value as Signification })}>
              {(["redige", "verifie", "approuve"] as Signification[]).filter((x) => s.peut("documents", niveauSignature(x))).map((x) => <option key={x} value={x}>{LIBELLES_SIGNIFICATIONS[x]}</option>)}
            </Liste>
          </Champ>
          <Champ libelle="Commentaire"><ZoneTexte value={signature.commentaire} onChange={(e) => setSignature({ ...signature, commentaire: e.target.value })} /></Champ>
          <Champ libelle="Mot de passe (confirmation d'identité)"><Saisie type="password" autoFocus value={signature.motDePasse} onChange={(e) => setSignature({ ...signature, motDePasse: e.target.value })} autoComplete="current-password" /></Champ>
        </div>
      </Modale>
    );
  }

  return (
    <Modale large titre={doc.titre} onFermer={onFermer}>
      <MessageErreur erreur={action.erreur} />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Badge ton={TON_STATUT[doc.statut]}>{LIBELLES_STATUTS[doc.statut]}</Badge>
        <span className="text-texte-2">{libelleType(doc.type_document)} · version {doc.version_courante || "—"}{doc.valide_jusqu_au && ` · valide jusqu'au ${formatDate(doc.valide_jusqu_au)}`}</span>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {versions[0] && <Bouton variante="principal" onClick={() => void ouvrir(versions[0].chemin_stockage)}>Ouvrir la version {versions[0].version}</Bouton>}
        {ecriture && <Bouton onClick={() => { action.effacer(); setNouvelleVersion({ fichier: null, commentaire: "" }); }}>Nouvelle version</Bouton>}
        {ecriture && doc.version_courante > 0 && <Bouton onClick={() => { action.effacer(); setSignature({ signification: "redige", motDePasse: "", commentaire: "", puisApprouver: false }); }}>Signer…</Bouton>}
        {ecriture && doc.statut === "brouillon" && doc.version_courante > 0 && <Bouton onClick={() => void changerStatut("en_revue")}>Soumettre en revue</Bouton>}
        {validation && doc.statut !== "approuve" && doc.statut !== "perime" && doc.version_courante > 0 && (
          <Bouton variante="principal" onClick={() => { action.effacer(); setSignature({ signification: "approuve", motDePasse: "", commentaire: "", puisApprouver: true }); }}>Approuver (signature)</Bouton>
        )}
        {ecriture && doc.statut === "en_revue" && <Bouton variante="discret" onClick={() => void changerStatut("brouillon")}>Repasser en brouillon</Bouton>}
        {validation && doc.statut !== "perime" && <Bouton variante="danger" onClick={() => { if (window.confirm("Déclarer ce document périmé ?")) void changerStatut("perime"); }}>Déclarer périmé</Bouton>}
      </div>

      {nouvelleVersion && (
        <div className="mb-4 rounded-lg border border-bord bg-fond p-3">
          <div className="mb-2 text-sm font-semibold">Déposer une nouvelle version {doc.statut === "approuve" && <Badge ton="attention">le document repassera en brouillon</Badge>}</div>
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <input type="file" className="text-sm" onChange={(e) => setNouvelleVersion({ ...nouvelleVersion, fichier: e.target.files?.[0] ?? null })} />
            <Saisie placeholder="Nature de la modification" value={nouvelleVersion.commentaire} onChange={(e) => setNouvelleVersion({ ...nouvelleVersion, commentaire: e.target.value })} />
            <div className="flex gap-2">
              <Bouton onClick={() => setNouvelleVersion(null)}>Annuler</Bouton>
              <Bouton variante="principal" disabled={action.enCours || !nouvelleVersion.fichier} onClick={() => void action.executer(async () => {
                await deposerVersion(s, doc.id, nouvelleVersion.fichier!, nouvelleVersion.commentaire);
                setNouvelleVersion(null);
                recharger();
              })}>Déposer</Bouton>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold">Signatures de la version {doc.version_courante || "—"}</h3>
          {signaturesVersion.length === 0 ? <p className="text-sm text-texte-2">Aucune signature.</p> : (
            <ul className="space-y-1.5 text-sm">
              {signaturesVersion.map((x) => (
                <li key={x.id} className="rounded-lg border border-bord px-3 py-2">
                  <div><strong>{LIBELLES_SIGNIFICATIONS[x.signification]}</strong> {x.nom_signataire}</div>
                  <div className="text-xs text-texte-2">{formatDate(x.signe_le, true)}{x.commentaire && ` — ${x.commentaire}`}</div>
                </li>
              ))}
            </ul>
          )}
          {signatures.length > signaturesVersion.length && <p className="mt-2 text-xs text-texte-2">{signatures.length - signaturesVersion.length} signature(s) sur des versions antérieures.</p>}
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Versions</h3>
          <ul className="space-y-1.5 text-sm">
            {versions.map((v) => (
              <li key={v.id} className="flex items-start justify-between gap-2 rounded-lg border border-bord px-3 py-2">
                <div>
                  <div><strong>v{v.version}</strong> {v.nom_fichier}</div>
                  <div className="text-xs text-texte-2">{formatDate(v.cree_le, true)} · {nomUtilisateur(s.profils, v.cree_par)}{v.commentaire && ` — ${v.commentaire}`}</div>
                </div>
                <Bouton variante="discret" onClick={() => void ouvrir(v.chemin_stockage)}>Ouvrir</Bouton>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modale>
  );
}
