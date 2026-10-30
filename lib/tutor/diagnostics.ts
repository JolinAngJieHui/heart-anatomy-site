import { AsyncLocalStorage } from "node:async_hooks";
import type { NavigationCommand } from "./scene-actions";

const context = new AsyncLocalStorage<{ requestId: string }>();
export const diagnosticRequestId = () => context.getStore()?.requestId;
export function withDiagnostics(handler: (request: Request) => Promise<Response>) {
  return (request: Request) => context.run({ requestId: crypto.randomUUID() }, async () => {
    const started = Date.now();
    const response = await handler(request);
    response.headers.set("X-Request-ID", diagnosticRequestId()!);
    console.info(JSON.stringify({ event: "anatomy_http", requestId: diagnosticRequestId(), route: new URL(request.url).pathname, status: response.status, latencyMs: Date.now() - started }));
    return response;
  });
}
const pending = new Map<string, { requestId?: string; command: NavigationCommand; at: number }>();
export function recordProposal(id: string, command: NavigationCommand) {
  for (const [key, value] of pending) if (Date.now() - value.at > 120000) pending.delete(key);
  if (pending.size >= 200) pending.delete(pending.keys().next().value!);
  const entry = { requestId: diagnosticRequestId(), command, at: Date.now() };
  pending.set(id, entry);
  console.info(JSON.stringify({ event: "viewer_action_proposed", requestId: entry.requestId, actionId: id, command }));
}
export function recordExecution(id: string, status: "confirmed" | "failed") {
  const entry = pending.get(id);
  if (!entry) return false;
  pending.delete(id);
  if (Date.now() - entry.at > 120000) return false;
  console.info(JSON.stringify({ event: "viewer_action_result", requestId: entry.requestId, actionId: id, command: entry.command, status, reportedBy: "browser", latencyMs: Date.now() - entry.at }));
  return true;
}
