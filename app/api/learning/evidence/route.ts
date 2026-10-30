import { loadLearningEvidence } from "@/lib/learning/evidence-server";
export const runtime = "nodejs";
export async function GET() {
  try { return Response.json(await loadLearningEvidence(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "Approved local reference content is unavailable. Activity summaries still work." }, { status: 503 }); }
}
