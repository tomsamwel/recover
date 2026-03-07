/**
 * Minimal adapter for JSON persistence in localStorage.
 *
 * Goals:
 * - keep JSON/localStorage error handling in one place
 * - provide predictable fallback/no-op behavior
 * - keep domain-shaping/validation outside this module
 */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Writes a JSON-serializable value. Storage/serialization errors are ignored. */
export function writeJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // No-op by design: callers should not crash on persistence failures.
  }
}

/**
 * Read-modify-write helper for map-like records.
 *
 * If reading/parsing fails, `fallback` is used as current state.
 * If mutate or write fails, operation is a no-op.
 */
export function updateJson<T>(key: string, fallback: T, mutate: (current: T) => T): void {
  try {
    const current = readJson(key, fallback);
    const next = mutate(current);
    writeJson(key, next);
  } catch {
    // No-op by design.
  }
}
