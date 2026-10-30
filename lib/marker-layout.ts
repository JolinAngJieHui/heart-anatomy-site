import type { HeartPartId } from "./heart-parts";
export type ProjectedMarker = { id: HeartPartId; x: number; y: number; behind?: boolean };
export type PlacedMarker = ProjectedMarker & { markerX: number; markerY: number };

/** Projected 3D anchors remain fixed; only buttons move to avoid overlap, with leader lines.
 * Input order determines priority (selected first). Omit excess markers only if no hit target fits.
 */
export function placeMarkers(anchors: ProjectedMarker[], width: number, height: number, diameter = 32): PlacedMarker[] {
  const radius = diameter / 2;
  const edge = radius + 4;
  const gap = diameter + 4;
  if (width < edge * 2 || height < edge * 2) return [];
  const placed: PlacedMarker[] = [];
  for (const anchor of anchors) {
    const x = Math.max(edge, Math.min(width - edge, anchor.x));
    const y = Math.max(edge, Math.min(height - edge, anchor.y));
    const candidates = [{ x, y }];
    for (let gy = edge; gy <= height - edge; gy += gap) {
      for (let gx = edge; gx <= width - edge; gx += gap) candidates.push({ x: gx, y: gy });
    }
    candidates.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
    const free = candidates.find((candidate) => placed.every((other) => Math.hypot(candidate.x - other.markerX, candidate.y - other.markerY) >= gap));
    if (free) placed.push({ ...anchor, markerX: free.x, markerY: free.y });
  }
  return placed;
}
