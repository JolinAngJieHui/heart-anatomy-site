import { recordExecution } from "@/lib/tutor/diagnostics";
import { withSignal } from "@/lib/tutor/deadline";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return new Response(null, { status: 403 });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return new Response(null, { status: 415 });
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error();
    let text = "";
    const decoder = new TextDecoder();
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(5000)]);
    for (;;) {
      const item = await withSignal(reader.read(), signal);
      if (item.done) break;
      text += decoder.decode(item.value, { stream: true });
      if (text.length > 512) { await reader.cancel(); throw new Error(); }
    }
    const value = JSON.parse(text);
    if (typeof value.id !== "string" || value.id.length > 100 || !["confirmed", "failed"].includes(value.status) || Object.keys(value).some(k => !["id", "status"].includes(k))) throw new Error();
    return new Response(null, { status: recordExecution(value.id, value.status) ? 204 : 410 });
  } catch { return new Response(null, { status: 400 }); }
}
