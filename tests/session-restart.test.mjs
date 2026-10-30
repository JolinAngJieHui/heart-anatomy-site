import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypeScript } from '../scripts/load-typescript.mjs';
const S = loadTypeScript('lib/learning/session.ts');
const { createSessionStore, historyLifetime } = loadTypeScript('lib/learning/session-store.ts');
const { TAB_SESSION_STORAGE_KEY, restoreTabHistory } = loadTypeScript('lib/learning/persistence.ts');
const { generateSummary } = loadTypeScript('lib/learning/summary.ts');
const { questionPool } = loadTypeScript('lib/learning/quiz.ts');
function fixture() {
  const data = new Map(), reads = []; let writes = 0, invalidations = 0;
  const storage = { getItem: k => { reads.push(k); return data.get(k) ?? null; }, setItem: (k, v) => { writes++; data.set(k, v); }, removeItem: k => data.delete(k) };
  const make = () => createSessionStore({ storage: () => storage, invalidate: () => invalidations++ });
  return { data, storage, make, reads, writes: () => writes, invalidations: () => invalidations };
}
const active = store => { const h = store.getSnapshot().history; return [h.activeId, historyLifetime(h)]; };
const card = (id = 'coronary-sinus') => S.recordCard(id, 'advanced');
test('one tab restores unique progress and level without locks or reading a legacy archive', () => {
  const f = fixture(); f.data.set(S.SESSION_STORAGE_KEY, 'LEGACY ARCHIVE MUST NOT BE PARSED');
  const a = f.make(); a.load(); a.record(card(), ...active(a)); a.record(card(), ...active(a)); a.flush();
  const b = f.make(); b.load();
  assert.deepEqual(S.sessionExploration(b.getSnapshot().history.sessions[0]), { visitedIds: ['coronary-sinus'], learningLevel: 'advanced' });
  assert.equal(S.sessionActivity(b.getSnapshot().history.sessions[0]).cards.length, 2);
  assert.deepEqual(f.reads, [TAB_SESSION_STORAGE_KEY, TAB_SESSION_STORAGE_KEY]); a.dispose(); b.dispose();
});
test('activity updates synchronously and a batch is checkpointed with one write, without rereading history', () => {
  const f = fixture(), a = f.make(); a.load(); a.flush(); const initialWrites = f.writes();
  for (let i = 0; i < 30; i++) a.record(card(), ...active(a));
  assert.equal(a.getSnapshot().history.sessions[0].events.length, 30); assert.equal(f.writes(), initialWrites);
  assert.equal(f.reads.length, 1); a.flush(); assert.equal(f.writes(), initialWrites + 1); a.dispose();
});
test('a fresh visit discards copied tab data and new tabs have independent histories', () => {
  const f = fixture(), a = f.make(); a.load(); a.record(card(), ...active(a)); a.flush(); const old = active(a);
  const duplicate = f.make(); duplicate.load(false); assert.deepEqual(duplicate.getSnapshot().history.sessions[0].events, []); assert.notEqual(active(duplicate)[0], old[0]);
  const other = fixture(), b = other.make(); b.load(); b.record(card('ascending-aorta'), ...active(b));
  a.restart(); assert.equal(S.sessionExploration(b.getSnapshot().history.sessions[0]).visitedIds.length, 1);
  a.dispose(); duplicate.dispose(); b.dispose();
});
test('restart erases the active lesson and caches, leaves unrelated tab storage alone, and rejects late work', () => {
  const f = fixture(), a = f.make(); a.load(); a.record(card(), ...active(a)); const stale = active(a);
  a.record({ ...S.stamp(), type: 'question-asked', question: 'OLD QUESTION', level: 'basic', structureId: null }, ...active(a));
  a.record({ ...S.stamp(), type: 'confusion-noted', text: 'OLD NOTE', structureId: null }, ...active(a));
  f.data.set('other-app', 'keep'); a.restart();
  a.record({ ...S.stamp(), type: 'tutor-replied', questionId: 'deleted-question', reply: {} }, ...stale);
  a.record(card(), ...stale); a.flush();
  const fresh = a.getSnapshot().history;
  assert.equal(fresh.sessions.length, 1); assert.deepEqual(fresh.sessions[0].events, []); assert.equal(f.data.get('other-app'), 'keep');
  assert.equal(f.invalidations(), 1); assert.deepEqual(restoreTabHistory(f.storage), fresh);
  assert.doesNotMatch(JSON.stringify(generateSummary(fresh.sessions[0], null)), /OLD QUESTION|OLD NOTE|coronary sinus/i);
  assert.deepEqual(questionPool(fresh.sessions[0], [], 'basic'), []); a.dispose();
});
test('corrupt, oversized, obsolete and multi-session checkpoints fail safely into a ready lesson', () => {
  const archive = S.startSession(S.newHistory('first', new Date().toISOString()), 'second', new Date().toISOString());
  for (const value of ['broken', JSON.stringify({ version: 99 }), JSON.stringify(archive), 'x'.repeat(4_000_001)]) {
    const f = fixture(); f.data.set(TAB_SESSION_STORAGE_KEY, value); const a = f.make(); a.load();
    assert.ok(a.getSnapshot().error); assert.equal(a.getSnapshot().ready, true); assert.deepEqual(a.getSnapshot().history.sessions[0].events, []);
    a.record(card(), ...active(a)); assert.equal(S.sessionExploration(a.getSnapshot().history.sessions[0]).visitedIds.length, 1); a.dispose();
  }
});
test('blocked storage does not prevent startup, exploration, or in-memory restart', () => {
  const a = createSessionStore({ storage: () => { throw Error('blocked'); }, invalidate: () => {} });
  a.load(); assert.equal(a.getSnapshot().ready, true); a.record(card(), ...active(a)); a.flush();
  assert.equal(S.sessionExploration(a.getSnapshot().history.sessions[0]).visitedIds.length, 1);
  a.restart(); assert.deepEqual(a.getSnapshot().history.sessions[0].events, []); assert.ok(a.getSnapshot().error); a.dispose();
});
test('restart deletes the checkpoint even when storage rejects writes', () => {
  const f = fixture(), a = f.make(); a.load(); a.record(card(), ...active(a)); a.flush();
  f.storage.setItem = () => { throw Error('quota'); };
  a.restart(); assert.equal(f.data.has(TAB_SESSION_STORAGE_KEY), false);
  assert.deepEqual(a.getSnapshot().history.sessions[0].events, []); assert.ok(a.getSnapshot().error); a.dispose();
});
test('a different quiz level does not overwrite the saved explorer learning level', () => {
  let h = S.newHistory('level-session', new Date().toISOString()); h = S.appendEvent(h, h.activeId, card());
  h = S.appendEvent(h, h.activeId, { ...S.stamp(), type: 'quiz-started', level: 'basic', attemptId: 'quiz', questionIds: ['question'] });
  assert.equal(S.sessionExploration(h.sessions[0]).learningLevel, 'advanced');
});
