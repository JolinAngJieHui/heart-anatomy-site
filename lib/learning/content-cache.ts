const PREFIX = "heart-anatomy:content:v2:";
function address(kind: string, key: string) {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  return `${PREFIX}${kind}:${hash >>> 0}`;
}
export function readLearningCache(kind: string, key: string): unknown {
  try {
    const raw = sessionStorage.getItem(address(kind, key));
    if (!raw || raw.length > 1500000) return null;
    const saved = JSON.parse(raw);
    return saved.key === key ? saved.value : null;
  } catch { return null; }
}
export function writeLearningCache(kind: string, key: string, value: unknown) {
  try {
    const raw = JSON.stringify({ key, value });
    if (raw.length > 1500000) return;
    const keys = Object.keys(sessionStorage).filter(k => k.startsWith(PREFIX));
    let size = keys.reduce((n, k) => n + (sessionStorage.getItem(k)?.length ?? 0), 0);
    while (keys.length && (size + raw.length > 2000000 || keys.length >= 12)) {
      const oldest = keys.shift()!; size -= sessionStorage.getItem(oldest)?.length ?? 0; sessionStorage.removeItem(oldest);
    }
    sessionStorage.setItem(address(kind, key), raw);
  } catch { /* Private/unavailable/full storage keeps the in-memory workflow usable. */ }
}
export function clearLearningContent() {
  try { Object.keys(sessionStorage).filter(k => k.startsWith(PREFIX)).forEach(k => sessionStorage.removeItem(k)); } catch { /* No available storage. */ }
}
