# 🧽 Gestion Nettoyage

Logiciel de gestion complet pour entreprise de nettoyage, dans **un seul fichier** : `index.html`. Aucune installation, aucun serveur : téléchargez le fichier et ouvrez-le d'un double-clic dans votre navigateur. Tout fonctionne hors ligne et s'imprime proprement en PDF.

## Les onglets

### 🏠 Accueil
Le tableau de bord : chiffres clés du mois en cours (CA des contrats, coûts, **marge brute**, **frais généraux**, **résultat du mois**, TVA à payer, heures planifiées et retenues, interventions, taux de conformité qualité) + **centre d'alertes cliquables** (contrôles techniques, révisions en retard, stocks sous seuil, tickets à traiter, anomalies, coûts horaires manquants, journées non pointées) + le planning du jour.

### 📅 Planning
Planning des salariés en vue **Semaine** ou **Mois** :
- créneaux de travail (horaires, **client**, description du travail) et **trajets 🚗** (durée, km, lieu de départ → arrivée) ;
- repos, congés, fériés, notes ; réorganisation par glisser-déposer (poignée ⠿) ;
- **↔ Glisser-déposer d'une tâche** : attrapez une tâche dans une case et déposez-la sur un autre créneau — même jour, autre jour, **autre salarié**, **autre semaine**. Les créneaux qui peuvent la recevoir s'allument dès la prise, un trait indique où elle va tomber et un bandeau annonce la destination en clair (avec un avertissement si le créneau est dépassé). Au doigt, maintenez une demi-seconde avant de glisser. Pour changer de semaine sans lâcher, **poussez vers le bord de l'écran** : la période tourne toutes les demi-secondes, et vous déposez une fois arrivé. En vue Mois, plusieurs semaines sont visibles d'un coup — c'est le chemin le plus simple pour un déplacement lointain. Échap ou un lâcher dans le vide annule, et **rien n'est retiré tant que la tâche n'est pas déposée**. Déposée sur une journée de travail encore vide, elle ouvre la journée avec un créneau pré-rempli que vous validez ;
- **tâches une semaine sur deux** : chaque tâche peut être marquée « 1 semaine sur 2 » — un badge le rappelle dans le planning et sur la fiche imprimée ;
- totaux d'heures par salarié et par jour, kilomètres comptés **une seule fois par véhicule partagé** (équipes) ;
- **👤 Planning individuel** (impression A4 paysage, en couleur) : une fiche par salarié **sur une seule page**, sans numéro de semaine ni dates — un planning type à afficher ou à remettre, valable tant que la semaine ne change pas. Les journées sont présentées en colonnes et la taille du texte s'ajuste automatiquement pour occuper la page sans déborder ; une **journée sans rien à dire n'est pas imprimée**, la place profite aux autres jours — un samedi ou un dimanche non travaillé disparaît même s'il porte « repos », et en semaine seules les journées entièrement vides sont retirées (repos, congés, fériés et notes restent affichés). Le bandeau du bas détaille le calcul : **travail chez les clients + trajets (saisis à la main) = total de la semaine** ;
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
Trois sous-onglets : **En poste**, **📁 Dossiers** et **📦 Anciens salariés**.

**En poste** — une fiche par salarié : poste, couleur du planning, véhicule attribué, coordonnées, type de contrat, date d'entrée, **heures de contrat (h/semaine)**, **trajets (h/semaine)** et **coût horaire chargé**. La fiche affiche les heures mensualisées (× 52/12, ex. 35 h/semaine = 151h40/mois) et le **coût mensuel** du salarié. Le champ **🚗 Trajets** (saisi « 5h50 », « 5:50 » ou « 5,5 ») apparaît dans le bandeau de total du planning individuel imprimé, sans être détaillé jour par jour — il est aussi modifiable au moment de l'impression. Les heures de contrat et le coût horaire alimentent la **masse salariale** (indicateur de l'Accueil, bandeau des Marges avec la part affectée aux clients, et écart contrat/réalisé dans les feuilles de temps).

**📦 Archiver un salarié qui s'en va** — bouton 📦 sur sa fiche : vous saisissez la date de sortie et, si vous voulez, le motif. S'il lui reste des journées planifiées après cette date, le logiciel propose de les retirer.

Il disparaît alors du planning à venir, de la masse salariale, des congés, du pointage, des équipes de bons d'intervention et de toutes les listes de choix. **Mais rien n'est effacé** : les semaines qu'il a réellement travaillées continuent de l'afficher, et il reste compté dans les **marges**, le **kilométrage par véhicule**, les **feuilles de temps** et l'**export prépaie** des mois concernés. Vos chiffres déjà arrêtés ne changent pas rétroactivement — c'est tout l'intérêt d'archiver plutôt que de supprimer.

**L'onglet 📦 Anciens salariés** reste entièrement modifiable — nom, poste, date d'entrée, **date de sortie**, motif du départ, coordonnées, type de contrat, heures et coût horaire — et garde la trace de son passage : poste, dates d'entrée et de sortie, motif, période travaillée, nombre de jours, heures au planning, bons d'intervention, journées pointées et liste des clients servis. Vider la date de sortie est refusé : pour qu'il revienne, c'est le bouton Réintégrer. Corriger son coût horaire reste possible, mais cela modifie les marges des mois où il a travaillé — le logiciel le rappelle sur la fiche.

Deux boutons : **Réintégrer** (s'il revient) et **Supprimer définitivement** (qui efface aussi tout l'historique — le logiciel vous en dissuade tant que des journées sont enregistrées).

Un ancien salarié reste proposé, signalé « (ancien) », dans les deux écrans rétrospectifs : les **feuilles de temps** et l'impression du **planning individuel**.

**📁 Dossiers — un dossier par salarié**, en poste comme ancien (bouton 📁 sur sa fiche, ou sélecteur en haut de l'onglet). Trois parties :

- **💶 Rémunération** — l'historique des taux horaires bruts avec leur date d'effet, le motif (embauche, augmentation annuelle, revalorisation du SMIC…) et l'**écart en pourcentage** d'une ligne à l'autre. Le coût chargé correspondant est affiché à titre indicatif (taux brut + le pourcentage de charges patronales des paramètres). Cet historique est une **mémoire** : il ne recalcule rien tout seul. Le *coût horaire chargé* de l'onglet En poste reste la valeur qui alimente les marges et la masse salariale — volontairement, pour que corriger une vieille ligne ne change pas des mois déjà clôturés. Un bouton propose de reporter le coût suggéré, après vous avoir averti de l'effet sur les chiffres passés.

- **📎 Pièces justificatives et échéances** — huit rubriques : carte d'identité / passeport, titre de séjour ou autorisation de travail, permis de conduire, **visite médicale**, arrêt de travail / arrêt maladie, contrat et avenants, diplômes et habilitations (CACES, SST…), autres documents. Chaque pièce porte un intitulé, deux dates (dont le libellé s'adapte à la rubrique : *Délivrée le / Expire le*, *Visite du / Prochaine visite*, *Du / Au*), un numéro, une note, et **un fichier joint** (photo ou PDF, 10 Mo maximum). Pour une visite médicale, saisir la date de la visite propose automatiquement la **prochaine à 24 mois**.

- **🌴 Congés et arrêts** — le reflet de l'onglet Congés pour ce salarié : chaque absence avec son type, sa période, son décompte en jours, son statut et son motif, plus le total accordé par type. La saisie reste dans l'onglet 🌴 Congés, pour qu'une absence n'existe qu'à un seul endroit.

**⏰ Les alarmes** remontent toutes seules dans les alertes de l'Accueil, et le clic ouvre le dossier concerné : visite médicale à refaire (45 jours avant, puis en rouge une fois dépassée), titre de séjour, carte d'identité, permis ou habilitation qui expirent (60 jours avant), fin de validité d'un contrat (30 jours), et la liste des salariés dont la visite médicale n'est pas renseignée.

**Où vont les fichiers.** Pas dans les données de l'application : une seule carte d'identité scannée pèse plus que tout le reste du logiciel et saturerait le navigateur. Ils partent dans un **espace privé du coffre en ligne**, rangés par compte et par salarié, que **seul votre compte peut lire**. Conséquence : il faut être **connecté** (bouton ☁) pour déposer ou ouvrir un document, alors que le reste du dossier — dates, numéros, montants — fonctionne hors ligne comme tout le logiciel. Supprimer définitivement un salarié, ou retirer une pièce, efface aussi le fichier du coffre.

⚠️ Pièces d'identité, titres de séjour et avis d'aptitude sont des **données personnelles sensibles**. N'y déposez que ce dont vous avez réellement besoin, informez vos salariés par écrit que vous les conservez, et effacez-les quand l'obligation légale de conservation est éteinte.
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

### 💶 Finances
Trois sous-onglets pour passer de la marge de chantier au résultat réel :
- **🧾 Frais généraux** : toutes les charges d'entreprise (loyer, assurances, carburant, comptable, téléphonie, formation…) avec catégorie, montant HT, taux de TVA, récurrence (mensuelle, trimestrielle, annuelle, ponctuelle), date de début et fin éventuelle. Deux colonnes : **€/mois** (montant mensualisé — une prime annuelle compte pour un douzième, c'est lui qui sert au résultat) et **ce mois-ci** (montant réellement décaissé, utilisé pour la TVA). Répartition par catégorie et KPI du mois.
- **🏛️ TVA** (régime réel normal, déclaration CA3 mensuelle) : les 12 mois de l'année avec CA HT, **TVA collectée** (CA × votre taux), **TVA déductible** (frais du mois, chacun à son taux), **TVA à payer** — ou crédit de TVA quand elle est négative. Une colonne « déclaré / payé » à remplir pour repérer les écarts.
- **👥 Cotisations sociales** : masse salariale chargée, brut estimé et **cotisations patronales estimées** (à partir d'un taux de charges réglable), face aux montants **réels** saisis mois par mois (URSSAF, retraite/prévoyance, autres). L'écart est signalé au-delà de 10 %. ⚠️ Ces cotisations ne s'ajoutent pas aux coûts : le coût horaire du Personnel étant *chargé*, elles sont déjà dans les marges — cet onglet sert au suivi de trésorerie et au contrôle des bordereaux.

Le **résultat du mois** (marge brute des chantiers − frais généraux mensualisés) apparaît sur l'Accueil et en bas de l'onglet Marges. Les frais ne sont pas répartis par client : les marges par client restent des marges brutes de chantier. Tous les montants sont en HT.

### 📈 Rapports
- **🧑‍💼 Rapport client mensuel** : le document à remettre chaque mois à vos clients — interventions réalisées (bons, anomalies, signatures), heures planifiées/effectuées, taux de conformité qualité, consommables utilisés.
- **⏱️ Feuilles de temps** : par salarié et par mois, planifié vs réel jour par jour, congés/fériés comptés, imprimable, et **export CSV prépaie** de tous les salariés (s'ouvre dans Excel, à transmettre à l'expert-comptable).
- **🧾 Export facturation** : le tableau mensuel de ce qu'il y a à facturer par client (forfait ou heures × taux, sur les heures retenues), exporté en **CSV** pour votre logiciel de facturation et en **JSON** — le format qui servira à la future connexion par API.

## 🔒 Code d'accès de l'appareil

Bouton **🔓 / 🔒** en haut à droite : pose un code demandé **à chaque ouverture du logiciel sur cet appareil**. Tant qu'il n'est pas saisi, rien n'est affiché — ni le planning, ni les salaires, ni les congés.

C'est une protection contre **quelqu'un qui prendrait votre tablette ou s'assiérait devant votre ordinateur déverrouillé**, c'est-à-dire le risque réel. Le code est propre à l'appareil : chacun peut avoir le sien, ou aucun.

Ce que ce code **ne fait pas** : il ne protège pas vos données en ligne — c'est le mot de passe de votre compte qui s'en charge — et il n'empêche pas quelqu'un de techniquement averti de lire le contenu du navigateur. Pour un verrou réellement infranchissable au niveau du site, il faudrait l'offre payante de l'hébergeur.

⚠️ Le code n'est pas récupérable : s'il est oublié, il faut effacer les données du navigateur sur cet appareil pour revenir. Les données en ligne, elles, restent intactes et redescendent à la reconnexion.

## ☁ Synchronisation en ligne

Le logiciel est publié à l'adresse **https://berto-nettoyage.vercel.app** et peut garder le même planning sur l'ordinateur, la tablette et le téléphone.

**Pour l'activer** : bouton **☁** en haut à droite → créez votre compte (adresse e-mail + mot de passe), une seule fois. Ensuite tout se fait seul.

**Ce que vous voyez** : un indicateur permanent à côté du bouton 💾 — *À jour*, *À envoyer*, *Pas de réseau*, *À vérifier*. Vos saisies partent quelques secondes après avoir été enregistrées sur l'appareil ; l'autre appareil les récupère à l'ouverture, au retour sur l'onglet ou en cliquant *Synchroniser maintenant*.

**Le logiciel reste utilisable sans compte et sans réseau.** La synchronisation est un supplément : hors connexion vous continuez à travailler normalement, et tout repart dès que le réseau revient.

⚠️ **La synchronisation ne fonctionne pas quand le fichier est ouvert par double-clic** (`file://`) : le navigateur l'interdit pour des raisons de sécurité. Utilisez l'adresse web. Le fichier local continue de marcher, simplement sans partage entre appareils.

### Comment les conflits sont traités

Rien ne peut être perdu, par construction :

- **Aucune écriture à l'aveugle.** Chaque envoi est conditionné à la version connue : si l'autre appareil a écrit entre-temps, l'envoi est refusé, jamais imposé.
- **Rien n'est remplacé sans archive préalable.** Avant de prendre la version en ligne, la version locale est déposée dans l'historique en ligne ; avant d'écraser la version en ligne, c'est elle qui y est déposée. Les deux restent récupérables.
- **Un appareil vierge reçoit sans poser de question**, et ne peut pas imposer son vide à un appareil qui a le dossier.
- **Si les deux ont été modifiés**, le logiciel s'arrête et demande, en montrant ce que contient chaque version. Les deux sont conservées quel que soit le choix.
- Les données ne sont jamais remplacées pendant une saisie : si une fenêtre est ouverte, la synchronisation attend.

### Où vont les données

Base PostgreSQL **hébergée à Paris** (Supabase), une ligne par compte, protégée par les règles de sécurité de la base : personne d'autre que vous ne peut lire ni écrire votre dossier, et **le logiciel n'a pas le droit de le supprimer**. L'historique conserve les douze derniers états pendant trois mois.

⚠️ Le projet est sur l'offre gratuite : **il se met en veille après une semaine sans activité**. Au réveil, la synchronisation échoue tant qu'il n'est pas relancé depuis le tableau de bord Supabase. L'indicateur affiche alors *Pas de réseau*, et rien n'est perdu — tout repart ensuite.

Les **documents des dossiers salariés** (onglet 👥 Personnel → 📁 Dossiers) sont rangés à part, dans un espace de fichiers privé du même hébergement, sous `votre-compte/salarié/` : eux non plus ne sont lisibles que par votre compte, et ils ne transitent jamais par la ligne de données ni par les sauvegardes JSON.

⚠️ Vos données contiennent des informations personnelles de vos salariés, dont des **arrêts maladie**, des **avis d'aptitude** et, si vous les déposez, des **pièces d'identité** (données de santé et données sensibles). Dès lors qu'elles sont hébergées, informez vos salariés par écrit et tenez le registre de traitement prévu par le RGPD.

## 💾 Sauvegarde

Les données sont enregistrées automatiquement dans le navigateur (localStorage). Le bouton **💾 Sauvegarde** permet :
- **d'exporter** toutes les données dans un fichier `nettoyage-sauvegarde-AAAA-MM-JJ.json` (à conserver précieusement — c'est votre sauvegarde) ;
- **d'importer** un fichier de sauvegarde (remplace les données actuelles, après confirmation).

La sauvegarde contient les **fiches** des dossiers salariés (rubriques, dates, numéros, historique des rémunérations), mais pas les **fichiers** eux-mêmes, qui restent dans le coffre en ligne.

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
