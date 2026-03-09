import type { Schedule, ScheduleDayOfWeek, ScheduleMeta, ScheduleSessionTiming, ScheduleWeek } from "../model";
import { isAnytimeLabel, parseHHMM, parseRecurringTimingLabel } from "../utils";

const DAY_ORDER: ScheduleDayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function normalizeDays(raw: unknown): ScheduleDayOfWeek[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set<ScheduleDayOfWeek>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    if (DAY_ORDER.includes(item as ScheduleDayOfWeek)) set.add(item as ScheduleDayOfWeek);
  }
  return DAY_ORDER.filter((d) => set.has(d));
}

function normalizeTimingFromRaw(raw: any): ScheduleSessionTiming | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const mode = typeof raw.mode === "string" ? raw.mode : "";
  const label = typeof raw.label === "string" ? raw.label : undefined;

  if (mode === "exact") {
    const time = typeof raw.time === "string" ? raw.time.trim() : "";
    return { mode: "exact", time, label };
  }

  if (mode === "anytime") return label ? { mode: "anytime", label } : { mode: "anytime" };

  if (mode === "recurring") {
    const days = normalizeDays(raw.days);
    const time = typeof raw.time === "string" ? raw.time : undefined;
    return { mode: "recurring", days, time, label };
  }

  return undefined;
}

function normalizeTimingFromLegacy(timeOfDay: string): ScheduleSessionTiming {
  const trimmed = timeOfDay.trim();
  if (Number.isFinite(parseHHMM(trimmed))) return { mode: "exact", time: trimmed };
  if (isAnytimeLabel(trimmed)) return { mode: "anytime", label: "Throughout day" };
  const recurring = parseRecurringTimingLabel(trimmed);
  if (recurring) return { mode: "recurring", days: recurring.days, time: recurring.time, label: trimmed };
  return { mode: "anytime", label: trimmed };
}

export function normalizeMeta(raw: any): ScheduleMeta | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: ScheduleMeta = { ...raw };
  if (raw.anchor && typeof raw.anchor === "object" && typeof raw.anchor.at === "string")
    out.anchor = { at: String(raw.anchor.at), type: typeof raw.anchor.type === "string" ? raw.anchor.type : undefined };
  else if (typeof raw.surgeryStart === "string") out.anchor = { at: raw.surgeryStart, type: "surgeryStart" };
  if (Array.isArray(raw.periods))
    out.periods = raw.periods
      .filter((p: any) => p && typeof p === "object")
      .map((p: any) => ({
        id: String(p.id ?? ""),
        label: String(p.label ?? ""),
        startDay: Number(p.startDay),
        endDay: Number(p.endDay),
      }))
      .filter((p: any) => p.id && p.label && Number.isFinite(p.startDay) && Number.isFinite(p.endDay) && p.endDay >= p.startDay);
  if (Number.isFinite(Number(raw.weekLengthDays))) out.weekLengthDays = Number(raw.weekLengthDays);
  return out;
}

export function normalizeScheduleV1(raw: any): Schedule | null {
  if (!raw || typeof raw !== "object") return null;
  if (!Array.isArray(raw.weeks)) return null;
  const version = Number(raw.version);
  if (!Number.isFinite(version)) return null;

  const weeks: ScheduleWeek[] = raw.weeks
    .filter((w: any) => w && typeof w === "object" && Number.isFinite(Number(w.weekNumber)) && Array.isArray(w.sessions))
    .map((w: any) => ({
      weekNumber: Number(w.weekNumber),
      label: typeof w.label === "string" ? w.label : undefined,
      description: typeof w.description === "string" ? w.description : undefined,
      gates: Array.isArray(w.gates)
        ? w.gates
            .filter((g: any) => g && typeof g === "object" && typeof g.id === "string" && typeof g.title === "string")
            .map((g: any) => ({
              id: String(g.id),
              title: String(g.title),
              detail: Array.isArray(g.detail) ? g.detail.map((x: any) => String(x)) : [],
            }))
        : [],
      sessions: w.sessions
        .filter((s: any) => s && typeof s === "object" && typeof s.id === "string" && Array.isArray(s.exercises))
        .map((s: any) => {
          const legacyTime = typeof s.timeOfDay === "string" ? s.timeOfDay : s.timeOfDay ?? null;
          const hasRawTiming = s.timing && typeof s.timing === "object";
          const timing = hasRawTiming
            ? normalizeTimingFromRaw(s.timing)
            : typeof legacyTime === "string" && legacyTime.trim()
              ? normalizeTimingFromLegacy(legacyTime)
              : undefined;
          return {
            id: String(s.id),
            title: typeof s.title === "string" ? s.title : String(s.id),
            timeOfDay: legacyTime,
            timing,
            exercises: s.exercises
              .filter((e: any) => e && typeof e === "object")
              .map((e: any) => ({
                id: typeof e.id === "string" ? e.id : undefined,
                name: String(e.name ?? ""),
                purpose: String(e.purpose ?? ""),
                instructions: String(e.instructions ?? ""),
                progression: typeof e.progression === "string" ? e.progression : undefined,
                link: typeof e.link === "string" ? e.link : undefined,
              })),
          };
        }),
    }));

  if (!weeks.length) return null;
  return { version, metadata: normalizeMeta(raw.metadata), weeks };
}
