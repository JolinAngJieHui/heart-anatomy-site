export function withSignal<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) { void operation.catch(() => {}); return Promise.reject(signal.reason ?? new Error("Timed out")); }
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new Error("Timed out"));
    signal.addEventListener("abort", abort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
