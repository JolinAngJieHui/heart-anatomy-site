import { Box3, Color, Group, Light, Mesh, Vector3, type Material, type Object3D, type Texture } from "three";
import { DEFAULT_TARGET, IMPORTED_MODEL_DIAMETER } from "./heart-model";
import { vesselHighlightColor, VESSEL_HIGHLIGHT_OPACITY } from "./vessel-highlight";
import { getHeartPart, type HeartPartId } from "./heart-parts";
import type { HeartModelConfig } from "./model-config";
import type { ModelRegistry } from "./model-registry";
import { enableVesselPicking } from "./vessel-picking";
import { ISOLATION_CONTEXT_OPACITY, setIsolationContext } from "./heart-isolation";

type ColoredMaterial = Material & { color?: Color; emissive?: Color; emissiveIntensity?: number };
export type VesselTarget = { groupId?: string; label: string; structureIds: HeartPartId[] };
export function prepareImportedModel(root: Group, config: HeartModelConfig) {
  const orientation = new Group(), container = new Group();
  orientation.rotation.set(...config.rotationDegrees.map(degrees => degrees * Math.PI / 180) as [number, number, number]);
  orientation.add(root); container.add(orientation);
  const materials = new Map<ColoredMaterial, { color?: Color; emissive?: Color; emissiveIntensity?: number; opacity: number; transparent: boolean; depthWrite: boolean; depthTest: boolean; forceSinglePass: boolean }>();
  const originalVisibility = new Map<Mesh, boolean>();
  const originalOrder = new Map<Mesh, number>();
  const named = new Map<string, Object3D[]>();
  const normalized = new Map<string, Set<Object3D>>();
  const normalizeName = (name: string) => name.trim().toLowerCase().replace(/[\s_-]+/g, "-").replace(/^-|-$/g, "");
  root.traverse(object => {
    // GLTFLoader sanitizes node.name; userData.name retains the Blender name.
    // Only separators/case are normalized. Numeric suffixes remain explicit.
    for (const name of new Set([object.name, typeof object.userData.name === "string" ? object.userData.name : ""].filter(Boolean))) {
      named.set(name, [...(named.get(name) ?? []), object]);
      const key = normalizeName(name);
      if (!normalized.has(key)) normalized.set(key, new Set());
      normalized.get(key)!.add(object);
    }
    // The viewer owns lighting; embedded scene lights must not wash out the asset.
    if (object instanceof Light) object.visible = false;
    if (!(object instanceof Mesh)) return;
    originalVisibility.set(object, object.visible);
    originalOrder.set(object, object.renderOrder);
    for (const material of (Array.isArray(object.material) ? object.material : [object.material]) as ColoredMaterial[]) {
      materials.set(material, { color: material.color?.clone(), emissive: material.emissive?.clone(), emissiveIntensity: material.emissiveIntensity,
        opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite, depthTest: material.depthTest, forceSinglePass: material.forceSinglePass });
    }
  });
  container.updateWorldMatrix(true, true);
  const bounds = new Box3().setFromObject(orientation, true);
  const center = bounds.getCenter(new Vector3()), size = bounds.getSize(new Vector3());
  const diameter = size.length();
  if (bounds.isEmpty() || !Number.isFinite(diameter) || diameter <= 0) throw Error("The model contains no usable geometry.");
  // A fixed bounding-sphere size keeps existing orbit, zoom and panel framing useful
  // regardless of whether the author worked in millimetres, centimetres or metres.
  const scale = IMPORTED_MODEL_DIAMETER / diameter;
  container.scale.setScalar(scale);
  container.position.copy(new Vector3(...DEFAULT_TARGET).sub(center.clone().multiplyScalar(scale)));
  const modelCenter = new Group();
  modelCenter.position.copy(center); container.add(modelCenter);
  container.updateWorldMatrix(true, true);
  const registry: ModelRegistry = new Map();
  const owners = new Map<Object3D, VesselTarget>();
  const groups = new Map<string, VesselTarget>();
  const warnings: string[] = [];
  const resolve = (name: string) => {
    const matches = named.get(name) ?? [...(normalized.get(normalizeName(name)) ?? [])];
    if (matches.length !== 1) { warnings.push(`Node '${name}' must exist exactly once.`); return undefined; }
    return matches[0];
  };
  const claimed = new Map<Object3D, VesselTarget[]>();
  const mappedObjects = new Map<HeartPartId, Object3D[]>();
  const resolveMeshes = (names: string[]) => [...new Set(names.flatMap(name => {
    const node = resolve(name), meshes: Object3D[] = [];
    node?.traverse(child => { if (child instanceof Mesh) meshes.push(child); });
    if (node && !meshes.length) warnings.push(`Node '${name}' has no meshes.`);
    return meshes;
  }))];
  const claim = (objects: Object3D[], target: VesselTarget) => {
    objects.forEach(object => claimed.set(object, [...(claimed.get(object) ?? []), target]));
    target.structureIds.forEach(id => mappedObjects.set(id, [...(mappedObjects.get(id) ?? []), ...objects]));
  };
  for (const [id, definition] of Object.entries(config.structures) as [HeartPartId, HeartModelConfig["structures"][string]][]) {
    const objects = resolveMeshes(definition.meshes);
    claim(objects, { label: getHeartPart(id)!.name, structureIds: [id] });
    const anchorObject = definition.anchor?.node ? resolve(definition.anchor.node) : root;
    if (definition.anchor && anchorObject) registry.set(id, { objects, anchorObject, anchor: definition.anchor.position, modelCenter });
  }
  for (const [groupId, group] of Object.entries(config.highlightGroups ?? {})) {
    const target: VesselTarget = { groupId, label: group.label, structureIds: group.structures as HeartPartId[] };
    groups.set(groupId, target);
    claim(resolveMeshes(group.meshes), target);
  }
  for (const [object, targets] of claimed) {
    if (targets.length === 1) owners.set(object, targets[0]);
    else warnings.push(`Mesh '${object.name}' is assigned to multiple structures; picking/isolation is disabled for it.`);
  }
  registry.forEach((entry, id) => { entry.objects = [...new Set(mappedObjects.get(id) ?? [])].filter(object => owners.has(object)); });
  const meshIds = [...new Set([...owners.values()].flatMap(target => target.structureIds))];
  const highlightTint = new Color();
  function applySelection(selected: HeartPartId | null, hovered: HeartPartId | null, isolated: HeartPartId | null, selectedGroup: string | null = null, hoveredGroup: string | null = null, isolatedGroup: string | null = null) {
    if (process.env.NODE_ENV === "development") container.userData.selection = { selected, hovered, isolated, selectedGroup, hoveredGroup };
    const canIsolate = (!!isolated && meshIds.includes(isolated)) || (!!isolatedGroup && groups.has(isolatedGroup));
    // Clone per mesh once so shared author materials cannot highlight other vessels.
    originalVisibility.forEach((visible, mesh) => {
      const target = owners.get(mesh);
      const isIsolated = canIsolate && (!!isolated && target?.structureIds.includes(isolated) || !!isolatedGroup && target?.groupId === isolatedGroup);
      mesh.visible = visible;
      setIsolationContext(mesh, canIsolate && !isIsolated);
      mesh.renderOrder = canIsolate ? (isIsolated ? 1 : 0) : originalOrder.get(mesh)!;
      const isSelected = !!target && (!!selected && target.structureIds.includes(selected) || !!selectedGroup && target.groupId === selectedGroup);
      const isHovered = !!target && (!!hovered && target.structureIds.includes(hovered) || !!hoveredGroup && target.groupId === hoveredGroup);
      const highlight = target && vesselHighlightColor(target.structureIds);
      for (const material of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as ColoredMaterial[]) {
        const original = materials.get(material);
        if (!original) continue;
        if (material.color && original?.color) material.color.copy(original.color);
        if (material.emissive && original?.emissive) material.emissive.copy(original.emissive);
        if (original?.emissiveIntensity !== undefined) material.emissiveIntensity = original.emissiveIntensity;
        const transparent = canIsolate || original.transparent;
        const singlePass = canIsolate || original.forceSinglePass;
        if (material.transparent !== transparent || material.forceSinglePass !== singlePass) material.needsUpdate = true;
        material.transparent = transparent;
        material.forceSinglePass = singlePass;
        material.opacity = canIsolate ? (isIsolated ? 1 : ISOLATION_CONTEXT_OPACITY) : original.opacity;
        material.depthWrite = canIsolate ? !!isIsolated : original.depthWrite;
        material.depthTest = canIsolate ? true : original.depthTest;
        // Both enter the ordered transparency pass: context first without depth
        // writes, then the alpha-1 vessel with normal self-occlusion. Context in
        // front cannot tint/cover it. Single-pass retains the original draw count.
        // Original textures, colour, emissive, roughness and normals stay intact.
        if (!canIsolate && highlight && (isSelected || isHovered)) {
          highlightTint.set(highlight);
          material.color?.lerp(highlightTint, VESSEL_HIGHLIGHT_OPACITY);
          // A restrained lift keeps every photographic vessel legible
          // without changing its texture or adding bloom, lights or geometry.
          if (material.emissive) {
            material.emissive.set(highlight);
            material.emissiveIntensity = (isSelected ? .22 : .12) * VESSEL_HIGHLIGHT_OPACITY;
          }
        }
      }
    });
  }
  // These clones belong to this load, and are disposed with it. Textures stay shared.
  originalVisibility.forEach((_visible, mesh) => {
    // No per-triangle pointer scan: each mesh shares its already prepared BVH.
    // Untagged context blocks hits on vessels behind it without gaining an ID.
    if (owners.size) enableVesselPicking(mesh);
    else mesh.raycast = () => {};
    const clone = (material: ColoredMaterial) => { const result = material.clone() as ColoredMaterial; materials.set(result, materials.get(material)!); return result; };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
  });
  return { container, root, registry, owners, groups, meshIds, warnings, applySelection, dispose: () => disposeModel(container, [...materials.keys()]) };
}

export type PreparedHeartModel = ReturnType<typeof prepareImportedModel>;
export function disposeModel(root: Object3D, additionalMaterials: Material[] = []) {
  const materials = new Set(additionalMaterials), textures = new Set<Texture>();
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    material.dispose();
  }
  for (const texture of textures) {
    if (typeof ImageBitmap !== "undefined" && texture.source.data instanceof ImageBitmap) texture.source.data.close();
    texture.dispose();
  }
}
