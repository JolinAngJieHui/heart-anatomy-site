import { historySchema, SESSION_STORAGE_KEY, type SessionHistory } from "./session";
export const TAB_SESSION_STORAGE_KEY = "heart-anatomy:tab-session:v1";
export const MAX_TAB_SESSION_CHARACTERS = 4_000_000;
const tabHistorySchema = historySchema.safeExtend({ sessions: historySchema.shape.sessions.max(1) });
export interface SessionStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export function restoreTabHistory(storage: SessionStorage): SessionHistory | null {
  const raw = storage.getItem(TAB_SESSION_STORAGE_KEY);
  if (!raw) return null;
  // Bound parsing work and accept one active lesson, never a saved archive.
  if (raw.length > MAX_TAB_SESSION_CHARACTERS) throw new Error("Tab session is too large");
  const history = tabHistorySchema.parse(JSON.parse(raw));
  return history;
}
export function restoreHistory(storage: SessionStorage): SessionHistory | null {
  const raw = storage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  return historySchema.parse(JSON.parse(raw));
}
export function saveHistory(storage: SessionStorage, history: SessionHistory) {
  storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(historySchema.parse(history)));
}
export function clearHistory(storage: SessionStorage, confirmed: boolean) {
  if (!confirmed) return false;
  storage.removeItem(SESSION_STORAGE_KEY);
  return true;
}
