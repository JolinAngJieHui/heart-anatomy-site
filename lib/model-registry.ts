import type { Object3D } from "three";
import type { HeartPartId } from "./heart-parts";
import type { Coordinates } from "./heart-model";

/** Renderer contract: a structure may map to multiple meshes in the final model. */
export type ModelStructure = {
  objects: Object3D[];
  anchorObject: Object3D;
  anchor: Coordinates;
  /** The normalized imported model's centre, independent of node nesting. */
  modelCenter?: Object3D;
};
export type ModelRegistry = Map<HeartPartId, ModelStructure>;
export type PointerGesture = {
  x: number;
  y: number;
  dragged: boolean;
  pointers: Set<number>;
};
