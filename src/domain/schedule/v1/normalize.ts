import type { Schedule, ScheduleMeta, ScheduleWeek } from "../model";

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
        .map((s: any) => ({
          id: String(s.id),
          title: typeof s.title === "string" ? s.title : String(s.id),
          timeOfDay: typeof s.timeOfDay === "string" ? s.timeOfDay : s.timeOfDay ?? null,
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
        })),
    }));

  if (!weeks.length) return null;
  return { version, metadata: normalizeMeta(raw.metadata), weeks };
}
