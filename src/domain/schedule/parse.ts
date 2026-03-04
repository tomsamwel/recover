import type { Schedule } from "./model";
import { normalizeScheduleV1 } from "./v1/normalize";

export type ParseScheduleResult =
  | { ok: true; value: Schedule }
  | { ok: false; errors: string[] };

export function parseSchedule(input: unknown): ParseScheduleResult {
  if (!input || typeof input !== "object") return { ok: false, errors: ["Schedule payload must be an object."] };

  const raw = input as { version?: unknown; weeks?: unknown; metadata?: any };
  const version = Number(raw.version);
  if (!Number.isFinite(version)) return { ok: false, errors: ["Missing or invalid schedule version."] };
  if (!Array.isArray(raw.weeks)) return { ok: false, errors: ["Schedule must contain a weeks array."] };

  if (version === 1) {
    const normalized = normalizeScheduleV1(raw);
    if (!normalized) return { ok: false, errors: ["Invalid v1 schedule format."] };

    const errors: string[] = [];
    if (!normalized.weeks.length) errors.push("Schedule must include at least one week.");
    const badPeriods = normalized.metadata?.periods?.some((p) => p.endDay < p.startDay);
    if (badPeriods) errors.push("One or more periods have endDay before startDay.");
    if (normalized.metadata?.anchor?.at && !Number.isFinite(new Date(normalized.metadata.anchor.at).getTime()))
      errors.push("Anchor date is malformed.");

    return errors.length ? { ok: false, errors } : { ok: true, value: normalized };
  }

  return { ok: false, errors: [`Unsupported schedule version: ${version}.`] };
}
