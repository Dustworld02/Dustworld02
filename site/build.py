#!/usr/bin/env python3
"""Générateur du site vitrine B&F Berto & Fils.

Usage :  python3 site/build.py
Sortie : dossier docs/ (le site statique prêt à héberger).

Aucune dépendance : Python 3 standard uniquement.
Les pages sources sont dans site/pages/, le gabarit dans site/layout.html,
les styles et images dans site/assets/.
"""
from __future__ import annotations

import datetime as _dt
import json
import re
import shutil
from pathlib import Path

# ---------------------------------------------------------------------------
# RÉGLAGES — à adapter quand le site change d'adresse.
# ---------------------------------------------------------------------------
SITE_URL = "https://haute-savoie-propre-site.lovable.app"  # sans / final
SITE_NAME = "B&F Berto & Fils"
DEFAULT_OG_IMAGE = "/assets/og-image.png"

COMPANY = {
    "name": "B&F Berto & Fils",
    "legal_name": "B&F Berto & Fils",
    "founded": "2004",
    "street": "51 route de la Serra",
    "postal": "74490",
    "city": "Saint-Jeoire-en-Faucigny",
    "region": "Haute-Savoie",
    "country": "FR",
    "lat": 46.1408,
    "lng": 6.4614,
    "email": "Berto.net@orange.fr",
    "phone_tech": "+33681299740",
    "phone_tech_display": "+33 6 81 29 97 40",
    "phone_com": "+33667967226",
    "phone_com_display": "+33 6 67 96 72 26",
    "phone_ch": "+41767547272",
    "phone_ch_display": "+41 76 754 72 72",
}

# Villes et zones desservies (référencement local).
AREAS = [
    "Saint-Jeoire-en-Faucigny", "Bonneville", "Cluses", "Scionzier", "Marnaz",
    "Marignier", "Sallanches", "La Roche-sur-Foron", "Annemasse", "Saint-Julien-en-Genevois",
    "Annecy", "Thonon-les-Bains", "Genève",
]

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent / "docs"
PAGES = ROOT / "pages"
ASSETS = ROOT / "assets"
LAYOUT = (ROOT / "layout.html").read_text(encoding="utf-8")

# Ordre des pages dans le sitemap et navigation.
NAV = [
    ("nettoyage-salle-blanche", "Salle blanche"),
    ("nettoyage-industriel", "Nettoyage industriel"),
    ("services", "Services"),
    ("zones-intervention", "Zones"),
    ("faq", "FAQ"),
    ("contact", "Contact"),
]


def parse_page(path: Path) -> tuple[dict, str]:
    raw = path.read_text(encoding="utf-8")
    m = re.match(r"\s*<!--(.*?)-->\s*", raw, re.S)
    if not m:
        raise SystemExit(f"{path}: en-tête manquant")
    meta: dict[str, str] = {}
    for line in m.group(1).strip().splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()
    body = raw[m.end():]
    meta.setdefault("slug", path.stem)
    return meta, body


def url_for(slug: str) -> str:
    if slug in ("index", ""):
        return "/"
    if slug == "404":
        return "/404.html"
    return f"/{slug}/"


def esc(s: str) -> str:
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;"))


def local_business_ld() -> str:
    c = COMPANY
    data = {
        "@context": "https://schema.org",
        "@type": ["LocalBusiness", "ProfessionalService"],
        "@id": SITE_URL + "/#entreprise",
        "name": c["name"],
        "alternateName": ["Berto & Fils", "B&F"],
        "description": "Entreprise de nettoyage industriel spécialisée dans les salles blanches, zones propres et zones à atmosphère contrôlée en Haute-Savoie. Nettoyage industriel, vitrerie, nettoyage spécialisé et désinfection.",
        "url": SITE_URL + "/",
        "logo": SITE_URL + "/assets/logo.svg",
        "image": SITE_URL + DEFAULT_OG_IMAGE,
        "foundingDate": c["founded"],
        "email": c["email"],
        "telephone": c["phone_com"],
        "address": {
            "@type": "PostalAddress",
            "streetAddress": c["street"],
            "addressLocality": c["city"],
            "postalCode": c["postal"],
            "addressRegion": c["region"],
            "addressCountry": c["country"],
        },
        "geo": {"@type": "GeoCoordinates", "latitude": c["lat"], "longitude": c["lng"]},
        "areaServed": [
            {"@type": "AdministrativeArea", "name": "Haute-Savoie"},
            {"@type": "Place", "name": "Vallée de l'Arve"},
            {"@type": "Place", "name": "Genevois français"},
            {"@type": "Place", "name": "Bassin annécien"},
            {"@type": "Place", "name": "Chablais"},
            {"@type": "AdministrativeArea", "name": "Canton de Genève"},
        ] + [{"@type": "City", "name": a} for a in AREAS],
        "contactPoint": [
            {"@type": "ContactPoint", "contactType": "commercial et administratif", "name": "Chris Berto",
             "telephone": c["phone_com"], "availableLanguage": "fr"},
            {"@type": "ContactPoint", "contactType": "commercial (Suisse)", "name": "Chris Berto",
             "telephone": c["phone_ch"], "availableLanguage": "fr"},
            {"@type": "ContactPoint", "contactType": "technique", "name": "Antonio Berto",
             "telephone": c["phone_tech"], "email": c["email"], "availableLanguage": "fr"},
        ],
        "knowsAbout": [
            "Nettoyage de salle blanche", "Nettoyage de zone propre", "Zone à atmosphère contrôlée",
            "Bionettoyage", "Désinfection des surfaces", "Normes EN 1276 et EN 14476", "BPF annexe 1", "ISO 14644", "Nettoyage industriel", "Nettoyage d'usine", "Vitrerie",
            "Désinfection professionnelle", "Nettoyage après décès", "Syndrome de Diogène",
            "Rénovation du marbre", "Nettoyage de bâtiments communaux",
        ],
        "hasOfferCatalog": {
            "@type": "OfferCatalog",
            "name": "Prestations de nettoyage",
            "itemListElement": [
                {"@type": "Offer", "itemOffered": {"@type": "Service", "name": n, "url": SITE_URL + u}}
                for n, u in [
                    ("Nettoyage de salle blanche et zone à atmosphère contrôlée", "/nettoyage-salle-blanche/"),
                    ("Bionettoyage", "/bionettoyage-haute-savoie/"),
                    ("Nettoyage industriel", "/nettoyage-industriel/"),
                    ("Vitrerie", "/vitrerie/"),
                    ("Nettoyage spécialisé et désinfection", "/nettoyage-specialise/"),
                    ("Conseil et nouveaux bâtiments", "/conseil-nouveaux-batiments/"),
                    ("Bâtiments communaux et collectivités", "/batiments-communaux/"),
                ]
            ],
        },
    }
    return json.dumps(data, ensure_ascii=False)


def breadcrumb_ld(meta: dict) -> str:
    slug = meta["slug"]
    if slug in ("index", "404"):
        return ""
    items = [{"@type": "ListItem", "position": 1, "name": "Accueil", "item": SITE_URL + "/"}]
    parent = meta.get("parent")
    pos = 2
    if parent:
        pmeta, _ = parse_page(PAGES / f"{parent}.html")
        items.append({"@type": "ListItem", "position": pos, "name": pmeta.get("breadcrumb", pmeta["title"]),
                      "item": SITE_URL + url_for(parent)})
        pos += 1
    items.append({"@type": "ListItem", "position": pos, "name": meta.get("breadcrumb", meta["title"]),
                  "item": SITE_URL + url_for(slug)})
    data = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": items}
    return json.dumps(data, ensure_ascii=False)


def breadcrumb_html(meta: dict) -> str:
    slug = meta["slug"]
    if slug in ("index", "404"):
        return ""
    parts = ['<a href="/">Accueil</a>']
    parent = meta.get("parent")
    if parent:
        pmeta, _ = parse_page(PAGES / f"{parent}.html")
        parts.append(f'<a href="{url_for(parent)}">{esc(pmeta.get("breadcrumb", pmeta["title"]))}</a>')
    parts.append(f'<span aria-current="page">{esc(meta.get("breadcrumb", meta["title"]))}</span>')
    return '<nav class="breadcrumb" aria-label="Fil d’Ariane"><div class="wrap">' + \
        '<span class="sep">›</span>'.join(parts) + "</div></nav>"


def nav_html(current: str) -> str:
    out = []
    for slug, label in NAV:
        cur = ' aria-current="page"' if slug == current else ""
        out.append(f'<li><a href="{url_for(slug)}"{cur}>{esc(label)}</a></li>')
    return "".join(out)


def render(meta: dict, body: str) -> str:
    slug = meta["slug"]
    canonical = SITE_URL + url_for(slug)
    og_image = SITE_URL + meta.get("image", DEFAULT_OG_IMAGE)
    ld = [local_business_ld()]
    bc = breadcrumb_ld(meta)
    if bc:
        ld.append(bc)
    ld_html = "\n".join(f'<script type="application/ld+json">{x}</script>' for x in ld)
    robots = meta.get("robots", "index, follow, max-image-preview:large, max-snippet:-1")
    c = COMPANY
    year = _dt.date.today().year
    html = LAYOUT
    repl = {
        "{{lang}}": "fr",
        "{{site_url}}": SITE_URL,
        "{{title}}": esc(meta["title"]),
        "{{description}}": esc(meta["description"]),
        "{{canonical}}": canonical,
        "{{og_image}}": og_image,
        "{{robots}}": robots,
        "{{jsonld}}": ld_html,
        "{{nav}}": nav_html(slug),
        "{{breadcrumb}}": breadcrumb_html(meta),
        "{{body_class}}": meta.get("body_class", ""),
        "{{content}}": body,
        "{{year}}": str(year),
        "{{site_name}}": esc(SITE_NAME),
        "{{street}}": c["street"],
        "{{postal}}": c["postal"],
        "{{city}}": c["city"],
        "{{email}}": c["email"],
        "{{phone_tech}}": c["phone_tech"],
        "{{phone_tech_display}}": c["phone_tech_display"],
        "{{phone_com}}": c["phone_com"],
        "{{phone_com_display}}": c["phone_com_display"],
        "{{phone_ch}}": c["phone_ch"],
        "{{phone_ch_display}}": c["phone_ch_display"],
        "{{areas}}": " · ".join(AREAS),
    }
    # Espaces insécables dans les numéros affichés : jamais coupés en fin de ligne.
    for k in ("{{phone_tech_display}}", "{{phone_com_display}}", "{{phone_ch_display}}"):
        repl[k] = repl[k].replace(" ", "\u00a0")
    for k, v in repl.items():
        html = html.replace(k, v)
    # Les tokens société peuvent aussi apparaître dans le contenu des pages.
    for k, v in repl.items():
        if k in ("{{content}}", "{{jsonld}}", "{{nav}}", "{{breadcrumb}}"):
            continue
        html = html.replace(k, v)
    leftover = re.findall(r"\{\{[a-z_]+\}\}", html)
    if leftover:
        raise SystemExit(f"{slug}: tokens non remplacés {sorted(set(leftover))}")
    return html


def build() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    shutil.copytree(ASSETS, OUT / "assets", ignore=shutil.ignore_patterns("*.html", "*.py"))

    pages = []
    for path in sorted(PAGES.glob("*.html")):
        meta, body = parse_page(path)
        html = render(meta, body)
        slug = meta["slug"]
        if slug == "index":
            dest = OUT / "index.html"
        elif slug == "404":
            dest = OUT / "404.html"
        else:
            dest = OUT / slug / "index.html"
            dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(html, encoding="utf-8")
        if slug != "404" and "noindex" not in meta.get("robots", ""):
            pages.append((url_for(slug), meta.get("priority", "0.7"), meta.get("changefreq", "monthly")))
        print(f"  {url_for(slug):40s} ← {path.name}")

    today = _dt.date.today().isoformat()
    urls = "\n".join(
        f"  <url>\n    <loc>{SITE_URL}{u}</loc>\n    <lastmod>{today}</lastmod>\n"
        f"    <changefreq>{cf}</changefreq>\n    <priority>{p}</priority>\n  </url>"
        for u, p, cf in sorted(pages, key=lambda x: -float(x[1]))
    )
    (OUT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + "\n</urlset>\n",
        encoding="utf-8")
    (OUT / "robots.txt").write_text(
        "User-agent: *\nAllow: /\n\n" f"Sitemap: {SITE_URL}/sitemap.xml\n", encoding="utf-8")
    (OUT / "site.webmanifest").write_text(json.dumps({
        "name": SITE_NAME, "short_name": "B&F", "start_url": "/", "display": "browser",
        "background_color": "#F5F8FC", "theme_color": "#0B1D3A",
        "icons": [{"src": "/assets/icon-192.png", "sizes": "192x192", "type": "image/png"},
                  {"src": "/assets/icon-512.png", "sizes": "512x512", "type": "image/png"}],
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    # Empêche GitHub Pages de passer par Jekyll (les dossiers _ seraient ignorés).
    (OUT / ".nojekyll").write_text("", encoding="utf-8")
    print(f"\n{len(pages)} pages → {OUT}")


if __name__ == "__main__":
    build()
