import type { Point2D } from "../data/types";

export function aire(points: Point2D[]): number {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

export function centroide(points: Point2D[]): Point2D {
  const a = aire(points);
  if (a === 0) {
    const n = points.length || 1;
    return [points.reduce((t, p) => t + p[0], 0) / n, points.reduce((t, p) => t + p[1], 0) / n];
  }
  let cx = 0;
  let cy = 0;
  let signe = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    const f = x1 * y2 - x2 * y1;
    signe += f;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  return [cx / (3 * signe), cy / (3 * signe)];
}

export function pointDansPolygone([x, y]: Point2D, points: Point2D[]): boolean {
  let dedans = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

export function distanceSegment([x, y]: Point2D, [x1, y1]: Point2D, [x2, y2]: Point2D): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / l2));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

/** Distance d'un point au contour d'un polygone, et orientation (degrés) du côté le plus proche. */
export function distanceContour(p: Point2D, points: Point2D[]): { distance: number; angle: number } {
  let meilleur = { distance: Infinity, angle: 0 };
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const d = distanceSegment(p, a, b);
    if (d < meilleur.distance) meilleur = { distance: d, angle: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI };
  }
  return meilleur;
}

export function rectangle(x1: number, y1: number, x2: number, y2: number): Point2D[] {
  const [gx, dx] = [Math.min(x1, x2), Math.max(x1, x2)];
  const [hy, by] = [Math.min(y1, y2), Math.max(y1, y2)];
  return [[gx, hy], [dx, hy], [dx, by], [gx, by]];
}

export function arrondir(v: number, pas: number): number {
  return Math.round(v / pas) * pas;
}

export function arrondiAffichage(v: number, decimales = 2): number {
  const f = Math.pow(10, decimales);
  return Math.round(v * f) / f;
}
