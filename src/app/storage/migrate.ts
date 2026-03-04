import { STORAGE_MIGRATION_KEY } from "./keys";

export function migrateLocalState() {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(STORAGE_MIGRATION_KEY) === "1") return;
    localStorage.setItem(STORAGE_MIGRATION_KEY, "1");
  } catch {
    // ignore storage limits/privacy mode failures
  }
}
