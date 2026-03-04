import type { Gate, Schedule, ScheduleWeek } from "../domain/schedule";
import { parseHHMM } from "../domain/schedule";
import { DONE_STORAGE_KEY, GATES_STORAGE_KEY, SCHEDULE_STORAGE_KEY } from "./storage/keys";

export type Item = { id: string; title: string; icon: IconName; how: string[]; why: string; progress?: string };
export type Session = { id: string; time: string; title: string; items: Item[] };
export type DoneState = Record<string, Record<string, boolean>>;

export type IconName = "hand" | "bone" | "pendulum" | "rotate" | "thoraxUp" | "scapula" | "breath" | "sleep";

const pad2 = (n: number) => String(n).padStart(2, "0");

export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

export const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;

export const fmtAt = (s?: string) => {
  if (!s) return "";
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return s;
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

function hash32(str: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function scheduleId(s: Schedule) {
  const m = s.metadata ?? {};
  const slim = {
    v: s.version,
    a: m.anchor?.at ?? m.surgeryStart ?? "",
    p: Array.isArray(m.periods) ? m.periods.map((x) => [x.id, x.label, x.startDay, x.endDay]) : [],
    w: s.weeks.map((wk) => [
      wk.weekNumber,
      wk.label ?? "",
      wk.gates?.map((g) => [g.id, g.title]) ?? [],
      wk.sessions.map((ss) => [ss.id, ss.title, ss.timeOfDay ?? "", ss.exercises.map((e) => e.id ?? e.name)]),
    ]),
  };
  return hash32(JSON.stringify(slim));
}

function iconFor(title: string): IconName {
  const t = title.toLowerCase();
  if (t.includes("hand") || t.includes("wrist") || t.includes("fist")) return "hand";
  if (t.includes("elbow") || t.includes("biceps") || t.includes("triceps")) return "bone";
  if (t.includes("pend") || t.includes("sling")) return "pendulum";
  if (t.includes("thor") || t.includes("t-spine") || t.includes("chest")) return "thoraxUp";
  if (t.includes("scap") || t.includes("serratus") || t.includes("trap")) return "scapula";
  if (t.includes("breath")) return "breath";
  if (t.includes("sleep")) return "sleep";
  return "rotate";
}

export function buildSessionsFromWeek(week: ScheduleWeek): Session[] {
  return week.sessions
    .map((s) => ({ ...s, t: parseHHMM(s.timeOfDay) }))
    .sort((a, b) => (Number.isFinite(a.t) ? a.t : 1e9) - (Number.isFinite(b.t) ? b.t : 1e9))
    .map((s) => {
      const items: Item[] = s.exercises.map((e, i) => {
        const lines = (e.instructions || "")
          .split("\r")
          .join("")
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean);
        const id = (e.id || `${s.id}__${i}__${e.name || "exercise"}`).trim().toLowerCase().replaceAll(" ", "-");
        return {
          id,
          title: e.name || "Exercise",
          icon: iconFor(e.name || "exercise"),
          how: lines.length ? lines : [e.instructions].filter(Boolean),
          why: e.purpose || "",
          progress: e.progression,
        };
      });
      return { id: s.id, time: typeof s.timeOfDay === "string" ? s.timeOfDay : "", title: s.title, items };
    });
}

export function loadSchedule<T>(fallback: T, parse: (value: unknown) => T | null): T {
  try {
    const raw = localStorage.getItem(SCHEDULE_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parse(parsed) ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveSchedule(s: Schedule) {
  try {
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

export function emptyDone(sessions: Session[]): DoneState {
  const out: DoneState = {};
  for (const s of sessions) {
    out[s.id] = {};
    for (const it of s.items) out[s.id][it.id] = false;
  }
  return out;
}

export function loadDone(doneKey: string, sessions: Session[]): DoneState {
  const base = emptyDone(sessions);
  try {
    const raw = localStorage.getItem(DONE_STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Record<string, DoneState>;
    const saved = parsed?.[doneKey];
    if (!saved) return base;
    for (const s of sessions) for (const it of s.items) base[s.id][it.id] = Boolean(saved?.[s.id]?.[it.id]);
    return base;
  } catch {
    return base;
  }
}

export function saveDone(doneKey: string, done: DoneState) {
  try {
    const raw = localStorage.getItem(DONE_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, DoneState>) : {};
    parsed[doneKey] = done;
    localStorage.setItem(DONE_STORAGE_KEY, JSON.stringify(parsed));
  } catch {}
}

export const emptyGateState = (gates: Gate[]) => Object.fromEntries(gates.map((g) => [g.id, false])) as Record<string, boolean>;

export function loadGates(key: string, gates: Gate[]) {
  const base = emptyGateState(gates);
  try {
    const raw = localStorage.getItem(GATES_STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Record<string, Record<string, boolean>>;
    const saved = parsed?.[key];
    if (!saved) return base;
    for (const g of gates) base[g.id] = Boolean(saved[g.id]);
    return base;
  } catch {
    return base;
  }
}

export function saveGates(key: string, state: Record<string, boolean>) {
  try {
    const raw = localStorage.getItem(GATES_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, Record<string, boolean>>) : {};
    parsed[key] = state;
    localStorage.setItem(GATES_STORAGE_KEY, JSON.stringify(parsed));
  } catch {}
}
