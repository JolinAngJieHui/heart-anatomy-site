export type CardSide = "right" | "left" | "below" | "above";
export type CardBounds = { x: number; y: number; width: number; height: number };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Keep a side until it no longer fits. Dock at an edge to avoid chasing camera movement. */
export function placeInformationCard(bounds: CardBounds, marker: { x: number; y: number } | null,
  width: number, height: number, previous: CardSide | null, compact: boolean) {
  const edge = 8, gap = 28;
  const left = bounds.x + edge, right = bounds.x + bounds.width - edge;
  const top = bounds.y + edge, bottom = bounds.y + bounds.height - edge;
  width = Math.min(width, Math.max(0, right - left));
  height = Math.min(height, Math.max(0, bottom - top));
  const point = marker ?? { x: (left + right) / 2, y: (top + bottom) / 2 };
  const fits = (side: CardSide) => side === "right" ? right - point.x >= width + gap
    : side === "left" ? point.x - left >= width + gap
    : side === "below" ? bottom - point.y >= height + gap : point.y - top >= height + gap;
  const side = compact || !marker ? "below" : previous && fits(previous) ? previous
    : (["right", "left", "above", "below"] as CardSide[]).find(fits) ?? "below";
  const x = side === "right" ? right - width : side === "left" ? left : clamp(point.x - width / 2, left, right - width);
  const y = compact || !marker ? bottom - height : side === "below" ? bottom - height
    : side === "above" ? top : clamp(point.y - height / 2, top, bottom - height);
  // Connect to the closest card edge; hide the leader if the projected marker is covered.
  const inside = point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
  return { x, y, width, height, side, lineVisible: !!marker && !inside,
    lineX: clamp(point.x, x, x + width), lineY: clamp(point.y, y, y + height) };
}
