import type { CardBounds } from "./information-card-layout";

/** Dock independently of model/marker motion so framing cannot feed back into
 * card placement. Wide viewers reserve a clear corridor to the left. */
export function dockInformationCard(bounds: CardBounds, width: number, height: number, compact: boolean) {
  const edge = 8;
  width = Math.min(width, Math.max(0, bounds.width - edge * 2));
  height = Math.min(height, Math.max(0, bounds.height - edge * 2));
  return compact
    ? { x: bounds.x + (bounds.width - width) / 2, y: bounds.y + bounds.height - edge - height, width, height, side: "below" as const }
    : { x: bounds.x + bounds.width - edge - width, y: bounds.y + (bounds.height - height) / 2, width, height, side: "right" as const };
}
