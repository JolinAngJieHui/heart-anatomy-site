export type HeartPartId =
  | "right-atrium"
  | "right-ventricle"
  | "left-atrium"
  | "left-ventricle"
  | "aorta"
  | "pulmonary-trunk";

export type HeartPart = {
  id: HeartPartId;
  name: string;
  shortName: string;
  color: string;
  summary: string;
  bloodFlow: string;
  shape: "chamber" | "vessel";
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
};

/**
 * A schematic (not photorealistic) heart.
 * Coordinates are in "anatomical anterior" layout: viewer's left is the
 * heart's right, matching textbook diagrams.
 */
export const HEART_PARTS: HeartPart[] = [
  {
    id: "right-atrium",
    name: "Right atrium",
    shortName: "RA",
    color: "#f3a49c",
    summary:
      "Receives deoxygenated blood from the body through the superior and inferior vena cava.",
    bloodFlow: "Body → vena cava → right atrium → tricuspid valve → right ventricle",
    shape: "chamber",
    position: [0.72, 0.62, 0.08],
    rotation: [0, 0, 0],
    scale: [0.82, 0.68, 0.74],
  },
  {
    id: "right-ventricle",
    name: "Right ventricle",
    shortName: "RV",
    color: "#e45b4c",
    summary:
      "Pumps deoxygenated blood into the pulmonary trunk toward the lungs. Its wall is thinner than the left ventricle.",
    bloodFlow: "Right atrium → right ventricle → pulmonary valve → lungs",
    shape: "chamber",
    position: [0.62, -0.42, 0.22],
    rotation: [0, 0, 0],
    scale: [0.98, 1.08, 0.92],
  },
  {
    id: "left-atrium",
    name: "Left atrium",
    shortName: "LA",
    color: "#d46b62",
    summary:
      "Receives oxygenated blood from the pulmonary veins after it has been oxygenated in the lungs.",
    bloodFlow: "Lungs → pulmonary veins → left atrium → mitral valve → left ventricle",
    shape: "chamber",
    position: [-0.58, 0.68, -0.18],
    rotation: [0, 0, 0],
    scale: [0.86, 0.7, 0.8],
  },
  {
    id: "left-ventricle",
    name: "Left ventricle",
    shortName: "LV",
    color: "#b42318",
    summary:
      "The strongest chamber. It pumps oxygenated blood into the aorta for the whole body, so its wall is the thickest.",
    bloodFlow: "Left atrium → left ventricle → aortic valve → aorta → body",
    shape: "chamber",
    position: [-0.58, -0.38, 0],
    rotation: [0, 0, 0],
    scale: [1.18, 1.32, 1.12],
  },
  {
    id: "aorta",
    name: "Aorta",
    shortName: "Ao",
    color: "#7a1410",
    summary:
      "The largest artery. It carries oxygenated blood from the left ventricle to the systemic circulation.",
    bloodFlow: "Left ventricle → aortic valve → aorta → arteries",
    shape: "vessel",
    position: [-0.22, 1.42, -0.12],
    rotation: [0.15, 0, -0.2],
    scale: [0.28, 0.72, 0.28],
  },
  {
    id: "pulmonary-trunk",
    name: "Pulmonary trunk",
    shortName: "PT",
    color: "#9b2c24",
    summary:
      "Carries deoxygenated blood from the right ventricle toward the lungs, then splits into left and right pulmonary arteries.",
    bloodFlow: "Right ventricle → pulmonary valve → pulmonary trunk → lungs",
    shape: "vessel",
    position: [0.28, 1.22, 0.18],
    rotation: [0.4, 0, 0.45],
    scale: [0.24, 0.55, 0.24],
  },
];

export function getHeartPart(id: HeartPartId | null): HeartPart | undefined {
  if (!id) return undefined;
  return HEART_PARTS.find((part) => part.id === id);
}
