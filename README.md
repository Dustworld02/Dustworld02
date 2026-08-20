# 📅 Générateur de planning employés

Application web simple pour créer les plannings hebdomadaires de vos employés et les **imprimer en PDF** de façon claire et lisible.

## 🚀 Utilisation

Aucune installation nécessaire : ouvrez simplement le fichier **`index.html`** dans votre navigateur (double-clic).

### 1. Ajouter vos employés
Cliquez sur **👥 Employés**, saisissez le nom (et le poste si vous voulez), choisissez une couleur, puis **Ajouter**. Vous pouvez réordonner (↑ ↓) ou supprimer (✕) chaque employé.

### 2. Remplir le planning
- Basculez entre la **vue Semaine** et la **vue Mois** avec les boutons en haut ; les deux vues s'impriment et permettent de modifier les journées d'un clic.
- Choisissez la période avec les flèches **◀ ▶** ou le sélecteur de date.
- Cliquez sur une case du tableau pour définir la journée d'un employé :
  - **Travail** : un ou plusieurs créneaux horaires (boutons d'horaires rapides disponibles, créneaux de coupure possibles) ;
  - pour chaque créneau : le **client** (avec suggestions des clients déjà saisis) et la **description du travail à effectuer** ;
  - des créneaux **🚗 Trajet** : lieu de départ → lieu d'arrivée, temps (en minutes) et nombre de km ; affichés en gris et comptés à part dans les totaux (heures et kilomètres) ;
  - **Repos**, **Congé** ou **Férié** ;
  - une **note** libre (remplacement, formation…) ;
  - les créneaux se **réorganisent en les faisant glisser** par la poignée ⠿ (souris ou tactile).
- Les **totaux d'heures** par employé et par jour sont calculés automatiquement, avec le détail « dont X h trajet ».
- **📋 Copier une semaine…** copie une semaine passée (jusqu'à 8 en arrière) vers la semaine affichée — pour un roulement une semaine sur deux, copiez « il y a 2 semaines ».
- **👤➜👤 Dupliquer salarié** copie tous les créneaux de la semaine affichée d'un salarié vers un autre.

### 3. Imprimer en PDF
Cliquez sur **🖨️ Imprimer / PDF**, puis dans la fenêtre d'impression du navigateur choisissez **« Enregistrer au format PDF »** comme destination. La mise en page est optimisée automatiquement : **A4 paysage** pour la vue semaine, **A4 portrait** pour la vue mois (paysage au-delà de 4 employés). Couleurs conservées, boutons masqués, tableau lisible.

> 💡 Astuce : dans les options d'impression, activez « Graphiques d'arrière-plan » si les couleurs n'apparaissent pas.

## 💾 Sauvegarde

Les données (employés, horaires, nom de l'entreprise) sont enregistrées automatiquement dans le navigateur (localStorage). Elles sont conservées d'une visite à l'autre sur le même ordinateur et le même navigateur.

## 🛠️ Technique

- Un seul fichier `index.html` : HTML + CSS + JavaScript, sans dépendance ni serveur.
- Fonctionne hors ligne.
- Impression optimisée via `@media print` (format A4 paysage).
