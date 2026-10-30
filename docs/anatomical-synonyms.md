# Anatomical synonym dictionary

Canonical names and the 17 stable IDs remain unchanged in `lib/heart-parts.ts`. Query aliases are stored separately in `lib/knowledge-base/anatomical-synonyms.ts`. These user-supplied associations are query vocabulary, not scientific approval of the teaching documents or confirmation of model geometry.

The existing tutor retrieval path uses this dictionary through `resolveAnatomicalTerms` and `canonicalText`. It matches longer phrases before shorter ones: `first diagonal branch of LAD` maps to D1, and `pRCA` maps to the proximal RCA ID rather than treating the final RCA abbreviation as a whole-vessel query. Case, whitespace and common dash forms are normalized. Uppercase `AM` is recognized; ordinary English `am` is deliberately not treated as a vessel. Matches return the original canonical names, IDs, scope, origin qualifier and whether the association can be used.

Whole `RCA` and `LAD` queries are marked `whole-vessel` and relate to their existing segment IDs collectively. They never select a single arbitrary segment. Proximal/middle/distal labels remain subdivisions of a parent artery. Explicit question terms take precedence over unrelated selected-structure context for ranking, while generic follow-up questions can still use the existing selected structure.

## Anatomical distinctions retained

- Distal LAD is not an alias for apical LAD. Distal LAD queries are labelled an unmapped region and keep their distal wording; related passages may be retrieved, but no exact apical ID association is inferred.
- R-PDA and L-PDA both concern the PDA structure, with distinct `rca-origin` and `lcx-origin` qualifiers. These describe the user's query, not confirmation of this model's PDA origin or a retrieved passage's origin. Generic PDA, R-PDA and L-PDA normalization remain different.
- Generic OM maps to left marginal. OM1 and OM2 remain specific, unconfirmed branch labels and do not automatically map to the generic model structure. Related actual OM1/OM2 passages can still be retrieved without establishing model identity.
- Third coronary artery is a conditional conus candidate requiring separately confirmed aortic origin. Ordinary chat never supplies that confirmation, so this label alone does not trigger a conus association or retrieval. The explicit confirmation option is for trusted, future reviewed model/source context, not a user-controlled approval field.

Synonym matches do not prove that sufficient evidence exists, confirm individual anatomy, change a 3D selection, approve documents or bypass citation/permission controls. Qualified-origin queries may retrieve general PDA material; the qualifier must be verified against actual evidence before an origin-specific answer. Existing conservative sufficiency evaluation remains in place. No source text or scientific approvals were changed.

## Try locally without an API key

```powershell
npm run rag:terms -- "What does pRCA supply?"
npm run rag:terms -- "Compare pRCA and dRCA"
npm run rag:terms -- "R-PDA and L-PDA"
npm run rag:terms -- "third coronary artery"
npm run rag:inspect -- --synthetic "What does pRCA supply?"
npm run rag:inspect -- --approved "What does pRCA supply?"
```

`rag:terms` shows only terminology associations and makes no retrieval or network call. `rag:inspect` shows the same associations alongside retrieved passages. Approved mode will continue returning no reference passages until teaching content is reviewed and approved. Synthetic mode uses clearly fictional test material.

Tests cover every dictionary alias and all canonical names/IDs, segment versus whole-vessel scope, origin qualifiers, conditional conus mapping, OM numbering, distal/apical distinction, ambiguous AM, punctuation/case and multiple terms in a comparison. Additional terms can be added to the separate dictionary without renaming canonical structures or changing teaching-document content.
