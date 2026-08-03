# 📅 Générateur de planning employés

Application web simple pour créer les plannings hebdomadaires de vos employés et les **imprimer en PDF** de façon claire et lisible.

## 🚀 Utilisation

Aucune installation nécessaire : ouvrez simplement le fichier **`index.html`** dans votre navigateur (double-clic).

### 1. Ajouter vos employés
Cliquez sur **👥 Employés**, saisissez le nom (et le poste si vous voulez), choisissez une couleur, puis **Ajouter**. Vous pouvez réordonner (↑ ↓) ou supprimer (✕) chaque employé.

### 2. Remplir le planning
- Choisissez la semaine avec les flèches **◀ ▶** ou le sélecteur de date.
- Cliquez sur une case du tableau pour définir la journée d'un employé :
  - **Travail** : un ou plusieurs créneaux horaires (boutons d'horaires rapides disponibles, créneaux de coupure possibles) ;
  - **Repos**, **Congé** ou **Férié** ;
  - une **note** libre (remplacement, formation…).
- Les **totaux d'heures** par employé et par jour sont calculés automatiquement.
- **📋 Copier la semaine préc.** duplique la semaine précédente pour aller plus vite.

### 3. Imprimer en PDF
Cliquez sur **🖨️ Imprimer / PDF**, puis dans la fenêtre d'impression du navigateur choisissez **« Enregistrer au format PDF »** comme destination. La mise en page est optimisée pour du **A4 paysage** : couleurs conservées, boutons masqués, tableau lisible.

> 💡 Astuce : dans les options d'impression, activez « Graphiques d'arrière-plan » si les couleurs n'apparaissent pas.

## 💾 Sauvegarde

Les données (employés, horaires, nom de l'entreprise) sont enregistrées automatiquement dans le navigateur (localStorage). Elles sont conservées d'une visite à l'autre sur le même ordinateur et le même navigateur.

## 🛠️ Technique

- Un seul fichier `index.html` : HTML + CSS + JavaScript, sans dépendance ni serveur.
- Fonctionne hors ligne.
- Impression optimisée via `@media print` (format A4 paysage).
