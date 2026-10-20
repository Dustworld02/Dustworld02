# Salles Propres — application

Outil de gestion des salles propres et zones à atmosphère contrôlée. Ce dossier contient la **phase 1 (socle)** du plan de développement (`../docs/PLAN_DEVELOPPEMENT_SALLES_PROPRES.md`).

## Ce que fait la phase 1

| Domaine | Contenu |
|---|---|
| Comptes et droits | Connexion, organisations, 7 rôles par défaut, matrice de droits éditable, rôles personnalisés, restriction d'un membre à certains sites, invitations |
| Installations | Entreprises → sites → salles propres → zones, avec classification (ISO au repos / en activité, grade BPF, zone à risque NF S 90-351) et consignes (pression, renouvellement, température, HR) |
| Secteurs et gabarits | Assistant de création d'une salle en 5 étapes ; 8 secteurs livrés (pharma stérile, pharma non stérile / cosmétique, dispositifs médicaux, micro-électronique, hôpital, biotech / laboratoire, agroalimentaire, aérospatial / optique) ; gabarits d'entreprise (« enregistrer comme gabarit », duplication, édition versionnée) |
| Calculs | Limites particulaires ISO 14644-1 (y compris classes intermédiaires), limites Annexe 1 qui priment à 0,5 et 5 µm, limites microbiologiques, volume, nombre minimal de points de prélèvement (tableau A.1), contrôles de cohérence |
| Référentiels | Classes ISO, tableau A.1, grades BPF, périodicités ISO 14644-2 (personnalisables), catalogue d'essais, types de documents (personnalisables) |
| Documents (GED) | Dépôt, versions immuables, rattachement à une salle, statuts brouillon / en revue / approuvé / périmé, échéances de validité |
| Traçabilité | Journal d'audit en ajout seul (qui, quand, avant / après), signatures électroniques avec ressaisie du mot de passe, approbation impossible sans signature sur la version courante |

Les modules des phases suivantes apparaissent dans la navigation sous « À venir ».

## Essayer sans serveur (mode démonstration)

```bash
cd salles-propres
npm install
npm run dev
```

Sans configuration Supabase, l'application démarre en **mode démonstration** : données dans le navigateur, un compte par rôle (mot de passe `demo`), une entreprise « MedTech Exemple » avec une salle générée par le gabarit dispositifs médicaux. Les règles de la base (droits, journal, signatures) y sont émulées pour que la démonstration se comporte comme la version hébergée, mais ce mode n'a **aucune valeur de preuve**.

## Mise en service hébergée (Supabase)

1. Créer un projet sur supabase.com, **région Union européenne**.
2. Appliquer les migrations du dossier `supabase/migrations`, dans l'ordre : avec la CLI (`supabase link` puis `supabase db push`) ou en collant chaque fichier dans l'éditeur SQL.
3. Dans Authentication → URL Configuration, renseigner l'adresse de l'application (Site URL).
4. Copier `.env.example` en `.env.local` et renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (Project Settings → API). La clé « anon » est publique par conception : la sécurité repose sur les politiques RLS.
5. `npm run build` produit un site statique dans `dist/`, à héberger sur Vercel, Netlify ou tout hébergement HTTPS (dossier racine du projet : `salles-propres`, mêmes variables d'environnement).

Le premier compte créé crée son organisation et en devient administrateur. Les suivants sont invités depuis Configuration → Utilisateurs : la personne crée son compte avec l'adresse invitée et rejoint l'organisation à sa première connexion.

## Sécurité : où sont appliquées les règles

Toutes les règles sont dans la base, l'interface ne fait que les refléter :

- **droits** : politiques RLS sur chaque table, fondées sur la matrice rôle × module et sur le périmètre de sites du membre ;
- **journal d'audit** : déclencheurs sur toutes les tables ; la table refuse toute modification ou suppression, même pour un administrateur de la base ;
- **signatures** : créées uniquement par la fonction `signer()` (horodatage serveur, nom du signataire figé), inviolables ;
- **cohérence** : un enregistrement ne peut ni changer d'organisation ni pointer vers l'objet d'une autre organisation ; l'organisation garde toujours un administrateur actif ;
- **fichiers** : bucket privé, cloisonné par organisation, sans modification ni suppression.

Limites connues de la v1 (outil de pilotage, pas encore système validé GxP) : la ressaisie du mot de passe avant signature est faite par l'application, pas prouvée côté serveur ; la séparation rédacteur / approbateur n'est pas imposée ; les documents ne sont pas encore restreints par site.

## Tests

```bash
npm test            # domaine, mode démo et schéma SQL (PostgreSQL embarqué PGlite)
npm run typecheck
npm run build && npx vite preview --port 4173 &
npm run recette     # parcours complet dans Chromium (variable CHROMIUM pour le chemin du navigateur)
```

Les tests SQL appliquent les migrations sur un vrai PostgreSQL et vérifient les droits utilisateur par utilisateur : cloisonnement entre organisations, restriction par site, rôle opérateur en lecture seule, journal et signatures inviolables, approbation sans signature refusée, création atomique d'une salle.

## Organisation du code

```
src/domain/        règles métier pures : référentiels normatifs, droits, gabarits sectoriels, exigences des zones
src/data/          accès aux données : interface Depot, implémentations Supabase et démonstration
src/pages/         écrans
src/ui/            composants communs et coquille de navigation
supabase/          migrations SQL (schéma, RLS, déclencheurs, fonctions)
tests/             tests automatisés
scripts/recette.mjs  recette de bout en bout dans le navigateur
```
