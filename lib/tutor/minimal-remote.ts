import type OpenAI from "openai";
import { matchesIndex, type IndexManifest, type PreparedDocument } from "../knowledge-base/documents";
import { LocalRetrievalProvider, terminology, type LocalDocument, type RetrievalProvider, type RetrievalQuery } from "./retrieval";

/** Remote search proposes candidates; only byte-validated scoped local paragraphs
 * may become evidence. Reuses the same paragraph/concept ranking for both paths. */
export class MinimalRemoteRetrievalProvider implements RetrievalProvider {
  readonly mode = "openai" as const;
  constructor(private client: OpenAI, private manifest: IndexManifest, private documents: PreparedDocument[], private corpus: LocalDocument[], private phase: "review" | "production") {}
  async retrieve(query: RetrievalQuery, signal: AbortSignal) {
    if (!this.manifest.vectorStoreId || !this.documents.length) return [];
    if (this.phase === "review" && process.env.NODE_ENV === "production") throw new Error("Review index cannot serve production");
    const allowed = this.documents.filter(d => d.source.externalIndexingPermission?.cleared && d.source.licenseConfirmed && (this.phase === "review" ? ["pending_review", "approved"].includes(d.source.status) : d.source.status === "approved") && this.manifest.documents.some(e => matchesIndex(d, e)));
    if (!allowed.length) return [];
    const collectionId = allowed[0].source.extraction!.collectionId;
    if (allowed.some(d => d.source.extraction?.collectionId !== collectionId)) throw new Error("Mixed remote collection");
    const response = await this.client.vectorStores.search(this.manifest.vectorStoreId, { query: terminology(query), max_num_results: 12, rewrite_query: false, filters: { type: "eq", key: "collection_id", value: collectionId } }, { signal });
    const candidates: LocalDocument[] = [];
    for (const row of response.data) {
      const entry = this.manifest.documents.find(e => e.fileId === row.file_id);
      const document = allowed.find(d => entry && matchesIndex(d, entry));
      if (!document || row.attributes?.collection_id !== collectionId || row.attributes?.source_id !== document.source.id || row.attributes?.version !== document.hash || row.attributes?.metadata_hash !== document.metadataHash || row.attributes?.review_status !== document.source.status) continue;
      const text = row.content.filter(c => c.type === "text").map(c => c.text).join("\n");
      for (const unit of this.corpus.filter(p => p.source.id === document.source.id)) {
        // Retrieve full qualified original paragraphs, not partial provider slices.
        const hit = text.includes(unit.text) || [...unit.text.matchAll(/[\s\S]{100,200}/g)].some(m => text.includes(m[0]));
        if (hit && !candidates.some(p => p.source.id === unit.source.id && p.source.section === unit.source.section)) candidates.push(unit);
      }
    }
    return new LocalRetrievalProvider(candidates).retrieve(query, signal);
  }
}
