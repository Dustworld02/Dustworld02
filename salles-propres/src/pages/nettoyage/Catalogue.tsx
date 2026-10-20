import { Badge, Carte } from "../../ui/composants";
import { GestionEntites, optionsDe } from "../../ui/entites";
import type { DonneesNettoyage } from "./donnees";

const FAMILLES = { detergent: "Détergent", detergent_desinfectant: "Détergent-désinfectant", desinfectant: "Désinfectant", alcool: "Alcool", sporicide: "Sporicide", eau: "Eau" };
const TYPES_CONSO = { lingette: "Lingette", mop: "Frange / mop", gant: "Gants", tenue: "Tenue", autre: "Autre" };
const TYPES_MATERIEL = { chariot: "Chariot", seau: "Seau / bac", support_mop: "Support de mop", manche: "Manche", aspirateur_hepa: "Aspirateur HEPA", autolaveuse: "Autolaveuse", pulverisateur: "Pulvérisateur", autre: "Autre" };
const ETATS = { bon: "Bon", use: "Usé", hors_service: "Hors service" };

export function CatalogueNettoyage({ d, recharger }: { d: DonneesNettoyage; recharger: () => void }) {
  return (
    <div className="grid gap-6">
      <Carte>
        <GestionEntites
          table="produits_nettoyage"
          titre="Produits"
          lignes={d.produits}
          recharger={recharger}
          champs={[
            { cle: "nom", libelle: "Nom commercial", type: "texte", requis: true, large: true },
            { cle: "famille", libelle: "Famille", type: "liste", requis: true, options: optionsDe(FAMILLES) },
            { cle: "fournisseur", libelle: "Fournisseur", type: "texte" },
            { cle: "reference", libelle: "Référence", type: "texte" },
            { cle: "substance_active", libelle: "Substance(s) active(s)", type: "texte" },
            { cle: "dilution", libelle: "Dilution", type: "texte" },
            { cle: "temps_contact_min", libelle: "Temps de contact (min)", type: "nombre" },
            { cle: "peremption_solution_h", libelle: "Péremption de la solution préparée (h)", type: "nombre" },
            { cle: "groupe_rotation", libelle: "Groupe de rotation", type: "texte", aide: "A, B… ; S pour les sporicides" },
            { cle: "spectre", libelle: "Spectre / normes", type: "zone_texte" },
            { cle: "compatibilites", libelle: "Compatibilités / incompatibilités matériaux", type: "zone_texte" },
            { cle: "rincage", libelle: "Rinçage", type: "case", aide: "Rinçage nécessaire après application" },
            { cle: "sterile", libelle: "Stérile", type: "case", aide: "Produit stérile" },
            { cle: "a_completer", libelle: "Fiche", type: "case", aide: "À compléter (fournisseur, FDS)" },
            { cle: "actif", libelle: "Actif", type: "case", aide: "Utilisé actuellement" },
          ]}
          valeursInitiales={() => ({ nom: "", famille: "detergent_desinfectant", rincage: false, sterile: false, actif: true, a_completer: false })}
          texteRecherche={(p) => `${p.nom} ${p.fournisseur} ${p.substance_active}`}
          trier={(a, b) => a.nom.localeCompare(b.nom)}
          colonnes={[
            { libelle: "Produit", rendu: (p) => <><strong>{p.nom}</strong>{p.a_completer && <Badge ton="attention">à compléter</Badge>}{p.sterile && <Badge ton="info">stérile</Badge>}<div className="text-xs text-texte-2">{p.fournisseur || "Fournisseur à préciser"}</div></> },
            { libelle: "Famille", rendu: (p) => FAMILLES[p.famille as keyof typeof FAMILLES] ?? p.famille },
            { libelle: "Dilution / contact", rendu: (p) => `${p.dilution || "—"} · ${p.temps_contact_min != null ? `${p.temps_contact_min} min` : "—"}` },
            { libelle: "Rotation", rendu: (p) => p.groupe_rotation || "—" },
            { libelle: "FDS", rendu: (p) => (p.fds_document_id ? "Oui" : <span className="text-texte-2">à joindre</span>) },
          ]}
          vide="Aucun produit. Le générateur de procédures ajoute ici les produits nécessaires."
        />
      </Carte>
      <Carte>
        <GestionEntites
          table="consommables"
          titre="Consommables (lingettes, franges, gants)"
          lignes={d.consommables}
          recharger={recharger}
          champs={[
            { cle: "nom", libelle: "Nom", type: "texte", requis: true, large: true },
            { cle: "type", libelle: "Type", type: "liste", requis: true, options: optionsDe(TYPES_CONSO) },
            { cle: "matiere", libelle: "Matière", type: "texte" },
            { cle: "classe_iso_min", libelle: "Utilisable jusqu'à la classe ISO", type: "nombre" },
            { cle: "preimpregne", libelle: "Pré-imprégnation", type: "texte" },
            { cle: "fournisseur", libelle: "Fournisseur", type: "texte" },
            { cle: "reference", libelle: "Référence", type: "texte" },
            { cle: "unite", libelle: "Unité", type: "texte" },
            { cle: "stock", libelle: "Stock", type: "nombre" },
            { cle: "seuil_alerte", libelle: "Seuil d'alerte", type: "nombre" },
            { cle: "sterile", libelle: "Stérile", type: "case", aide: "Stérile" },
            { cle: "a_completer", libelle: "Fiche", type: "case", aide: "À compléter" },
            { cle: "actif", libelle: "Actif", type: "case", aide: "Utilisé actuellement" },
          ]}
          valeursInitiales={() => ({ nom: "", type: "lingette", unite: "sachet", stock: 0, seuil_alerte: 0, sterile: false, actif: true })}
          trier={(a, b) => a.nom.localeCompare(b.nom)}
          colonnes={[
            { libelle: "Consommable", rendu: (c) => <><strong>{c.nom}</strong>{c.a_completer && <Badge ton="attention">à compléter</Badge>}{c.sterile && <Badge ton="info">stérile</Badge>}<div className="text-xs text-texte-2">{c.matiere}</div></> },
            { libelle: "Classe", rendu: (c) => (c.classe_iso_min != null ? `jusqu'à ISO ${c.classe_iso_min}` : "—") },
            { libelle: "Stock", classe: "nombre", rendu: (c) => <span className={c.stock <= c.seuil_alerte && c.seuil_alerte > 0 ? "font-semibold text-red-700" : ""}>{c.stock} {c.unite}</span> },
          ]}
          vide="Aucun consommable."
        />
      </Carte>
      <Carte>
        <GestionEntites
          table="materiel_nettoyage"
          titre="Matériel de nettoyage"
          lignes={d.materiel}
          recharger={recharger}
          champs={[
            { cle: "libelle", libelle: "Libellé", type: "texte", requis: true },
            { cle: "type", libelle: "Type", type: "liste", requis: true, options: optionsDe(TYPES_MATERIEL) },
            { cle: "salle_id", libelle: "Salle propre", type: "liste", options: d.salles.map((x) => ({ valeur: x.id, libelle: x.nom })) },
            { cle: "couleur", libelle: "Code couleur", type: "texte", aide: "Matériel dédié par zone (ex. bleu = ISO 7)" },
            { cle: "zones_dediees", libelle: "Zones dédiées", type: "texte" },
            { cle: "etat", libelle: "État", type: "liste", requis: true, options: optionsDe(ETATS) },
            { cle: "date_mise_service", libelle: "Mise en service", type: "date" },
            { cle: "date_remplacement_prevue", libelle: "Remplacement prévu", type: "date" },
            { cle: "notes", libelle: "Notes", type: "zone_texte" },
          ]}
          valeursInitiales={() => ({ libelle: "", type: "chariot", etat: "bon", salle_id: d.salles[0]?.id ?? null })}
          colonnes={[
            { libelle: "Matériel", rendu: (m) => <><strong>{m.libelle}</strong>{m.couleur && <span className="text-texte-2"> · {m.couleur}</span>}</> },
            { libelle: "Salle / zones", rendu: (m) => `${d.salles.find((x) => x.id === m.salle_id)?.nom ?? "—"}${m.zones_dediees ? ` · ${m.zones_dediees}` : ""}` },
            { libelle: "État", rendu: (m) => <Badge ton={m.etat === "bon" ? "ok" : m.etat === "use" ? "attention" : "alerte"}>{ETATS[m.etat]}</Badge> },
            { libelle: "Remplacement", rendu: (m) => (m.date_remplacement_prevue ? new Date(m.date_remplacement_prevue).toLocaleDateString("fr-FR") : "—") },
          ]}
          vide="Aucun matériel."
        />
      </Carte>
    </div>
  );
}
