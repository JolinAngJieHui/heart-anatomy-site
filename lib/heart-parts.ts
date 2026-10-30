/** Inventory from Coronary arteries.docx. Numbers are teaching labels, not angiographic segment codes. */
export const HEART_PARTS = [
  { id: "right-coronary-proximal", number: 1, name: "Right Coronary Artery (Proximal)", shortName: "RCA-P", group: "right", category: "coronary-artery" },
  { id: "right-coronary-middle", number: 2, name: "Right Coronary Artery (Middle)", shortName: "RCA-M", group: "right", category: "coronary-artery" },
  { id: "right-coronary-distal", number: 3, name: "Right Coronary Artery (Distal)", shortName: "RCA-D", group: "right", category: "coronary-artery" },
  { id: "posterior-descending-artery", number: 4, name: "Posterior Descending Artery", shortName: "PDA", group: "right", category: "coronary-artery" },
  { id: "left-coronary-artery", number: 5, name: "Left Coronary Artery", shortName: "LM", group: "left", category: "coronary-artery" },
  { id: "left-anterior-descending-proximal", number: 6, name: "Left Anterior Descending (Proximal)", shortName: "LAD-P", group: "left", category: "coronary-artery" },
  { id: "left-anterior-descending-mid", number: 7, name: "Left Anterior Descending (Mid)", shortName: "LAD-M", group: "left", category: "coronary-artery" },
  { id: "left-anterior-descending-apical", number: 8, name: "Left Anterior Descending (Apical)", shortName: "LAD-A", group: "left", category: "coronary-artery" },
  { id: "left-diagonal-d1", number: 9, name: "Left Diagonal D1", shortName: "D1", group: "left", category: "coronary-artery" },
  { id: "left-diagonal-d2", number: 10, name: "Left Diagonal D2", shortName: "D2", group: "left", category: "coronary-artery" },
  { id: "left-circumflex-artery", number: 11, name: "Left Circumflex Artery", shortName: "LCx", group: "left", category: "coronary-artery" },
  { id: "right-marginal-artery", number: 12, name: "Right Marginal Artery", shortName: "RMA", group: "right", category: "coronary-artery" },
  { id: "right-conus-artery", number: 13, name: "Right Conus Artery", shortName: "Conus", group: "right", category: "coronary-artery" },
  { id: "left-marginal-artery", number: 14, name: "Left Marginal Artery", shortName: "OM", group: "left", category: "coronary-artery" },
  { id: "ascending-aorta", number: 15, name: "Ascending Aorta", shortName: "Ao", group: "great", category: "great-artery" },
  { id: "superior-vena-cava", number: 16, name: "Superior Vena Cava", shortName: "SVC", group: "great", category: "systemic-vein" },
  { id: "coronary-sinus", number: 17, name: "Coronary Sinus", shortName: "CS", group: "great", category: "coronary-vein" },
] as const;
export type HeartPart = (typeof HEART_PARTS)[number];
export type HeartPartId = HeartPart["id"];
export const STRUCTURE_GROUPS = [
  { id: "right", name: "Right coronary artery and branches", note: "PDA grouped here for an illustrative right-dominant pattern; its origin varies." },
  { id: "left", name: "Left coronary artery and branches", note: "Left Coronary Artery denotes the left main trunk." },
  { id: "great", name: "Great vessels and venous drainage", note: "Includes a great artery, a systemic vein and a coronary vein." },
] as const;
export const CATEGORY_NAMES = { "coronary-artery": "Coronary artery", "great-artery": "Great artery", "systemic-vein": "Systemic vein", "coronary-vein": "Coronary vein" };
export function getHeartPart(id: HeartPartId | null): HeartPart | undefined {
  return HEART_PARTS.find((part) => part.id === id);
}
