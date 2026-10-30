import type { HeartPartId } from "./heart-parts";

export type ProjectedAnchor = { id: HeartPartId; x: number; y: number };
export type PlacedAnnotation = ProjectedAnchor & { labelX: number; labelY: number; side: "left" | "right" };

/** Screen-space layout only; independent of meshes, content, and React. */
export function placeAnnotations(anchors: ProjectedAnchor[], width: number, height: number): PlacedAnnotation[] {
  const labelWidth = Math.min(158, width * 0.4);
  const edge = 12;
  const gap = 44;
  const top = 28;
  const bottom = height - 28;
  const result: PlacedAnnotation[] = [];
  for (const side of ["left", "right"] as const) {
    const column = anchors.filter((anchor) => side === "left" ? anchor.x <= width / 2 : anchor.x > width / 2)
      .slice(0, Math.max(1, Math.floor((bottom - top) / gap) + 1))
      .sort((a, b) => a.y - b.y);
    const positions = column.map((anchor, index) => Math.max(anchor.y, top + index * gap));
    for (let index = positions.length - 1; index >= 0; index--) {
      positions[index] = Math.min(positions[index], index === positions.length - 1 ? bottom : positions[index + 1] - gap);
    }
    column.forEach((anchor, index) => result.push({ ...anchor, side,
      labelX: side === "left" ? edge + labelWidth : width - edge - labelWidth,
      labelY: positions[index] }));
  }
  return result;
}
