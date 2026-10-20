# Salles Propres — application

Outil de gestion des salles propres et zones à atmosphère contrôlée, de la modélisation à la revue périodique. Ce dossier contient les **phases 1 à 7** du plan de développement (`../docs/PLAN_DEVELOPPEMENT_SALLES_PROPRES.md`) ; le dossier de validation logicielle est dans `docs/VALIDATION_LOGICIELLE.md`.

## Modules

| Module | Contenu |
|---|---|
| Tableau de bord | Indicateurs (écarts, conformité de la surveillance, réalisation du nettoyage, requalifications, habilitations, maintenance, documents, tâches), synthèse par salle, liste « à traiter » priorisée |
| Comptes et droits | Organisations, 7 rôles par défaut, matrice rôle × module éditable (19 modules, 5 niveaux), rôles personnalisés, restriction par site, invitations |
| Installations | Entreprises → sites → salles propres → zones ; classification ISO 14644-1, grade BPF, zone à risque ; consignes de pression, renouvellement, température, HR |
| Secteurs et gabarits | Assistant de création en 5 étapes ; 8 secteurs (pharma stérile / non stérile, DM, micro-électronique, hôpital, biotech, agroalimentaire, aérospatial) ; gabarits d'entreprise versionnés |
| Modélisation | Plan 2D (zones, portes, bouches, équipements, mobilier, points de prélèvement, flux), cascade de pression, bilan aéraulique, CTA et étages, filtres et relevés de perte de charge |
| Qualification | Assistant de campagne (essais proposés selon la salle, ses CTA et équipements), protocole et rapport signés, classification point par point (tableau A.1), échéancier de requalification ISO 14644-2 |
| Instruments | Étalonnages, refus de toute mesure hors validité, analyse d'impact d'un étalonnage non conforme |
| Contaminations | Entrepôt unique air / surface / gants / liquide × particulaire / microbiologique / chimique ; plan d'échantillonnage proposé selon les points et le niveau des zones ; prélèvements dus ; règle de dérive en base ; tendances, cartographie sur le plan, rapport périodique ; imports et exports CSV |
| Nettoyage | Procédures générées selon le secteur, le type et la classe (lingettes, produits, techniques, fréquences), approuvées par signature et versionnées ; catalogue ; planning ; mode terrain hors ligne ; validation de l'efficacité |
| Personnel | Habilitations, formations, échéances, matrice d'accès aux zones ; seule une personne habilitée peut se voir affecter un nettoyage |
| Écarts et CAPA | Écarts automatiques (limite d'action, dérive, essai non conforme, étalonnage non conforme), 5 pourquoi, Ishikawa, CAPA, vérification d'efficacité, clôture signée |
| Maintenance et changements | Gammes préventives, interventions préventives et correctives, change control numéroté avec évaluation d'impact, approbation et clôture signées, requalification exigée avant clôture |
| Traitement d'air | Carnet sanitaire imprimable, estimation de l'énergie des ventilateurs, relevés d'ambiance et import des exports de GTC |
| Pilotage | Kanban avec glisser-déposer, propriétaire, échéance, cartes générées depuis toutes les échéances ; discussions avec mentions ; notifications |
| Revue périodique | Revue annuelle générée (état qualifié, surveillance, ambiance, nettoyage, écarts, changements, maintenance, personnel, constats proposés), imprimable, archivée dans la GED |
| Documents et traçabilité | GED versionnée, statuts, signatures électroniques avec ressaisie du mot de passe, journal d'audit en ajout seul |

## Essayer sans serveur (mode démonstration)

```bash
cd salles-propres
npm install
npm run dev
```

Sans configuration Supabase, l'application démarre en **mode démonstration** : données dans le navigateur, un compte par rôle (mot de passe `demo`) et un jeu d'exemple complet autour d'une salle d'assemblage de dispositifs médicaux (qualification clôturée, six mois de surveillance avec une dérive, écarts et CAPA, procédures de nettoyage approuvées et planning, personnel, maintenance, change control, relevés d'ambiance). Les règles de la base y sont émulées, mais ce mode n'a **aucune valeur de preuve**.

## Mise en service hébergée (Supabase)

1. Créer un projet sur supabase.com, **région Union européenne**.
2. Appliquer les migrations de `supabase/migrations` **dans l'ordre** (CLI : `supabase link` puis `supabase db push`, ou chaque fichier dans l'éditeur SQL).
3. Authentication → URL Configuration : renseigner l'adresse de l'application (Site URL). Régler la politique de mot de passe et, si besoin, la double authentification.
4. Copier `.env.example` en `.env.local` et renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (Project Settings → API). La clé « anon » est publique par conception : la sécurité repose sur les politiques RLS.
5. `npm run build` produit un site statique dans `dist/`, à héberger sur Vercel, Netlify ou tout hébergement HTTPS (racine du projet : `salles-propres`, mêmes variables d'environnement).
6. Dérouler le contrôle de mise en service décrit dans `docs/VALIDATION_LOGICIELLE.md` (§5) sur l'instance hébergée.

Le premier compte crée son organisation et en devient administrateur. Les suivants sont invités depuis Configuration → Utilisateurs.

## Sécurité : où sont appliquées les règles

Toutes les règles sont dans la base, l'interface ne fait que les refléter :

- **droits** : politiques RLS sur chaque table, fondées sur la matrice rôle × module et le périmètre de sites du membre ;
- **journal d'audit** : déclencheurs sur toutes les tables ; la table refuse toute modification ou suppression ;
- **signatures** : créées uniquement par la fonction `signer()` (horodatage serveur, nom figé), exigées par déclencheur pour approuver un document, un protocole, un rapport, une procédure, un changement ou clore un écart ;
- **règles métier** : instrument étalonné à la date de mesure, verdicts calculés, objets figés après clôture, numérotation, écarts automatiques, personne habilitée pour un nettoyage, procédure approuvée pour planifier, requalification avant clôture d'un changement ;
- **cohérence** : un enregistrement ne peut ni changer d'organisation ni pointer vers l'objet d'une autre organisation ;
- **fichiers** : bucket privé, cloisonné par organisation, sans modification ni suppression.

Limites connues : voir `docs/VALIDATION_LOGICIELLE.md` (§6).

## Tests

```bash
npm test            # domaine, mode démo et schéma SQL (PostgreSQL embarqué PGlite) — 119 tests
npm run typecheck
npm run build && npx vite preview --port 4173 &
npm run recette     # parcours complet dans Chromium — 41 étapes (variable CHROMIUM pour le chemin du navigateur)
```

## Organisation du code

```
src/domain/        règles métier pures : référentiels, droits, gabarits, qualification, surveillance, nettoyage, maintenance
src/data/          interface Depot, implémentations Supabase et démonstration, registre des tables, règles émulées
src/pages/         écrans (chargés à la demande, préchargés pour le mode hors ligne)
src/ui/            composants communs et coquille de navigation
supabase/          migrations SQL (schéma, RLS, déclencheurs, fonctions)
tests/             tests automatisés
scripts/           recette de bout en bout et serveur de recette
docs/              dossier de validation logicielle
```
