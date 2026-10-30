"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function RestartSessionDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { dialog.current?.showModal(); cancel.current?.focus(); }, []);
  return createPortal(<dialog ref={dialog} className="restart-session-dialog" aria-labelledby="restart-title" aria-describedby="restart-description" onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }} onKeyDown={event => {
    if (event.key !== "Tab") return;
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <p className="eyebrow">A fresh start</p><h2 id="restart-title">Restart your session?</h2>
    <p id="restart-description">This clears this tab’s lesson, including tutor conversations, explored vessels, reviews, quizzes, and revision notes. It also removes any older saved history from this browser. Lessons in other open tabs are unaffected.</p>
    <p>Your next session will begin with no explored vessels and the default learning level and view. This cannot be undone.</p>
    <div className="learning-actions"><button ref={cancel} className="control" disabled={busy} onClick={onCancel}>Cancel</button><button className="ask-tutor-button" disabled={busy} onClick={() => { setBusy(true); void onConfirm(); }}>{busy ? "Restarting…" : "Restart Session"}</button></div>
  </dialog>, document.body);
}
