import { HEART_PARTS } from "../heart-parts";
import { validateRegistry, type Reference } from "./registry";

export const COVERAGE_GAPS: Record<string, string> = {
  "right-coronary-proximal": "Review exact proximal RCA landmarks against the chosen named segmentation scheme; broad RCA accounts alone do not define boundaries.",
  "right-coronary-middle": "Review mid-RCA start/end landmarks; confirm consistency of website teaching terminology and specialist scheme.",
  "right-coronary-distal": "Review distal RCA/crux landmarks and dominance-dependent continuation; no universal vessel extent assumed.",
  "posterior-descending-artery": "Reconcile dominance descriptions across consumer and specialist sources; avoid treating right-origin PDA as universal.",
  "left-coronary-artery": "Confirm left main trunk terminology and ostium-to-bifurcation boundary; rare-origin cases cannot define normal origin.",
  "left-anterior-descending-proximal": "Reconcile D1-only simplified landmark with SCCT first-large-septal-or-D1 definition; consensus scenario had moderate agreement.",
  "left-anterior-descending-mid": "Review proximal/mid/distal boundaries under a specified scheme rather than assuming source agreement.",
  "left-anterior-descending-apical": "Apical teaching label is not automatically equivalent to distal LAD segment 8. Obtain a dedicated apex/wraparound LAD reference and reviewer mapping.",
  "left-diagonal-d1": "Named branch is covered; review branch ordering, variable size/territory and whether a D1 exists in a particular heart. ECG study is selected-cohort clinical context.",
  "left-diagonal-d2": "Named branch is covered but dedicated D2 normal-anatomy detail is limited. Add a branch-specific atlas or peer-reviewed account of variable number, ordering and territory.",
  "left-circumflex-artery": "Separate normal left-main origin from anomalous right-sinus/RCA case reports; reconcile dominance wording.",
  "right-marginal-artery": "Normal acute/right marginal branch is covered in broad references; dedicated origin/course/territory and procedural coverage remain thin.",
  "right-conus-artery": "Normal RCA branch and separate aortic ostium must be distinguished from combined rare LCA anomaly cases. Add a dedicated normal conus/collateral anatomy reference.",
  "left-marginal-artery": "Review obtuse marginal family versus particular OM1/OM2; website label is generic OM, not SCCT numeric segment 14 or ramus intermedius.",
  "ascending-aorta": "Basic/intermediate descriptions available; advanced root/sinotubular junction, dimensions, imaging and procedural coverage need dedicated specialist sources.",
  "superior-vena-cava": "Basic/intermediate sources available; advanced tributaries, mediastinal relationships, persistent left SVC and procedural anatomy require additional specialist sources.",
  "coronary-sinus": "StatPearls metadata/excerpt available; full chapter and permissions unverified. Add accessible reusable specialist coverage of ostium, valves, tributaries and procedural anatomy.",
};

/** Candidate coverage is not an approval, quality score or production readiness. */
export function buildCoverage(records: Reference[]) {
  validateRegistry(records);
  return HEART_PARTS.map(part => {
    const supporting = records.filter(r => r.curation && r.structureIds.includes(part.id)).map(r => ({
      sourceId: r.id, title: r.title, url: r.location, status: r.status,
      scope: r.curation!.scope, reuseDisposition: r.curation!.reuse.disposition,
      sections: r.curation!.sectionMappings.filter(m => m.structureIds.includes(part.id)),
    }));
    const normal = supporting.flatMap(r => r.sections.filter(s => s.verified && ["normal", "normal-variant"].includes(s.anatomy) && ["direct", "parent-vessel"].includes(s.relationship)));
    return { ...part, supporting, candidateNormalLevels: [...new Set(normal.flatMap(s => s.levels))].sort(), approvedSourceCount: supporting.filter(r => r.status === "approved").length, gap: COVERAGE_GAPS[part.id] };
  });
}
