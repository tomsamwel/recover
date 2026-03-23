import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  TEMPLATE_SCHEDULE,
  activePeriod,
  loadDefaultSchedule,
  loadDefaultScheduleManifest,
  parseHHMM,
  parseSchedule,
  weekIndexFromDay,
  PREFERRED_DEFAULT_SCHEDULE_ID,
} from "./domain/schedule";
import type { DefaultScheduleEntry, Schedule } from "./domain/schedule";
import { GateChecklist } from "./app/components/GateChecklist";
import { ScheduleHeader } from "./app/components/ScheduleHeader";
import { SessionTimeline } from "./app/components/SessionTimeline";
import {
  buildSessionsFromWeek,
  emptyDone,
  emptyGateState,
  fmtAt,
  loadDone,
  loadGates,
  loadSchedule,
  minutesOfDay,
  saveDone,
  saveGates,
  saveSchedule,
  scheduleId,
  type DoneState,
} from "./app/scheduleViewModel";
import { migrateLocalState } from "./app/storage/migrate";
import { SCHEDULE_STORAGE_KEY, SELECTED_WEEK_KEY, THEME_KEY } from "./app/storage/keys";
import {
  calendarDayDiff,
  loadManualSurgeryDateOverride,
  normalizeDateOnly,
  resolveSurgeryDate,
  saveManualSurgeryDateOverride,
} from "./app/surgeryDate";
import { attachTimelineMeasurement, scheduleTimelineMeasurement } from "./app/timelineMeasurement";
import { useNowMinute } from "./app/useNowMinute";
import {
  Hand,
  Bone,
  Orbit,
  RotateCcw,
  ArrowUpFromLine,
  Aperture,
  Wind,
  Moon,
  Info,
  RefreshCcw,
  PencilRuler,
  Timer,
  Sun,
  X,
} from "lucide-react";

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

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

const clsx = (...v: Array<string | false | null | undefined>) => v.filter(Boolean).join(" ");

const ScheduleEditorPage = React.lazy(async () => {
  const mod = await import("./app/components/ScheduleEditorPage");
  return { default: mod.ScheduleEditorPage };
});

function sameDotPositions(a: Record<string, number>, b: Record<string, number>) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (Math.abs(a[key] - b[key]) > 0.25) return false;
  }
  return true;
}

function dayKeyFromDate(d: Date) {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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
    <motion.div
      layout
      className={clsx("exerciseTile", variant === "overdue" && "exerciseTileOverdue", done && "exerciseTileDone")}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.16 }}
    >
      <motion.button type="button" className="exerciseToggle" onClick={onToggle} whileTap={{ scale: 0.99 }} aria-pressed={done}>
        <span className="exerciseIcon">
          <Icon className="exerciseIconSvg" />
        </span>
        <span className="exerciseText">
          <span className="exerciseTitle">{title}</span>
          <span className={clsx("exerciseState", done && "exerciseStateDone", variant === "overdue" && !done && "exerciseStateOverdue")}>
            {done ? "Completed" : variant === "overdue" ? "Needs attention" : "Ready"}
          </span>
        </span>
      </motion.button>
      <button
        type="button"
        className="infoButton exerciseInfoButton"
        onClick={onInfo}
        aria-label={`Open exercise details for ${title}`}
        title="Details"
      >
        <Info className="infoButtonIcon" />
      </button>
    </motion.div>
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
  const size = 24;
  const stroke = 2.4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ringColor = doneAll ? "var(--color-success)" : overdue ? "var(--color-warning)" : "var(--color-accent)";

  return (
    <motion.button
      ref={innerRef as never}
      type="button"
      className="sessionDot"
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      whileHover={{ scale: 1.04 }}
      transition={{ duration: 0.14 }}
      aria-label="Toggle session"
      title="Toggle session"
    >
      <svg className="sessionDotSvg" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r={r} className="sessionDotTrack" strokeWidth={stroke} />
        <motion.circle
          cx="12"
          cy="12"
          r={r}
          className="sessionDotRing"
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
        className={clsx("sessionDotCore", doneAll && "sessionDotCoreDone", overdue && !doneAll && "sessionDotCoreOverdue")}
        animate={doneAll ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={{ duration: 0.45 }}
      />
    </motion.button>
  );
}

export default function App() {
  const [schedule, setSchedule] = useState<Schedule>(() =>
    typeof window === "undefined"
      ? TEMPLATE_SCHEDULE
      : loadSchedule(TEMPLATE_SCHEDULE, (parsed) => {
          const result = parseSchedule(parsed);
          return result.ok ? result.value : null;
        })
  );
  const [dm, setDm] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) === "d";
    } catch {
      return false;
    }
  });
  const [defaultSchedules, setDefaultSchedules] = useState<DefaultScheduleEntry[]>([]);
  const [page, setPage] = useState<"timeline" | "editor">(() =>
    typeof window !== "undefined" && window.location.hash === "#/editor" ? "editor" : "timeline"
  );
  const [selectedDefaultId, setSelectedDefaultId] = useState("");
  const [defaultMenuOpen, setDefaultMenuOpen] = useState(false);
  const [defaultState, setDefaultState] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  const hadSavedScheduleOnBootRef = useRef<boolean>(
    typeof window !== "undefined" ? Boolean(localStorage.getItem(SCHEDULE_STORAGE_KEY)) : false
  );

  useEffect(() => {
    migrateLocalState();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, dm ? "d" : "l");
    } catch {
      // Ignore localStorage failures.
    }
  }, [dm]);

  useEffect(() => saveSchedule(schedule), [schedule]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextHash = page === "editor" ? "#/editor" : "#/timeline";
    if (window.location.hash !== nextHash) window.history.replaceState(null, "", nextHash);
  }, [page]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onHashChange = () => setPage(window.location.hash === "#/editor" ? "editor" : "timeline");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    loadDefaultScheduleManifest()
      .then((entries) => {
        if (cancelled) return;
        setDefaultSchedules(entries);

        const preferred = entries.find((x) => x.id === PREFERRED_DEFAULT_SCHEDULE_ID) ?? entries[0];
        if (!preferred) return;

        setSelectedDefaultId((cur) => cur || preferred.id);

        if (!hadSavedScheduleOnBootRef.current) {
          loadDefaultSchedule(preferred)
            .then((next) => {
              if (!cancelled) setSchedule(next);
            })
            .catch((err: unknown) => {
              if (!cancelled) {
                setDefaultState((prev) => ({
                  ...prev,
                  error: err instanceof Error ? err.message : "Failed to load default schedule.",
                }));
              }
            });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDefaultState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : "Failed to load default schedules.",
        }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const defaultsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!defaultMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const node = defaultsRef.current;
      if (!node) return;
      if (!node.contains(e.target as Node)) setDefaultMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [defaultMenuOpen]);

  const weeks = useMemo(() => schedule.weeks.slice().sort((a, b) => a.weekNumber - b.weekNumber), [schedule]);
  const schedId = useMemo(() => scheduleId(schedule), [schedule]);

  const now = useNowMinute();
  const todayLabel = useMemo(() => dayKeyFromDate(now), [now]);
  const [manualSurgeryDate, setManualSurgeryDate] = useState<string | null>(() =>
    typeof window === "undefined" ? null : loadManualSurgeryDateOverride()
  );
  const resolvedSurgeryDate = useMemo(
    () =>
      resolveSurgeryDate({
        manualSelection: manualSurgeryDate,
        scheduleAnchorAt: schedule.metadata?.anchor?.at,
        scheduleSurgeryStart: typeof schedule.metadata?.surgeryStart === "string" ? schedule.metadata.surgeryStart : null,
        now,
      }),
    [manualSurgeryDate, now, schedule.metadata?.anchor?.at, schedule.metadata?.surgeryStart]
  );
  const anchor = resolvedSurgeryDate.date;
  const day = useMemo(() => calendarDayDiff(now, anchor), [now, anchor]);
  const period = useMemo(() => activePeriod(schedule.metadata, day), [schedule, day]);
  const anchorLabel = schedule.metadata?.anchor?.at ? fmtAt(schedule.metadata.anchor.at) : "(missing)";

  useEffect(() => {
    saveManualSurgeryDateOverride(manualSurgeryDate);
  }, [manualSurgeryDate]);

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
    } catch {
      // Ignore localStorage failures.
    }
  }, [selectedWeek]);

  const week = useMemo(() => weeks.find((w) => w.weekNumber === selectedWeek) ?? weeks[0], [weeks, selectedWeek]);
  const sessions = useMemo(() => buildSessionsFromWeek(week), [week]);

  const doneKey = useMemo(() => `${schedId}|${todayLabel}|w${week.weekNumber}`, [schedId, todayLabel, week.weekNumber]);
  const [done, setDone] = useState<DoneState>(() => (typeof window === "undefined" ? emptyDone(sessions) : loadDone(doneKey, sessions)));

  const gates = useMemo(() => week.gates ?? [], [week]);
  const gateKey = useMemo(() => `${schedId}|w${week.weekNumber}`, [schedId, week.weekNumber]);
  const [gateDone, setGateDone] = useState<Record<string, boolean>>(() =>
    typeof window === "undefined" ? emptyGateState(gates) : loadGates(gateKey, gates)
  );

  const [gatesOpen, setGatesOpen] = useState(false);
  useEffect(() => setGatesOpen(false), [week.weekNumber]);

  const [open, setOpen] = useState<OpenState | null>(null);
  useEffect(() => setOpen(null), [page, week.weekNumber]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const dotRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [dotPos, setDotPos] = useState<Record<string, number>>({});

  const onSurgeryDateChange = useCallback((value: string) => {
    if (!value) {
      setManualSurgeryDate(null);
      return;
    }
    const normalized = normalizeDateOnly(value);
    if (!normalized) return;
    setManualSurgeryDate(normalized);
  }, []);

  const onClearSurgeryDateOverride = useCallback(() => setManualSurgeryDate(null), []);

  useEffect(() => setDone(loadDone(doneKey, sessions)), [doneKey, sessions]);
  useEffect(() => saveDone(doneKey, done), [doneKey, done]);
  useEffect(() => setGateDone(loadGates(gateKey, gates)), [gateKey, gates]);
  useEffect(() => saveGates(gateKey, gateDone), [gateKey, gateDone]);

  const measureDotPositions = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const cr = el.getBoundingClientRect();
    const next: Record<string, number> = {};
    for (const s of sessions) {
      const btn = dotRefs.current[s.id];
      if (!btn) continue;
      const r = btn.getBoundingClientRect();
      next[s.id] = r.top - cr.top + r.height / 2;
    }
    setDotPos((prev) => (sameDotPositions(prev, next) ? prev : next));
  }, [sessions]);

  useEffect(() => {
    if (page !== "timeline") {
      setDotPos({});
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    return attachTimelineMeasurement(el, measureDotPositions);
  }, [page, measureDotPositions]);

  useEffect(() => {
    if (page !== "timeline") return;
    return scheduleTimelineMeasurement(measureDotPositions);
  }, [page, measureDotPositions, done, open]);

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
        const t = parseHHMM(s.clockTime);
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

  const toggleItem = useCallback(
    (sessionId: string, itemId: string) =>
      setDone((p) => ({ ...p, [sessionId]: { ...p[sessionId], [itemId]: !p[sessionId]?.[itemId] } })),
    []
  );

  const toggleSession = useCallback(
    (sessionId: string) => {
      const s = sessions.find((x) => x.id === sessionId);
      if (!s) return;
      setDone((p) => {
        const allDone = s.items.every((it) => Boolean(p[sessionId]?.[it.id]));
        const next: DoneState = { ...p, [sessionId]: { ...p[sessionId] } };
        for (const it of s.items) next[sessionId][it.id] = !allDone;
        return next;
      });
    },
    [sessions]
  );

  const toggleGate = useCallback((gateId: string) => setGateDone((p) => ({ ...p, [gateId]: !p[gateId] })), []);

  const isOverdue = useCallback(
    (sessionId: string) => {
      const t = minutesOfDay(now);
      const s = sessions.find((x) => x.id === sessionId);
      if (!s) return false;
      const st = parseHHMM(s.clockTime);
      if (!Number.isFinite(st)) return false;
      const tot = totals[sessionId];
      return t > st + 10 && tot.done < tot.total;
    },
    [now, sessions, totals]
  );

  const [uploadError, setUploadError] = useState<string | null>(null);

  const onUpload = useCallback((file: File) => {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const parsed = JSON.parse(String(fr.result ?? ""));
        const result = parseSchedule(parsed);
        if (result.ok) {
          setSchedule(result.value);
          setUploadError(null);
        } else {
          setUploadError(result.errors[0] ?? "Invalid schedule JSON.");
        }
      } catch {
        setUploadError("Invalid JSON file.");
      }
    };
    fr.readAsText(file);
  }, []);

  const downloadSchedule = useCallback(() => {
    const blob = new Blob([JSON.stringify(schedule, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schedule-v${schedule.version}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [schedule]);

  const applyDefaultSchedule = useCallback(
    async (scheduleId?: string) => {
      const id = scheduleId ?? selectedDefaultId;
      const entry = defaultSchedules.find((x) => x.id === id);
      if (!entry) return;
      setDefaultState({ loading: true, error: null });
      try {
        const next = await loadDefaultSchedule(entry);
        setSchedule(next);
        setUploadError(null);
        setSelectedDefaultId(entry.id);
        setDefaultMenuOpen(false);
        setDefaultState({ loading: false, error: null });
      } catch (err: unknown) {
        setDefaultState({
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load default schedule.",
        });
      }
    },
    [defaultSchedules, selectedDefaultId]
  );

  const resetToday = useCallback(() => {
    setDone(emptyDone(sessions));
    setOpen(null);
  }, [sessions]);

  const showGateInfo = useCallback((gateId: string) => setOpen({ kind: "gate", gateId }), []);
  const setOpenExercise = useCallback((sessionId: string, itemId: string) => setOpen({ kind: "exercise", sessionId, itemId }), []);

  const gateById = useMemo(() => new Map(gates.map((g) => [g.id, g] as const)), [gates]);

  const exerciseDetail =
    open?.kind === "exercise"
      ? (() => {
          const session = sessions.find((x) => x.id === open.sessionId);
          const item = session?.items.find((x) => x.id === open.itemId);
          return session && item ? { session, item } : null;
        })()
      : null;

  const gateDetail = open?.kind === "gate" ? gateById.get(open.gateId) ?? null : null;

  return (
    <div className={clsx("recoverApp", dm && "themeDark")}>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="srOnly"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.currentTarget.value = "";
        }}
      />

      <div className="ambientBackdrop" aria-hidden />

      <div className="appShell">
        <aside className="contextRail">
          <motion.div
            className="railFrame"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="railTopbar">
              <div>
                <div className="brandKicker">Clinical recovery workspace</div>
                <h1 className="brandName">Recover</h1>
              </div>
              <div className="themeToggle" role="group" aria-label="Theme toggle">
                <button
                  type="button"
                  className={clsx("themeToggleButton", !dm && "themeToggleButtonActive")}
                  onClick={() => setDm(false)}
                  aria-label="Light theme"
                  title="Light theme"
                >
                  <Sun className="themeToggleIcon" />
                </button>
                <button
                  type="button"
                  className={clsx("themeToggleButton", dm && "themeToggleButtonActive")}
                  onClick={() => setDm(true)}
                  aria-label="Dark theme"
                  title="Dark theme"
                >
                  <Moon className="themeToggleIcon" />
                </button>
              </div>
            </div>

            <motion.div
              className="railHero"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="todayStamp">{todayLabel}</div>
              <p className="brandSummary">
                Track the rehab day, keep progression rules visible, and update the protocol without leaving the workspace.
              </p>
            </motion.div>

            <div className="pageTabs" role="tablist" aria-label="Pages">
              <button
                type="button"
                role="tab"
                aria-selected={page === "timeline"}
                className={clsx("pageTab", page === "timeline" && "pageTabActive")}
                onClick={() => setPage("timeline")}
              >
                <Timer className="pageTabIcon" />
                Timeline
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={page === "editor"}
                className={clsx("pageTab", page === "editor" && "pageTabActive")}
                onClick={() => setPage("editor")}
              >
                <PencilRuler className="pageTabIcon" />
                Editor
              </button>
            </div>

            <ScheduleHeader
              defaultsRef={defaultsRef}
              defaultMenuOpen={defaultMenuOpen}
              setDefaultMenuOpen={setDefaultMenuOpen}
              fileRef={fileRef}
              defaultSchedules={defaultSchedules}
              selectedDefaultId={selectedDefaultId}
              applyDefaultSchedule={applyDefaultSchedule}
              defaultState={defaultState}
              day={day}
              period={period}
              anchor={schedule.metadata?.anchor}
              anchorLabel={anchorLabel}
              surgeryDateValue={resolvedSurgeryDate.value}
              onSurgeryDateChange={onSurgeryDateChange}
              onClearSurgeryDateOverride={onClearSurgeryDateOverride}
              surgeryDateSource={resolvedSurgeryDate.source}
              weeks={weeks}
              selectedWeek={selectedWeek}
              autoWeek={autoWeek}
              setSelectedWeek={setSelectedWeek}
              week={week}
            />
          </motion.div>
        </aside>

        <main className="pageCanvas">
          {page === "timeline" ? (
            <div className="workspacePanel">
              <motion.section
                className="workspaceLead"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <div>
                  <div className="sectionLabel">Today&apos;s sequence</div>
                  <h2 className="workspaceTitle">{week.label ?? `Week ${week.weekNumber}`}</h2>
                  <p className="workspaceText">
                    {week.description || "Keep the day visible, finish each session, and confirm the gates before progression."}
                  </p>
                </div>
                <motion.button type="button" onClick={resetToday} whileTap={{ scale: 0.98 }} className="quietAction">
                  <RefreshCcw className="quietActionIcon" />
                  Reset checkmarks
                </motion.button>
              </motion.section>

              <GateChecklist
                gatesOpen={gatesOpen}
                setGatesOpen={setGatesOpen}
                gateProgress={gateProgress}
                gates={gates}
                gateDone={gateDone}
                toggleGate={toggleGate}
                showGateInfo={showGateInfo}
              />

              <section className="timelineSection" aria-label="Recovery timeline">
                <div className="timelineSectionHead">
                  <div>
                    <div className="sectionLabel">Timeline</div>
                    <h3 className="sectionTitle">Session flow</h3>
                  </div>
                </div>

                <SessionTimeline
                  containerRef={containerRef}
                  nowY={nowY}
                  sessions={sessions}
                  totals={totals}
                  isOverdue={isOverdue}
                  toggleSession={toggleSession}
                  dotRefs={dotRefs}
                  ICONS={ICONS}
                  done={done}
                  toggleItem={toggleItem}
                  setOpenExercise={setOpenExercise}
                  Tile={Tile}
                  SessionDot={SessionDot}
                />
              </section>
            </div>
          ) : (
            <Suspense fallback={<div className="workspacePanel loadingPanel">Loading editor...</div>}>
              <ScheduleEditorPage
                schedule={schedule}
                setSchedule={setSchedule}
                onOpenUpload={() => fileRef.current?.click()}
                onDownload={downloadSchedule}
                uploadError={uploadError}
              />
            </Suspense>
          )}
        </main>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="detailScrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(null)}
          >
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-labelledby="detail-sheet-title"
              className="detailSheet"
              initial={{ opacity: 0, x: 42, y: 24 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 42, y: 18 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="detailHandle" aria-hidden />
              <div className="detailHeader">
                <div>
                  <div className="sectionLabel">{open.kind === "exercise" ? "Exercise detail" : "Criteria gate"}</div>
                  <h2 id="detail-sheet-title" className="detailTitle">
                    {exerciseDetail?.item.title ?? gateDetail?.title ?? "Details"}
                  </h2>
                  <p className="detailMeta">
                    {exerciseDetail
                      ? `${exerciseDetail.session.title}${exerciseDetail.session.time ? ` · ${exerciseDetail.session.time}` : ""}`
                      : `Week ${week.weekNumber}`}
                  </p>
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  className="sheetClose"
                  onClick={() => setOpen(null)}
                  aria-label="Close details"
                >
                  <X className="sheetCloseIcon" />
                </motion.button>
              </div>

              <div className="detailBody">
                {exerciseDetail ? (
                  <>
                    <section className="detailSection">
                      <h3 className="detailSectionTitle">How</h3>
                      <ul className="detailList">
                        {exerciseDetail.item.how.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ul>
                    </section>
                    {exerciseDetail.item.why ? (
                      <section className="detailSection">
                        <h3 className="detailSectionTitle">Why</h3>
                        <p className="detailCopy">{exerciseDetail.item.why}</p>
                      </section>
                    ) : null}
                    {exerciseDetail.item.progress ? (
                      <section className="detailSection">
                        <h3 className="detailSectionTitle">Progression</h3>
                        <p className="detailCopy">{exerciseDetail.item.progress}</p>
                      </section>
                    ) : null}
                  </>
                ) : gateDetail ? (
                  <section className="detailSection">
                    <h3 className="detailSectionTitle">Checklist</h3>
                    <ul className="detailList">
                      {gateDetail.detail.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
