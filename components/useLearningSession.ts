"use client";
import { clearLearningContent } from "@/lib/learning/content-cache";
import { useCallback, useEffect, useRef, useState } from "react";
import { SESSION_STORAGE_KEY, type LearningEvent } from "@/lib/learning/session";
import { createSessionStore, historyLifetime, type SessionSnapshot } from "@/lib/learning/session-store";
import { PROGRESS_STORAGE_KEY } from "@/lib/exploration-progress";
import { personalisedQuizClient } from "@/lib/learning/quiz-client";
import { lessonReviewClient } from "@/lib/learning/review-client";

export default function useLearningSession() {
  const store = useRef<ReturnType<typeof createSessionStore> | null>(null);
  const [state, setState] = useState<SessionSnapshot>({ history: null, ready: false, error: null, revision: 0 });
  useEffect(() => {
    const current = createSessionStore({ storage: () => sessionStorage,
      clearLegacy: () => { localStorage.removeItem(SESSION_STORAGE_KEY); localStorage.removeItem(PROGRESS_STORAGE_KEY); },
      invalidate: () => { clearLearningContent(); lessonReviewClient.clear(); personalisedQuizClient.clear(); } });
    store.current = current;
    const unsubscribe = current.subscribe(() => setState(current.getSnapshot()));
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    // Fresh navigation starts a new visit, even if an opener copied sessionStorage.
    // Refresh/back navigation can recover only this tab's current lesson.
    if (navigation?.type !== "reload" && navigation?.type !== "back_forward") clearLearningContent();
    current.load(navigation?.type === "reload" || navigation?.type === "back_forward");
    const hidden = () => { if (document.visibilityState === "hidden") current.flush(); };
    window.addEventListener("pagehide", current.flush);
    document.addEventListener("visibilitychange", hidden);
    return () => { unsubscribe(); current.dispose(); window.removeEventListener("pagehide", current.flush); document.removeEventListener("visibilitychange", hidden); };
  }, []);
  const lifetime = state.history ? historyLifetime(state.history) : "";
  const activeId = state.history?.activeId ?? "";
  const record = useCallback((event: LearningEvent, sessionId = activeId) => { store.current?.record(event, sessionId, lifetime); }, [activeId, lifetime]);
  const restart = useCallback(() => { store.current?.restart(); }, []);
  return { ...state, session: state.history?.sessions[0] ?? null, record, restart };
}
