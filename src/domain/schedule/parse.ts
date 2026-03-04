import type { Schedule } from "./model";
import { validateSchedule } from "./validate";
import { normalizeScheduleV1 } from "./v1/normalize";

export type ParseScheduleResult =
  | { ok: true; value: Schedule }
  | { ok: false; errors: string[] };

type VersionParser = (input: any) => ParseScheduleResult;

function parseV1(raw: any): ParseScheduleResult {
  const normalized = normalizeScheduleV1(raw);
  if (!normalized) return { ok: false, errors: ["Invalid v1 schedule format."] };

  const errors = validateSchedule(normalized);
  const hasBadRawPeriod = Array.isArray(raw?.metadata?.periods)
    ? raw.metadata.periods.some((p: any) => Number.isFinite(Number(p?.startDay)) && Number.isFinite(Number(p?.endDay)) && Number(p.endDay) < Number(p.startDay))
    : false;
  if (hasBadRawPeriod) errors.push("One or more periods have endDay before startDay.");

  return errors.length ? { ok: false, errors } : { ok: true, value: normalized };
}

const PARSERS: Record<number, VersionParser> = {
  1: parseV1,
  6: parseV1,
};

export function parseSchedule(input: unknown): ParseScheduleResult {
  if (!input || typeof input !== "object") return { ok: false, errors: ["Schedule payload must be an object."] };

  const raw = input as { version?: unknown; weeks?: unknown };
  const version = Number(raw.version);
  if (!Number.isFinite(version)) return { ok: false, errors: ["Missing or invalid schedule version."] };
  if (!Array.isArray(raw.weeks)) return { ok: false, errors: ["Schedule must contain a weeks array."] };

  const parser = PARSERS[version];
  if (!parser) return { ok: false, errors: [`Unsupported schedule version: ${version}.`] };

  return parser(raw);
}
