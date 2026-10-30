import "server-only";
export interface UsageLimiter { reserve(minuteLimit: number, dailyLimit: number): Promise<boolean> }

// Global limits deliberately avoid trusting spoofable forwarded-IP headers.
const windows = new Map<string, number>();
export async function reserveUsage(minuteLimit: number, dailyLimit: number) {
  // Explicit server-only examiner opt-in. Provider and hosting limits remain.
  // Check before store validation so missing/stale Redis settings cannot block it.
  if (process.env.ASSESSMENT_DISABLE_USAGE_LIMITS === "true") return true;
  const minute = `anatomy-tutor:minute:${Math.floor(Date.now() / 60000)}`;
  const day = `anatomy-tutor:day:${Math.floor(Date.now() / 86400000)}`;
  const url = process.env.TUTOR_REDIS_REST_URL;
  if (url) {
    if (!url.startsWith("https://") || !process.env.TUTOR_REDIS_REST_TOKEN) throw new Error("Invalid shared limiter");
    const script = "local a=tonumber(redis.call('GET',KEYS[1]) or '0'); local b=tonumber(redis.call('GET',KEYS[2]) or '0'); if a>=tonumber(ARGV[1]) or b>=tonumber(ARGV[2]) then return 0 end; redis.call('INCR',KEYS[1]); redis.call('EXPIRE',KEYS[1],120); redis.call('INCR',KEYS[2]); redis.call('EXPIRE',KEYS[2],172800); return 1";
    const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${process.env.TUTOR_REDIS_REST_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(["EVAL", script, "2", minute, day, String(minuteLimit), String(dailyLimit)]), signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!response.ok) throw new Error("Usage limiter unavailable");
    const data = await response.json();
    if (data.error || ![0, 1].includes(data.result)) throw new Error("Usage limiter failed");
    return data.result === 1;
  }
  for (const key of windows.keys()) if (key !== minute && key !== day) windows.delete(key);
  if ((windows.get(minute) ?? 0) >= minuteLimit || (windows.get(day) ?? 0) >= dailyLimit) return false;
  windows.set(minute, (windows.get(minute) ?? 0) + 1);
  windows.set(day, (windows.get(day) ?? 0) + 1);
  return true;
}
