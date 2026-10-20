# Plan de développement — Outil de gestion des salles propres et ZAC

Version 4 — 20 octobre 2026

---

## Avancement

| Phase | État | Où |
|---|---|---|
| 0 — Cadrage | Questions du §9 encore ouvertes ; hypothèse de travail : secteur pilote dispositifs médicaux | ce document |
| 1 — Socle | **Livrée** (20 octobre 2026) | dossier `salles-propres/` |
| 2 à 7 | À faire | — |

Écarts assumés par rapport au texte du plan, décidés pendant la phase 1 :

- **Hiérarchie** : Organisation → **Entreprise** → Site → **Salle propre** → Zone. Le niveau Entreprise permet de gérer les salles de plusieurs clients ; le secteur d'activité est porté par la salle propre (proposé par défaut depuis l'entreprise), conformément à la demande « sélectionner un secteur à la création d'une salle blanche pour une entreprise donnée ». Le bâtiment et l'étage sont des attributs de la salle plutôt qu'un niveau à part.
- **Référentiels** : les tables normatives (ISO 14644-1, tableau A.1, Annexe 1) sont en lecture seule ; seules les périodicités et les types de documents sont personnalisables par organisation. Modifier une table normative doit rester un changement de version de l'outil, relu.
- **Reportés** de la phase 1 : notifications e-mail, double authentification et politique de mot de passe (paramètres Supabase, à régler à la mise en service), restriction des documents par site, séparation imposée rédacteur / approbateur.

---

## 0. Lire ceci d'abord : trois décisions qui conditionnent tout le reste

**Décisions prises le 20 octobre 2026** : application hébergée dès la v1 (§0.1) et piste d'audit + signatures conçues dans le socle (§0.2). Les paragraphes ci-dessous gardent l'argumentaire pour mémoire.

### 0.1 Le fichier unique + localStorage ne tient pas pour ce projet

L'application `index.html` actuelle (Gestion Nettoyage) fonctionne sans serveur. C'est très bien pour un usage mono-poste, mais le cahier des charges demande :

- des **utilisateurs avec des droits différents** (panneau de configuration),
- un **lieu d'échange avec historique**,
- un tableau Kanban avec **propriétaires** de tâches,
- des **documents de qualification accessibles** à plusieurs personnes.

Tout cela suppose plusieurs personnes connectées sur des postes différents. Avec localStorage, un « utilisateur » n'est qu'un libellé : n'importe qui ouvrant le fichier voit et modifie tout. Les droits seraient purement cosmétiques, et un auditeur le verrait immédiatement.

**Décision : application web hébergée dès la v1**, avec une base de données et une authentification réelles (détail en §6). L'approche « fichier unique » est abandonnée pour ce projet.

### 0.2 Statut réglementaire : outil de pilotage ou système GxP ?

Si l'outil devient **l'enregistrement officiel** des qualifications, des nettoyages ou des CAPA dans un contexte pharmaceutique ou dispositif médical (BPF Annexe 11, 21 CFR Part 11), il doit lui-même être validé (piste d'audit inviolable, signatures électroniques, gestion des versions, sauvegardes, validation du système informatisé).

Ce n'est pas le cas pour un laboratoire, un atelier micro-électronique ou une ZAC hospitalière hors pharmacie à usage intérieur, où les exigences sont plus souples.

**Décision : la piste d'audit et les signatures sont conçues dès le socle (phase 1).** La v1 reste annoncée comme outil de pilotage, les documents signés restant la référence réglementaire. La validation CSV du logiciel est une phase à part (phase 7), à décider plus tard selon le secteur.

### 0.3 Ne pas tout construire en même temps

Le périmètre demandé représente 8 modules métier, un socle et une bibliothèque de gabarits par secteur (§4.0). Les enchaîner dans le bon ordre est ce qui évite de refaire. L'ordre proposé en §7 est dicté par les dépendances de données : tout repose sur le référentiel « site → zones → classes → équipements ». Il doit exister avant la qualification, qui doit exister avant le nettoyage validé, etc.

---

## 1. Objectif et utilisateurs

**Objectif** : un seul outil pour modéliser une salle propre ou une ZAC (locaux, mobilier, équipements, traitement d'air), y rattacher les exigences (classe ISO, grade BPF, limites particulaires et microbiologiques), et piloter tout le cycle de vie : qualification initiale et périodique, surveillance, nettoyage, écarts et CAPA, tâches, documents, échanges.

**Utilisateurs cibles** (ils deviennent les rôles du §8) :

| Rôle | Ce qu'il fait dans l'outil |
|---|---|
| Administrateur | Configuration, utilisateurs, droits, référentiels |
| Responsable Assurance Qualité | Approuve protocoles et rapports, pilote CAPA, clôture les écarts |
| Responsable technique / maintenance | CTA, filtres, instruments, interventions, maintenance préventive |
| Qualificateur / métrologue (interne ou prestataire) | Exécute les essais, saisit les résultats, joint les rapports |
| Responsable nettoyage / hygiène | Plans de nettoyage, produits, planning, enregistrements |
| Opérateur (production, nettoyage) | Exécute et enregistre, remonte des anomalies |
| Lecteur / auditeur | Lecture seule, exports |

**Hors périmètre v1** (à dire clairement pour ne pas se disperser) :

- supervision temps réel (GTC/BMS, compteurs particulaires en continu) : prévu en phase 6 par import, pas en connexion directe en v1 ;
- modélisation 3D et simulation CFD : la v1 fait un plan 2D annoté ; la 3D n'apporte rien au pilotage ;
- gestion de la production (lots, batch records) : hors sujet ;
- LIMS microbiologique complet : on enregistre les résultats, on ne gère pas le laboratoire.

---

## 2. Référentiels à embarquer dans l'outil

Ces données sont des **tables de configuration** livrées avec l'outil, modifiables par l'administrateur (les normes évoluent).

### 2.1 Classes ISO 14644-1:2015 — concentrations maximales (particules/m³)

| Classe ISO | ≥ 0,1 µm | ≥ 0,2 µm | ≥ 0,3 µm | ≥ 0,5 µm | ≥ 1 µm | ≥ 5 µm |
|---|---|---|---|---|---|---|
| ISO 1 | 10 | — | — | — | — | — |
| ISO 2 | 100 | 24 | 10 | — | — | — |
| ISO 3 | 1 000 | 237 | 102 | 35 | — | — |
| ISO 4 | 10 000 | 2 370 | 1 020 | 352 | 83 | — |
| ISO 5 | 100 000 | 23 700 | 10 200 | 3 520 | 832 | — |
| ISO 6 | 1 000 000 | 237 000 | 102 000 | 35 200 | 8 320 | 293 |
| ISO 7 | — | — | — | 352 000 | 83 200 | 2 930 |
| ISO 8 | — | — | — | 3 520 000 | 832 000 | 29 300 |
| ISO 9 | — | — | — | 35 200 000 | 8 320 000 | 293 000 |

Nombre minimal de points de prélèvement selon la surface (tableau A.1 de la norme) : à embarquer aussi, il sert au générateur de plan d'échantillonnage (§5.3).

### 2.2 Grades BPF (Annexe 1, 2022) — correspondance usuelle

| Grade | Au repos (≈ ISO) | En activité (≈ ISO) | Limites microbio en activité (air, UFC/m³) |
|---|---|---|---|
| A | ISO 5 | ISO 5 | pas de croissance |
| B | ISO 5 | ISO 7 | 10 |
| C | ISO 7 | ISO 8 | 100 |
| D | ISO 8 | non défini | 200 |

Les limites surfaces (UFC/boîte contact) et gants sont aussi à stocker. Chaque zone porte des **limites d'alerte et d'action** propres, par défaut dérivées du grade, modifiables.

### 2.3 Autres référentiels à prévoir

- ISO 14644-2 (surveillance, périodicité des essais), 14644-3 (méthodes d'essai), 14644-4 (conception), 14644-5 (exploitation : habillage, nettoyage), 14644-7 (dispositifs séparatifs : isolateurs, PSM), 14644-16 (énergie), 14644-17 (taux de dépôt particulaire) ;
- contamination chimique et surfaces : ISO 14644-8 (contamination moléculaire aéroportée, AMC : acides, bases, condensables, dopants, COV), 14644-9 (propreté particulaire des surfaces), 14644-10 (propreté chimique des surfaces), 14644-13 (nettoyage des surfaces), 14644-15 (dégazage des matériaux) ;
- ISO 14698-1/2 (biocontamination), NF S 90-351 (établissements de santé : classes de risque 1 à 4, zones 1 à 4), EN 12469 (PSM), EN 1822 (filtres HEPA/ULPA H13/H14/U15…) ;
- FD S 90-351 carnet sanitaire de l'air.

### 2.4 Périodicités minimales (ISO 14644-2:2015) — base des échéanciers

| Essai | ISO ≤ 5 | ISO > 5 |
|---|---|---|
| Classification particulaire | 6 mois | 12 mois |
| Pression différentielle | 12 mois | 12 mois |
| Débit / vitesse d'air | 12 mois | 12 mois |
| Intégrité filtres, visualisation des flux, temps de récupération, étanchéité (optionnels) | 24 mois conseillé | 24 mois conseillé |

Ces délais sont des **valeurs par défaut** : l'outil doit permettre de les resserrer par zone (analyse de risque) et de les justifier.

---

## 3. Modèle de données

Entités principales et liens. Tout objet porte `créé_par / créé_le / modifié_par / modifié_le` et une entrée dans le **journal d'audit** (qui, quand, quoi, ancienne et nouvelle valeur).

```
Organisation
 └─ Site
     ├─ Secteur d'activité (pharma stérile, pharma non stérile, dispositifs médicaux, micro-électronique, hôpital,
     │   biotech/laboratoire, cosmétique, agroalimentaire, aérospatial/optique) + gabarit appliqué et sa version
     └─ Bâtiment / Étage
         └─ Zone (salle, SAS personnel, SAS matériel, passe-plat, zone de pesée, couloir propre…)
             ├─ Classification : classe ISO au repos / en activité, grade BPF, classe NF S 90-351
             ├─ Exigences : limites particulaires, microbio (air, surfaces, gants), pression (consigne ± tol.),
             │              renouvellement d'air (vol/h), T°, HR, temps de récupération cible
             ├─ Géométrie : polygone sur le plan 2D, surface, hauteur, volume (calculé)
             ├─ Ouvertures : portes (vers quelle zone, asservissement), passe-plats
             ├─ Mobilier (lit du plan 2D) : paillasses, étagères, chariots, poubelles… position, matériau, nettoyabilité
             ├─ Équipements : PSM, isolateur, hotte à flux laminaire, autoclave, balance, compteur…
             ├─ Bouches : soufflage / reprise / extraction, avec filtre terminal (HEPA H14…) et CTA source
             ├─ Points de prélèvement : particulaire, air microbio, surfaces, pression (position sur le plan)
             └─ Plan de nettoyage applicable

CTA (centrale de traitement d'air)
 ├─ Caractéristiques : débit nominal, étages de filtration (G4/F7/F9/H13…), recyclage/air neuf, batteries, humidif.
 ├─ Réseaux : gaines → bouches (zones desservies) → cascade de pression déduite
 ├─ Filtres : référence, classe EN 1822, date de pose, Δp, échéance de remplacement, test d'intégrité
 └─ Sondes fixes : Δp, T°, HR (ce sont des Instruments, ci-dessous)

Instrument (parc métrologique)
 ├─ Identité : type (compteur particulaire, biocollecteur, anémomètre, manomètre, sonde T°/HR, luminomètre ATP,
 │             analyseur COV / AMC, conductimètre…), marque, modèle, n° de série, plage, résolution, incertitude
 ├─ Étalonnage : périodicité, dernier certificat (document GED), prochaine échéance, statut (valide / à étalonner / hors service)
 ├─ Localisation / affectation, prêt, maintenance
 └─ Résultats produits par cet instrument (lien inverse : permet de retrouver tous les résultats impactés par un
    étalonnage non conforme et d'ouvrir l'écart correspondant)

Qualification
 ├─ Objet qualifié : zone, CTA, équipement (ou « salle entière » = jeu de zones)
 ├─ Campagne : initiale / périodique / après modification (change control)
 ├─ Protocole (QC / QI / QO / QP) → Essais → Résultats → Écarts → Rapport → Approbation
 └─ Échéancier : prochaine échéance par essai et par objet

Essai (catalogue ISO 14644-3 + spécifiques équipement)
 ├─ Méthode, instrument utilisé (avec étalonnage valide), critère d'acceptation (hérité de la zone)
 ├─ Points mesurés, valeurs, état d'occupation (au repos / en activité / après construction)
 └─ Verdict calculé + validé par un humain

Suivi des contaminations (entrepôt unique de tous les résultats de mesure)
 ├─ Résultat : date/heure, zone, point de prélèvement (sur le plan), instrument (étalonnage valide exigé),
 │   opérateur, état d'occupation (repos / activité)
 │   ├─ Milieu : AIR (aérien) / SURFACE / GANTS-TENUE / LIQUIDE (eau, solutions)
 │   ├─ Nature : PARTICULAIRE (particules/m³ par taille, taux de dépôt ISO 14644-17, propreté surface ISO 14644-9)
 │   │           MICROBIOLOGIQUE (UFC/m³, UFC/boîte contact, UFC/écouvillon, identification des germes, ATP en RLU)
 │   │           CHIMIQUE (AMC ISO 14644-8 : COV, acides, bases, condensables ; résidus de surface ISO 14644-10 ;
 │   │                     résidus de produits de nettoyage ; endotoxines ; TOC / conductivité des eaux)
 │   ├─ Méthode, unité, valeur(s), limite d'alerte, limite d'action, verdict (conforme / alerte / action)
 │   └─ Origine : qualification (essai), surveillance de routine, validation de nettoyage, investigation d'écart
 ├─ Plan d'échantillonnage (points, fréquence, méthode, limites alerte/action, par nature et par milieu)
 ├─ Séries temporelles par point / zone / nature / milieu → tendances, dérives, comparaison repos vs activité
 └─ Dépassement ou dérive → Écart automatique → CAPA

Écart / Déviation → Analyse de cause → CAPA (actions, propriétaire, échéance, vérification d'efficacité, clôture)

Nettoyage
 ├─ Produits (détergents, désinfectants, sporicides) : FDS, dilution, temps de contact, spectre, rotation
 ├─ Procédures par type de zone / classe : étapes ordonnées, matériel dédié, fréquence, sens (propre→sale, haut→bas)
 ├─ Planning (généré depuis les fréquences) → Interventions → Enregistrements (qui, quand, produit, lot, durée)
 ├─ Validation du nettoyage : contrôles visuels, ATP, prélèvements microbio, résultats
 └─ Matériel de nettoyage : affectation par zone / classe, état, remplacement

Tâche (Kanban) : titre, description, colonne, propriétaire, échéance, priorité, objet lié (zone, CAPA, essai…), pièces jointes
Discussion : fil rattaché à n'importe quel objet, messages horodatés, mentions, pièces jointes, jamais supprimés (archivage)
Document : fichier versionné, type (protocole, rapport, certificat, FDS, procédure, plan…), objet(s) lié(s), statut (brouillon / en revue / approuvé / périmé), date de validité
Personnel : habilitations (zones autorisées, classes), formations (habillage, comportement, nettoyage), échéances de recyclage
Utilisateur, Rôle, Permission (§8)

Secteur d'activité
 ├─ Référentiels par défaut (BPF Annexe 1, ISO 13485, ISO 14644-8, NF S 90-351, ISO 22716…), vocabulaire (grade / classe / zone)
 ├─ Gabarits (versionnés, éditables par l'administrateur, exportables / importables en JSON)
 │   ├─ Types de zones et classes par défaut (ex. DM : salle de production ISO 7, SAS ISO 8, zone d'emballage ISO 8)
 │   ├─ Règles de dérivation : fréquence de nettoyage, fréquence de surveillance, périodicité des essais
 │   │   = f(secteur, type de zone, classe ISO / grade, état d'activité)
 │   ├─ Procédures de nettoyage types : produits, consommables (lingettes, mops), techniques, ordre, matériel dédié
 │   ├─ Procédures d'habillage types par classe, plan d'échantillonnage type, catalogue d'essais type
 │   ├─ Modèles de documents (protocole, rapport, procédure, carnet sanitaire) avec la terminologie du secteur
 │   └─ Colonnes Kanban et cartes de démarrage (ex. « Qualification initiale », « Rédiger le plan de nettoyage »)
 └─ Objet généré : porte « généré depuis gabarit X vY », modifiable, re-synchronisable sur demande
```

---

## 4. Modules fonctionnels

### 4.0 Secteur d'activité et gabarits métier (assistant de création d'une salle)

À la création d'une salle propre pour une entreprise, l'utilisateur choisit un **secteur d'activité**. Ce choix pré-remplit l'ensemble des modules avec des contenus adaptés, tous modifiables. L'objectif : démarrer avec une base crédible en quelques minutes, pas avec des tables vides.

**Secteurs livrés en v1** (liste extensible dans le panneau de configuration) :

| Secteur | Référentiels par défaut | Spécificités injectées |
|---|---|---|
| Pharma stérile | BPF Annexe 1 (grades A à D), ISO 14644 | Rotation désinfectants + sporicide, limites microbio Annexe 1, habillage grade B, surveillance en activité renforcée |
| Pharma non stérile / cosmétique | BPF, ISO 22716 | Classes D / ISO 8, microbio moins fréquente, focus résidus de nettoyage |
| Dispositifs médicaux | ISO 13485, ISO 14644, ISO 14698 | Salles ISO 7/8, bioburden produit, lingettes polyester, traçabilité lots de produits de nettoyage |
| Micro-électronique / semi-conducteurs | ISO 14644-1/-8/-9, ESD | AMC (COV, acides, bases), eau déionisée + IPA, pas de sporicide, matériel antistatique, classes ISO 3 à 6 |
| Hôpital (PUI, bloc, stérilisation) | NF S 90-351, BPP | Classes de risque 1 à 4, carnet sanitaire de l'air, bionettoyage, zones 1 à 4 |
| Biotech / laboratoire (P2, P3) | ISO 14644-7, EN 12469, arrêtés confinement | PSM, pression négative, décontamination, déchets |
| Agroalimentaire (zones ultra-propres) | ISO 22000, HACCP | Désinfection alimentaire, sans résidu, fréquences par poste |
| Aérospatial / optique / mécanique | ISO 14644-9, ECSS-Q-ST-70 | Propreté particulaire des surfaces, dépôt, outils dédiés, pas de microbio |

**Ce que le gabarit génère à la création** (et uniquement si le module est activé pour l'entreprise) :

1. **Zones types** proposées avec leur classe par défaut (ex. DM : SAS personnel ISO 8, SAS matériel ISO 8, salle de production ISO 7, zone d'emballage ISO 8) ; l'utilisateur coche, renomme, change les classes. Les limites particulaires et microbio en découlent.
2. **Procédures de nettoyage** par type de zone, déjà renseignées :
   - consommables suggérés selon classe et secteur (ex. DM ISO 7 : lingettes polyester tricoté non pelucheuses, pré-imprégnées IPA 70 % ; micro-élec ISO 5 : polyester scellé, eau DI ; pharma grade A/B : stériles irradiées) ;
   - produits suggérés (détergent, désinfectant, sporicide si secteur stérile, rotation) avec dilutions et temps de contact à confirmer par la FDS fournisseur ;
   - techniques : surfaces en **S** avec chevauchement unidirectionnel, sols en **bandes parallèles** (mop plat), du plus propre vers le plus sale, du haut vers le bas, une face de lingette par passage ; schémas inclus ;
   - ordre des opérations et matériel dédié par zone (code couleur) ;
   - **fréquences calculées** par la règle de dérivation (voir ci-dessous).
3. **Procédures d'habillage** par SAS et par classe, avec la liste de tenue du secteur.
4. **Plan d'échantillonnage** type (natures mesurées, fréquences, limites) et **catalogue d'essais** de qualification pré-coché avec périodicités.
5. **Modèles de documents** à la terminologie du secteur (grade pour la pharma, classe de risque pour l'hôpital).
6. **Kanban de démarrage** avec les cartes du parcours de mise en service.

**Règle de dérivation des fréquences** (exemple pour dispositifs médicaux, modifiable dans la configuration) :

| Type de zone | Classe | Sols | Surfaces de travail | Murs / plafonds | Désinfection complète |
|---|---|---|---|---|---|
| Salle de production | ISO 7 | chaque poste | début et fin de poste | hebdomadaire | mensuelle |
| Salle de production | ISO 8 | quotidien | début de poste | mensuelle | trimestrielle |
| SAS personnel / matériel | ISO 8 | quotidien | quotidien | mensuelle | trimestrielle |
| Zone d'emballage | ISO 8 | quotidien | début de poste | mensuelle | trimestrielle |

La règle produit aussi la fréquence de surveillance (ex. DM ISO 7 : particulaire mensuel, microbio air et surfaces hebdomadaires en activité) et la périodicité des essais (ISO 14644-2 par défaut, resserrée pour les secteurs stériles).

**Traçabilité et mise à jour** : chaque objet généré garde la référence du gabarit et de sa version. Quand un gabarit évolue (nouvelle version de l'Annexe 1, changement de fournisseur de lingettes), l'outil propose zone par zone d'appliquer la mise à jour ou de conserver la version locale ; les objets déjà approuvés passent par le change control.

**Gabarits d'entreprise** : l'administrateur peut créer son propre gabarit à partir d'une salle existante (« enregistrer comme gabarit »), afin que la deuxième salle de la même entreprise démarre avec ses procédures à elle, pas avec le générique du secteur.

**Deux limites à annoncer clairement dans l'outil** :

- un gabarit est un **point de départ**, pas une procédure validée : les produits, dilutions et temps de contact doivent être confirmés par les FDS et la validation du nettoyage du site, et l'entreprise reste responsable de ses procédures ;
- le contenu des gabarits est un travail de rédaction métier distinct du développement (§7, phase « Contenu ») et doit être relu par une personne formée du secteur.

### 4.1 Modélisation de la salle (plan 2D interactif)

- Éditeur 2D sur grille : tracer les zones comme des polygones (ou rectangles), nommer, classer. Import d'un plan DWG/PDF en fond d'image calé à l'échelle.
- Portes et SAS : une porte relie deux zones. L'outil déduit la **cascade de pression** à partir des consignes de pression de chaque zone et l'affiche par des flèches colorées ; il signale toute cascade incohérente (zone plus propre à pression inférieure à sa voisine).
- Bouches de soufflage/reprise posées sur le plan, reliées à une CTA ; calcul automatique du **taux de renouvellement** (Σ débits soufflés / volume) et comparaison à la cible de la classe.
- Bibliothèque de mobilier et d'équipements (symboles), avec attributs de nettoyabilité (matériau, arêtes, roulettes…) et position. Permet d'éditer le **plan de nettoyage illustré** et le **plan des points de prélèvement**.
- Vue « cartographie des classes » : chaque zone colorée par classe ISO, avec légende, exportable en PDF (document de qualification).
- Vue « flux » : flux personnel, flux matériel, flux déchets dessinés comme des parcours (entrée → SAS → zone → sortie) ; contrôle des croisements propre/sale.

### 4.2 CTA et traitement d'air

- Fiche CTA avec schéma simplifié des étages (préfiltre → batteries → filtre fin → ventilateur → gaines → filtres terminaux).
- Filtres : échéances de remplacement, Δp relevées (saisie manuelle ou import), alerte quand la Δp dépasse le seuil de colmatage.
- Test d'intégrité des filtres terminaux (DEHS / Emery, fuite maximale admissible) rattaché à la qualification.
- Instruments de mesure et étalonnage : voir §4.4, le parc métrologique y est géré avec les résultats qu'il produit.
- **Carnet sanitaire de l'air** : généré automatiquement depuis les données (description des installations, maintenances, contrôles, résultats), imprimable ; c'est un livrable que l'ASPEC traite comme un sujet à part entière.

### 4.3 Qualification pas à pas (salle et équipements)

Démarche guidée sous forme d'**assistant** :

1. **Choisir l'objet** : zone(s), CTA, équipement (PSM, isolateur, hotte, autoclave…).
2. **Type de campagne** : initiale, périodique (générée par l'échéancier), après modification (lien change control).
3. **Protocole** : généré depuis un modèle selon l'objet et sa classe ; liste d'essais pré-cochée (ISO 14644-3 pour une zone, EN 12469 pour un PSM, ISO 14644-7 pour un isolateur) ; critères d'acceptation pré-remplis depuis les exigences de la zone ; circuit d'approbation (rédacteur → vérificateur → approbateur AQ).
4. **Exécution** : un écran par essai ; saisie des points et valeurs (ou import CSV du compteur) ; état d'occupation ; instrument utilisé ; calcul automatique du verdict (ex. classification : moyenne par point ≤ limite, nombre de points conforme au tableau A.1) ; photos et pièces jointes.
5. **Écarts** : tout essai non conforme crée un écart ; décision : refaire, accepter avec justification, ouvrir une CAPA.
6. **Rapport** : généré (PDF) depuis le protocole, les résultats et les écarts ; signé électroniquement ; versionné ; rangé dans la GED.
7. **Clôture** : statut qualifié / qualifié avec réserves / non qualifié ; mise à jour de l'échéance suivante ; badge visible sur le plan.

Essais du catalogue initial (ISO 14644-3) : comptage particulaire (classification), débit et vitesse d'air, pression différentielle, intégrité des filtres, visualisation des flux (fumée, vidéo jointe), temps de récupération / décontamination, étanchéité de l'enceinte, température et humidité, électrostatique, éclairage et bruit (optionnels). Pour les équipements : QC/QI/QO/QP avec URS, FAT/SAT, et essais spécifiques (PSM : vitesse frontale, flux descendant, test KI-Discus ; isolateur : test de fuite, intégrité gants, cycle de décontamination).

### 4.4 Instruments, étalonnage et suivi des contaminations

Un seul module, parce que les deux sujets sont liés : une mesure ne vaut que par l'instrument qui l'a produite, et un étalonnage non conforme doit permettre de retrouver toutes les mesures à remettre en cause.

**Instruments et étalonnage**

- Parc métrologique : fiche par instrument (type, série, plage, incertitude), affectation, état.
- Étalonnage : périodicité, certificat déposé en GED, échéance, alerte à 30 jours, blocage : un résultat ne peut être saisi ni un essai validé avec un instrument périmé ou hors service.
- Étalonnage non conforme : l'outil liste tous les résultats produits depuis le dernier étalonnage conforme et propose d'ouvrir un écart d'impact.
- Prestataires d'étalonnage et métrologie interne (étalons de référence, raccordement).

**Entrepôt unique des résultats (air et surfaces)**

Tous les résultats de mesure, quelle que soit leur origine (qualification, surveillance de routine, validation de nettoyage, investigation), sont enregistrés dans une même structure, classés selon deux axes :

| Milieu \ Nature | Particulaire | Microbiologique | Chimique |
|---|---|---|---|
| **Air (aérien)** | particules/m³ par taille (0,5 µm, 5 µm…), classification ISO | UFC/m³ (biocollecteur), boîtes de sédimentation (UFC/4 h), identification | AMC ISO 14644-8 : COV, acides, bases, condensables ; gaz spécifiques (H₂O₂ résiduel après décontamination) |
| **Surface** | propreté particulaire ISO 14644-9, taux de dépôt ISO 14644-17 (témoins), contrôle visuel | boîtes contact (UFC/25 cm²), écouvillons, ATP (RLU) | résidus ISO 14644-10, résidus de détergent/désinfectant, endotoxines, TOC |
| **Gants / tenue** | — | empreintes de gants (UFC/5 doigts), tenue | — |
| **Liquides** | — | eau, solutions préparées (UFC/ml) | conductivité, TOC |

- Chaque résultat porte : zone, point sur le plan, milieu, nature, méthode, unité, valeur, état d'occupation, instrument, opérateur, limites alerte et action héritées de la zone (modifiables par point), verdict calculé.
- Saisie manuelle, import CSV (compteur, biocollecteur, luminomètre, laboratoire externe), ou alimentation automatique par les essais de qualification et les validations de nettoyage.
- Plan d'échantillonnage par zone et par nature : points, fréquences, méthodes, limites ; générateur du nombre de points particulaires selon ISO 14644-1 A.1 ; fréquences microbio selon le grade (Annexe 1).

**Évolution et suivi des contaminations**

- Courbes par point, par zone, par nature et par milieu, avec limites d'alerte et d'action tracées ; comparaison au repos / en activité ; comparaison avant / après nettoyage.
- Règles de dérive configurables : n alertes consécutives, tendance croissante sur k mesures, récurrence d'un même germe, dépassement d'un seuil cumulé ; chaque déclenchement crée un écart.
- Cartographie de contamination sur le plan 2D : chaque point coloré selon son dernier verdict et sa tendance, filtrable par nature (particulaire / microbio / chimique). Permet de repérer une source (porte, équipement, poste de travail).
- Rapport de surveillance mensuel et annuel généré ; revue des tendances intégrée à la revue périodique.

### 4.5 Écarts et CAPA

- Écart : description, origine (qualification, surveillance, nettoyage, audit, plainte), gravité, impact produit/patient, zone liée.
- Analyse de cause (5 pourquoi, Ishikawa en champs guidés).
- CAPA : actions correctives et préventives, propriétaire, échéance, preuve, **vérification d'efficacité** à date différée, clôture AQ.
- Tableau de bord : CAPA en retard, par zone, par origine, délai moyen de clôture.

### 4.6 Tâches (Kanban type Trello)

- Colonnes configurables (par défaut : À faire / En cours / En attente / À vérifier / Terminé), glisser-déposer, propriétaire, échéance, priorité, étiquettes, checklist, pièces jointes, fil de discussion.
- Création automatique de cartes depuis : échéances de qualification, CAPA, remplacements de filtres, étalonnages, nettoyages périodiques non réalisés.
- Filtres : mes tâches, par zone, en retard ; vue calendrier ; notification e-mail aux échéances.

### 4.7 Nettoyage de A à Z

- **Point de départ** : les procédures, produits, consommables et fréquences sont pré-générés par le gabarit du secteur (§4.0), puis ajustés ici.
- **Référentiel produits et consommables** : fiche (famille, spectre, dilution, temps de contact, matériaux compatibles, FDS, rotation désinfectants, péremption des solutions préparées) ; consommables (lingettes par matière : polyester tricoté, polyester-cellulose, microfibre ; stériles ou non ; pré-imprégnées ; mops plats, têtes jetables) avec classes d'usage recommandées.
- **Procédures** par type de zone et classe : étapes ordonnées, matériel dédié (couleur/zone), fréquence (quotidien, hebdo, mensuel, après intervention), sens de nettoyage, contrôle attendu.
- **Planning** généré depuis les fréquences ; interventions attribuées ; mode terrain tablette (grandes cases, hors ligne, synchronisation).
- **Enregistrement** : qui, quand, produit et lot, durée, anomalie constatée, signature.
- **Validation du nettoyage** : protocole (visuel, ATP, prélèvements microbio avant/après), résultats, rapport ; revalidation périodique.
- **Matériel de nettoyage** : inventaire par zone, état, remplacement (mops, lingettes, autolaveuse), stocks de consommables (reprise du module Stocks de l'application existante).
- Lien avec les habilitations : un opérateur non formé ne peut pas être affecté à une zone de classe supérieure.

### 4.8 Personnel, habillage et formation (manque identifié via l'ASPEC)

Le catalogue ASPEC consacre une large place au comportement, à l'habillage et à la formation initiale ; votre liste ne le prévoyait pas, c'est pourtant la première source de contamination.

- Fiche personnel : zones autorisées, qualification d'habillage (avec tests de gants/tenue), formations suivies et échéances de recyclage, résultats.
- Règles : l'accès à une zone de grade B exige une qualification d'habillage valide ; alerte avant péremption.
- Procédures d'habillage par SAS, illustrées, affichables sur tablette à l'entrée.

### 4.9 Maintenance et change control (manque identifié)

- Maintenance préventive des CTA, filtres, PSM, instruments : gammes, périodicités, interventions, prestataires, rapports.
- **Change control** : toute modification (déplacement d'équipement, changement de filtre, travaux) déclenche une évaluation d'impact et, si nécessaire, une requalification. C'est ce qui relie maintenance et qualification ; sans ce module, l'historique de qualification devient faux après la première modification.

### 4.10 Documents (GED)

- Dépôt versionné, typé, lié aux objets ; recherche plein texte ; statut de cycle de vie ; dates de validité et alertes de péremption (certificats d'étalonnage, FDS, procédures).
- Modèles de documents (protocole, rapport, procédure de nettoyage, carnet sanitaire) générés par l'outil.

### 4.11 Échanges avec historique

- Un fil de discussion sur chaque objet (zone, CTA, essai, écart, CAPA, tâche, document) et un espace général par site.
- Messages horodatés, mentions `@`, pièces jointes, réactions ; jamais supprimés (archivés), conforme au besoin de traçabilité.
- Journal des notifications par utilisateur.

### 4.12 Tableau de bord et rapports

- État de qualification par zone (carte colorée), échéances à 30/60/90 jours, CAPA ouvertes, dérives de contamination par nature (particulaire / microbio / chimique), nettoyages non réalisés, filtres à remplacer, étalonnages périmés, formations à recycler.
- Exports PDF/CSV ; rapport de revue périodique (annuel) généré.

### 4.13 Performance énergétique (optionnel, phase 6)

L'ASPEC propose une formation dédiée (ISO 14644-16). Mesures simples : consigne de débit réduit hors activité, suivi des heures de fonctionnement des CTA, estimation des kWh. À ne pas faire en v1.

---

## 5. Ce que la revue du catalogue ASPEC a ajouté au périmètre

| Formation ASPEC | Fonctionnalité correspondante dans l'outil | Déjà dans votre demande ? |
|---|---|---|
| L'essentiel de la salle propre, e-learning contaminants et comportement | Module personnel, habilitations, formations (§4.8) | Non |
| ISO 14644-1 & 2 classification et surveillance | Tables de classes, générateur de points, échéancier, suivi particulaire (§2, §4.4) | Partiellement |
| Métrologie et essais, tests d'intégrité filtres, visualisation des flux | Catalogue d'essais 14644-3 (§4.3), parc métrologique et étalonnage (§4.4) | Partiellement |
| Qualification des locaux et traitement d'air (QC/QI/QO/QP) | Assistant de qualification (§4.3) | Oui |
| Biocontamination, stratégie d'échantillonnage | Suivi des contaminations microbio air / surfaces / gants, plan d'échantillonnage, tendances (§4.4) | Non |
| Nettoyage et désinfection (produits, techniques, validation) | Module nettoyage complet avec validation (§4.7) | Oui, la validation du nettoyage manquait |
| Carnet sanitaire de l'air | Génération du carnet depuis les données CTA (§4.2) | Non |
| PSM, isolateurs, bonnes pratiques | Qualification d'équipements séparatifs (§4.3) | Partiellement |
| Cahier des charges, bonnes pratiques de réalisation, projet hospitalier conception et maintenance | Maintenance, change control (§4.9), classes NF S 90-351 | Non |
| Performance énergétique | Module optionnel (§4.13) | Non |

Sources consultées : [Formations ASPEC](https://aspec.fr/formations/), [Contrôles et validations](https://aspec.fr/type-formation/formations-aspec/controles-et-validations/), [Conception et qualification](https://aspec.fr/type-formation/formations-aspec/conception-et-qualification/), [Généralités et fondamentaux](https://aspec.fr/type-formation/formations-aspec/generalites-fondamentaux/), [ISO 14644-1 & 2](https://aspec.fr/formations/iso-14644-classification-surveillance/), [Qualification des locaux et traitement d'air](https://aspec.fr/formations/qualification-locaux-traitement-air/), [Tests d'intégrité filtres](https://aspec.fr/formations/tests-integrite-filtres-dehs-emery/), [Visualisation des flux d'air](https://aspec.fr/formations/visualisation-flux-air-salles-propres/), [Métrologie et essais](https://aspec.fr/formations/metrologie-essais-salles-propres/), [Nettoyage et désinfection](https://aspec.fr/formations/nettoyage-desinfection-salle-propre/), [Biocontamination](https://aspec.fr/formations/biocontamination/), [Carnet sanitaire de l'air](https://aspec.fr/formations/carnet-sanitaire/), [PSM bonnes pratiques](https://aspec.fr/formations/psm-postes-securite-microbiologique/), [Cahier des charges](https://aspec.fr/formations/cahier-des-charges-salle-propre/), [Projet hospitalier conception et maintenance](https://aspec.fr/formations/projet-hospitalier-maintenance/), [Performance énergétique](https://aspec.fr/formations/formation-performance-energetique-salles-propres-aspec/), [Pharma hospitalière](https://aspec.fr/formations/formation-pharma-hospitaliere-aspec/).

---

## 6. Architecture technique recommandée

| Couche | Choix | Pourquoi |
|---|---|---|
| Interface | Application web (PWA installable), React + TypeScript, Vite | Fonctionne sur PC et tablette, installable, mode hors ligne possible pour le terrain (nettoyage, relevés) |
| Composants | Tailwind, shadcn/ui ; `dnd-kit` pour le Kanban ; SVG ou Konva pour l'éditeur de plan 2D | Éprouvés, pas de dépendance lourde |
| Backend | Supabase (PostgreSQL + Auth + Storage + Row Level Security) | Authentification, droits au niveau des lignes, stockage de fichiers, sans serveur à administrer ; un connecteur Supabase est déjà disponible dans votre espace |
| Piste d'audit | Déclencheurs PostgreSQL écrivant dans une table `audit_log` en ajout seul | Inviolable depuis l'interface, base d'une future validation Part 11 |
| Documents PDF | Génération côté client (impression navigateur, comme l'application actuelle) puis côté serveur si besoin de signature | Réutilise le savoir-faire d'impression existant |
| Hébergement | Vercel ou Netlify pour le front, Supabase pour les données ; région UE | Données en Europe, HTTPS natif |
| Import/export | CSV (compteurs, sondes), JSON complet (sauvegarde), PDF | Continuité avec l'application existante |

Points de vigilance :

- **Mode hors ligne** : seulement pour les écrans terrain (enregistrement de nettoyage, saisie de relevés), avec synchronisation et résolution de conflits simple (dernier écrit gagne + journal). Pas de hors ligne pour la configuration ou les approbations.
- **Signature électronique** : ré-authentification (mot de passe) au moment de signer, horodatage serveur, signification de la signature (rédigé / vérifié / approuvé), enregistrement dans l'audit. Suffisant pour une v1 non validée, et compatible avec Part 11 si validée ensuite.
- **Sauvegardes** : sauvegardes automatiques Supabase + export JSON hebdomadaire téléchargeable depuis le panneau de configuration.

Alternative si vous voulez absolument rester sans serveur pour commencer : réaliser les phases 1 à 3 en fichier unique avec un « utilisateur courant » déclaratif, puis migrer. Je le déconseille : les droits, la GED multi-utilisateur et les échanges devraient être refaits.

---

## 7. Plan par phases

Les durées sont indicatives, pour une personne à temps plein assistée par génération de code. Chaque phase livre quelque chose d'utilisable.

### Phase 0 — Cadrage (1 à 2 semaines)

- Répondre aux questions ouvertes du §9.
- Choisir un site pilote réel (plan, zones, classes, CTA) qui servira de jeu de données de test.
- Collecter vos modèles actuels de protocoles, rapports, procédures de nettoyage, plan de nettoyage, fiche CAPA : l'outil doit reproduire vos documents, pas en imposer d'autres.
- Livrable : ce plan validé, modèle de données figé pour le socle, maquettes des 5 écrans principaux.

### Phase 1 — Socle (3 à 4 semaines)

- Projet, authentification, utilisateurs, rôles, **panneau de configuration** et matrice de droits (§8).
- Référentiels : classes ISO, grades BPF, périodicités, catalogue d'essais, types de documents.
- **Secteurs d'activité et moteur de gabarits** (§4.0) : structure générique (un gabarit = description JSON versionnée des objets à créer + règles de dérivation), assistant de création d'une salle avec choix du secteur. En phase 1, le gabarit ne génère que les zones types et leurs classes ; chaque phase suivante ajoute sa part (procédures de nettoyage en phase 5, plan d'échantillonnage en phase 6…).
- Modèle site → bâtiment → zones (sans plan 2D encore) avec classification et exigences par zone.
- Journal d'audit, signature électronique simple, GED minimale (dépôt, version, lien à un objet).
- Livrable : on peut créer son site, ses zones avec leurs classes, inviter des utilisateurs avec des droits différents, déposer des documents.

### Phase 2 — Modélisation (3 à 4 semaines)

- Éditeur de plan 2D : zones, portes/SAS, bouches, mobilier, équipements, points de prélèvement ; fond de plan image.
- CTA, réseaux, filtres, instruments et étalonnages.
- Calculs : cascade de pression, renouvellement d'air, surfaces/volumes, nombre de points de prélèvement.
- Cartographie des classes et plans imprimables.
- Livrable : la salle entière est modélisée et vérifiée (incohérences de cascade signalées).

### Phase 3 — Qualification (4 à 5 semaines)

- Assistant de qualification (zones, CTA, équipements), modèles de protocole, exécution des essais avec verdicts calculés, écarts, rapport PDF, circuit d'approbation.
- **Entrepôt unique des résultats** (§4.4) construit ici, car les essais de qualification sont ses premiers producteurs : structure milieu × nature, limites héritées des zones, lien obligatoire à un instrument étalonné.
- Parc métrologique complet : étalonnages, blocage des instruments périmés, impact d'un étalonnage non conforme.
- Échéancier des requalifications, tableau de bord de l'état de qualification.
- Import CSV de résultats de compteur particulaire.
- Livrable : une campagne de qualification initiale complète, du protocole au rapport signé, sur le site pilote.

### Phase 4 — Écarts, CAPA, Kanban, échanges (3 semaines)

- Écarts et CAPA avec vérification d'efficacité.
- Kanban avec glisser-déposer, propriétaires, échéances, cartes automatiques.
- Fils de discussion sur tous les objets, mentions, notifications e-mail.
- Livrable : le pilotage quotidien se fait dans l'outil.

### Phase 5 — Nettoyage (4 semaines)

- Produits, procédures, planning généré, mode terrain tablette hors ligne, enregistrements, validation du nettoyage, matériel et consommables.
- Habilitations et formations du personnel (§4.8), car elles conditionnent les affectations.
- Livrable : un mois complet de nettoyage planifié, exécuté et enregistré sur le site pilote, avec sa validation.

### Phase 6 — Suivi des contaminations, maintenance, change control (4 semaines)

- Plan d'échantillonnage par nature et par milieu, saisie et imports de routine (biocollecteur, luminomètre, laboratoire externe, analyseur AMC).
- Courbes d'évolution, règles de dérive, cartographie de contamination sur le plan, rapports mensuel et annuel.
- Maintenance préventive, carnet sanitaire de l'air généré, change control → requalification.
- Imports depuis GTC/sondes (CSV, puis API si disponible).
- Module énergie optionnel.

### Phase 7 — Consolidation (2 à 3 semaines, puis en continu)

- Revue périodique annuelle générée, exports, performances, accessibilité tablette.
- Si contexte GxP : dossier de validation du logiciel (spécifications, tests, procédure d'exploitation), gel des versions.

### Phase transverse — Contenu des gabarits (3 à 4 semaines, en parallèle des phases 2 à 6)

- Rédaction du contenu métier par secteur : zones types, procédures de nettoyage (produits, lingettes, techniques, ordre), habillage, plans d'échantillonnage, règles de fréquence, modèles de documents.
- Priorité : le secteur de votre site pilote d'abord, complet et relu ; les autres secteurs ensuite, en commençant par les plus proches (DM puis pharma non stérile, par exemple).
- Relecture par une personne formée du secteur ; mention « point de départ, à valider » dans tous les objets générés.
- Livrable : bibliothèque de gabarits v1 importée dans l'outil, exportable en JSON.

Total indicatif : 27 à 35 semaines (le contenu des gabarits se fait en parallèle, mais c'est du temps de rédaction, pas de développement). Les phases 4 et 5 peuvent être inversées si le nettoyage est plus urgent que les CAPA.

---

## 8. Panneau de configuration et droits

### 8.1 Contenu du panneau

- Organisation, sites, logo, langue, fuseau.
- Utilisateurs : invitation par e-mail, activation/désactivation, rôle(s), sites autorisés, réinitialisation de mot de passe.
- Rôles et matrice de droits (ci-dessous), rôles personnalisés.
- Référentiels : classes, grades, limites par défaut, périodicités, catalogue d'essais, familles de produits, types de documents, colonnes du Kanban, modèles de documents.
- **Secteurs et gabarits** : bibliothèque des gabarits par secteur, versions, édition des règles de dérivation (fréquences), duplication, création d'un gabarit d'entreprise depuis une salle existante, import/export JSON, choix des modules activés par entreprise.
- Notifications : qui reçoit quoi (échéances, écarts, mentions), délais d'anticipation.
- Sécurité : politique de mot de passe, double authentification, durée de session, ré-authentification à la signature.
- Sauvegarde : export JSON complet, planification, restauration.
- Journal d'audit consultable et exportable.

### 8.2 Matrice de droits par défaut

Niveaux : `—` aucun, `L` lecture, `E` écriture, `V` validation/approbation, `A` administration.

| Module | Admin | Resp. AQ | Resp. technique | Qualificateur | Resp. nettoyage | Opérateur | Lecteur |
|---|---|---|---|---|---|---|---|
| Configuration, utilisateurs | A | L | — | — | — | — | — |
| Référentiels normatifs | A | V | L | L | L | L | L |
| Secteurs et gabarits | A | V | L | L | E (nettoyage) | — | L |
| Sites, zones, plan 2D | A | V | E | L | L | L | L |
| CTA, filtres | A | L | E | E | — | — | L |
| Qualification : protocoles | A | V | E | E | — | — | L |
| Qualification : exécution, résultats | A | V | L | E | — | — | L |
| Instruments, étalonnage | A | L | E | E | L | — | L |
| Suivi des contaminations : résultats, plans d'échantillonnage | A | V | L | E | E | E (saisie) | L |
| Suivi des contaminations : tendances, rapports | A | V | L | L | L | — | L |
| Écarts et CAPA | A | V | E | E | E | E (déclarer) | L |
| Kanban | A | E | E | E | E | E (ses cartes) | L |
| Nettoyage : produits, procédures | A | V | L | — | E | L | L |
| Nettoyage : planning, enregistrements | A | L | L | — | E | E (les siens) | L |
| Personnel, habilitations | A | V | L | — | E | L (soi) | — |
| Maintenance, change control | A | V | E | L | — | — | L |
| Documents | A | V | E | E | E | L | L |
| Discussions | A | E | E | E | E | E | L |
| Journal d'audit | A | L | — | — | — | — | — |

Règles transverses : un utilisateur ne voit que ses sites ; une permission peut être restreinte à une liste de zones (ex. prestataire de nettoyage limité à un bâtiment) ; les droits sont vérifiés côté base (RLS), pas seulement dans l'interface.

---

## 9. Questions ouvertes à trancher en phase 0

1. **Secteur et statut réglementaire** : pharma/DM (BPF Annexe 1, Part 11) ou laboratoire/industrie/hôpital ? Cela décide de la phase 7 et du niveau d'exigence des signatures.
2. **Qui qualifie** : prestataire externe (l'outil sert surtout à ranger et suivre ses rapports) ou équipe interne (l'outil doit porter l'exécution des essais) ? Les deux sont prévus, mais la priorité de la phase 3 change.
3. **Nombre de sites et d'utilisateurs** attendus à 12 mois : dimensionne l'hébergement et la gestion multi-sites.
4. **Reprise de l'existant** : y a-t-il des données à reprendre (résultats de qualification anciens, procédures Word) ? Prévoir un lot d'import.
5. **Terrain** : les opérateurs auront-ils des tablettes en zone ? Sinon, le mode hors ligne peut être repoussé.
6. **Secteurs prioritaires** : quel est le secteur de votre site pilote, et quels secteurs vos clients ou vos autres sites couvrent-ils à 12 mois ? Le contenu des gabarits se rédige dans cet ordre.
7. **Lien avec l'application Gestion Nettoyage existante** : réutiliser ses modules Stocks, Matériel, Personnel, Planning (code en vanilla JS) en les portant, ou repartir de zéro ? Mon avis : repartir de zéro sur le nouveau socle en reprenant la logique métier et les impressions, pas le code.

---

## 10. Risques

| Risque | Parade |
|---|---|
| Périmètre trop large, rien d'utilisable avant des mois | Phases livrables, site pilote réel dès la phase 1 |
| Gabarits sectoriels inexacts (mauvaise lingette, mauvaise fréquence) pris pour des procédures validées | Relecture métier par secteur, mention « point de départ » sur chaque objet généré, validation du nettoyage obligatoire avant usage officiel |
| Référentiels normatifs mal transcrits | Tables modifiables, relecture par une personne formée (les formations ASPEC ISO 14644-1 & 2 et qualification des locaux sont le bon niveau) |
| Outil utilisé comme enregistrement officiel sans être validé | Mention explicite dans l'outil, phase 7 décidée en connaissance de cause |
| Éditeur de plan 2D trop ambitieux | Commencer par des rectangles sur grille et un fond d'image ; les polygones libres viennent ensuite |
| Adoption terrain faible | Mode tablette simple, enregistrement en 3 gestes, pas de saisie redondante |
