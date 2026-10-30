import { chatResponseSchema } from "./schema";
import type { TutorResponse } from "./types";
export async function readTutorResponse(response: Response): Promise<TutorResponse> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty tutor response.");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const chunk = await reader.read(); if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > 131072) { await reader.cancel(); throw new Error("Tutor response exceeded the allowed size."); }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let value;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw new Error("Invalid tutor response. Please retry."); }
  if (!response.ok) throw new Error(typeof value?.error === "string" ? value.error.slice(0, 500) : "Tutor request failed.");
  const parsed = chatResponseSchema.safeParse(value);
  if (!parsed.success) throw new Error("Invalid tutor response. Please retry.");
  return parsed.data;
}
