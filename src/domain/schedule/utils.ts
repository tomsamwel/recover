import type { Schedule, ScheduleMeta, SchedulePeriod } from "./model";

export function parseHHMM(t?: string | null) {
  if (!t) return NaN;
  const parts = t.trim().split(":");
  if (parts.length !== 2) return NaN;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  if (h < 0 || h > 23 || m < 0 || m > 59) return NaN;
  return h * 60 + m;
}

export function getAnchorDate(schedule: Schedule) {
  const at = schedule.metadata?.anchor?.at;
  const d = at ? new Date(at) : new Date(NaN);
  if (Number.isFinite(d.getTime())) return d;
  const legacy = schedule.metadata?.surgeryStart;
  const d2 = typeof legacy === "string" ? new Date(legacy) : new Date(NaN);
  if (Number.isFinite(d2.getTime())) return d2;
  return new Date();
}

export function activePeriod(meta: ScheduleMeta | undefined, day: number): SchedulePeriod | null {
  const ps = meta?.periods;
  if (!Array.isArray(ps) || !ps.length) return null;
  for (const p of ps) if (day >= p.startDay && day <= p.endDay) return p;
  return null;
}

export function weekIndexFromDay(meta: ScheduleMeta | undefined, day: number) {
  const wlen = Number.isFinite(Number(meta?.weekLengthDays)) ? Number(meta?.weekLengthDays) : 7;
  return Math.floor(day / Math.max(1, wlen));
}
