# Dossier de validation logicielle — Salles Propres 1.0.0

Ce dossier sert de base si l'outil devient un enregistrement officiel (BPF Annexe 11, 21 CFR Part 11, ISO 13485 §4.1.6). Il décrit les exigences, la stratégie de test, la traçabilité exigences → tests, le contrôle à dérouler sur l'instance hébergée et les limites connues. **Il ne remplace pas la validation sur site** : la qualification de l'installation et du fonctionnement (§5) doit être exécutée et signée par l'utilisateur sur sa propre instance Supabase.

## 1. Objet et statut

| Élément | Valeur |
|---|---|
| Système | Application web Salles Propres (React, site statique) + base Supabase (PostgreSQL, authentification, stockage) |
| Version | 1.0.0 (dépôt git, branche de livraison ; migrations `supabase/migrations/2026102*_*.sql`) |
| Catégorie GAMP 5 | 5 (logiciel développé spécifiquement) pour l'application ; 1 (infrastructure) pour PostgreSQL / Supabase |
| Usage prévu | Pilotage des salles propres : modélisation, qualification, surveillance, nettoyage, écarts / CAPA, maintenance, changements, revue périodique |
| Statut par défaut | **Outil de pilotage** : les documents signés (protocoles, rapports, procédures) restent la référence tant que la validation sur site n'est pas faite |
| Mode démonstration | Données dans le navigateur, **sans valeur de preuve**, hors périmètre de validation |

## 2. Exigences principales et traçabilité

Les tests cités sont dans `tests/` (vitest : *domaine*, *SQL* = schéma réel sur PostgreSQL embarqué, *démo* = parité du mode démonstration) et `scripts/recette.mjs` (*R n* = étape de recette dans Chromium).

| N° | Exigence | Preuves |
|---|---|---|
| EX-01 | Chaque utilisateur n'accède qu'aux données de son organisation | SQL « isole un utilisateur sans adhésion », « empêche les rattachements entre organisations » |
| EX-02 | Droits par rôle et module (lecture, écriture, validation, administration), éditables par l'administrateur | SQL « applique le rôle reçu par invitation », « applique le module traitement d'air », « réserve l'exécution au module » ; R 10, R 39, R 40 |
| EX-03 | Restriction d'un membre à certains sites | SQL et démo « restreint un membre à ses sites » |
| EX-04 | L'organisation garde toujours un administrateur actif | SQL « garde toujours un administrateur » ; démo « garde un administrateur » |
| EX-05 | Journal d'audit de toute écriture (qui, quand, avant / après), inviolable | SQL « journalise chaque écriture », « rend le journal d'audit inviolable » ; R 9 |
| EX-06 | Signature électronique avec ressaisie du mot de passe, signification, horodatage serveur, inviolable | SQL « rend les signatures inviolables » ; R 8 (mot de passe faux refusé) |
| EX-07 | Approbation impossible sans signature au niveau validation sur la version courante | SQL « refuse l'approbation sans signature », « refuse la signature d'approbation sans le niveau validation », « approuve après signature, puis repasse en brouillon » |
| EX-08 | Fichiers privés, cloisonnés par organisation, non modifiables | SQL « cloisonne le stockage des fichiers » |
| EX-09 | Classification ISO 14644-1 (tableau 1, formule, tableau A.1), primauté de l'Annexe 1 | Domaine « ISO 14644-1 », « fait primer le grade BPF à 5 µm » ; R 6, R 20 |
| EX-10 | Création d'une salle selon le gabarit du secteur, atomique | Domaine « Gabarits sectoriels » ; SQL « crée la salle et ses zones en une transaction », « n'enregistre rien si une zone est invalide » ; R 3 à R 5 |
| EX-11 | Cascade de pression et bilan aéraulique contrôlés | Domaine « Cascade de pression », « Bilan aéraulique » ; R 11, R 14 |
| EX-12 | Aucune mesure avec un instrument non étalonné à la date de mesure ; impact d'un étalonnage non conforme | SQL « refuse un résultat mesuré avec un instrument non étalonné », « refuse un essai réalisé … instrument périmé » ; R 19, R 21 |
| EX-13 | Campagne de qualification : protocole et rapport signés, campagne figée après clôture | SQL « numérote la campagne et exige la signature du protocole », « fige la campagne » ; R 17, R 18 |
| EX-14 | Verdicts calculés (résultats, essais, campagne) | Domaine « Verdicts », « calcule le verdict d'un résultat » ; R 20, R 22 |
| EX-15 | Échéancier de requalification selon ISO 14644-2 | Domaine « Échéancier » ; R 16 |
| EX-16 | Écart automatique : limite d'action, essai non conforme, étalonnage non conforme, dérive (3 alertes consécutives) | SQL « ouvre un écart automatique », « ouvre un écart pour un essai non conforme … », « ouvre un écart de dérive » ; démo « ouvre un écart de dérive » ; R 23, R 32 |
| EX-17 | CAPA : vérification d'efficacité au niveau validation ; clôture d'écart signée, CAPA soldées, puis figée | SQL « contrôle les CAPA et la clôture », « réserve la vérification d'efficacité » |
| EX-18 | Messages conservés (archivage seul), mentions notifiées | SQL « conserve les messages … » ; R 27 |
| EX-19 | Procédures de nettoyage générées selon le secteur et la classe, approuvées par signature, versionnées à chaque modification | Domaine « Procédures de nettoyage générées par secteur » ; SQL « exige une procédure approuvée par signature et versionne » ; R 28, R 29 |
| EX-20 | Planification limitée aux procédures approuvées ; affectation limitée aux personnes habilitées à la date | SQL « n'affecte une intervention qu'à une personne habilitée » ; démo « refuse d'affecter une personne non habilitée » ; R 31 |
| EX-21 | Plan d'échantillonnage, prélèvements dus, signaux de tendance | Domaine « Plan d'échantillonnage et dérives » ; R 32, R 33 |
| EX-22 | Intervention de maintenance réalisée documentée (compte rendu) | SQL « rattache gammes et interventions … » ; démo « refuse une intervention réalisée sans compte rendu » |
| EX-23 | Change control : approbation et clôture signées, requalification clôturée exigée si demandée, figé après clôture | SQL « approuve et clôture un changement par signature » ; démo « exige la requalification » ; R 35 |
| EX-24 | Revue périodique générée et archivée dans la GED pour approbation | R 37 |
| EX-25 | Exports des données (CSV, sauvegarde JSON complète) | Domaine « Export CSV » ; R 38 |
| EX-26 | Le registre applicatif des tables reflète exactement le schéma (droits, rattachements, défauts) | SQL « Registre des tables ⇄ schéma SQL » (4 tests) |

Résultat à la version 1.0.0 : **119 tests automatisés et 41 étapes de recette réussis** (`npm test`, `npm run recette`).

## 3. Architecture et principes de sécurité

- Le navigateur n'a que la clé publique ; **toutes les règles sont dans la base** : politiques RLS générées par `app.politiques()`, déclencheurs de cohérence, de numérotation, de signature exigée (`app.exiger_signature`), de journal (`app.tracer`) et règles métier propres à chaque table.
- Le mode démonstration applique les mêmes règles depuis le registre `src/data/schema.ts` et `src/data/regles.ts` ; leur cohérence avec le SQL est vérifiée par les tests EX-26.
- Les migrations sont **en ajout seul** : une version déployée n'est jamais modifiée, toute évolution passe par une nouvelle migration.

## 4. Stratégie de test

| Niveau | Contenu | Outil |
|---|---|---|
| Domaine | Calculs normatifs, générateurs (gabarits, procédures, plans), verdicts, échéances | vitest |
| Base de données | Migrations réelles appliquées sur PostgreSQL, droits testés utilisateur par utilisateur, règles et déclencheurs | vitest + PGlite |
| Parité démo | Mêmes règles dans le mode démonstration | vitest |
| Recette | Parcours utilisateur complet dans Chromium, aucune erreur console | Playwright |

Toute modification du code ou du schéma rejoue l'ensemble avant livraison.

## 5. Contrôle de mise en service sur l'instance hébergée (à exécuter et signer)

| Étape | Attendu | Fait le / par |
|---|---|---|
| Projet Supabase en région UE, sauvegardes quotidiennes et restauration à un instant (PITR) activées | Conforme à la politique de sauvegarde du site | |
| Migrations 0001 à 0009 appliquées dans l'ordre, sans erreur | `select count(*) from supabase_migrations.schema_migrations` (CLI) ou contrôle manuel | |
| RLS active sur toutes les tables publiques | `select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity` ne renvoie rien | |
| Politique de mot de passe et durée de session réglées (Authentication → Policies) | Conforme à la politique sécurité du site | |
| Variables `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` de production, site en HTTPS | Écran de connexion sans bandeau « Mode démonstration » | |
| Deux comptes de test : un administrateur, un opérateur | L'opérateur ne peut ni créer une salle, ni ouvrir la configuration, ni le journal | |
| Signature avec un mot de passe faux | Refusée | |
| Modification d'une zone puis consultation du journal | Ancienne et nouvelle valeurs tracées avec l'auteur | |
| Approbation d'un document sans signature | Refusée par la base | |
| Résultat au-delà de la limite d'action | Écart ouvert automatiquement | |
| Export de sauvegarde JSON (Configuration) | Fichier téléchargé, contenu lisible | |
| Revue des droits par défaut au regard de l'organisation réelle | Matrice ajustée et approuvée | |

## 6. Limites connues et écarts assumés

- **Ressaisie du mot de passe à la signature** : contrôlée par l'application (nouvelle authentification Supabase), pas prouvée côté serveur dans la signature elle-même. Pour un usage Part 11 strict, ajouter une fonction serveur (Edge Function) qui vérifie l'identité avant d'appeler `signer()`.
- **Séparation rédacteur / approbateur** non imposée : une même personne de niveau validation peut rédiger et approuver. À imposer par procédure ou par une règle supplémentaire si exigé.
- **Documents** : visibles de toute l'organisation (pas de restriction par site).
- **Notifications** : dans l'application uniquement, pas d'e-mail.
- **Hors ligne** : seule la saisie des nettoyages en mode terrain est mise en file d'attente ; les autres écrans demandent le réseau.
- **Imports GTC** : par fichier CSV (pas de connexion directe) ; agréger à l'heure avant import pour les exports à la minute.
- **Énergie** : estimation des ventilateurs seuls (loi de similitude), pas de mesure.
- **Revue périodique** : archivée comme instantané HTML dans la GED ; l'approbation se fait par le circuit documentaire signé.
- **Contenu métier des gabarits** (fréquences, produits, limites proposées) : point de départ à relire par une personne formée du secteur ; chaque objet généré porte la mention « à valider ».
- **Validation réalisée sur PostgreSQL embarqué et en mode démonstration** : la qualification sur l'instance Supabase réelle (§5) reste à faire.

## 7. Exploitation

- **Versions** : chaque livraison est étiquetée dans git ; le numéro de version de `package.json` est incrémenté ; la liste des migrations appliquées fait foi pour le schéma.
- **Changements de l'outil** : passent par le change control de l'application elle-même (catégorie « documentation » ou « autre »), avec rejeu des tests et de la recette avant mise en production.
- **Sauvegardes** : sauvegarde Supabase quotidienne + export JSON mensuel archivé hors de Supabase ; test de restauration annuel.
- **Revue des accès** : semestrielle, depuis Configuration → Utilisateurs (comptes inactifs désactivés, rôles conformes aux fonctions).
- **Incidents** : déclarés comme écart (origine « autre »), avec évaluation de l'impact sur les enregistrements.
