import model from "../../public/models/heart-model.json";
// Reuse the installed model's explicit groups; never infer anatomical geometry.
export const vesselGroups = Object.entries(model.highlightGroups).map(([id, group]) => ({
  id, label: group.label, structureIds: group.structures,
}));
