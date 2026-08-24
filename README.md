# 🧽 Gestion Nettoyage

Logiciel de gestion complet pour entreprise de nettoyage, dans **un seul fichier** : `index.html`. Aucune installation, aucun serveur : téléchargez le fichier et ouvrez-le d'un double-clic dans votre navigateur. Tout fonctionne hors ligne et s'imprime proprement en PDF.

## Les onglets

### 📅 Planning
Planning des salariés en vue **Semaine** ou **Mois** :
- créneaux de travail (horaires, **client**, description du travail) et **trajets 🚗** (durée, km, lieu de départ → arrivée) ;
- repos, congés, fériés, notes ; réorganisation par glisser-déposer (poignée ⠿) ;
- totaux d'heures par salarié et par jour, kilomètres comptés **une seule fois par véhicule partagé** (équipes) ;
- **📋 Copier une semaine…** (jusqu'à 8 semaines en arrière — pour un roulement une semaine sur deux, copiez « il y a 2 semaines ») et **👤➜👤 Dupliquer salarié** ;
- impression A4 paysage (semaine) ou portrait (mois).

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
Fiches salariés : poste, couleur du planning, véhicule attribué, coordonnées, type de contrat, date d'entrée et **coût horaire chargé** (base du calcul des marges).

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

Le rapprochement planning ↔ clients se fait par le nom, sans tenir compte des majuscules ni des accents.

## 💾 Sauvegarde

Les données sont enregistrées automatiquement dans le navigateur (localStorage). Le bouton **💾 Sauvegarde** permet :
- **d'exporter** toutes les données dans un fichier `nettoyage-sauvegarde-AAAA-MM-JJ.json` (à conserver précieusement — c'est votre sauvegarde) ;
- **d'importer** un fichier de sauvegarde (remplace les données actuelles, après confirmation).

> 💡 Exportez régulièrement, et avant tout changement d'ordinateur ou de navigateur.

## 🖨️ Impression PDF

Le bouton **🖨️ Imprimer / PDF** imprime l'onglet affiché (choisissez « Enregistrer au format PDF » comme destination). Le format s'adapte tout seul (paysage/portrait). Activez « Graphiques d'arrière-plan » si les couleurs manquent.

## 🛠️ Technique

Un seul fichier `index.html` (HTML + CSS + JavaScript), sans dépendance. Données en localStorage, migration automatique des anciennes versions, export/import JSON.
