# Site vitrine B&F Berto & Fils — sources

Refonte du site https://haute-savoie-propre-site.lovable.app/ en site statique multi-pages,
orienté **salle blanche / zone propre / zone à atmosphère contrôlée** et optimisé pour le référencement local
(entreprise de nettoyage en Haute-Savoie, nettoyage industriel).

## Organisation

| Dossier / fichier | Rôle |
|---|---|
| `site/pages/*.html` | Le contenu de chaque page (un fichier = une URL). L'en-tête en commentaire donne le titre, la description, l'URL. |
| `site/layout.html` | Le gabarit commun : en-tête, menu, bandeau devis, pied de page, balises SEO. |
| `site/assets/` | Feuille de style, logo, favicon, image de partage (`og-image.png`). |
| `site/build.py` | Le générateur (Python 3, sans dépendance). Il assemble les pages et écrit `docs/`. |
| `docs/` | **Le site prêt à mettre en ligne.** Ne pas modifier à la main : il est régénéré à chaque build. |

## Modifier le site

1. Éditer une page dans `site/pages/` (ou le gabarit / le CSS).
2. Lancer `python3 site/build.py`.
3. Mettre en ligne le contenu de `docs/`.

Les coordonnées (téléphones, e-mail, adresse) et la liste des villes sont centralisées dans `site/build.py`
(bloc `COMPANY` et `AREAS`) et se répercutent sur toutes les pages.

## Changer de nom de domaine (important pour le SEO)

Dans `site/build.py`, modifier `SITE_URL` puis relancer le build : les balises canonical, le sitemap,
le robots.txt et les données structurées sont réécrits avec la nouvelle adresse.

## Mise en ligne

Le dossier `docs/` est un site statique : il fonctionne chez n'importe quel hébergeur (OVH, o2switch, Netlify,
Vercel, GitHub Pages…). Sur GitHub Pages : *Settings → Pages → Deploy from a branch → branche `main`, dossier `/docs`*.

Pour la page 404 et les URL « propres » (`/contact/`), tout hébergeur qui sert `index.html` dans un dossier convient
(c'est le cas de tous ceux cités).

## Pages

| URL | Cible de référencement |
|---|---|
| `/` | entreprise de nettoyage Haute-Savoie, nettoyage industriel, salle blanche |
| `/nettoyage-salle-blanche/` | nettoyage salle blanche, salle propre, zone propre, zone à atmosphère contrôlée, ZAC, ISO 14644 |
| `/nettoyage-industriel/` | nettoyage industriel Haute-Savoie, usine, atelier, décolletage |
| `/vitrerie/` | nettoyage de vitres, façades vitrées, verrières |
| `/nettoyage-specialise/` | désinfection, nettoyage après décès, syndrome de Diogène, marbre |
| `/conseil-nouveaux-batiments/` | conseil sur plan, entretien de bâtiments neufs |
| `/batiments-communaux/` | nettoyage mairies, écoles, gymnases, collectivités |
| `/services/` | page hub de toutes les prestations |
| `/zones-intervention/` | entreprise de nettoyage à Cluses, Bonneville, Annemasse, Annecy, Thonon, Genève |
| `/faq/` | questions fréquentes (données structurées FAQPage) |
| `/contact/` | devis, coordonnées, plan |
| `/mentions-legales/` | mentions légales (champs « À COMPLÉTER » à renseigner) |

## Charte graphique

Le site applique la charte de la « Trame Berto & Fils » :

| Élément | Valeur | Usage |
|---|---|---|
| Bleu marine | `#1A1A2E` | textes, titres, en-têtes de tableau, fonds sombres |
| Or | `#C9A84C` | filets, accents, boutons d'appel — avec parcimonie |
| Blanc cassé | `#FDF8F0` | fonds de sections et d'encadrés |
| Titres | Playfair Display | |
| Texte et étiquettes | Montserrat | étiquettes en gras, majuscules, or |

L'or pur est trop clair pour du texte sur fond blanc (contraste insuffisant pour l'accessibilité) :
les étiquettes sur fond clair utilisent `#7A6221`, l'or pur reste réservé aux filets, aux boutons et aux fonds sombres.

Les polices sont hébergées sur le site (`site/assets/fonts/`, licence SIL OFL), sans appel à Google Fonts :
plus rapide, et aucune adresse IP de visiteur transmise à Google.

Le monogramme « B&F » est provisoire : dès qu'un logo officiel existe, remplacer `site/assets/logo.svg`,
`site/assets/favicon.svg` et le SVG de `.brand-mark` dans `site/layout.html`.

## Image de partage et icônes

`site/assets/og-image.html` est la maquette de l'image de partage (réseaux sociaux, WhatsApp, LinkedIn).
`og-image.png`, `apple-touch-icon.png`, `icon-192.png` et `icon-512.png` en sont des rendus ; ils sont
versionnés, pas besoin de les régénérer sauf changement de texte ou de logo.
