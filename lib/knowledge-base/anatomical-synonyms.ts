import type { HeartPartId } from "../heart-parts";

/** User-supplied query vocabulary. Canonical labels remain in heart-parts.ts. */
export type QualifiedSynonym = { aliases: string[]; qualifier: "rca-origin" | "lcx-origin" | "separate-aortic-origin"; requiresConfirmation: boolean };
type Entry = { aliases: string[]; qualifiedAliases?: QualifiedSynonym[] };
export const ANATOMICAL_SYNONYMS: Record<HeartPartId, Entry> = {
  "right-coronary-proximal": { aliases: ["Proximal RCA", "pRCA", "prox RCA", "p RCA", "proximal right coronary artery", "proximal segment of RCA"] },
  "right-coronary-middle": { aliases: ["Mid RCA", "mid-RCA", "mRCA", "m RCA", "middle RCA", "middle segment of right coronary artery"] },
  "right-coronary-distal": { aliases: ["Distal RCA", "dRCA", "d RCA", "distal right coronary artery", "distal segment of RCA"] },
  "posterior-descending-artery": { aliases: ["PDA", "posterior interventricular artery", "posterior interventricular branch", "posterior descending branch", "PD artery", "inferior interventricular artery"], qualifiedAliases: [
    { aliases: ["R-PDA", "R-PDA (RCA origin)"], qualifier: "rca-origin", requiresConfirmation: false },
    { aliases: ["L-PDA", "L-PDA (LCx origin)"], qualifier: "lcx-origin", requiresConfirmation: false },
  ] },
  "left-coronary-artery": { aliases: ["Left main coronary artery", "LMCA", "LM", "left main stem", "LMS", "left coronary artery", "LCA", "left coronary trunk", "left main artery", "left main"] },
  "left-anterior-descending-proximal": { aliases: ["Proximal LAD", "pLAD", "prox LAD", "p LAD", "proximal left anterior descending artery", "proximal anterior interventricular artery"] },
  "left-anterior-descending-mid": { aliases: ["Mid LAD", "mid-LAD", "mLAD", "m LAD", "middle left anterior descending artery", "middle anterior interventricular artery"] },
  "left-anterior-descending-apical": { aliases: ["Apical LAD", "apical segment of LAD", "apical portion of left anterior descending artery", "LAD at the cardiac apex"] },
  "left-diagonal-d1": { aliases: ["First diagonal artery", "first diagonal branch", "D1", "LAD-D1", "first diagonal branch of LAD", "first diagonal", "diagonal 1"] },
  "left-diagonal-d2": { aliases: ["Second diagonal artery", "second diagonal branch", "D2", "LAD-D2", "second diagonal branch of LAD", "second diagonal", "diagonal 2"] },
  "left-circumflex-artery": { aliases: ["LCx", "LCX", "Cx", "circumflex artery", "left circumflex coronary artery", "circumflex branch of left coronary artery", "left circumflex", "circumflex"] },
  // R2 uses these explicit marginal-branch names; generic RV branches stay distinct.
  "right-marginal-artery": { aliases: ["Acute marginal artery", "acute marginal branch", "AM", "right acute marginal artery", "RAM", "right marginal branch of RCA", "right marginal", "RMA", "right ventricular marginal branch", "right ventricular marginal artery", "RV marginal artery"] },
  "right-conus-artery": { aliases: ["Right conal artery", "conus branch", "conal branch of RCA", "right infundibular artery", "infundibular branch of RCA", "conus artery", "conal artery", "conal branch", "conus"], qualifiedAliases: [
    { aliases: ["third coronary artery"], qualifier: "separate-aortic-origin", requiresConfirmation: true },
  ] },
  "left-marginal-artery": { aliases: ["Obtuse marginal artery", "OM", "obtuse marginal branch", "left obtuse marginal artery", "left marginal branch of LCx", "circumflex marginal branch", "left marginal", "obtuse marginal"] },
  "ascending-aorta": { aliases: ["Ascending part of aorta", "ascending portion of the aorta", "ascending thoracic aorta", "Asc Ao", "AAo", "aorta ascendens", "ascending aortic"] },
  "superior-vena-cava": { aliases: ["SVC", "superior caval vein", "vena cava superior"] },
  "coronary-sinus": { aliases: ["CS", "sinus coronarius", "coronary venous sinus"] },
};
export const WHOLE_VESSEL_SYNONYMS: { aliases: string[]; family: "rca" | "lad"; structureIds: HeartPartId[] }[] = [
  { aliases: ["RCA", "right coronary artery", "right coronary"], family: "rca", structureIds: ["right-coronary-proximal", "right-coronary-middle", "right-coronary-distal"] },
  { aliases: ["LAD", "left anterior descending artery", "left anterior descending", "anterior interventricular artery", "anterior interventricular branch"], family: "lad", structureIds: ["left-anterior-descending-proximal", "left-anterior-descending-mid", "left-anterior-descending-apical"] },
];
