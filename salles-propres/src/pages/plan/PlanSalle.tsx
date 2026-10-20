import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as PE } from "react";
import { Link } from "react-router";
import { useSession } from "../../session";
import type { Bouche, Equipement, Flux, Mobilier, NomTable, Point2D, PointPrelevement, Porte, SallePropre, Zone } from "../../data/types";
import { Badge, Bouton, Champ, Liste, MessageErreur, Modale, Onglets, Saisie, SaisieNombre, useAction, useDonnees } from "../../ui/composants";
import { Formulaire, optionsDe, type DefinitionChamp } from "../../ui/entites";
import { aire, arrondiAffichage, arrondir, centroide, distanceContour, pointDansPolygone, rectangle } from "../../domain/geometrie";
import { analyserCascade, bilanAeraulique, type Statut } from "../../domain/aeraulique";
import { libelleClasse } from "../../domain/referentiels/classesIso";
import { LIBELLES_TYPES_ZONES } from "../../domain/secteurs/types";
import {
  ABREVIATIONS_EQUIPEMENTS, COULEURS_FLUX, MATERIAUX, NATURES_PRELEVEMENT, NETTOYABILITE, STATUTS_EQUIPEMENTS, TYPES_BOUCHES,
  TYPES_EQUIPEMENTS, TYPES_FLUX, TYPES_MOBILIER, TYPES_PORTES, couleurClasse, couleurTexteClasse,
} from "../../domain/libelles";

type TypeElement = "zone" | "porte" | "bouche" | "equipement" | "mobilier" | "point" | "flux";
type Outil = "selection" | TypeElement;
type Affichage = "edition" | "classes" | "pression" | "flux";

const TABLE: Record<TypeElement, NomTable> = {
  zone: "zones", porte: "portes", bouche: "bouches", equipement: "equipements", mobilier: "mobilier", point: "points_prelevement", flux: "flux",
};

const OUTILS: { cle: Outil; libelle: string; aide: string }[] = [
  { cle: "selection", libelle: "↖ Sélection", aide: "Cliquez un élément pour le modifier ; faites-le glisser pour le déplacer. Sur une zone sélectionnée, tirez les sommets ou les milieux de côtés." },
  { cle: "zone", libelle: "▭ Zone", aide: "Tracez un rectangle en faisant glisser. Les coins s'aimantent aux sommets des zones voisines." },
  { cle: "porte", libelle: "🚪 Porte", aide: "Cliquez sur une cloison : les deux zones de part et d'autre sont détectées." },
  { cle: "bouche", libelle: "◉ Bouche", aide: "Cliquez dans une zone pour poser une bouche (type choisi ci-contre)." },
  { cle: "equipement", libelle: "▣ Équipement", aide: "Cliquez pour poser un équipement (PSM, isolateur, hotte…)." },
  { cle: "mobilier", libelle: "▤ Mobilier", aide: "Cliquez pour poser un meuble." },
  { cle: "point", libelle: "◆ Point", aide: "Cliquez pour poser un point de prélèvement." },
  { cle: "flux", libelle: "➝ Flux", aide: "Cliquez les étapes du parcours, puis double-cliquez (ou Entrée) pour terminer. Échap annule." },
];

const COULEUR_STATUT: Record<Statut, string> = { ok: "#059669", attention: "#d97706", alerte: "#dc2626", inconnu: "#64748b", info: "#2563eb" };
const TON_STATUT = { ok: "ok", attention: "attention", alerte: "alerte", inconnu: "neutre", info: "info" } as const;

interface Glissement {
  type: TypeElement;
  id: string;
  depart: Point2D;
  courant: Point2D;
  sommet?: number;
  /** Polygone modifié (zones) ou parcours (flux). */
  points?: Point2D[];
  deplace: boolean;
}

export function PlanSalle({ salle, onSalleModifiee }: { salle: SallePropre; onSalleModifiee: () => void }) {
  const s = useSession();
  const org = s.org!.id;
  const peutInstallations = s.peut("installations", 2);
  const peutCta = s.peut("cta", 2);
  const { donnees, recharger } = useDonnees(async () => {
    const f = { salle_id: salle.id };
    const [zones, portes, bouches, equipements, mobilier, points, flux, ctas] = await Promise.all([
      s.depot.lister("zones", org, f), s.depot.lister("portes", org, f),
      s.peut("cta", 1) ? s.depot.lister("bouches", org, f) : [],
      s.depot.lister("equipements", org, f), s.depot.lister("mobilier", org, f),
      s.depot.lister("points_prelevement", org, f), s.depot.lister("flux", org, f),
      s.peut("cta", 1) ? s.depot.lister("ctas", org, { site_id: salle.site_id }) : [],
    ]);
    return { zones, portes, bouches, equipements, mobilier, points, flux, ctas };
  }, [org, salle.id]);

  const [outil, setOutil] = useState<Outil>("selection");
  const [affichage, setAffichage] = useState<Affichage>("edition");
  const [selection, setSelection] = useState<{ type: TypeElement; id: string } | null>(null);
  const [glissement, setGlissement] = useState<Glissement | null>(null);
  const [traceZone, setTraceZone] = useState<{ depart: Point2D; courant: Point2D } | null>(null);
  const [nouvelleZone, setNouvelleZone] = useState<Point2D[] | null>(null);
  const [parcours, setParcours] = useState<Point2D[]>([]);
  const [survol, setSurvol] = useState<Point2D | null>(null);
  const [typeBouche, setTypeBouche] = useState<Bouche["type"]>("soufflage");
  const [typeFlux, setTypeFlux] = useState<Flux["type"]>("personnel");
  const [magnetisme, setMagnetisme] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [fond, setFond] = useState<string | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const action = useAction();

  const L = salle.plan_largeur_m;
  const H = salle.plan_hauteur_m;
  const pas = magnetisme ? 0.1 : 0.01;

  useEffect(() => {
    let actif = true;
    if (salle.plan_fond) s.depot.urlFichier(salle.plan_fond).then((u) => { if (actif) setFond(u); }).catch(() => setFond(null));
    else setFond(null);
    return () => { actif = false; };
  }, [salle.plan_fond, s.depot]);

  const zones = donnees?.zones ?? [];
  const zonesTracees = zones.filter((z) => z.geometrie && z.geometrie.length >= 3);
  const peutModifier = (type: TypeElement) => (type === "bouche" ? peutCta : peutInstallations);

  const cascade = useMemo(() => analyserCascade(zones, donnees?.portes ?? []), [zones, donnees?.portes]);
  const bilans = useMemo(() => bilanAeraulique(zones, donnees?.bouches ?? []), [zones, donnees?.bouches]);

  // ------------------------------------------------------------------
  // Coordonnées et aimantation
  // ------------------------------------------------------------------

  const versPlan = (e: { clientX: number; clientY: number }): Point2D => {
    const el = svg.current!;
    const m = el.getScreenCTM();
    if (!m) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  };

  const aimanter = useCallback((p: Point2D, exclureZone?: string): Point2D => {
    if (magnetisme) {
      let meilleur: Point2D | null = null;
      let distance = 0.25;
      for (const z of zonesTracees) {
        if (z.id === exclureZone) continue;
        for (const v of z.geometrie!) {
          const d = Math.hypot(v[0] - p[0], v[1] - p[1]);
          if (d < distance) { distance = d; meilleur = v; }
        }
      }
      if (meilleur) return [...meilleur] as Point2D;
    }
    return [arrondir(p[0], pas), arrondir(p[1], pas)];
  }, [magnetisme, pas, zonesTracees]);

  const zoneEn = (p: Point2D): Zone | undefined => zonesTracees.find((z) => pointDansPolygone(p, z.geometrie!));

  // ------------------------------------------------------------------
  // Écritures
  // ------------------------------------------------------------------

  const ecrire = (fn: () => Promise<unknown>) => action.executer(async () => { await fn(); recharger(); });

  const creer = (type: TypeElement, p: Point2D) => ecrire(async () => {
    const zone = zoneEn(p);
    const base = { org_id: org, salle_id: salle.id };
    let cree: { id: string };
    switch (type) {
      case "porte": {
        const proches = zonesTracees
          .map((z) => ({ z, ...distanceContour(p, z.geometrie!) }))
          .filter((x) => x.distance < 0.6)
          .sort((a, b) => a.distance - b.distance);
        const angle = proches[0] ? Math.round(proches[0].angle / 90) * 90 % 180 : 0;
        cree = await s.depot.creer("portes", { ...base, type: "porte", x: p[0], y: p[1], angle, zone_a: proches[0]?.z.id ?? null, zone_b: proches[1]?.z.id ?? null });
        break;
      }
      case "bouche":
        cree = await s.depot.creer("bouches", { ...base, type: typeBouche, x: p[0], y: p[1], zone_id: zone?.id ?? null, cta_id: donnees?.ctas[0]?.id ?? null, debit_m3h: null });
        break;
      case "equipement":
        cree = await s.depot.creer("equipements", { ...base, type: "psm", libelle: "Nouvel équipement", x: p[0], y: p[1], zone_id: zone?.id ?? null });
        break;
      case "mobilier":
        cree = await s.depot.creer("mobilier", { ...base, type: "paillasse", libelle: "Paillasse", x: p[0], y: p[1], zone_id: zone?.id ?? null, largeur: 1.5, profondeur: 0.7 });
        break;
      case "point": {
        const max = (donnees?.points ?? []).reduce((m, x) => Math.max(m, parseInt(x.code.replace(/\D/g, ""), 10) || 0), 0);
        cree = await s.depot.creer("points_prelevement", { ...base, code: `P${String(max + 1).padStart(2, "0")}`, natures: ["particulaire"], x: p[0], y: p[1], zone_id: zone?.id ?? null });
        break;
      }
      default:
        return;
    }
    setSelection({ type, id: cree.id });
  });

  const terminerParcours = () => {
    if (parcours.length >= 2) {
      void ecrire(async () => {
        const f = await s.depot.creer("flux", { org_id: org, salle_id: salle.id, type: typeFlux, libelle: TYPES_FLUX[typeFlux], points: parcours });
        setSelection({ type: "flux", id: f.id });
      });
    }
    setParcours([]);
  };

  const supprimerSelection = () => {
    if (!selection || !window.confirm("Supprimer cet élément du plan ?")) return;
    if (selection.type === "zone") {
      void ecrire(() => s.depot.modifier("zones", selection.id, { geometrie: null }));
    } else {
      void ecrire(() => s.depot.supprimer(TABLE[selection.type], selection.id));
    }
    setSelection(null);
  };

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
      if (e.key === "Escape") { setParcours([]); setTraceZone(null); setSelection(null); }
      if (e.key === "Enter" && outil === "flux") terminerParcours();
      if ((e.key === "Delete" || e.key === "Backspace") && selection && peutModifier(selection.type)) supprimerSelection();
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  });

  // ------------------------------------------------------------------
  // Pointeur
  // ------------------------------------------------------------------

  const auPointeurBas = (e: PE<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const brut = versPlan(e);
    const cible = (e.target as Element).closest("[data-type]") as SVGElement | null;
    if (outil === "selection") {
      if (!cible) { setSelection(null); return; }
      const type = cible.dataset.type as TypeElement;
      const id = cible.dataset.id!;
      setSelection({ type, id });
      if (!peutModifier(type)) return;
      svg.current?.setPointerCapture(e.pointerId);
      const sommet = cible.dataset.sommet !== undefined ? Number(cible.dataset.sommet) : undefined;
      const milieu = cible.dataset.milieu !== undefined ? Number(cible.dataset.milieu) : undefined;
      if (type === "zone") {
        const z = zones.find((x) => x.id === id)!;
        let points = [...z.geometrie!.map((p) => [...p] as Point2D)];
        let indice = sommet;
        if (milieu !== undefined) {
          points = [...points.slice(0, milieu + 1), aimanter(brut, id), ...points.slice(milieu + 1)];
          indice = milieu + 1;
        }
        setGlissement({ type, id, depart: brut, courant: brut, sommet: indice, points, deplace: milieu !== undefined });
      } else if (type === "flux") {
        const f = donnees!.flux.find((x) => x.id === id)!;
        setGlissement({ type, id, depart: brut, courant: brut, sommet, points: f.points.map((p) => [...p] as Point2D), deplace: false });
      } else {
        setGlissement({ type, id, depart: brut, courant: brut, deplace: false });
      }
      return;
    }
    if (outil === "zone") {
      svg.current?.setPointerCapture(e.pointerId);
      const p = aimanter(brut);
      setTraceZone({ depart: p, courant: p });
      return;
    }
    if (outil === "flux") {
      setParcours([...parcours, [arrondir(brut[0], pas), arrondir(brut[1], pas)]]);
      return;
    }
    void creer(outil, [arrondir(brut[0], pas), arrondir(brut[1], pas)]);
  };

  const auPointeurDeplace = (e: PE<SVGSVGElement>) => {
    const brut = versPlan(e);
    setSurvol(brut);
    if (traceZone) setTraceZone({ ...traceZone, courant: aimanter(brut) });
    if (glissement) {
      const deplace = glissement.deplace || Math.hypot(brut[0] - glissement.depart[0], brut[1] - glissement.depart[1]) > 0.05;
      setGlissement({ ...glissement, courant: brut, deplace });
    }
  };

  const decalage = (g: Glissement): Point2D => [arrondir(g.courant[0] - g.depart[0], pas), arrondir(g.courant[1] - g.depart[1], pas)];

  /** Polygone ou parcours en cours de modification. */
  const pointsGlisses = (g: Glissement): Point2D[] => {
    const pts = g.points!;
    if (g.sommet !== undefined) {
      const p = g.type === "zone" ? aimanter(g.courant, g.id) : ([arrondir(g.courant[0], pas), arrondir(g.courant[1], pas)] as Point2D);
      return pts.map((x, i) => (i === g.sommet ? p : x));
    }
    const [dx, dy] = decalage(g);
    return pts.map(([x, y]) => [arrondiAffichage(x + dx), arrondiAffichage(y + dy)] as Point2D);
  };

  const auPointeurHaut = () => {
    if (traceZone) {
      const pts = rectangle(traceZone.depart[0], traceZone.depart[1], traceZone.courant[0], traceZone.courant[1]);
      setTraceZone(null);
      if (aire(pts) >= 0.25) setNouvelleZone(pts);
    }
    if (glissement) {
      const g = glissement;
      setGlissement(null);
      if (!g.deplace) return;
      if (g.type === "zone") {
        void ecrire(() => s.depot.modifier("zones", g.id, { geometrie: pointsGlisses(g) }));
      } else if (g.type === "flux") {
        void ecrire(() => s.depot.modifier("flux", g.id, { points: pointsGlisses(g) }));
      } else {
        const element = elementPose(g.type, g.id);
        if (!element) return;
        const [dx, dy] = decalage(g);
        const p: Point2D = [arrondiAffichage(Number(element.x) + dx), arrondiAffichage(Number(element.y) + dy)];
        const valeurs: Record<string, unknown> = { x: p[0], y: p[1] };
        if (g.type === "bouche" || g.type === "equipement" || g.type === "mobilier" || g.type === "point") {
          const z = zoneEn(p);
          if (z) valeurs.zone_id = z.id;
        }
        void ecrire(() => s.depot.modifier(TABLE[g.type], g.id, valeurs as never));
      }
    }
  };

  function elementPose(type: TypeElement, id: string): { x: number | null; y: number | null } | undefined {
    const listes: Partial<Record<TypeElement, { id: string; x: number | null; y: number | null }[]>> = {
      porte: donnees?.portes, bouche: donnees?.bouches, equipement: donnees?.equipements, mobilier: donnees?.mobilier, point: donnees?.points,
    };
    return listes[type]?.find((x) => x.id === id);
  }

  const position = (type: TypeElement, id: string, x: number, y: number): Point2D => {
    if (glissement && glissement.type === type && glissement.id === id && glissement.deplace) {
      const [dx, dy] = decalage(glissement);
      return [x + dx, y + dy];
    }
    return [x, y];
  };

  // ------------------------------------------------------------------
  // Rendu
  // ------------------------------------------------------------------

  const pressions = zones.map((z) => z.pression_pa).filter((p): p is number => p != null);
  const pMin = Math.min(0, ...pressions);
  const pMax = Math.max(1, ...pressions);
  const couleurPression = (p: number | null) => {
    if (p == null) return "#e5e7eb";
    if (p < 0) return "#c4b5fd";
    const t = (p - Math.max(0, pMin)) / (pMax - Math.max(0, pMin) || 1);
    const l = 92 - t * 45;
    return `hsl(24, 65%, ${l}%)`;
  };
  const remplissage = (z: Zone) => {
    if (affichage === "classes") return couleurClasse(z.iso_repos);
    if (affichage === "pression") return couleurPression(z.pression_pa);
    if (affichage === "flux") return "#f1f5f9";
    return "#eef3fa";
  };
  const texteZone = (z: Zone) => (affichage === "classes" ? couleurTexteClasse(z.iso_repos) : "#0a1830");
  const t = Math.max(L, H) / 60; // taille de texte de base (m)

  const grille = [];
  for (let x = 0; x <= L; x += 1) grille.push(<line key={`x${x}`} x1={x} y1={0} x2={x} y2={H} stroke={x % 5 === 0 ? "#cbd5e1" : "#e2e8f0"} strokeWidth={x % 5 === 0 ? 0.03 : 0.015} />);
  for (let y = 0; y <= H; y += 1) grille.push(<line key={`y${y}`} x1={0} y1={y} x2={L} y2={y} stroke={y % 5 === 0 ? "#cbd5e1" : "#e2e8f0"} strokeWidth={y % 5 === 0 ? 0.03 : 0.015} />);

  const selectionnee = (type: TypeElement, id: string) => selection?.type === type && selection.id === id;
  const contour = (type: TypeElement, id: string) => (selectionnee(type, id) ? "#c2703c" : "#17355f");

  const fleches = affichage === "pression" ? cascade.filter((c) => c.deltaPa !== null).map((c) => {
    const p = c.porte;
    const versBasse = c.zoneBasse?.geometrie ? centroide(c.zoneBasse.geometrie) : c.zoneHaute?.geometrie ? (() => { const h = centroide(c.zoneHaute!.geometrie!); return [2 * p.x - h[0], 2 * p.y - h[1]] as Point2D; })() : null;
    if (!versBasse) return null;
    const dx = versBasse[0] - p.x;
    const dy = versBasse[1] - p.y;
    const n = Math.hypot(dx, dy) || 1;
    const lg = Math.max(0.8, t * 2.2);
    const x2 = p.x + (dx / n) * lg;
    const y2 = p.y + (dy / n) * lg;
    const couleur = COULEUR_STATUT[c.statut];
    return (
      <g key={`f${p.id}`} pointerEvents="none">
        <line x1={p.x} y1={p.y} x2={x2} y2={y2} stroke={couleur} strokeWidth={t * 0.18} markerEnd={`url(#fleche-${c.statut})`} />
        <text x={x2 + (dx / n) * t * 0.6} y={y2 + (dy / n) * t * 0.6} fontSize={t * 0.75} fill={couleur} fontWeight={700} textAnchor="middle" dominantBaseline="middle">{c.deltaPa} Pa</text>
      </g>
    );
  }) : null;

  const sel = selection ? (() => {
    const listes: Record<TypeElement, { id: string }[] | undefined> = {
      zone: zones, porte: donnees?.portes, bouche: donnees?.bouches, equipement: donnees?.equipements, mobilier: donnees?.mobilier, point: donnees?.points, flux: donnees?.flux,
    };
    return listes[selection.type]?.find((x) => x.id === selection.id) as Record<string, unknown> | undefined;
  })() : undefined;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        <div className="no-print mb-2 flex flex-wrap items-center gap-1.5">
          {OUTILS.map((o) => (
            <button
              key={o.cle}
              type="button"
              title={o.aide}
              disabled={o.cle !== "selection" && !peutModifier(o.cle as TypeElement)}
              onClick={() => { setOutil(o.cle); setParcours([]); }}
              className={`rounded-lg border px-2.5 py-1 text-sm disabled:opacity-40 ${outil === o.cle ? "border-navy-700 bg-navy-700 text-white" : "border-bord bg-white hover:bg-navy-050"}`}
            >
              {o.libelle}
            </button>
          ))}
          {outil === "bouche" && (
            <Liste aria-label="Type de bouche" className="!w-36" value={typeBouche} onChange={(e) => setTypeBouche(e.target.value as Bouche["type"])}>
              {Object.entries(TYPES_BOUCHES).map(([c, l]) => <option key={c} value={c}>{l}</option>)}
            </Liste>
          )}
          {outil === "flux" && (
            <>
              <Liste aria-label="Type de flux" className="!w-36" value={typeFlux} onChange={(e) => setTypeFlux(e.target.value as Flux["type"])}>
                {Object.entries(TYPES_FLUX).map(([c, l]) => <option key={c} value={c}>{l}</option>)}
              </Liste>
              <Bouton disabled={parcours.length < 2} onClick={terminerParcours}>Terminer le parcours</Bouton>
            </>
          )}
          <span className="mx-1 h-6 w-px bg-bord" />
          <Liste aria-label="Affichage" className="!w-48" value={affichage} onChange={(e) => setAffichage(e.target.value as Affichage)}>
            <option value="edition">Vue : édition</option>
            <option value="classes">Vue : cartographie des classes</option>
            <option value="pression">Vue : cascade de pression</option>
            <option value="flux">Vue : flux</option>
          </Liste>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={magnetisme} onChange={(e) => setMagnetisme(e.target.checked)} /> Magnétisme</label>
          <Bouton variante="discret" aria-label="Zoom arrière" onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}>−</Bouton>
          <span className="w-12 text-center text-xs">{Math.round(zoom * 100)} %</span>
          <Bouton variante="discret" aria-label="Zoom avant" onClick={() => setZoom(Math.min(4, zoom + 0.25))}>+</Bouton>
          <Bouton variante="discret" onClick={() => window.print()}>Imprimer</Bouton>
        </div>
        <p className="no-print mb-2 text-xs text-texte-2">{OUTILS.find((o) => o.cle === outil)?.aide}{survol && ` · ${survol[0].toFixed(1)} ; ${survol[1].toFixed(1)} m`}</p>
        <MessageErreur erreur={action.erreur} />
        <div className="overflow-auto rounded-xl border border-bord bg-white">
          <svg
            ref={svg}
            role="img"
            aria-label={`Plan de ${salle.nom}`}
            viewBox={`${-0.5} ${-0.5} ${L + 1} ${H + 1}`}
            style={{ width: `${zoom * 100}%`, minWidth: 600, touchAction: "none", cursor: outil === "selection" ? "default" : "crosshair" }}
            onPointerDown={auPointeurBas}
            onPointerMove={auPointeurDeplace}
            onPointerUp={auPointeurHaut}
            onPointerLeave={() => setSurvol(null)}
            onDoubleClick={() => outil === "flux" && terminerParcours()}
          >
            <defs>
              {(Object.keys(COULEUR_STATUT) as Statut[]).map((st) => (
                <marker key={st} id={`fleche-${st}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill={COULEUR_STATUT[st]} />
                </marker>
              ))}
              {Object.entries(COULEURS_FLUX).map(([k, c]) => (
                <marker key={k} id={`fleche-flux-${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill={c} />
                </marker>
              ))}
            </defs>
            <rect x={0} y={0} width={L} height={H} fill="#fff" />
            {fond && <image href={fond} x={0} y={0} width={salle.plan_fond_largeur_m ?? L} preserveAspectRatio="xMinYMin meet" opacity={0.45} />}
            <g pointerEvents="none">{grille}</g>

            {zonesTracees.map((z) => {
              const pts = glissement?.type === "zone" && glissement.id === z.id && glissement.deplace ? pointsGlisses(glissement) : z.geometrie!;
              const c = centroide(pts);
              return (
                <g key={z.id}>
                  <polygon data-type="zone" data-id={z.id} points={pts.map((p) => p.join(",")).join(" ")} fill={remplissage(z)} stroke={contour("zone", z.id)} strokeWidth={selectionnee("zone", z.id) ? t * 0.12 : t * 0.06} />
                  <text x={c[0]} y={c[1] - t * 0.5} fontSize={t * 0.8} textAnchor="middle" fill={texteZone(z)} fontWeight={700} pointerEvents="none">{z.code} {z.nom}</text>
                  <text x={c[0]} y={c[1] + t * 0.6} fontSize={t * 0.7} textAnchor="middle" fill={texteZone(z)} pointerEvents="none">
                    {affichage === "pression" ? (z.pression_pa != null ? `${z.pression_pa} Pa` : "pression ?") : `${libelleClasse(z.iso_repos)}${z.grade_bpf ? ` · ${z.grade_bpf}` : ""}`}
                  </text>
                </g>
              );
            })}

            {(donnees?.flux ?? []).map((f) => {
              const pts = glissement?.type === "flux" && glissement.id === f.id && glissement.deplace ? pointsGlisses(glissement) : f.points;
              const couleur = COULEURS_FLUX[f.type];
              const attenue = affichage !== "flux" && affichage !== "edition";
              return (
                <g key={f.id} opacity={attenue ? 0.35 : 1}>
                  <polyline data-type="flux" data-id={f.id} points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={couleur} strokeWidth={t * (selectionnee("flux", f.id) ? 0.3 : 0.2)} strokeDasharray={f.type === "dechets" ? `${t * 0.6} ${t * 0.3}` : undefined} markerEnd={`url(#fleche-flux-${f.type})`} />
                  {selectionnee("flux", f.id) && pts.map((p, i) => <circle key={i} data-type="flux" data-id={f.id} data-sommet={i} cx={p[0]} cy={p[1]} r={t * 0.3} fill="#fff" stroke={couleur} strokeWidth={t * 0.08} />)}
                </g>
              );
            })}

            {(donnees?.mobilier ?? []).map((m: Mobilier) => {
              const [x, y] = position("mobilier", m.id, m.x, m.y);
              return (
                <rect key={m.id} data-type="mobilier" data-id={m.id} x={x - m.largeur / 2} y={y - m.profondeur / 2} width={m.largeur} height={m.profondeur}
                  transform={`rotate(${m.angle} ${x} ${y})`} fill="#cbd5e1" stroke={contour("mobilier", m.id)} strokeWidth={t * 0.05} opacity={affichage === "flux" ? 0.5 : 1}>
                  <title>{m.libelle || TYPES_MOBILIER[m.type]}</title>
                </rect>
              );
            })}

            {(donnees?.equipements ?? []).filter((q) => q.x != null && q.y != null).map((q: Equipement) => {
              const [x, y] = position("equipement", q.id, q.x!, q.y!);
              return (
                <g key={q.id}>
                  <rect data-type="equipement" data-id={q.id} x={x - q.largeur / 2} y={y - q.profondeur / 2} width={q.largeur} height={q.profondeur} fill="#fde68a" stroke={contour("equipement", q.id)} strokeWidth={t * 0.06}>
                    <title>{q.libelle}</title>
                  </rect>
                  <text x={x} y={y} fontSize={Math.min(t * 0.6, q.profondeur * 0.6)} textAnchor="middle" dominantBaseline="middle" fontWeight={700} fill="#713f12" pointerEvents="none">{ABREVIATIONS_EQUIPEMENTS[q.type] ?? "ÉQ"}</text>
                </g>
              );
            })}

            {(donnees?.portes ?? []).map((p: Porte) => {
              const [x, y] = position("porte", p.id, p.x, p.y);
              const analyse = cascade.find((c) => c.porte.id === p.id);
              return (
                <rect key={p.id} data-type="porte" data-id={p.id} x={x - 0.45} y={y - 0.09} width={0.9} height={0.18} transform={`rotate(${p.angle} ${x} ${y})`}
                  fill={p.type === "passe_plat" ? "#e0e7ff" : "#fff"} stroke={selectionnee("porte", p.id) ? "#c2703c" : affichage === "pression" && analyse ? COULEUR_STATUT[analyse.statut] : "#17355f"} strokeWidth={t * 0.08}>
                  <title>{p.libelle || TYPES_PORTES[p.type]}{analyse ? ` — ${analyse.message}` : ""}</title>
                </rect>
              );
            })}
            {fleches}

            {(donnees?.bouches ?? []).map((b: Bouche) => {
              const [x, y] = position("bouche", b.id, b.x, b.y);
              const couleur = b.type === "soufflage" ? "#2563eb" : b.type === "reprise" ? "#059669" : "#ea580c";
              return (
                <g key={b.id} opacity={affichage === "flux" ? 0.4 : 1}>
                  <circle data-type="bouche" data-id={b.id} cx={x} cy={y} r={t * 0.45} fill={couleur} stroke={selectionnee("bouche", b.id) ? "#c2703c" : "#fff"} strokeWidth={t * 0.1}>
                    <title>{TYPES_BOUCHES[b.type]} {b.repere} {b.debit_m3h != null ? `${b.debit_m3h} m³/h` : ""}</title>
                  </circle>
                  <text x={x} y={y} fontSize={t * 0.55} textAnchor="middle" dominantBaseline="central" fill="#fff" fontWeight={700} pointerEvents="none">{b.type[0].toUpperCase()}</text>
                </g>
              );
            })}

            {(donnees?.points ?? []).map((pt: PointPrelevement) => {
              const [x, y] = position("point", pt.id, pt.x, pt.y);
              const r = t * 0.4;
              return (
                <g key={pt.id} opacity={pt.actif ? 1 : 0.4}>
                  <polygon data-type="point" data-id={pt.id} points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`} fill="#dc2626" stroke={selectionnee("point", pt.id) ? "#c2703c" : "#fff"} strokeWidth={t * 0.08} />
                  <text x={x} y={y - r - t * 0.2} fontSize={t * 0.55} textAnchor="middle" fill="#991b1b" fontWeight={700} pointerEvents="none">{pt.code}</text>
                </g>
              );
            })}

            {selection?.type === "zone" && peutInstallations && (() => {
              const z = zones.find((x) => x.id === selection.id);
              if (!z?.geometrie) return null;
              const pts = glissement?.type === "zone" && glissement.id === z.id && glissement.deplace ? pointsGlisses(glissement) : z.geometrie;
              return (
                <g>
                  {pts.map((p, i) => {
                    const q = pts[(i + 1) % pts.length];
                    return <circle key={`m${i}`} data-type="zone" data-id={z.id} data-milieu={i} cx={(p[0] + q[0]) / 2} cy={(p[1] + q[1]) / 2} r={t * 0.22} fill="#fff" stroke="#94a3b8" strokeWidth={t * 0.05} />;
                  })}
                  {pts.map((p, i) => <rect key={`s${i}`} data-type="zone" data-id={z.id} data-sommet={i} x={p[0] - t * 0.25} y={p[1] - t * 0.25} width={t * 0.5} height={t * 0.5} fill="#c2703c" />)}
                </g>
              );
            })()}

            {traceZone && (() => {
              const pts = rectangle(traceZone.depart[0], traceZone.depart[1], traceZone.courant[0], traceZone.courant[1]);
              const [x0, y0] = pts[0];
              const [x1, y1] = pts[2];
              return (
                <g pointerEvents="none">
                  <polygon points={pts.map((p) => p.join(",")).join(" ")} fill="rgba(194,112,60,.15)" stroke="#c2703c" strokeWidth={t * 0.08} strokeDasharray={`${t * 0.3}`} />
                  <text x={(x0 + x1) / 2} y={(y0 + y1) / 2} fontSize={t * 0.8} textAnchor="middle" fill="#a85c2c">{(x1 - x0).toFixed(1)} × {(y1 - y0).toFixed(1)} m = {aire(pts).toFixed(1)} m²</text>
                </g>
              );
            })()}
            {parcours.length > 0 && (
              <polyline pointerEvents="none" points={[...parcours, ...(survol ? [survol] : [])].map((p) => p.join(",")).join(" ")} fill="none" stroke={COULEURS_FLUX[typeFlux]} strokeWidth={t * 0.15} strokeDasharray={`${t * 0.4}`} />
            )}
          </svg>
        </div>
        <Legende affichage={affichage} />
      </div>

      <aside className="no-print min-w-0">
        {selection && sel ? (
          <PanneauElement
            key={`${selection.type}-${selection.id}-${String(sel.modifie_le)}`}
            type={selection.type}
            element={sel}
            zones={zones}
            ctas={donnees?.ctas ?? []}
            modifiable={peutModifier(selection.type)}
            onEnregistrer={(valeurs) => ecrire(() => s.depot.modifier(TABLE[selection.type], selection.id, valeurs as never))}
            onSupprimer={supprimerSelection}
            onFermer={() => setSelection(null)}
          />
        ) : (
          <PanneauAnalyse cascade={cascade} bilans={bilans} zones={zones} salle={salle} peutModifier={peutInstallations} onSalleModifiee={onSalleModifiee} onSelection={(id) => setSelection({ type: "zone", id })} />
        )}
      </aside>

      {nouvelleZone && (
        <DialogueNouvelleZone
          points={nouvelleZone}
          zonesSansTrace={zones.filter((z) => !z.geometrie)}
          onFermer={() => setNouvelleZone(null)}
          onValider={(choix) => ecrire(async () => {
            const surface = arrondiAffichage(aire(nouvelleZone));
            if (choix.zoneId) {
              const z = zones.find((x) => x.id === choix.zoneId)!;
              await s.depot.modifier("zones", z.id, { geometrie: nouvelleZone, ...(choix.majSurface || z.surface_m2 == null ? { surface_m2: surface } : {}) });
              setSelection({ type: "zone", id: z.id });
            } else {
              const max = zones.reduce((m, z) => Math.max(m, parseInt(z.code.replace(/\D/g, ""), 10) || 0), 0);
              const z = await s.depot.creer("zones", {
                org_id: org, salle_id: salle.id, code: `Z${String(max + 1).padStart(2, "0")}`, nom: choix.nom, type_zone: choix.type as Zone["type_zone"],
                iso_repos: choix.iso, iso_activite: choix.iso, grade_bpf: null, zone_risque: null, surface_m2: surface, hauteur_m: 2.6,
                pression_pa: null, tolerance_pression_pa: null, renouvellement_vol_h: null, temperature_min: null, temperature_max: null,
                hr_min: null, hr_max: null, gabarit_ref: null, notes: "", geometrie: nouvelleZone,
              });
              setSelection({ type: "zone", id: z.id });
            }
            setNouvelleZone(null);
            onSalleModifiee();
          })}
        />
      )}
    </div>
  );
}

function Legende({ affichage }: { affichage: Affichage }) {
  const puce = (couleur: string, libelle: string, forme: "carre" | "rond" | "trait" = "carre") => (
    <span key={libelle} className="inline-flex items-center gap-1.5">
      <span style={{ background: couleur }} className={forme === "rond" ? "h-3 w-3 rounded-full" : forme === "trait" ? "h-1 w-5" : "h-3 w-3 rounded-sm"} />
      {libelle}
    </span>
  );
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-texte-2">
      {affichage === "classes" && [4, 5, 6, 7, 8, 9].map((c) => puce(couleurClasse(c), `ISO ${c}${c === 4 ? " et moins" : ""}`))}
      {affichage === "classes" && puce(couleurClasse(null), "Non classée")}
      {affichage === "pression" && <>
        {puce("hsl(24,65%,85%)", "Pression faible")}{puce("hsl(24,65%,50%)", "Pression forte")}{puce("#c4b5fd", "Dépression")}
        {puce(COULEUR_STATUT.ok, "Cascade correcte", "trait")}{puce(COULEUR_STATUT.attention, "Écart < 10 Pa", "trait")}{puce(COULEUR_STATUT.alerte, "Inversion", "trait")}
      </>}
      {(affichage === "flux" || affichage === "edition") && Object.entries(TYPES_FLUX).map(([k, l]) => puce(COULEURS_FLUX[k], `Flux ${l.toLowerCase()}`, "trait"))}
      {puce("#2563eb", "Soufflage", "rond")}{puce("#059669", "Reprise", "rond")}{puce("#ea580c", "Extraction", "rond")}
      {puce("#fde68a", "Équipement")}{puce("#cbd5e1", "Mobilier")}{puce("#dc2626", "Point de prélèvement")}
    </div>
  );
}

function PanneauAnalyse({ cascade, bilans, zones, salle, peutModifier, onSalleModifiee, onSelection }: {
  cascade: ReturnType<typeof analyserCascade>;
  bilans: ReturnType<typeof bilanAeraulique>;
  zones: Zone[];
  salle: SallePropre;
  peutModifier: boolean;
  onSalleModifiee: () => void;
  onSelection: (zoneId: string) => void;
}) {
  const s = useSession();
  const [onglet, setOnglet] = useState<"cascade" | "debits" | "plan">("cascade");
  const [dimensions, setDimensions] = useState({ l: salle.plan_largeur_m as number | null, h: salle.plan_hauteur_m as number | null, f: salle.plan_fond_largeur_m });
  const action = useAction();
  const problemes = cascade.filter((c) => c.statut === "alerte" || c.statut === "attention");
  const sansTrace = zones.filter((z) => !z.geometrie);

  const deposerFond = (fichier: File) => action.executer(async () => {
    const chemin = `${s.org!.id}/plans/${salle.id}/${crypto.randomUUID()}-${fichier.name.normalize("NFD").replace(/[^a-zA-Z0-9._-]+/g, "-")}`;
    await s.depot.deposerFichier(chemin, fichier);
    await s.depot.modifier("salles_propres", salle.id, { plan_fond: chemin, plan_fond_largeur_m: salle.plan_fond_largeur_m ?? salle.plan_largeur_m });
    onSalleModifiee();
  });

  return (
    <div className="rounded-xl border border-bord bg-white p-3">
      <Onglets
        onglets={[
          { cle: "cascade", libelle: <>Cascade {problemes.length > 0 && <Badge ton="alerte">{problemes.length}</Badge>}</> },
          { cle: "debits", libelle: "Débits" },
          { cle: "plan", libelle: "Plan" },
        ]}
        actif={onglet}
        onChange={setOnglet}
      />
      {onglet === "cascade" && (
        <div className="space-y-2 text-sm">
          {cascade.length === 0 && <p className="text-texte-2">Posez des portes entre les zones pour analyser la cascade de pression.</p>}
          {cascade.map((c) => (
            <div key={c.porte.id} className="flex gap-2">
              <Badge ton={TON_STATUT[c.statut]}>{c.deltaPa != null ? `${c.deltaPa} Pa` : "?"}</Badge>
              <span>{c.porte.libelle && <strong>{c.porte.libelle} : </strong>}{c.message}</span>
            </div>
          ))}
        </div>
      )}
      {onglet === "debits" && (
        <div className="space-y-2 text-sm">
          {bilans.map((b) => (
            <button key={b.zone.id} type="button" className="block w-full rounded-lg border border-bord p-2 text-left hover:bg-fond" onClick={() => b.zone.geometrie && onSelection(b.zone.id)}>
              <div className="flex items-center justify-between gap-2"><strong>{b.zone.code} {b.zone.nom}</strong><Badge ton={TON_STATUT[b.statut]}>{b.tauxVolH != null ? `${b.tauxVolH} vol/h` : "—"}</Badge></div>
              <div className="text-xs text-texte-2">Soufflé {b.souffleM3h} m³/h · repris {b.repriseM3h} · extrait {b.extractionM3h}{b.volumeM3 ? ` · ${b.volumeM3} m³` : ""}</div>
              <div className="text-xs">{b.message}</div>
            </button>
          ))}
        </div>
      )}
      {onglet === "plan" && (
        <div className="space-y-3 text-sm">
          <MessageErreur erreur={action.erreur} />
          {sansTrace.length > 0 && (
            <div>
              <div className="mb-1 font-semibold">Zones sans tracé ({sansTrace.length})</div>
              <p className="mb-1 text-xs text-texte-2">Outil « Zone » : tracez un rectangle puis associez-le à l'une d'elles.</p>
              <ul className="text-xs">{sansTrace.map((z) => <li key={z.id}>{z.code} {z.nom}</li>)}</ul>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Champ libelle="Largeur (m)"><SaisieNombre disabled={!peutModifier} valeur={dimensions.l} onChange={(l) => setDimensions({ ...dimensions, l })} /></Champ>
            <Champ libelle="Hauteur (m)"><SaisieNombre disabled={!peutModifier} valeur={dimensions.h} onChange={(h) => setDimensions({ ...dimensions, h })} /></Champ>
          </div>
          {salle.plan_fond && (
            <Champ libelle="Largeur réelle du fond de plan (m)" aide="Cale l'image à l'échelle du plan."><SaisieNombre disabled={!peutModifier} valeur={dimensions.f} onChange={(f) => setDimensions({ ...dimensions, f })} /></Champ>
          )}
          {peutModifier && (
            <>
              <Bouton disabled={action.enCours || !dimensions.l || !dimensions.h} onClick={() => void action.executer(async () => {
                await s.depot.modifier("salles_propres", salle.id, { plan_largeur_m: dimensions.l!, plan_hauteur_m: dimensions.h!, plan_fond_largeur_m: dimensions.f });
                onSalleModifiee();
              })}>Appliquer</Bouton>
              <div>
                <div className="mb-1 font-semibold">Fond de plan</div>
                <p className="mb-1 text-xs text-texte-2">Image du plan architecte (PNG, JPG). Exportez un DWG ou un PDF en image au préalable.</p>
                <input type="file" accept="image/*" className="text-xs" onChange={(e) => { const f = e.target.files?.[0]; if (f) void deposerFond(f); }} />
                {salle.plan_fond && <Bouton variante="discret" onClick={() => void action.executer(async () => { await s.depot.modifier("salles_propres", salle.id, { plan_fond: null }); onSalleModifiee(); })}>Retirer le fond</Bouton>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function champsElement(type: TypeElement, zones: Zone[], ctas: { id: string; nom: string }[]): DefinitionChamp[] {
  const optionsZones = zones.map((z) => ({ valeur: z.id, libelle: `${z.code} ${z.nom}` }));
  switch (type) {
    case "zone": return [
      { cle: "code", libelle: "Code", type: "texte" },
      { cle: "nom", libelle: "Nom", type: "texte", requis: true },
      { cle: "type_zone", libelle: "Type", type: "liste", options: optionsDe(LIBELLES_TYPES_ZONES), requis: true },
      { cle: "iso_repos", libelle: "ISO au repos", type: "nombre" },
      { cle: "iso_activite", libelle: "ISO en activité", type: "nombre" },
      { cle: "pression_pa", libelle: "Pression (Pa)", type: "nombre" },
      { cle: "surface_m2", libelle: "Surface (m²)", type: "nombre" },
      { cle: "hauteur_m", libelle: "Hauteur (m)", type: "nombre" },
      { cle: "renouvellement_vol_h", libelle: "Renouvellement cible (vol/h)", type: "nombre", large: true },
    ];
    case "porte": return [
      { cle: "libelle", libelle: "Libellé", type: "texte" },
      { cle: "type", libelle: "Type", type: "liste", options: optionsDe(TYPES_PORTES), requis: true },
      { cle: "zone_a", libelle: "Côté A", type: "liste", options: optionsZones, aide: "Vide = extérieur" },
      { cle: "zone_b", libelle: "Côté B", type: "liste", options: optionsZones, aide: "Vide = extérieur" },
      { cle: "angle", libelle: "Orientation (°)", type: "nombre" },
      { cle: "asservie", libelle: "Asservissement", type: "case", aide: "Portes asservies (une seule ouverte à la fois)" },
      { cle: "notes", libelle: "Notes", type: "zone_texte" },
    ];
    case "bouche": return [
      { cle: "repere", libelle: "Repère", type: "texte" },
      { cle: "type", libelle: "Type", type: "liste", options: optionsDe(TYPES_BOUCHES), requis: true },
      { cle: "zone_id", libelle: "Zone", type: "liste", options: optionsZones },
      { cle: "cta_id", libelle: "CTA", type: "liste", options: ctas.map((c) => ({ valeur: c.id, libelle: c.nom })) },
      { cle: "debit_m3h", libelle: "Débit (m³/h)", type: "nombre", large: true },
      { cle: "notes", libelle: "Notes", type: "zone_texte" },
    ];
    case "equipement": return [
      { cle: "libelle", libelle: "Libellé", type: "texte", requis: true },
      { cle: "type", libelle: "Type", type: "liste", options: optionsDe(TYPES_EQUIPEMENTS), requis: true },
      { cle: "repere", libelle: "Repère", type: "texte" },
      { cle: "zone_id", libelle: "Zone", type: "liste", options: optionsZones },
      { cle: "statut", libelle: "Statut", type: "liste", options: optionsDe(STATUTS_EQUIPEMENTS), requis: true },
      { cle: "numero_serie", libelle: "N° de série", type: "texte" },
      { cle: "largeur", libelle: "Largeur (m)", type: "nombre" },
      { cle: "profondeur", libelle: "Profondeur (m)", type: "nombre" },
    ];
    case "mobilier": return [
      { cle: "libelle", libelle: "Libellé", type: "texte" },
      { cle: "type", libelle: "Type", type: "liste", options: optionsDe(TYPES_MOBILIER), requis: true },
      { cle: "materiau", libelle: "Matériau", type: "liste", options: optionsDe(MATERIAUX) },
      { cle: "nettoyabilite", libelle: "Nettoyabilité", type: "liste", options: optionsDe(NETTOYABILITE), requis: true },
      { cle: "zone_id", libelle: "Zone", type: "liste", options: optionsZones },
      { cle: "angle", libelle: "Orientation (°)", type: "nombre" },
      { cle: "largeur", libelle: "Largeur (m)", type: "nombre" },
      { cle: "profondeur", libelle: "Profondeur (m)", type: "nombre" },
    ];
    case "point": return [
      { cle: "code", libelle: "Code", type: "texte", requis: true },
      { cle: "zone_id", libelle: "Zone", type: "liste", options: optionsZones },
      { cle: "natures", libelle: "Natures de prélèvement", type: "multiple", options: optionsDe(NATURES_PRELEVEMENT) },
      { cle: "hauteur_m", libelle: "Hauteur de prélèvement (m)", type: "nombre" },
      { cle: "actif", libelle: "Actif", type: "case", aide: "Point en service" },
      { cle: "description", libelle: "Description", type: "zone_texte" },
    ];
    case "flux": return [
      { cle: "libelle", libelle: "Libellé", type: "texte" },
      { cle: "type", libelle: "Type", type: "liste", options: optionsDe(TYPES_FLUX), requis: true },
    ];
  }
}

const TITRES: Record<TypeElement, string> = { zone: "Zone", porte: "Porte", bouche: "Bouche", equipement: "Équipement", mobilier: "Mobilier", point: "Point de prélèvement", flux: "Flux" };

function PanneauElement({ type, element, zones, ctas, modifiable, onEnregistrer, onSupprimer, onFermer }: {
  type: TypeElement;
  element: Record<string, unknown>;
  zones: Zone[];
  ctas: { id: string; nom: string }[];
  modifiable: boolean;
  onEnregistrer: (valeurs: Record<string, unknown>) => Promise<boolean>;
  onSupprimer: () => void;
  onFermer: () => void;
}) {
  const [valeurs, setValeurs] = useState(element);
  const champs = champsElement(type, zones, ctas);
  const zone = type === "zone" ? (element as unknown as Zone) : null;
  const surfaceTrace = zone?.geometrie ? arrondiAffichage(aire(zone.geometrie)) : null;
  const propres = () => Object.fromEntries(champs.map((c) => [c.cle, valeurs[c.cle]]));
  return (
    <div className="rounded-xl border border-bord bg-white p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{TITRES[type]}</h3>
        <button type="button" aria-label="Fermer" className="text-texte-2" onClick={onFermer}>✕</button>
      </div>
      <Formulaire uneColonne champs={champs} valeurs={valeurs} onChange={setValeurs} lectureSeule={!modifiable} />
      {zone && surfaceTrace != null && (
        <p className="mt-2 text-xs text-texte-2">
          Surface du tracé : {surfaceTrace} m².{" "}
          {modifiable && zone.surface_m2 !== surfaceTrace && <button type="button" className="underline" onClick={() => setValeurs({ ...valeurs, surface_m2: surfaceTrace })}>Reprendre cette surface</button>}
        </p>
      )}
      {modifiable && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Bouton variante="principal" onClick={() => void onEnregistrer(propres())}>Enregistrer</Bouton>
          <Bouton variante="danger" onClick={onSupprimer}>{type === "zone" ? "Effacer le tracé" : "Supprimer"}</Bouton>
        </div>
      )}
      {type === "equipement" && <Link to="/equipements" className="mt-2 inline-block text-xs text-navy-700 hover:underline">Tous les équipements</Link>}
    </div>
  );
}

function DialogueNouvelleZone({ points, zonesSansTrace, onFermer, onValider }: {
  points: Point2D[];
  zonesSansTrace: Zone[];
  onFermer: () => void;
  onValider: (choix: { zoneId: string | null; majSurface: boolean; nom: string; type: string; iso: number | null }) => void;
}) {
  const [zoneId, setZoneId] = useState<string>(zonesSansTrace[0]?.id ?? "");
  const [majSurface, setMajSurface] = useState(true);
  const [nom, setNom] = useState("");
  const [type, setType] = useState("salle");
  const [iso, setIso] = useState<number | null>(8);
  const surface = arrondiAffichage(aire(points));
  return (
    <Modale
      titre={`Nouveau tracé — ${surface} m²`}
      onFermer={onFermer}
      pied={<><Bouton onClick={onFermer}>Annuler</Bouton><Bouton variante="principal" disabled={!zoneId && !nom.trim()} onClick={() => onValider({ zoneId: zoneId || null, majSurface, nom: nom.trim(), type, iso })}>Valider</Bouton></>}
    >
      <div className="grid gap-3">
        <Champ libelle="Associer le tracé à">
          <Liste value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            {zonesSansTrace.map((z) => <option key={z.id} value={z.id}>{z.code} {z.nom}{z.surface_m2 ? ` (${z.surface_m2} m² saisis)` : ""}</option>)}
            <option value="">+ Une nouvelle zone…</option>
          </Liste>
        </Champ>
        {zoneId ? (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={majSurface} onChange={(e) => setMajSurface(e.target.checked)} /> Remplacer la surface de la zone par celle du tracé ({surface} m²)</label>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            <Champ libelle="Nom" className="md:col-span-3"><Saisie autoFocus value={nom} onChange={(e) => setNom(e.target.value)} /></Champ>
            <Champ libelle="Type"><Liste value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(LIBELLES_TYPES_ZONES).map(([c, l]) => <option key={c} value={c}>{l}</option>)}</Liste></Champ>
            <Champ libelle="Classe ISO"><SaisieNombre valeur={iso} onChange={setIso} /></Champ>
          </div>
        )}
      </div>
    </Modale>
  );
}
