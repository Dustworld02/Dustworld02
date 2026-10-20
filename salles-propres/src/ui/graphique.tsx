import { useMemo } from "react";

export interface PointCourbe {
  date: string;
  valeur: number;
  /** Couleur propre du point (ex. selon le verdict). */
  couleur?: string;
  info?: string;
}

export interface Seuil {
  valeur: number;
  libelle: string;
  couleur: string;
}

export interface Serie {
  nom: string;
  couleur: string;
  points: PointCourbe[];
}

/** Courbe temporelle en SVG, avec seuils horizontaux (alerte, action…). */
export function Courbe({ series, seuils = [], unite = "", hauteur = 220, echelleLog = false }: {
  series: Serie[];
  seuils?: Seuil[];
  unite?: string;
  hauteur?: number;
  echelleLog?: boolean;
}) {
  const largeur = 720;
  const marge = { g: 56, d: 16, h: 12, b: 28 };
  const tous = series.flatMap((s) => s.points);
  const calc = useMemo(() => {
    if (tous.length === 0) return null;
    const temps = tous.map((p) => new Date(p.date).getTime());
    let t0 = Math.min(...temps);
    let t1 = Math.max(...temps);
    if (t0 === t1) { t0 -= 86400000; t1 += 86400000; }
    const valeurs = [...tous.map((p) => p.valeur), ...seuils.map((s) => s.valeur)];
    const transf = (v: number) => (echelleLog ? Math.log10(Math.max(v, 0.1)) : v);
    let v0 = Math.min(0, ...valeurs.map(transf));
    let v1 = Math.max(...valeurs.map(transf));
    if (echelleLog) v0 = Math.min(...valeurs.map(transf));
    if (v0 === v1) v1 = v0 + 1;
    v1 += (v1 - v0) * 0.08;
    const x = (d: string) => marge.g + ((new Date(d).getTime() - t0) / (t1 - t0)) * (largeur - marge.g - marge.d);
    const y = (v: number) => marge.h + (1 - (transf(v) - v0) / (v1 - v0)) * (hauteur - marge.h - marge.b);
    const graduations = Array.from({ length: 5 }, (_, i) => v0 + ((v1 - v0) * i) / 4);
    const dates = Array.from({ length: 4 }, (_, i) => new Date(t0 + ((t1 - t0) * i) / 3));
    return { x, y, graduations, dates, inverse: (v: number) => (echelleLog ? Math.pow(10, v) : v) };
  }, [tous, seuils, hauteur, echelleLog, marge.g, marge.d, marge.h, marge.b]);

  if (!calc) return <p className="text-sm text-texte-2">Aucune mesure à afficher.</p>;
  const format = (v: number) => new Intl.NumberFormat("fr-FR", { maximumSignificantDigits: 3 }).format(v);

  return (
    <div>
      <svg viewBox={`0 0 ${largeur} ${hauteur}`} className="w-full" role="img" aria-label="Évolution des mesures">
        {calc.graduations.map((g, i) => {
          const v = calc.inverse(g);
          const yy = calc.y(v);
          return (
            <g key={i}>
              <line x1={marge.g} x2={largeur - marge.d} y1={yy} y2={yy} stroke="#e2e8f0" />
              <text x={marge.g - 6} y={yy} fontSize={10} textAnchor="end" dominantBaseline="middle" fill="#5a6b85">{format(v)}</text>
            </g>
          );
        })}
        {calc.dates.map((d, i) => (
          <text key={i} x={calc.x(d.toISOString())} y={hauteur - 8} fontSize={10} textAnchor="middle" fill="#5a6b85">{d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" })}</text>
        ))}
        {seuils.map((s) => (
          <g key={s.libelle}>
            <line x1={marge.g} x2={largeur - marge.d} y1={calc.y(s.valeur)} y2={calc.y(s.valeur)} stroke={s.couleur} strokeDasharray="6 4" strokeWidth={1.5} />
            <text x={largeur - marge.d} y={calc.y(s.valeur) - 4} fontSize={10} textAnchor="end" fill={s.couleur}>{s.libelle} {format(s.valeur)}</text>
          </g>
        ))}
        {series.map((serie) => {
          const pts = [...serie.points].sort((a, b) => a.date.localeCompare(b.date));
          return (
            <g key={serie.nom}>
              <polyline points={pts.map((p) => `${calc.x(p.date)},${calc.y(p.valeur)}`).join(" ")} fill="none" stroke={serie.couleur} strokeWidth={2} />
              {pts.map((p, i) => (
                <circle key={i} cx={calc.x(p.date)} cy={calc.y(p.valeur)} r={3.5} fill={p.couleur ?? serie.couleur}>
                  <title>{new Date(p.date).toLocaleString("fr-FR")} : {format(p.valeur)} {unite}{p.info ? ` — ${p.info}` : ""}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {unite && <text x={8} y={12} fontSize={10} fill="#5a6b85">{unite}</text>}
      </svg>
      {series.length > 1 && (
        <div className="flex flex-wrap gap-3 text-xs text-texte-2">
          {series.map((s) => <span key={s.nom} className="inline-flex items-center gap-1"><span className="h-1 w-4" style={{ background: s.couleur }} />{s.nom}</span>)}
        </div>
      )}
    </div>
  );
}

const PALETTE = ["#17355f", "#c2703c", "#059669", "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#ea580c"];
export function couleurSerie(i: number): string {
  return PALETTE[i % PALETTE.length];
}
