import type { Object3D } from "three";

export const ISOLATION_CONTEXT_OPACITY = .2;
const CONTEXT_KEY = "heartAnatomyIsolationContext";
/** Translucent context stays drawn, but must not block the isolated vessel. */
export function isIsolationContext(object: Object3D) { return object.userData[CONTEXT_KEY] === true; }
export function setIsolationContext(object: Object3D, context: boolean) {
  if (context) object.userData[CONTEXT_KEY] = true;
  else delete object.userData[CONTEXT_KEY];
}
