export type ScreenRect = { x: number; y: number; width: number; height: number };
export type ScreenPoint = { x: number; y: number };
export type PanelLayout = { revision: number; viewport: ScreenRect; obstacles: ScreenRect[]; cardOpen: boolean; tutorOpen: boolean };
export type FramingBridge = { layout: PanelLayout; modelBounds: ScreenRect | null; animating: boolean; invalidate?: () => void; navigation?: { revision: number; selectedId: string | null; selectedGroupId: string | null; manual: boolean } };
export const createFramingBridge = (): FramingBridge => ({ layout: { revision: 0, viewport: { x: 0, y: 0, width: 0, height: 0 }, obstacles: [], cardOpen: false, tutorOpen: false }, modelBounds: null, animating: false });
export const area = (r: ScreenRect) => Math.max(0, r.width) * Math.max(0, r.height);
export function intersect(a: ScreenRect, b: ScreenRect): ScreenRect | null {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width), bottom = Math.min(a.y + a.height, b.y + b.height);
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}
export function subtract(rect: ScreenRect, obstacle: ScreenRect): ScreenRect[] {
  const hit = intersect(rect, obstacle);
  if (!hit) return [rect];
  return [
    { x: rect.x, y: rect.y, width: rect.width, height: hit.y - rect.y },
    { x: rect.x, y: hit.y + hit.height, width: rect.width, height: rect.y + rect.height - hit.y - hit.height },
    { x: rect.x, y: hit.y, width: hit.x - rect.x, height: hit.height },
    { x: hit.x + hit.width, y: hit.y, width: rect.x + rect.width - hit.x - hit.width, height: hit.height },
  ].filter(r => area(r) > 0);
}
export function freeRegions(viewport: ScreenRect, obstacles: ScreenRect[], gap = 0): ScreenRect[] {
  return obstacles.reduce((regions, obstacle) => regions.flatMap(r => subtract(r, { x: obstacle.x - gap, y: obstacle.y - gap, width: obstacle.width + 2 * gap, height: obstacle.height + 2 * gap })), [viewport]);
}
export function visibleFraction(model: ScreenRect, viewport: ScreenRect, obstacles: ScreenRect[]): number {
  const onScreen = intersect(model, viewport);
  if (!onScreen || !area(model)) return 0;
  return freeRegions(onScreen, obstacles).reduce((sum, r) => sum + area(r), 0) / area(model);
}
export function pointVisible(point: ScreenPoint, viewport: ScreenRect, obstacles: ScreenRect[], padding = 18): boolean {
  return point.x >= viewport.x + padding && point.x <= viewport.x + viewport.width - padding && point.y >= viewport.y + padding && point.y <= viewport.y + viewport.height - padding && !obstacles.some(r => point.x >= r.x - padding && point.x <= r.x + r.width + padding && point.y >= r.y - padding && point.y <= r.y + r.height + padding);
}

/** Find clear rectangles spanning panel edges rather than subtraction tiles.
 * A short side panel still leaves a full-height corridor beside it. */
export function clearFramingRegions(viewport: ScreenRect, obstacles: ScreenRect[], gap = 10): ScreenRect[] {
  const blocked = obstacles.flatMap(r => {
    const hit = intersect(viewport, { x: r.x - gap, y: r.y - gap, width: r.width + 2 * gap, height: r.height + 2 * gap });
    return hit ? [hit] : [];
  });
  const edges = [...new Set([viewport.x, viewport.x + viewport.width, ...blocked.flatMap(r => [r.x, r.x + r.width])])].sort((a, b) => a - b);
  const regions: ScreenRect[] = [];
  for (let left = 0; left < edges.length - 1; left++) {
    for (let right = left + 1; right < edges.length; right++) {
      const intervals = blocked.filter(r => r.x < edges[right] && r.x + r.width > edges[left]).sort((a, b) => a.y - b.y);
      let top = viewport.y;
      for (const r of intervals) {
        if (r.y > top) regions.push({ x: edges[left], y: top, width: edges[right] - edges[left], height: r.y - top });
        top = Math.max(top, r.y + r.height);
      }
      const bottom = viewport.y + viewport.height;
      if (top < bottom) regions.push({ x: edges[left], y: top, width: edges[right] - edges[left], height: bottom - top });
    }
  }
  return regions;
}

/** Centre the selected anchor in the clear region; use the whole model only when
 * nothing is selected. No rotation or zoom is needed for an optical pan. */
export function planFraming({ model, viewport, obstacles, marker }: { model: ScreenRect; viewport: ScreenRect; obstacles: ScreenRect[]; marker?: ScreenPoint | null }) {
  const regions = clearFramingRegions(viewport, obstacles).filter(r => r.width > 0 && r.height > 0);
  const region = regions.sort((a, b) => area(b) - area(a) || a.x - b.x || a.y - b.y)[0] ?? viewport;
  const subject = marker ?? { x: model.x + model.width / 2, y: model.y + model.height / 2 };
  const x = region.x + region.width / 2 - subject.x;
  const y = region.y + region.height / 2 - subject.y;
  const visibility = visibleFraction({ ...model, x: model.x + x, y: model.y + y }, viewport, obstacles);
  const target = viewport.width < 500 ? .65 : .85;
  const markerVisible = !marker || pointVisible({ x: marker.x + x, y: marker.y + y }, viewport, obstacles);
  return { x, y, visibility, markerVisible, target, limited: visibility < target, region };
}
