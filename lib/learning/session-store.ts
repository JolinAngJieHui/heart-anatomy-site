import { appendEvent, newHistory, stamp, type LearningEvent, type SessionHistory } from "./session";
import { MAX_TAB_SESSION_CHARACTERS, restoreTabHistory, TAB_SESSION_STORAGE_KEY, type SessionStorage } from "./persistence";

export type SessionSnapshot = { history: SessionHistory | null; ready: boolean; error: string | null; revision: number };
type Dependencies = { storage: () => SessionStorage; invalidate: () => void; clearLegacy?: () => void };
export const historyLifetime = (history: SessionHistory) => history.activeId;

// A tab owns one in-memory lesson. Storage is only its refresh checkpoint: no
// cross-tab locks, archive scans, broadcasts, or read/validate cycles on clicks.
export function createSessionStore(deps: Dependencies) {
  let snapshot: SessionSnapshot = { history: null, ready: false, error: null, revision: 0 };
  let pending: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const fresh = () => { const now = stamp(); return newHistory(now.id, now.at); };
  const publish = (history: SessionHistory, error: string | null = snapshot.error, restart = false) => {
    snapshot = { history, ready: true, error, revision: snapshot.revision + (restart ? 1 : 0) };
    listeners.forEach(listener => listener());
  };
  const cancel = () => { clearTimeout(pending); pending = undefined; };
  const flush = () => {
    if (pending === undefined || !snapshot.history) return;
    cancel();
    try {
      // Events are validated as they enter memory; do not parse the whole lesson
      // again on every save. Only the current tab's session is serialized.
      const raw = JSON.stringify(snapshot.history);
      if (raw.length > MAX_TAB_SESSION_CHARACTERS) { deps.storage().removeItem(TAB_SESSION_STORAGE_KEY); throw new Error("Tab checkpoint limit"); }
      deps.storage().setItem(TAB_SESSION_STORAGE_KEY, raw);
    } catch {
      publish(snapshot.history, "Your activity is available in this tab, but cannot be kept through a refresh. You can still download your review.");
    }
  };
  const scheduleSave = () => { if (pending === undefined) pending = setTimeout(flush, 150); };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    load(restore = true) {
      if (snapshot.ready) return;
      let history: SessionHistory | null = null, error: string | null = null;
      try {
        if (restore) history = restoreTabHistory(deps.storage());
        else deps.storage().removeItem(TAB_SESSION_STORAGE_KEY);
      } catch { error = "This tab’s previous activity could not be restored. A fresh lesson is ready; new activity stays available while this tab is open."; }
      publish(history ?? fresh(), error);
      scheduleSave();
    },
    record(event: LearningEvent, sessionId: string, lifetime: string) {
      const history = snapshot.history;
      if (!history || lifetime !== historyLifetime(history) || sessionId !== history.activeId) return;
      if (history.sessions[0].events.length >= 10000) { publish(history, "This lesson has reached its activity limit. Download your review, then restart for a new lesson."); return; }
      publish(appendEvent(history, sessionId, event));
      scheduleSave();
    },
    restart() {
      cancel(); deps.invalidate();
      let error: string | null = null;
      try { deps.storage().removeItem(TAB_SESSION_STORAGE_KEY); deps.clearLegacy?.(); }
      catch { error = "This tab was restarted, but browser storage could not be fully cleared. Allow storage access and restart again before refreshing."; }
      publish(fresh(), error, true);
      scheduleSave(); flush();
    },
    flush,
    dispose() { flush(); cancel(); listeners.clear(); },
  };
}
