import type { ConversationMessage } from "./types";
export function boundedConversation(messages: ConversationMessage[]): ConversationMessage[] {
  const result: ConversationMessage[] = []; let total = 0;
  for (const message of messages.slice().reverse()) {
    if (result.length === 6) break;
    const content = message.content.trim().slice(0, Math.min(1800, 4800 - total));
    if (!content) continue;
    result.unshift({ role: message.role, content }); total += content.length;
  }
  return result;
}
