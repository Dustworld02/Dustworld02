# 🧽 Gestion Nettoyage

Logiciel de gestion complet pour entreprise de nettoyage, dans **un seul fichier** : `index.html`. Aucune installation, aucun serveur : téléchargez le fichier et ouvrez-le d'un double-clic dans votre navigateur. Tout fonctionne hors ligne et s'imprime proprement en PDF.

## Les onglets

### 🏠 Accueil
Le tableau de bord : chiffres clés du mois en cours (CA des contrats, coûts, **marge estimée**, heures planifiées et retenues, interventions, taux de conformité qualité) + **centre d'alertes cliquables** (contrôles techniques, révisions en retard, stocks sous seuil, tickets à traiter, anomalies, coûts horaires manquants, journées non pointées) + le planning du jour.

### 📅 Planning
Planning des salariés en vue **Semaine** ou **Mois** :
- créneaux de travail (horaires, **client**, description du travail) et **trajets 🚗** (durée, km, lieu de départ → arrivée) ;
- repos, congés, fériés, notes ; réorganisation par glisser-déposer (poignée ⠿) ;
- totaux d'heures par salarié et par jour, kilomètres comptés **une seule fois par véhicule partagé** (équipes) ;
- **📋 Copier une semaine…** (jusqu'à 8 semaines en arrière — pour un roulement une semaine sur deux, copiez « il y a 2 semaines ») et **👤➜👤 Dupliquer salarié** ;
- impression A4 paysage (semaine) ou portrait (mois).

### 📋 Interventions
Quatre sous-onglets pour le suivi terrain :
- **📝 Bons d'intervention** (numérotés BI-AAAA-NNN) : créés en un clic pour un client et une date, ils reprennent la check-list du client (cochable), les consommables prévus (quantités ajustables) avec **décrément du stock en un clic** (une seule fois, tracé dans les mouvements), l'équipe et les horaires pré-remplis du planning, observations et anomalies, **signature du client au doigt** (ou à la souris), impression A4 avec **QR code du site**.
- **🔍 Contrôles qualité** : grille dérivée de la check-list du client, notation Conforme / Non conforme point par point, **taux de conformité calculé**, historique et tendance par client, rapport imprimable à présenter au client, création d'un ticket correctif depuis un point non conforme.
- **🎫 Tickets** : réclamations, oublis et demandes ponctuelles, avec priorité et statut (ouvert → en cours → clos).
- **⏱️ Pointage** : les **heures réelles** jour par jour, pré-remplies depuis le planning (bouton « conforme au planning »), pointages hors planning possibles. Les heures pointées remplacent les heures planifiées dans les marges, les feuilles de temps et l'export facturation.

### 🧑‍💼 Clients
Une fiche par client :
- coordonnées, contact, notes (codes, alarme…) ;
- **contrat** : forfait mensuel ou taux horaire (heures facturées/mois), statut actif/terminé ;
- **protocole / procédure** : les étapes de nettoyage, ordonnées ;
- **check-list** : les points à vérifier à chaque intervention ;
- **consommables par intervention** (référencés dans Stocks, avec coût calculé) et **matériel nécessaire** ;
- temps à passer et fréquence mensuelle ;
- deux impressions : **🖨️ Fiche** (récapitulatif interne) et **🖨️ Check-list** — la feuille d'intervention vierge que l'équipe emporte (cases à cocher, consommables à emporter, observations, signatures).

### 👥 Personnel
Fiches salariés : poste, couleur du planning, véhicule attribué, coordonnées, type de contrat, date d'entrée, **heures de contrat (h/semaine)** et **coût horaire chargé**. La fiche affiche les heures mensualisées (× 52/12, ex. 35 h/semaine = 151h40/mois) et le **coût mensuel** du salarié. Ces deux champs alimentent la **masse salariale** (indicateur de l'Accueil, bandeau des Marges avec la part affectée aux clients, et écart contrat/réalisé dans les feuilles de temps).

### 🌴 Congés
Gestion complète des congés et absences, en **jours ouvrables** (lundi → samedi, hors jours fériés — calcul automatique de Pâques, Ascension et Pentecôte) :
- **Soldes** : par salarié, jours acquis à ce jour (2,5 j/mois travaillé, plafond 30 j sur la période de référence 1er juin → 31 mai), report de la période précédente (modifiable), corrections manuelles, jours pris, demandes en attente et **solde restant** ; période navigable, impression du récapitulatif.
- **Demandes** : saisie salarié / type / du–au avec demi-journées, **aperçu du décompte et du solde restant avant validation** (alerte si insuffisant), statuts En attente / Validé / Refusé, **attestation imprimable** par absence. Types gérés : congés payés (décomptés du solde), RTT, arrêt maladie, congé sans solde, formation, événement familial.
- **Calendrier** : vue annuelle par salarié, pastilles colorées par type — pour repérer les chevauchements d'équipe avant d'accorder une demande (imprimable en paysage).

Une absence **validée** marque automatiquement les journées dans le planning (sans écraser un créneau de travail déjà saisi) ; un refus ou une suppression les retire. Les demandes en attente apparaissent dans les alertes de l'Accueil, et les absents du jour dans le planning du jour.

### 📦 Stocks
Consommables : quantités, seuil d'alerte (lignes rouges sous le seuil), prix unitaire, entrées/sorties (journal), et **besoin théorique du mois** = besoins des clients × interventions planifiées.

### 🧰 Matériel
Inventaire : quantité, état (bon / moyen / hors service) et localisation (dépôt, véhicule ou laissé chez un client).

### 🚙 Véhicules
Une fiche par véhicule : compteur km, **contrôle technique** (alerte à moins de 45 jours), **pleins de carburant** (objectif mensuel et pleins réalisés), révisions avec échéance par date ou km, matériel embarqué, km saisis au planning ce mois-ci.

### 📊 Marges
Tableau de bord mensuel par client, calculé automatiquement à partir du planning :
- heures planifiées et **interventions** (jours distincts — une équipe de 2 le même jour = 1 intervention) ;
- **CA** (forfait, ou heures facturées × taux) ;
- **coût de main-d'œuvre** (heures de chaque salarié × son coût horaire) ;
- **coût des consommables** (besoins par intervention × interventions) ;
- **marge en € et en %**, totaux, et alertes : client du planning sans fiche (bouton « Créer la fiche »), contrat manquant, coût horaire non renseigné, dépassement d'heures.

Le rapprochement planning ↔ clients se fait par le nom, sans tenir compte des majuscules ni des accents. Quand des pointages existent, une colonne « **Heures retenues** » apparaît : le coût de main-d'œuvre est alors calculé sur les heures réelles.

### 📈 Rapports
- **🧑‍💼 Rapport client mensuel** : le document à remettre chaque mois à vos clients — interventions réalisées (bons, anomalies, signatures), heures planifiées/effectuées, taux de conformité qualité, consommables utilisés.
- **⏱️ Feuilles de temps** : par salarié et par mois, planifié vs réel jour par jour, congés/fériés comptés, imprimable, et **export CSV prépaie** de tous les salariés (s'ouvre dans Excel, à transmettre à l'expert-comptable).
- **🧾 Export facturation** : le tableau mensuel de ce qu'il y a à facturer par client (forfait ou heures × taux, sur les heures retenues), exporté en **CSV** pour votre logiciel de facturation et en **JSON** — le format qui servira à la future connexion par API.

## 💾 Sauvegarde

Les données sont enregistrées automatiquement dans le navigateur (localStorage). Le bouton **💾 Sauvegarde** permet :
- **d'exporter** toutes les données dans un fichier `nettoyage-sauvegarde-AAAA-MM-JJ.json` (à conserver précieusement — c'est votre sauvegarde) ;
- **d'importer** un fichier de sauvegarde (remplace les données actuelles, après confirmation).

> 💡 Exportez régulièrement, et avant tout changement d'ordinateur ou de navigateur.

## 🖨️ Impression PDF

Le bouton **🖨️ Imprimer / PDF** imprime l'onglet affiché (choisissez « Enregistrer au format PDF » comme destination). Le format s'adapte tout seul (paysage/portrait). Activez « Graphiques d'arrière-plan » si les couleurs manquent.

## 🗺️ Feuille de route « version connectée » (pointage QR, mobiles, API)

L'application actuelle fonctionne sans serveur : c'est sa force (gratuite, hors ligne, aucune donnée chez un tiers) et sa limite (un seul appareil). Pour le pointage par QR chez les clients, les rapports mobiles des agents et la connexion au logiciel de facturation, il faudra une version hébergée :

1. **Héberger la même application en HTTPS** (PWA installable) — débloque l'appareil photo et le scan de QR depuis un téléphone.
2. **Petit serveur de synchronisation** (par ex. Supabase) : comptes agents, pointage en scannant le **QR déjà imprimé sur les feuilles d'intervention** (horodatage par le serveur), rapports d'intervention mobiles avec photos, synchronisation des enregistrements (chaque bon porte déjà un champ `syncState` prévu pour cela), **connexion API du logiciel de facturation** (l'export JSON actuel en définit le format).
3. **Anti-fraude du pointage** : plutôt qu'un QR « dynamique » (qui exigerait un écran chez chaque client), privilégier des **tags NFC** (~0,50 € pièce) ou la capture d'une position GPS ponctuelle au moment du scan.

⚠️ **Géolocalisation en continu des salariés : déconseillée.** En France (CNIL), elle n'est licite pour le suivi du temps de travail que si aucun autre moyen n'existe — or le pointage déclaratif de cette application existe précisément. Toute mise en place exigerait analyse d'impact, information écrite préalable des salariés, désactivation hors temps de travail et conservation limitée.

## 🛠️ Technique

Un seul fichier `index.html` (HTML + CSS + JavaScript), sans dépendance externe (bibliothèque de QR codes MIT embarquée). Données en localStorage, migration automatique des anciennes versions, export/import JSON, exports CSV (prépaie, facturation).
