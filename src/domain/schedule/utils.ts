import type { Schedule, ScheduleDayOfWeek, ScheduleMeta, SchedulePeriod, ScheduleSession } from "./model";

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

const DAY_ORDER: ScheduleDayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_ALIASES: Record<string, ScheduleDayOfWeek> = {
  mon: "Mon",
  monday: "Mon",
  tue: "Tue",
  tues: "Tue",
  tuesday: "Tue",
  wed: "Wed",
  weds: "Wed",
  wednesday: "Wed",
  thu: "Thu",
  thur: "Thu",
  thurs: "Thu",
  thursday: "Thu",
  fri: "Fri",
  friday: "Fri",
  sat: "Sat",
  saturday: "Sat",
  sun: "Sun",
  sunday: "Sun",
};

function normalizeDayToken(token: string): ScheduleDayOfWeek | null {
  return DAY_ALIASES[token.trim().toLowerCase()] ?? null;
}

function uniqueDays(days: ScheduleDayOfWeek[]): ScheduleDayOfWeek[] {
  const seen = new Set<ScheduleDayOfWeek>();
  for (const d of days) seen.add(d);
  return DAY_ORDER.filter((d) => seen.has(d));
}

export function isAnytimeLabel(value?: string | null): boolean {
  if (typeof value !== "string") return false;
  const s = value.trim().toLowerCase();
  return s === "throughout day" || s === "anytime" || s === "any time";
}

export function parseRecurringTimingLabel(raw?: string | null): { days: ScheduleDayOfWeek[]; time?: string } | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/);
  if (!parts.length) return null;
  const candidateTime = parts[parts.length - 1];
  const hasTime = Number.isFinite(parseHHMM(candidateTime));
  const dayPart = hasTime ? parts.slice(0, -1).join(" ") : parts.join(" ");

  const days = uniqueDays(
    dayPart
      .split("/")
      .map((x) => normalizeDayToken(x))
      .filter((x): x is ScheduleDayOfWeek => Boolean(x))
  );
  if (!days.length) return null;
  return hasTime ? { days, time: candidateTime } : { days };
}

export function getSessionSortableMinutes(session: ScheduleSession): number | null {
  const timing = session.timing;
  if (timing?.mode === "exact") {
    const t = parseHHMM(typeof timing.time === "string" ? timing.time : null);
    return Number.isFinite(t) ? t : null;
  }
  if (timing?.mode === "recurring" && typeof timing.time === "string") {
    const t = parseHHMM(timing.time);
    return Number.isFinite(t) ? t : null;
  }
  const legacy = parseHHMM(typeof session.timeOfDay === "string" ? session.timeOfDay : null);
  return Number.isFinite(legacy) ? legacy : null;
}

export function getSessionStrictClockTime(session: ScheduleSession): string | null {
  if (session.timing?.mode === "exact" && typeof session.timing.time === "string") return session.timing.time;
  if (!session.timing && typeof session.timeOfDay === "string" && Number.isFinite(parseHHMM(session.timeOfDay))) return session.timeOfDay.trim();
  return null;
}

export function getSessionDisplayTime(session: ScheduleSession): string {
  const timing = session.timing;
  if (timing?.mode === "exact") return (typeof timing.label === "string" ? timing.label.trim() : "") || (typeof timing.time === "string" ? timing.time : "");
  if (timing?.mode === "anytime") return (typeof timing.label === "string" ? timing.label.trim() : "") || "Any time";
  if (timing?.mode === "recurring") {
    if (typeof timing.label === "string" && timing.label.trim()) return timing.label;
    const safeDays = Array.isArray(timing.days) ? timing.days : [];
    const days = uniqueDays(safeDays).join("/");
    return typeof timing.time === "string" ? `${days} ${timing.time}`.trim() : days || "Recurring";
  }
  if (typeof session.timeOfDay === "string") return session.timeOfDay;
  return "";
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
