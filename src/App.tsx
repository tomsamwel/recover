import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  TEMPLATE_SCHEDULE,
  activePeriod,
  getAnchorDate,
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
import { ScheduleEditorPage } from "./app/components/ScheduleEditorPage";
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
  todayKey,
  type DoneState,
} from "./app/scheduleViewModel";
import { migrateLocalState } from "./app/storage/migrate";
import { SCHEDULE_STORAGE_KEY, SELECTED_WEEK_KEY, THEME_KEY } from "./app/storage/keys";
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

const postOpDay = (now: Date, anchor: Date) => Math.floor((now.getTime() - anchor.getTime()) / 86400000);

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
  const [schedule, setSchedule] = useState<Schedule>(() =>
    typeof window === "undefined" ? TEMPLATE_SCHEDULE : loadSchedule(TEMPLATE_SCHEDULE, (parsed) => {
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
    } catch {}
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
            .catch((err: any) => {
              if (!cancelled)
                setDefaultState((prev) => ({ ...prev, error: err instanceof Error ? err.message : "Failed to load default schedule." }));
            });
        }
      })
      .catch((err: any) => {
        if (cancelled) return;
        setDefaultState((prev) => ({ ...prev, error: err instanceof Error ? err.message : "Failed to load default schedules." }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
  const defaultsRef = useRef<HTMLDivElement | null>(null);
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
  };

  const [uploadError, setUploadError] = useState<string | null>(null);

  const downloadSchedule = () => {
    const blob = new Blob([JSON.stringify(schedule, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schedule-v${schedule.version}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const applyDefaultSchedule = async (scheduleId?: string) => {
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
    } catch (err: any) {
      setDefaultState({ loading: false, error: err instanceof Error ? err.message : "Failed to load default schedule." });
    }
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
        <ScheduleHeader
          dm={dm}
          setDm={setDm}
          defaultsRef={defaultsRef}
          defaultMenuOpen={defaultMenuOpen}
          setDefaultMenuOpen={setDefaultMenuOpen}
          fileRef={fileRef}
          defaultSchedules={defaultSchedules}
          selectedDefaultId={selectedDefaultId}
          applyDefaultSchedule={applyDefaultSchedule}
          defaultState={defaultState}
          todayLabel={todayKey()}
          day={day}
          period={period}
          anchor={a}
          anchorLabel={aTxt}
          weeks={weeks}
          selectedWeek={selectedWeek}
          autoWeek={autoWeek}
          setSelectedWeek={setSelectedWeek}
          week={week}
          clsx={clsx}
        />

        <div className="pageTabs" role="tablist" aria-label="Pages">
          <button type="button" className={clsx("pageTab", page === "timeline" && "pageTabOn")} onClick={() => setPage("timeline")}>
            <Timer className="h-4 w-4" />
            Timeline
          </button>
          <button type="button" className={clsx("pageTab", page === "editor" && "pageTabOn")} onClick={() => setPage("editor")}>
            <PencilRuler className="h-4 w-4" />
            Schedule editor
          </button>
        </div>

        {page === "timeline" ? (
          <>
            <GateChecklist
              gatesOpen={gatesOpen}
              setGatesOpen={setGatesOpen}
              gateProgress={gateProgress}
              gates={gates}
              gateDone={gateDone}
              toggleGate={toggleGate}
              showGateInfo={(gateId) => setOpen({ kind: "gate", gateId })}
              clsx={clsx}
            />

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
              setOpenExercise={(sessionId, itemId) => setOpen({ kind: "exercise", sessionId, itemId })}
              Tile={Tile}
              SessionDot={SessionDot}
            />
          </>
        ) : (
          <ScheduleEditorPage
            schedule={schedule}
            setSchedule={setSchedule}
            onOpenUpload={() => fileRef.current?.click()}
            onDownload={downloadSchedule}
            uploadError={uploadError}
          />
        )}

        {page === "timeline" ? (
          <div className="fab">
            <motion.button type="button" onClick={resetToday} whileTap={{ scale: 0.98 }} className="rb" aria-label="Reset today">
              <RefreshCcw className="h-4 w-4" />
              Reset
            </motion.button>
          </div>
        ) : null}

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
.upl{position:relative;display:flex;align-items:center;height:36px;border-radius:14px;border:1px solid var(--bd);background:var(--s1);color:var(--txm);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 6px 18px rgba(0,0,0,.08);overflow:hidden}
.uplOn,.upl:hover{border-color:var(--bd2);color:var(--tx)}
.uplPart{height:100%;display:grid;place-items:center;border:none;background:transparent;color:inherit;padding:0;touch-action:manipulation}
.uplMain{width:36px}
.uplMain svg{width:15px;height:15px;stroke-width:1.75;opacity:.88}
.uplChevron{width:26px}
.uplDiv{width:1px;height:18px;background:color-mix(in srgb,var(--bd2) 70%,transparent)}
.uplMenu{position:absolute;right:0;top:42px;min-width:220px;padding:6px;border-radius:14px;border:1px solid var(--bd);background:var(--s2);backdrop-filter:blur(16px) saturate(1.2);-webkit-backdrop-filter:blur(16px) saturate(1.2);box-shadow:0 10px 26px rgba(0,0,0,.14);z-index:15}
.uplIt{width:100%;display:flex;align-items:center;justify-content:flex-start;text-align:left;border:none;background:transparent;color:var(--tx);padding:8px 10px;border-radius:10px;font-size:13px;line-height:1.25;touch-action:manipulation}
.uplIt:hover{background:color-mix(in srgb,var(--s1) 70%,transparent)}
.uplItOn{background:color-mix(in srgb,var(--ac) 18%,transparent)}
.uplErr{margin-top:6px;padding:6px 8px;font-size:12px;color:color-mix(in srgb,var(--wa) 75%,var(--tx))}

.weekbar{display:flex;gap:10px;overflow:auto;padding:8px 2px;scrollbar-width:none}
.weekbar::-webkit-scrollbar{display:none}
.weekpill{position:relative;min-width:44px;height:34px;border-radius:999px;border:1px solid var(--bd);background:color-mix(in srgb,var(--s1) 70%,transparent);color:var(--txm);font-weight:800;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);touch-action:manipulation}
.weekpill-on{background:var(--s2);border-color:var(--bd2);color:var(--tx)}
.weekpill-dot{position:absolute;right:8px;top:7px;width:7px;height:7px;border-radius:999px;background:color-mix(in srgb,var(--ac) 75%,white 25%);box-shadow:0 0 0 5px rgba(10,132,255,.10)}
.weekpill-t{font-variant-numeric:tabular-nums}
.wk{margin:12px 0 6px}

.ib{width:36px;height:36px;border-radius:14px;display:grid;place-items:center;border:1px solid var(--bd);background:var(--s1);color:var(--txm);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 6px 18px rgba(0,0,0,.08);touch-action:manipulation}
.ib:hover{border-color:var(--bd2);color:var(--tx)}

.pageTabs{margin:10px 0 14px;display:inline-flex;gap:8px;padding:6px;border-radius:16px;border:1px solid var(--bd);background:color-mix(in srgb,var(--s1) 74%,transparent);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
.pageTab{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:12px;border:1px solid transparent;background:transparent;color:var(--txm);font-weight:700;touch-action:manipulation}
.pageTabOn{background:var(--s2);border-color:var(--bd2);color:var(--tx)}

.edWrap{display:grid;gap:14px;min-width:0}
.edTop{padding:16px;display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap}
.edTopTitle{min-width:0;max-width:560px}
.edActions{display:flex;gap:10px;flex-wrap:wrap}
.edActionBtn{min-height:40px}
.edErr{padding:10px 12px;border-radius:14px;border:1px solid color-mix(in srgb,var(--wa) 45%,var(--bd2));background:color-mix(in srgb,var(--wa) 16%,transparent);color:var(--tx);overflow-wrap:anywhere}
.edVal{padding:10px 12px;border-radius:14px;border:1px solid var(--bd2);background:color-mix(in srgb,var(--s1) 75%,transparent)}
.edValHead{display:flex;align-items:center;gap:8px;font-weight:680}
.edValList{margin:8px 0 0;padding-left:18px;color:var(--txm);display:grid;gap:4px;font-size:13px}
.edValOk{border-color:color-mix(in srgb,var(--ok) 40%,var(--bd2))}
.edValBad{border-color:color-mix(in srgb,var(--wa) 50%,var(--bd2));background:color-mix(in srgb,var(--wa) 12%,transparent)}
.edMeta{padding:16px}
.edSectionHead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:2px;flex-wrap:wrap}
.edWeeks{display:grid;gap:14px;min-width:0}
.edWeek{padding:16px;display:grid;gap:14px;min-width:0;overflow:hidden}
.edWeekTop{display:flex;align-items:center;justify-content:space-between;gap:10px}
.edWeekTitle{font-size:17px;font-weight:760;letter-spacing:-.01em;min-width:0;overflow-wrap:anywhere}
.edSession,.edExercise,.edGateRow{border:1px solid var(--bd);border-radius:14px;padding:12px;background:color-mix(in srgb,var(--s1) 55%,transparent);min-width:0;overflow:hidden}
.edExercise{margin-top:10px}
.edSessionTop{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.edInlineBtn{width:max-content;max-width:100%;padding:9px 12px;font-size:13px;white-space:nowrap}
.edGrid2,.edGrid3{display:grid;gap:10px;min-width:0}
.edGrid2{grid-template-columns:repeat(2,minmax(0,1fr))}
.edGrid3{grid-template-columns:repeat(3,minmax(0,1fr))}
.edSpan2{grid-column:span 2}
.edField{display:grid;gap:6px;font-size:12px;color:var(--txm);min-width:0}
.edField span{white-space:nowrap;text-overflow:ellipsis;overflow:hidden}
.edField input,.edField textarea{width:100%;max-width:100%;border-radius:10px;border:1px solid var(--bd);background:var(--s2);color:var(--tx);padding:9px 10px;font:inherit;min-width:0;box-sizing:border-box}
.edField textarea{resize:vertical}
.edGates{display:grid;gap:10px}
.edGatesTop{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}

@media (max-width:860px){.edGrid3{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:560px){.edGrid2,.edGrid3{grid-template-columns:1fr}.edSpan2{grid-column:auto}.pageTabs{display:flex}.edInlineBtn{width:100%;justify-content:center}.edActionBtn{width:100%;justify-content:center}}

.tb{width:64px;height:36px;border-radius:999px;border:1px solid var(--bd);background:var(--s1);backdrop-filter:blur(14px) saturate(1.2);-webkit-backdrop-filter:blur(14px) saturate(1.2);box-shadow:0 6px 18px rgba(0,0,0,.08);display:grid;grid-template-columns:1fr 1fr;overflow:hidden}
.tseg{border:none;background:transparent;border-radius:0;display:grid;place-items:center;color:var(--txm);touch-action:manipulation;height:100%;width:100%}
.tsegOn{background:color-mix(in srgb,var(--s2) 92%,white 8%);color:var(--tx)}
.tseg + .tseg{border-left:1px solid color-mix(in srgb,var(--bd2) 55%,transparent)}
.ti{width:16px;height:16px;transition:opacity .12s ease}

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

.tl{display:flex;align-items:center;gap:12px;min-height:62px;padding:12px;border-radius:18px;border:1px solid var(--bd);background:var(--s1);color:var(--tx);backdrop-filter:blur(16px) saturate(1.2);-webkit-backdrop-filter:blur(16px) saturate(1.2);box-shadow:0 10px 26px rgba(0,0,0,.08);touch-action:manipulation}
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
