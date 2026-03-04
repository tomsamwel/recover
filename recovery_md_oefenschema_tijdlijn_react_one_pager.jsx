import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Hand,
  Bone,
  Orbit,
  RotateCcw,
  ArrowUpFromLine,
  Aperture,
  Wind,
  Moon,
  Sun,
  Info,
  RefreshCcw,
  Upload,
  ChevronDown,
} from "lucide-react";

type Gate = { id: string; title: string; detail: string[] };

type ScheduleExercise = {
  id?: string;
  name: string;
  purpose: string;
  instructions: string;
  progression?: string;
  link?: string;
};

type ScheduleSession = {
  id: string;
  title: string;
  timeOfDay?: string | null;
  exercises: ScheduleExercise[];
};

type SchedulePeriod = { id: string; label: string; startDay: number; endDay: number };

type ScheduleAnchor = { type?: string; at: string };

type ScheduleMeta = {
  anchor?: ScheduleAnchor;
  periods?: SchedulePeriod[];
  weekLengthDays?: number;
  [k: string]: any;
};

type ScheduleWeek = {
  weekNumber: number;
  label?: string;
  description?: string;
  gates: Gate[];
  sessions: ScheduleSession[];
};

type Schedule = { version: number; metadata?: ScheduleMeta; weeks: ScheduleWeek[] };

type Item = { id: string; title: string; icon: keyof typeof ICONS; how: string[]; why: string; progress?: string };

type Session = { id: string; time: string; title: string; items: Item[] };

type DoneState = Record<string, Record<string, boolean>>;

type OpenState =
  | { kind: "exercise"; sessionId: string; itemId: string }
  | { kind: "gate"; gateId: string };

const ICONS = {
  hand: Hand,
  bone: Bone,
  pendulum: Orbit,
  rotate: RotateCcw,
  thoraxUp: ArrowUpFromLine,
  scapula: Aperture,
  breath: Wind,
  sleep: Moon,
} as const;

const TEMPLATE_SCHEDULE: Schedule = {
  version: 1,
  metadata: {
    template: true,
    anchor: { type: "surgeryEnd", at: "2026-02-13T16:00:00+01:00" },
    weekLengthDays: 7,
    periods: [
      { id: "p0", label: "Week 0–2 (Protection)", startDay: 0, endDay: 13 },
      { id: "p1", label: "Week 3–4 (PROM)", startDay: 14, endDay: 27 },
    ],
  },
  weeks: [
    {
      weekNumber: 0,
      label: "Template",
      description: "Upload your schedule JSON (auto-saved).",
      gates: [
        {
          id: "pain-rules",
          title: "Pain rules met",
          detail: [
            "Rest pain target ≤ 3/10.",
            "During exercises max 6/10.",
            "Return to baseline within 30 minutes.",
          ],
        },
      ],
      sessions: [
        {
          id: "am",
          title: "Morning",
          timeOfDay: "08:00",
          exercises: [
            {
              id: "handpump",
              name: "Hand/wrist pump",
              purpose: "Promote circulation.",
              instructions: "Make a fist 20x\nSpread fingers 20x\nWrist circles 10 each direction",
            },
          ],
        },
      ],
    },
  ],
};

const SCHEDULE_STORAGE_KEY = "recovery_schedule_json_v1";
const DONE_STORAGE_KEY = "recovery_done_v2";
const SELECTED_WEEK_KEY = "recovery_selected_week_v1";
const GATES_STORAGE_KEY = "recovery_gates_v1";
const THEME_KEY = "recovery_theme_v1";

const pad2 = (n: number) => String(n).padStart(2, "0");
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
const fmtAt = (s?: string) => {
  if (!s) return "";
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return s;
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

function hash32(str: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function scheduleId(s: Schedule) {
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

function parseHHMM(t?: string | null) {
  if (!t) return NaN;
  const parts = t.trim().split(":");
  if (parts.length !== 2) return NaN;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  if (h < 0 || h > 23 || m < 0 || m > 59) return NaN;
  return h * 60 + m;
}

const clsx = (...v: Array<string | false | null | undefined>) => v.filter(Boolean).join(" ");

function iconFor(title: string): keyof typeof ICONS {
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

function normalizeMeta(raw: any): ScheduleMeta | undefined {
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

function getAnchorDate(schedule: Schedule) {
  const at = schedule.metadata?.anchor?.at;
  const d = at ? new Date(at) : new Date(NaN);
  if (Number.isFinite(d.getTime())) return d;
  const legacy = schedule.metadata?.surgeryStart;
  const d2 = typeof legacy === "string" ? new Date(legacy) : new Date(NaN);
  if (Number.isFinite(d2.getTime())) return d2;
  return new Date();
}

const postOpDay = (now: Date, anchor: Date) => Math.floor((now.getTime() - anchor.getTime()) / 86400000);

function activePeriod(meta: ScheduleMeta | undefined, day: number): SchedulePeriod | null {
  const ps = meta?.periods;
  if (!Array.isArray(ps) || !ps.length) return null;
  for (const p of ps) if (day >= p.startDay && day <= p.endDay) return p;
  return null;
}

function weekIndexFromDay(meta: ScheduleMeta | undefined, day: number) {
  const wlen = Number.isFinite(Number(meta?.weekLengthDays)) ? Number(meta?.weekLengthDays) : 7;
  return Math.floor(day / Math.max(1, wlen));
}

function normalizeSchedule(raw: any): Schedule | null {
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

function buildSessionsFromWeek(week: ScheduleWeek): Session[] {
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
        const id = (e.id || `${s.id}__${i}__${e.name || "exercise"}`)
          .trim()
          .toLowerCase()
          .replaceAll(" ", "-");
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

function loadSchedule(): Schedule {
  try {
    const raw = localStorage.getItem(SCHEDULE_STORAGE_KEY);
    if (!raw) return TEMPLATE_SCHEDULE;
    const parsed = JSON.parse(raw);
    return normalizeSchedule(parsed) ?? TEMPLATE_SCHEDULE;
  } catch {
    return TEMPLATE_SCHEDULE;
  }
}

const saveSchedule = (s: Schedule) => {
  try {
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(s));
  } catch {}
};

function emptyDone(sessions: Session[]): DoneState {
  const out: DoneState = {};
  for (const s of sessions) {
    out[s.id] = {};
    for (const it of s.items) out[s.id][it.id] = false;
  }
  return out;
}

function loadDone(doneKey: string, sessions: Session[]): DoneState {
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

function saveDone(doneKey: string, done: DoneState) {
  try {
    const raw = localStorage.getItem(DONE_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, DoneState>) : {};
    parsed[doneKey] = done;
    localStorage.setItem(DONE_STORAGE_KEY, JSON.stringify(parsed));
  } catch {}
}

const emptyGateState = (gates: Gate[]) => Object.fromEntries(gates.map((g) => [g.id, false])) as Record<string, boolean>;

function loadGates(key: string, gates: Gate[]) {
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

function saveGates(key: string, state: Record<string, boolean>) {
  try {
    const raw = localStorage.getItem(GATES_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, Record<string, boolean>>) : {};
    parsed[key] = state;
    localStorage.setItem(GATES_STORAGE_KEY, JSON.stringify(parsed));
  } catch {}
}

function Tile({
  title,
  Icon,
  done,
  variant,
  onToggle,
  onInfo,
}: {
  title: string;
  Icon: React.ComponentType<{ className?: string }>;
  done: boolean;
  variant: "active" | "overdue" | "done";
  onToggle: () => void;
  onInfo: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      whileTap={{ scale: 0.985 }}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.12 }}
      className={clsx("tl", variant === "overdue" && "od", done && "dn")}
    >
      <div className="tli">
        <Icon className="h-5 w-5" />
      </div>
      <div className="tlt">{title}</div>
      <button
        type="button"
        className="ib"
        onClick={(e) => {
          e.stopPropagation();
          onInfo();
        }}
        aria-label="Details"
        title="Details"
      >
        <Info className="h-[18px] w-[18px]" />
      </button>
    </motion.button>
  );
}

function SessionDot({
  progress,
  doneAll,
  overdue,
  onClick,
  innerRef,
}: {
  progress: number;
  doneAll: boolean;
  overdue: boolean;
  onClick: () => void;
  innerRef?: (el: HTMLButtonElement | null) => void;
}) {
  const p = clamp(progress, 0, 1);
  const size = 20;
  const stroke = 2.2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ringColor = doneAll ? "var(--ok)" : overdue ? "var(--wa)" : "var(--ac)";

  return (
    <motion.button
      ref={innerRef as any}
      type="button"
      className="db"
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      whileHover={{ scale: 1.04 }}
      transition={{ duration: 0.14 }}
      aria-label="Toggle session"
      title="Toggle session"
    >
      <svg className="ds" viewBox="0 0 20 20" aria-hidden>
        <circle cx="10" cy="10" r={r} className="dt" strokeWidth={stroke} />
        <motion.circle
          cx="10"
          cy="10"
          r={r}
          className="dr"
          stroke={ringColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - p) }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: "50% 50%", transform: "rotate(-90deg)" }}
        />
      </svg>
      <motion.span
        className={clsx("dc", doneAll && "dcd", overdue && !doneAll && "dco")}
        animate={doneAll ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={{ duration: 0.45 }}
      />
    </motion.button>
  );
}

export default function App() {
  const [schedule, setSchedule] = useState<Schedule>(() => (typeof window === "undefined" ? TEMPLATE_SCHEDULE : loadSchedule()));
  const [dm, setDm] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) === "d";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, dm ? "d" : "l");
    } catch {}
  }, [dm]);
  useEffect(() => saveSchedule(schedule), [schedule]);

  const weeks = useMemo(() => schedule.weeks.slice().sort((a, b) => a.weekNumber - b.weekNumber), [schedule]);
  const schedId = useMemo(() => scheduleId(schedule), [schedule]);

  const [now, setNow] = useState<Date>(() => new Date());
  const anchor = useMemo(() => getAnchorDate(schedule), [schedule]);
  const day = useMemo(() => postOpDay(now, anchor), [now, anchor]);
  const period = useMemo(() => activePeriod(schedule.metadata, day), [schedule, day]);
  const a = schedule.metadata?.anchor;
  const aTxt = a?.at ? fmtAt(a.at) : "(missing)";

  const autoWeek = useMemo(() => {
    const idx = weekIndexFromDay(schedule.metadata, day);
    const minW = weeks[0]?.weekNumber ?? 0;
    const maxW = weeks[weeks.length - 1]?.weekNumber ?? minW;
    return clamp(idx, minW, maxW);
  }, [schedule, day, weeks]);

  const [selectedWeek, setSelectedWeek] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const raw = localStorage.getItem(SELECTED_WEEK_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : autoWeek;
  });

  useEffect(() => {
    setSelectedWeek((w) => {
      const minW = weeks[0]?.weekNumber ?? 0;
      const maxW = weeks[weeks.length - 1]?.weekNumber ?? minW;
      return clamp(Number.isFinite(w) ? w : autoWeek, minW, maxW);
    });
  }, [autoWeek, weeks]);

  useEffect(() => {
    try {
      localStorage.setItem(SELECTED_WEEK_KEY, String(selectedWeek));
    } catch {}
  }, [selectedWeek]);

  const week = useMemo(() => weeks.find((w) => w.weekNumber === selectedWeek) ?? weeks[0], [weeks, selectedWeek]);
  const sessions = useMemo(() => buildSessionsFromWeek(week), [week]);

  const doneKey = useMemo(() => `${schedId}|${todayKey()}|w${week.weekNumber}`, [schedId, week.weekNumber]);
  const [done, setDone] = useState<DoneState>(() => (typeof window === "undefined" ? emptyDone(sessions) : loadDone(doneKey, sessions)));

  const gates = useMemo(() => week.gates ?? [], [week]);
  const gateKey = useMemo(() => `${schedId}|w${week.weekNumber}`, [schedId, week.weekNumber]);
  const [gateDone, setGateDone] = useState<Record<string, boolean>>(() =>
    typeof window === "undefined" ? emptyGateState(gates) : loadGates(gateKey, gates)
  );

  const [gatesOpen, setGatesOpen] = useState(false);
  useEffect(() => setGatesOpen(false), [week.weekNumber]);

  const [open, setOpen] = useState<OpenState | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const dotRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [dotPos, setDotPos] = useState<Record<string, number>>({});

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => setDone(loadDone(doneKey, sessions)), [doneKey, sessions]);
  useEffect(() => saveDone(doneKey, done), [doneKey, done]);
  useEffect(() => setGateDone(loadGates(gateKey, gates)), [gateKey, gates]);
  useEffect(() => saveGates(gateKey, gateDone), [gateKey, gateDone]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const cr = el.getBoundingClientRect();
      const next: Record<string, number> = {};
      for (const s of sessions) {
        const btn = dotRefs.current[s.id];
        if (!btn) continue;
        const r = btn.getBoundingClientRect();
        next[s.id] = r.top - cr.top + r.height / 2;
      }
      setDotPos(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [done, open, sessions, gates]);

  const totals = useMemo(() => {
    const out: Record<string, { done: number; total: number; progress: number }> = {};
    for (const s of sessions) {
      const total = s.items.length;
      const d = s.items.reduce((acc, it) => acc + (done[s.id]?.[it.id] ? 1 : 0), 0);
      out[s.id] = { done: d, total, progress: total ? d / total : 0 };
    }
    return out;
  }, [done, sessions]);

  const gateProgress = useMemo(() => {
    const total = gates.length;
    const d = gates.reduce((acc, g) => acc + (gateDone[g.id] ? 1 : 0), 0);
    return { done: d, total, pct: total ? d / total : 0 };
  }, [gates, gateDone]);

  const timePoints = useMemo(() => {
    const pts = sessions
      .map((s) => {
        const t = parseHHMM(s.time);
        const y = dotPos[s.id];
        return Number.isFinite(t) && Number.isFinite(y) ? { id: s.id, t: t as number, y } : null;
      })
      .filter(Boolean) as Array<{ id: string; t: number; y: number }>;
    pts.sort((a, b) => a.t - b.t);
    return pts;
  }, [sessions, dotPos]);

  const firstT = useMemo(() => (timePoints.length ? timePoints[0].t : 0), [timePoints]);
  const lastT = useMemo(() => (timePoints.length ? timePoints[timePoints.length - 1].t : 24 * 60 - 1), [timePoints]);

  const nowY = useMemo(() => {
    if (!timePoints.length) return 12;
    const t = clamp(minutesOfDay(now), firstT, lastT);
    if (t <= timePoints[0].t) return timePoints[0].y;
    if (t >= timePoints[timePoints.length - 1].t) return timePoints[timePoints.length - 1].y;
    for (let i = 0; i < timePoints.length - 1; i++) {
      const a = timePoints[i];
      const b = timePoints[i + 1];
      if (t >= a.t && t <= b.t) {
        const pct = (t - a.t) / Math.max(1e-6, b.t - a.t);
        return a.y + pct * (b.y - a.y);
      }
    }
    return timePoints[0].y;
  }, [now, timePoints, firstT, lastT]);

  const toggleItem = (sessionId: string, itemId: string) =>
    setDone((p) => ({ ...p, [sessionId]: { ...p[sessionId], [itemId]: !p[sessionId]?.[itemId] } }));

  const toggleSession = (sessionId: string) => {
    const s = sessions.find((x) => x.id === sessionId);
    if (!s) return;
    setDone((p) => {
      const allDone = s.items.every((it) => Boolean(p[sessionId]?.[it.id]));
      const next: DoneState = { ...p, [sessionId]: { ...p[sessionId] } };
      for (const it of s.items) next[sessionId][it.id] = !allDone;
      return next;
    });
  };

  const toggleGate = (gateId: string) => setGateDone((p) => ({ ...p, [gateId]: !p[gateId] }));

  const isOverdue = (sessionId: string) => {
    const t = minutesOfDay(now);
    const s = sessions.find((x) => x.id === sessionId);
    if (!s) return false;
    const st = parseHHMM(s.time);
    if (!Number.isFinite(st)) return false;
    const tot = totals[sessionId];
    return t > st + 10 && tot.done < tot.total;
  };

  const onUpload = (file: File) => {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const parsed = JSON.parse(String(fr.result ?? ""));
        const norm = normalizeSchedule(parsed);
        if (norm) setSchedule(norm);
      } catch {}
    };
    fr.readAsText(file);
  };

  const resetToday = () => {
    setDone(emptyDone(sessions));
    setOpen(null);
  };

  const gateById = useMemo(() => new Map(gates.map((g) => [g.id, g] as const)), [gates]);

  return (
    <div className={clsx("app", dm && "d")}>
      <style>{css}</style>

      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.currentTarget.value = "";
        }}
      />

      <div className="wrap">
        <div className="top">
          <div>
            <div className="h1">Timeline</div>
          </div>

          <div className="topr">
            <motion.button type="button" whileTap={{ scale: 0.98 }} className="tb" onClick={() => setDm((v) => !v)} aria-label="Toggle dark mode" title="Theme">
              <motion.span className="tk" animate={{ x: dm ? 26 : 0 }} transition={{ duration: 0.18 }} />
              <Sun className={clsx("ti", dm && "off")} />
              <Moon className={clsx("ti", !dm && "off")} />
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              className="ib"
              onClick={() => fileRef.current?.click()}
              title="Upload"
              aria-label="Upload"
            >
              <Upload className="h-4 w-4" />
            </motion.button>
            <div className="mut">{todayKey()}</div>
          </div>
        </div>

        <div className="pnl ph">
          <div className="phl">
            <div className="cap">Post-op day</div>
            <div className="num">{day}</div>
            {period ? (
              <>
                <div className="dot" />
                <div className="cap">Phase</div>
                <div className="mut">{period.label}</div>
              </>
            ) : null}
          </div>
          <div className="fnt">
            Anchor: <span className="ak" title={a?.at}>{aTxt}</span>
            {a?.type ? <span className="atk"> · {a.type}</span> : null}
          </div>
        </div>

        <div className="weekbar">
          {weeks.map((w) => {
            const active = w.weekNumber === selectedWeek;
            const isAuto = w.weekNumber === autoWeek;
            return (
              <button
                key={w.weekNumber}
                type="button"
                className={clsx("weekpill", active && "weekpill-on")}
                onClick={() => setSelectedWeek(w.weekNumber)}
              >
                <span className="weekpill-t">{w.weekNumber}</span>
                {isAuto && <span className="weekpill-dot" aria-hidden />}
              </button>
            );
          })}
        </div>

        <div className="wk">
          <div className="cap">{week.label ?? `Week ${week.weekNumber}`}</div>
          {week.description ? <div className="sub">{week.description}</div> : null}
        </div>

        <div className="pnl gt">
          <button type="button" className="gth" onClick={() => setGatesOpen((v) => !v)} aria-expanded={gatesOpen}>
            <div className="cap">Criteria gates</div>
            <div className="gtr">
              <div className="gpm">
                <span className="numS">
                  {gateProgress.done}/{gateProgress.total}
                </span>
                <div className="gpb">
                  <motion.div
                    className="gpf"
                    animate={{ width: `${Math.round(gateProgress.pct * 100)}%` }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>
              <ChevronDown className={clsx("car", gatesOpen && "carOn")} />
            </div>
          </button>

          <AnimatePresence initial={false}>
            {gatesOpen && (
              <motion.div
                className="gtb"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {!gates.length ? (
                  <div className="sub">No gates in this week.</div>
                ) : (
                  <div className="gtl">
                    {gates.map((g) => {
                      const on = Boolean(gateDone[g.id]);
                      return (
                        <div key={g.id} className={clsx("gr", on && "grOn")}>
                          <button type="button" className="gm" onClick={() => toggleGate(g.id)}>
                            <span className={clsx("gc", on && "gcOn")} aria-hidden />
                            <span className="gtx">{g.title}</span>
                          </button>
                          <button
                            type="button"
                            className="ib"
                            onClick={() => setOpen({ kind: "gate", gateId: g.id })}
                            aria-label="Gate details"
                            title="Details"
                          >
                            <Info className="h-[18px] w-[18px]" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div ref={containerRef} className="tlw">
          <div className="rail" aria-hidden />
          <motion.div className="rail-fill" aria-hidden animate={{ height: nowY }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
          <motion.div className="now-dot" aria-hidden animate={{ top: nowY }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />

          <div className="sp">
            {sessions.map((s) => {
              const tot = totals[s.id] ?? { done: 0, total: 0, progress: 0 };
              const overdue = isOverdue(s.id);
              return (
                <div key={s.id} className="row">
                  <div className="row-rail">
                    <SessionDot
                      progress={tot.progress}
                      doneAll={tot.done === tot.total}
                      overdue={overdue}
                      onClick={() => toggleSession(s.id)}
                      innerRef={(el) => {
                        dotRefs.current[s.id] = el;
                      }}
                    />
                  </div>

                  <div className="cnt">
                    <div className="hdr">
                      <div className="rt">{s.time || ""}</div>
                      <div className="st">{s.title}</div>
                    </div>
                    <div className="grid">
                      {s.items.map((it) => {
                        const Icon = ICONS[it.icon];
                        const doneIt = Boolean(done[s.id]?.[it.id]);
                        const variant: "active" | "overdue" | "done" = doneIt ? "done" : overdue ? "overdue" : "active";
                        return (
                          <Tile
                            key={it.id}
                            title={it.title}
                            Icon={Icon}
                            done={doneIt}
                            variant={variant}
                            onToggle={() => toggleItem(s.id, it.id)}
                            onInfo={() => setOpen({ kind: "exercise", sessionId: s.id, itemId: it.id })}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="fab">
          <motion.button type="button" onClick={resetToday} whileTap={{ scale: 0.98 }} className="rb" aria-label="Reset today">
            <RefreshCcw className="h-4 w-4" />
            Reset
          </motion.button>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              className="sw"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(null)}
            >
              <motion.div
                initial={{ y: 16, opacity: 0, scale: 0.99 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 12, opacity: 0, scale: 0.99 }}
                transition={{ duration: 0.18 }}
                onClick={(e) => e.stopPropagation()}
                className="sh"
              >
                <div className="gh" />
                {open.kind === "exercise" ? (
                  (() => {
                    const s = sessions.find((x) => x.id === open.sessionId)!;
                    const it = s.items.find((x) => x.id === open.itemId)!;
                    return (
                      <div className="p">
                        <div className="shTop">
                          <div>
                            <div className="shT">{it.title}</div>
                            <div className="mut">
                              {s.title}
                              {s.time ? ` · ${s.time}` : ""}
                            </div>
                          </div>
                          <motion.button type="button" whileTap={{ scale: 0.98 }} className="rb" onClick={() => setOpen(null)}>
                            Close
                          </motion.button>
                        </div>

                        <div className="cg">
                          <div className="card">
                            <div className="cap">How</div>
                            <ul className="list">
                              {it.how.map((x) => (
                                <li key={x}>{x}</li>
                              ))}
                            </ul>
                          </div>
                          {it.why ? (
                            <div className="card">
                              <div className="cap">Why</div>
                              <div className="tx">{it.why}</div>
                            </div>
                          ) : null}
                          {it.progress ? (
                            <div className="card">
                              <div className="cap">Progression</div>
                              <div className="tx">{it.progress}</div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  (() => {
                    const g = gateById.get(open.gateId);
                    if (!g) return null;
                    return (
                      <div className="p">
                        <div className="shTop">
                          <div>
                            <div className="shT">{g.title}</div>
                            <div className="mut">Week {week.weekNumber}</div>
                          </div>
                          <motion.button type="button" whileTap={{ scale: 0.98 }} className="rb" onClick={() => setOpen(null)}>
                            Close
                          </motion.button>
                        </div>
                        <div className="cg">
                          <div className="card">
                            <div className="cap">Checklist</div>
                            <ul className="list">
                              {g.detail.map((x) => (
                                <li key={x}>{x}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const css = `
.app{
  cursor:default;
}
.app button{cursor:pointer}
.app button:disabled{cursor:default}

.app{
  --ac:#0a84ff;--ok:#34c759;--wa:#ff9f0a;
  --tx:rgba(0,0,0,.88);--txm:rgba(0,0,0,.62);--txf:rgba(0,0,0,.46);
  --s1:rgba(255,255,255,.56);--s2:rgba(255,255,255,.72);
  --bd:rgba(0,0,0,.08);--bd2:rgba(0,0,0,.12);
  --sh:0 10px 30px rgba(0,0,0,.10);
  --r:18px;--rail-col:34px;--rail-x:17px;
  min-height:100vh;width:100%;color:var(--tx);
  font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;
  background:
    radial-gradient(900px 600px at 15% 0%, rgba(10,132,255,.18), transparent 60%),
    radial-gradient(900px 600px at 90% 10%, rgba(255,45,85,.10), transparent 55%),
    radial-gradient(1000px 700px at 50% 100%, rgba(52,199,89,.10), transparent 55%),
    linear-gradient(180deg,#f7f9ff,#f2f4f8);
}

.app.d{
  --tx:rgba(255,255,255,.92);--txm:rgba(255,255,255,.72);--txf:rgba(255,255,255,.52);
  --s1:rgba(22,26,36,.58);--s2:rgba(30,36,50,.76);
  --bd:rgba(255,255,255,.10);--bd2:rgba(255,255,255,.16);
  --sh:0 10px 30px rgba(0,0,0,.45);
  background:
    radial-gradient(900px 600px at 15% 0%, rgba(10,132,255,.22), transparent 62%),
    radial-gradient(900px 600px at 90% 10%, rgba(255,45,85,.14), transparent 58%),
    radial-gradient(1000px 700px at 50% 100%, rgba(52,199,89,.14), transparent 58%),
    linear-gradient(180deg,#0b1020,#070913);
}
.app.d .pnl:before{opacity:.18;background:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,0))}

.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}

.wrap{max-width:980px;margin:0 auto;padding:22px 16px 120px}
.top{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:14px}
.topr{display:flex;align-items:center;gap:10px}
.h1{font-size:30px;font-weight:760;letter-spacing:-.02em}
.sub{font-size:14px;color:var(--txm)}
.mut{font-size:14px;color:var(--txm)}
.fnt{font-size:12px;color:var(--txf);margin-top:8px}
.ak{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;border:1px solid var(--bd);background:color-mix(in srgb,var(--s2) 65%,transparent);color:var(--txm);font-variant-numeric:tabular-nums}
.atk{color:var(--txf)}
.cap{font-size:12px;font-weight:760;letter-spacing:.10em;text-transform:uppercase;color:var(--txf)}
.num{font-size:14px;font-weight:760;font-variant-numeric:tabular-nums}
.numS{font-size:13px;font-weight:760;font-variant-numeric:tabular-nums}
.dot{width:5px;height:5px;border-radius:999px;background:color-mix(in srgb,var(--ac) 30%,transparent)}

.pnl{position:relative;border-radius:var(--r);border:1px solid var(--bd);background:var(--s1);box-shadow:var(--sh);backdrop-filter:blur(18px) saturate(1.2);-webkit-backdrop-filter:blur(18px) saturate(1.2)}
.pnl:before{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(180deg,rgba(255,255,255,.85),rgba(255,255,255,0));opacity:.38;pointer-events:none}
.ph{padding:12px 14px;margin-bottom:10px}
.phl{display:flex;flex-wrap:wrap;align-items:center;gap:10px}

.weekbar{display:flex;gap:10px;overflow:auto;padding:8px 2px;scrollbar-width:none}
.weekbar::-webkit-scrollbar{display:none}
.weekpill{position:relative;min-width:44px;height:34px;border-radius:999px;border:1px solid var(--bd);background:color-mix(in srgb,var(--s1) 70%,transparent);color:var(--txm);font-weight:800;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);touch-action:manipulation}
.weekpill-on{background:var(--s2);border-color:var(--bd2);color:var(--tx)}
.weekpill-dot{position:absolute;right:8px;top:7px;width:7px;height:7px;border-radius:999px;background:color-mix(in srgb,var(--ac) 75%,white 25%);box-shadow:0 0 0 5px rgba(10,132,255,.10)}
.weekpill-t{font-variant-numeric:tabular-nums}
.wk{margin:12px 0 6px}

.ib{width:36px;height:36px;border-radius:14px;display:grid;place-items:center;border:1px solid var(--bd);background:var(--s1);color:var(--txm);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 6px 18px rgba(0,0,0,.08);touch-action:manipulation}
.ib:hover{border-color:var(--bd2);color:var(--tx)}

.tb{position:relative;width:62px;height:36px;border-radius:999px;border:1px solid var(--bd);background:var(--s1);backdrop-filter:blur(14px) saturate(1.2);-webkit-backdrop-filter:blur(14px) saturate(1.2);box-shadow:0 6px 18px rgba(0,0,0,.08);display:flex;align-items:center;justify-content:space-between;padding:0 10px;touch-action:manipulation}
.tk{position:absolute;top:4px;left:4px;width:28px;height:28px;border-radius:999px;background:var(--s2);border:1px solid var(--bd);box-shadow:0 10px 24px rgba(0,0,0,.12);z-index:0}
.ti{width:16px;height:16px;z-index:1;color:var(--txm);transition:opacity .12s ease}
.ti.off{opacity:.35}

.gt{margin-top:12px;padding:12px 14px}
.gth{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;background:transparent;border:none;padding:0;text-align:left;cursor:pointer;touch-action:manipulation}
.gtr{display:flex;align-items:center;gap:10px}
.car{width:18px;height:18px;color:var(--txm);transition:transform .16s ease}
.carOn{transform:rotate(180deg)}
.gtb{overflow:hidden}
.gtl{margin-top:10px;display:grid}
.gr{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid var(--bd)}
.grOn{border-top-color:color-mix(in srgb,var(--ok) 20%,var(--bd))}
.gm{display:flex;align-items:center;gap:10px;min-width:0;text-align:left;flex:1;background:transparent;border:none;padding:0;color:inherit;touch-action:manipulation}
.gc{width:14px;height:14px;border-radius:999px;border:1px solid var(--bd2);background:transparent;flex:0 0 auto}
.gcOn{border-color:color-mix(in srgb,var(--ok) 55%,var(--bd2));background:color-mix(in srgb,var(--ok) 70%,white 30%)}
.gtx{font-weight:720;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gpm{display:flex;align-items:center;gap:10px}
.gpb{width:120px;height:8px;border-radius:999px;background:color-mix(in srgb,var(--bd) 70%,transparent);overflow:hidden}
.gpf{height:100%;border-radius:999px;background:linear-gradient(90deg,color-mix(in srgb,var(--ac) 80%,white 20%),color-mix(in srgb,var(--ac) 50%,white 50%))}

.tlw{position:relative;margin-top:16px}
.rail{position:absolute;left:var(--rail-x);top:0;bottom:0;width:2px;transform:translateX(-50%);border-radius:999px;background:color-mix(in srgb,var(--bd2) 55%,transparent)}
.rail-fill{position:absolute;left:var(--rail-x);top:0;width:2px;transform:translateX(-50%);border-radius:999px;background:linear-gradient(180deg,color-mix(in srgb,var(--ac) 22%,transparent),color-mix(in srgb,var(--ac) 48%,transparent));pointer-events:none}
.now-dot{position:absolute;left:var(--rail-x);width:7px;height:7px;transform:translate(-50%,-50%);border-radius:999px;background:color-mix(in srgb,var(--ac) 85%,white 15%);box-shadow:0 0 0 6px rgba(10,132,255,.10);z-index:4;pointer-events:none}

.sp{display:grid;gap:40px}
.row{display:grid;grid-template-columns:var(--rail-col) minmax(0,1fr);gap:14px;align-items:start}
.row-rail{position:relative;width:var(--rail-col);min-height:30px}
.cnt{min-width:0}
.hdr{display:flex;align-items:baseline;gap:12px;min-width:0;margin:0 0 10px}
.rt{font-size:26px;font-weight:720;letter-spacing:-.02em;color:var(--tx);line-height:1.05;font-variant-numeric:tabular-nums;flex:0 0 auto}
.st{font-size:14px;font-weight:650;color:var(--txm);min-width:0;flex:1;line-height:1.25;overflow-wrap:anywhere}
.grid{display:grid;gap:12px}
@media (min-width:640px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (min-width:1024px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}}

.db{position:absolute;left:calc(var(--rail-x) - 10px);top:4px;width:20px;height:20px;border-radius:999px;display:grid;place-items:center;background:transparent;border:none;padding:0;z-index:3;touch-action:manipulation}
.ds{position:absolute;inset:0}
.dt{fill:none;stroke:color-mix(in srgb,var(--bd2) 55%,transparent)}
.dr{fill:none}
.dc{position:absolute;inset:4px;border-radius:999px;background:var(--s2);border:1px solid var(--bd);box-shadow:0 2px 10px rgba(0,0,0,.06)}
.dcd{border-color:color-mix(in srgb,var(--ok) 28%,var(--bd2))}
.dco{border-color:color-mix(in srgb,var(--wa) 26%,var(--bd2))}

.tl{display:flex;align-items:center;gap:12px;min-height:62px;padding:12px;border-radius:18px;border:1px solid var(--bd);background:var(--s1);backdrop-filter:blur(16px) saturate(1.2);-webkit-backdrop-filter:blur(16px) saturate(1.2);box-shadow:0 10px 26px rgba(0,0,0,.08);touch-action:manipulation}
.tl:hover{border-color:var(--bd2)}
.tl.od{border-color:color-mix(in srgb,var(--wa) 45%,var(--bd2))}
.tl.dn{opacity:.62;box-shadow:0 6px 16px rgba(0,0,0,.06)}
.tli{width:36px;height:36px;border-radius:14px;display:grid;place-items:center;border:1px solid var(--bd);background:color-mix(in srgb,var(--s2) 70%,transparent);color:var(--txm);flex:0 0 auto}
.tlt{flex:1;min-width:0;font-weight:720;letter-spacing:-.01em;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.fab{position:fixed;right:18px;bottom:18px}
.rb{display:flex;align-items:center;gap:10px;border-radius:18px;border:1px solid var(--bd);background:var(--s2);backdrop-filter:blur(18px) saturate(1.2);-webkit-backdrop-filter:blur(18px) saturate(1.2);color:var(--tx);padding:12px 14px;font-weight:740;box-shadow:0 14px 34px rgba(0,0,0,.12);touch-action:manipulation}

.sw{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.22);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:flex;align-items:flex-end;justify-content:center;padding:14px}
.sh{width:min(680px,100%);border-radius:26px;border:1px solid var(--bd);background:var(--s2);backdrop-filter:blur(22px) saturate(1.2);-webkit-backdrop-filter:blur(22px) saturate(1.2);box-shadow:0 24px 70px rgba(0,0,0,.20)}
.gh{width:46px;height:5px;border-radius:999px;background:color-mix(in srgb,var(--bd2) 55%,transparent);margin:10px auto 0}
.p{padding:16px 16px 18px}
.shTop{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.shT{font-size:18px;font-weight:760;letter-spacing:-.01em}
.cg{margin-top:14px;display:grid;gap:12px}
.card{border-radius:18px;border:1px solid var(--bd);background:color-mix(in srgb,var(--s1) 70%,transparent);padding:14px}
.tx{margin-top:8px;color:var(--tx);line-height:1.5;font-size:14px}
.list{margin-top:8px;padding-left:18px;color:var(--tx);line-height:1.5;font-size:14px}
.list li{margin:6px 0}

@media (max-width:760px){.row{gap:12px}.rt{font-size:23px}}
@media (max-width:420px){.hdr{flex-wrap:wrap}.st{flex-basis:100%}}
@media (prefers-reduced-motion:reduce){.car,.weekpill-dot{transition:none}}
`;
