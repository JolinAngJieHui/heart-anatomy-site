export type Coordinates = [number, number, number];
export const DEFAULT_CAMERA: Coordinates = [3.8, 1.6, 6.2];
export const DEFAULT_TARGET: Coordinates = [0, 0.2, 0];

/** Upright scan view, including camera roll, matched to the reference view. */
export const IMPORTED_RESET_ROTATION: [number, number, number, number] = [-0.374269690, -0.210660589, 0.597399828, 0.677242764];
export const IMPORTED_RESET_TARGET: Coordinates = [-0.002052616, 0.048079248, 0.059062299];

export const IMPORTED_MODEL_DIAMETER = 3.4;
/** Preserve the reference framing, pulling back when the viewport is narrow. */
export function importedCameraDistance(fov: number, aspect: number) {
  const halfAngle = Math.atan(Math.tan(fov * Math.PI / 360) * Math.min(1, aspect));
  return 3.72227 * Math.sin(20 * Math.PI / 180) / Math.sin(halfAngle);
}

