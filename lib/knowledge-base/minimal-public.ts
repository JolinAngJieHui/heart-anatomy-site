import register from "../../docs/rag/anatomy_RAG_minimal_reference_register.json";
import type { HeartPartId } from "../heart-parts";
/** Reading links only. Register descriptions are never scientific index text. */
export function minimalReadingReferences(id: HeartPartId, collectionId?: string) {
  if (!collectionId?.startsWith("minimal-")) return null;
  const vessel = register.vessels.find(v => v.structure_id === id);
  return register.sources.filter(s => vessel?.source_ids.includes(s.id)).map(s => ({ id: s.id, title: s.title, url: s.url }));
}
