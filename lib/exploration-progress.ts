// Legacy key is retained only for the explicit Clear Saved History action.
// Current exploration and milestones live in memory for the lifetime of the page.
export const PROGRESS_STORAGE_KEY = "heart-anatomy:exploration:v1";
export type Milestone = { id: string; count: number; title: string; message: string };

export function explorationMilestones(total: number): Milestone[] {
  return [
    { id: "first-discoveries", count: 5, title: "First Discoveries", message: "Great start! You're building your understanding of heart anatomy." },
    { id: "heart-explorer", count: 10, title: "Heart Explorer", message: "You're making excellent progress. Keep exploring!" },
    { id: "almost-there", count: 15, title: "Almost There", message: `Just ${total - 15 === 2 ? "two" : total - 15} more structures to discover!` },
    { id: "anatomy-explorer", count: total, title: "Anatomy Explorer", message: "Congratulations! You've explored every structure!" },
  ].filter(m => m.count <= total && m.count > 0);
}

