export const ONE_MINUTE_MS = 60_000;

export function msUntilNextMinute(now: Date): number {
  const elapsed = now.getSeconds() * 1000 + now.getMilliseconds();
  return elapsed === 0 ? ONE_MINUTE_MS : ONE_MINUTE_MS - elapsed;
}

export function createMinuteTicker(onTick: () => void, nowProvider: () => Date = () => new Date()): () => void {
  let intervalId: ReturnType<typeof globalThis.setInterval> | null = null;
  const timeoutId = globalThis.setTimeout(() => {
    onTick();
    intervalId = globalThis.setInterval(onTick, ONE_MINUTE_MS);
  }, msUntilNextMinute(nowProvider()));

  return () => {
    globalThis.clearTimeout(timeoutId);
    if (intervalId !== null) globalThis.clearInterval(intervalId);
  };
}
