import React, { memo, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Download, Plus, Trash2, Upload } from "lucide-react";
import { isAnytimeLabel, parseHHMM, parseRecurringTimingLabel } from "../../domain/schedule";
import type { Gate, Schedule, ScheduleDayOfWeek, ScheduleExercise, ScheduleSession, ScheduleSessionTiming, ScheduleWeek } from "../../domain/schedule";
import {
  addExercise,
  addGate,
  addSession,
  addWeek,
  removeExercise,
  removeGate,
  removeSession,
  removeWeek,
  updateExercise,
  updateGate,
  updateSession,
  updateWeek,
} from "../scheduleEditorMutations";
import { getScheduleErrors } from "../scheduleEditorValidation";

type Props = {
  schedule: Schedule;
  setSchedule: React.Dispatch<React.SetStateAction<Schedule>>;
  onOpenUpload: () => void;
  onDownload: () => void;
  uploadError: string | null;
};

const parseLines = (value: string) =>
  value
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

const joinLines = (items: string[]) => items.join("\n");
const DAY_OPTIONS: ScheduleDayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function normalizeTimingForEditor(session: ScheduleSession): ScheduleSessionTiming {
  const t = session.timing;
  if (t?.mode === "exact") {
    const time = typeof t.time === "string" && t.time.trim() ? t.time.trim() : "08:00";
    const label = typeof t.label === "string" ? t.label : undefined;
    return { mode: "exact", time, label };
  }
  if (t?.mode === "anytime") {
    const label = typeof t.label === "string" ? t.label : undefined;
    return label ? { mode: "anytime", label } : { mode: "anytime" };
  }
  if (t?.mode === "recurring") {
    const days = Array.isArray(t.days) ? t.days.filter((d): d is ScheduleDayOfWeek => DAY_OPTIONS.includes(d as ScheduleDayOfWeek)) : [];
    const label = typeof t.label === "string" ? t.label : undefined;
    const time = typeof t.time === "string" ? t.time : undefined;
    return { mode: "recurring", days, time, label };
  }
  const raw = typeof session.timeOfDay === "string" ? session.timeOfDay.trim() : "";
  if (!raw) return { mode: "exact", time: "08:00" };
  if (Number.isFinite(parseHHMM(raw))) return { mode: "exact", time: raw };
  if (isAnytimeLabel(raw)) return { mode: "anytime", label: "Throughout day" };
  const recurring = parseRecurringTimingLabel(raw);
  if (recurring) return { mode: "recurring", days: recurring.days, time: recurring.time, label: raw };
  return { mode: "anytime", label: raw };
}

function legacyTimeFromTiming(timing: ScheduleSessionTiming): string {
  if (timing.mode === "exact") return timing.time;
  if (timing.mode === "anytime") return timing.label?.trim() || "throughout day";
  if (timing.label?.trim()) return timing.label.trim();
  return `${timing.days.join("/")}${timing.time ? ` ${timing.time}` : ""}`.trim();
}

const ExerciseEditor = memo(function ExerciseEditor({
  exercise,
  onChange,
  onRemove,
}: {
  exercise: ScheduleExercise;
  onChange: (patch: Partial<ScheduleExercise>) => void;
  onRemove: () => void;
}) {
  return (
    <section className="editorSubsection">
      <div className="editorSubsectionHeader">
        <div>
          <div className="sectionLabel">Exercise</div>
          <div className="editorSubsectionTitle">{exercise.name || "Untitled exercise"}</div>
        </div>
        <button type="button" className="iconAction" aria-label={`Delete exercise ${exercise.name || "item"}`} onClick={onRemove}>
          <Trash2 className="iconActionIcon" />
        </button>
      </div>

      <div className="editorGridTwo">
        <label className="field">
          <span>Name</span>
          <input className="fieldInput" type="text" value={exercise.name} onChange={(e) => onChange({ name: e.target.value })} />
        </label>
        <label className="field">
          <span>Purpose</span>
          <input className="fieldInput" type="text" value={exercise.purpose} onChange={(e) => onChange({ purpose: e.target.value })} />
        </label>
        <label className="field fieldSpanTwo">
          <span>Instructions (one step per line)</span>
          <textarea className="fieldInput" rows={3} value={exercise.instructions} onChange={(e) => onChange({ instructions: e.target.value })} />
        </label>
        <label className="field fieldSpanTwo">
          <span>Progression</span>
          <textarea className="fieldInput" rows={2} value={exercise.progression ?? ""} onChange={(e) => onChange({ progression: e.target.value })} />
        </label>
      </div>
    </section>
  );
});

const SessionEditor = memo(function SessionEditor({
  session,
  onChange,
  onRemove,
  onAddExercise,
  onExerciseChange,
  onExerciseRemove,
}: {
  session: ScheduleSession;
  onChange: (patch: Partial<ScheduleSession>) => void;
  onRemove: () => void;
  onAddExercise: () => void;
  onExerciseChange: (exerciseIndex: number, patch: Partial<ScheduleExercise>) => void;
  onExerciseRemove: (exerciseIndex: number) => void;
}) {
  const timing = normalizeTimingForEditor(session);
  const applyTiming = (next: ScheduleSessionTiming) => onChange({ timing: next, timeOfDay: legacyTimeFromTiming(next) });

  return (
    <section className="editorSection">
      <div className="editorSectionHeader">
        <div>
          <div className="sectionLabel">Session</div>
          <h4 className="editorSectionTitle">{session.title || session.id || "Untitled session"}</h4>
        </div>
        <button type="button" className="iconAction" aria-label={`Delete session ${session.title || session.id}`} onClick={onRemove}>
          <Trash2 className="iconActionIcon" />
        </button>
      </div>

      <div className="editorGridThree">
        <label className="field">
          <span>ID</span>
          <input className="fieldInput" type="text" value={session.id} onChange={(e) => onChange({ id: e.target.value })} />
        </label>
        <label className="field">
          <span>Title</span>
          <input className="fieldInput" type="text" value={session.title} onChange={(e) => onChange({ title: e.target.value })} />
        </label>
        <label className="field">
          <span>Timing mode</span>
          <select
            className="fieldInput"
            value={timing.mode}
            onChange={(e) => {
              const mode = e.target.value as ScheduleSessionTiming["mode"];
              if (mode === "exact") applyTiming({ mode: "exact", time: "08:00" });
              if (mode === "anytime") applyTiming({ mode: "anytime", label: "Throughout day" });
              if (mode === "recurring") applyTiming({ mode: "recurring", days: ["Mon", "Wed", "Fri"], time: "12:00" });
            }}
          >
            <option value="exact">Exact time</option>
            <option value="anytime">Any time</option>
            <option value="recurring">Recurring days</option>
          </select>
        </label>
      </div>

      {timing.mode === "exact" ? (
        <div className="editorGridThree">
          <label className="field">
            <span>Time (HH:MM)</span>
            <input className="fieldInput" type="text" value={timing.time} onChange={(e) => applyTiming({ ...timing, time: e.target.value })} />
          </label>
          <label className="field fieldSpanTwo">
            <span>Display label (optional)</span>
            <input
              className="fieldInput"
              type="text"
              value={timing.label ?? ""}
              onChange={(e) => applyTiming({ ...timing, label: e.target.value || undefined })}
            />
          </label>
        </div>
      ) : null}

      {timing.mode === "anytime" ? (
        <div className="editorGridThree">
          <label className="field fieldSpanTwo">
            <span>Label (optional)</span>
            <input
              className="fieldInput"
              type="text"
              value={timing.label ?? ""}
              onChange={(e) => applyTiming({ ...timing, label: e.target.value || undefined })}
            />
          </label>
        </div>
      ) : null}

      {timing.mode === "recurring" ? (
        <div className="editorGridThree">
          <div className="field fieldSpanTwo">
            <span>Days</span>
            <div className="checkboxGrid">
              {DAY_OPTIONS.map((day) => {
                const checked = timing.days.includes(day);
                return (
                  <label key={day} className="checkboxField">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        applyTiming({
                          ...timing,
                          days: checked ? timing.days.filter((x) => x !== day) : [...timing.days, day],
                        })
                      }
                    />
                    <span>{day}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <label className="field">
            <span>Time (optional HH:MM)</span>
            <input
              className="fieldInput"
              type="text"
              value={timing.time ?? ""}
              onChange={(e) => applyTiming({ ...timing, time: e.target.value || undefined })}
            />
          </label>
          <label className="field">
            <span>Display label (optional)</span>
            <input
              className="fieldInput"
              type="text"
              value={timing.label ?? ""}
              onChange={(e) => applyTiming({ ...timing, label: e.target.value || undefined })}
            />
          </label>
        </div>
      ) : null}

      <div className="editorSubsectionList">
        {session.exercises.map((exercise, exerciseIndex) => (
          <ExerciseEditor
            key={`${exercise.id ?? "exercise"}-${exerciseIndex}`}
            exercise={exercise}
            onChange={(patch) => onExerciseChange(exerciseIndex, patch)}
            onRemove={() => onExerciseRemove(exerciseIndex)}
          />
        ))}
      </div>

      <motion.button type="button" whileTap={{ scale: 0.98 }} className="actionButton actionButtonSecondary editorInlineAction" onClick={onAddExercise}>
        <Plus className="actionButtonIcon" />
        Add exercise
      </motion.button>
    </section>
  );
});

const GateEditor = memo(function GateEditor({
  gate,
  gateIndex,
  onChange,
  onRemove,
}: {
  gate: Gate;
  gateIndex: number;
  onChange: (patch: Partial<Gate>) => void;
  onRemove: () => void;
}) {
  return (
    <section className="editorSection">
      <div className="editorSectionHeader">
        <div>
          <div className="sectionLabel">Gate #{gateIndex + 1}</div>
          <h4 className="editorSectionTitle">{gate.title || gate.id || "Untitled gate"}</h4>
        </div>
        <button type="button" className="iconAction" aria-label={`Delete gate ${gate.title || gate.id}`} onClick={onRemove}>
          <Trash2 className="iconActionIcon" />
        </button>
      </div>

      <div className="editorGridTwo">
        <label className="field">
          <span>Title</span>
          <input className="fieldInput" type="text" value={gate.title} onChange={(e) => onChange({ title: e.target.value })} />
        </label>
        <label className="field fieldSpanTwo">
          <span>Details (one item per line)</span>
          <textarea className="fieldInput" rows={3} value={joinLines(gate.detail)} onChange={(e) => onChange({ detail: parseLines(e.target.value) })} />
        </label>
      </div>
    </section>
  );
});

const WeekEditor = memo(function WeekEditor({
  week,
  onChange,
  onRemove,
  canDeleteWeek,
  onSessionChange,
  onSessionRemove,
  onSessionAdd,
  onExerciseChange,
  onExerciseRemove,
  onExerciseAdd,
  onGateChange,
  onGateRemove,
  onGateAdd,
}: {
  week: ScheduleWeek;
  onChange: (patch: Partial<ScheduleWeek>) => void;
  onRemove: () => void;
  canDeleteWeek: boolean;
  onSessionChange: (sessionIndex: number, patch: Partial<ScheduleSession>) => void;
  onSessionRemove: (sessionIndex: number) => void;
  onSessionAdd: () => void;
  onExerciseChange: (sessionIndex: number, exerciseIndex: number, patch: Partial<ScheduleExercise>) => void;
  onExerciseRemove: (sessionIndex: number, exerciseIndex: number) => void;
  onExerciseAdd: (sessionIndex: number) => void;
  onGateChange: (gateIndex: number, patch: Partial<Gate>) => void;
  onGateRemove: (gateIndex: number) => void;
  onGateAdd: () => void;
}) {
  return (
    <section className="editorWeek">
      <div className="editorWeekHeader">
        <div>
          <div className="sectionLabel">Week {week.weekNumber}</div>
          <h3 className="editorWeekTitle">{week.label || `Week ${week.weekNumber}`}</h3>
        </div>
        <button
          type="button"
          className="iconAction"
          title={canDeleteWeek ? "Delete week" : "A schedule must have at least one week."}
          aria-label={`Delete week ${week.weekNumber}`}
          onClick={onRemove}
          disabled={!canDeleteWeek}
        >
          <Trash2 className="iconActionIcon" />
        </button>
      </div>

      <div className="editorGridTwo">
        <label className="field">
          <span>Week number</span>
          <input className="fieldInput" type="number" value={week.weekNumber} onChange={(e) => onChange({ weekNumber: Number(e.target.value) || 0 })} />
        </label>
        <label className="field">
          <span>Label</span>
          <input className="fieldInput" type="text" value={week.label ?? ""} onChange={(e) => onChange({ label: e.target.value })} />
        </label>
        <label className="field fieldSpanTwo">
          <span>Description</span>
          <textarea className="fieldInput" rows={2} value={week.description ?? ""} onChange={(e) => onChange({ description: e.target.value })} />
        </label>
      </div>

      <div className="editorDivider" />

      <div className="editorGroupHeader">
        <div>
          <div className="sectionLabel">Sessions</div>
          <div className="sectionText">Keep timing explicit and progression easy to scan.</div>
        </div>
        <motion.button type="button" whileTap={{ scale: 0.98 }} className="actionButton actionButtonSecondary" onClick={onSessionAdd}>
          <Plus className="actionButtonIcon" />
          Add session
        </motion.button>
      </div>

      <div className="editorStack">
        {week.sessions.map((session, sessionIndex) => (
          <SessionEditor
            key={`${session.id}-${sessionIndex}`}
            session={session}
            onChange={(patch) => onSessionChange(sessionIndex, patch)}
            onRemove={() => onSessionRemove(sessionIndex)}
            onAddExercise={() => onExerciseAdd(sessionIndex)}
            onExerciseChange={(exerciseIndex, patch) => onExerciseChange(sessionIndex, exerciseIndex, patch)}
            onExerciseRemove={(exerciseIndex) => onExerciseRemove(sessionIndex, exerciseIndex)}
          />
        ))}
      </div>

      <div className="editorDivider" />

      <div className="editorGroupHeader">
        <div>
          <div className="sectionLabel">Gates</div>
          <div className="sectionText">Use gates for progression rules or safety checks.</div>
        </div>
        <motion.button type="button" whileTap={{ scale: 0.98 }} className="actionButton actionButtonSecondary" onClick={onGateAdd}>
          <Plus className="actionButtonIcon" />
          Add gate
        </motion.button>
      </div>

      <div className="editorStack">
        {week.gates.map((gate, gateIndex) => (
          <GateEditor
            key={`${gate.id}-${gateIndex}`}
            gate={gate}
            gateIndex={gateIndex}
            onChange={(patch) => onGateChange(gateIndex, patch)}
            onRemove={() => onGateRemove(gateIndex)}
          />
        ))}
      </div>
    </section>
  );
});

export function ScheduleEditorPage({ schedule, setSchedule, onOpenUpload, onDownload, uploadError }: Props) {
  const validationErrors = useMemo(() => getScheduleErrors(schedule), [schedule]);
  const canDownload = validationErrors.length === 0;
  const validationHint = canDownload ? "Download schedule JSON" : validationErrors[0];

  const updateMeta = useCallback(
    (key: "at" | "type", value: string) => {
      setSchedule((prev) => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          anchor: {
            at: key === "at" ? value : prev.metadata?.anchor?.at ?? "",
            type: key === "type" ? value : prev.metadata?.anchor?.type,
          },
        },
      }));
    },
    [setSchedule]
  );

  const safeDownload = useCallback(() => {
    if (!canDownload) return;
    onDownload();
  }, [canDownload, onDownload]);

  return (
    <div className="editorShell">
      <aside className="editorRail">
        <div className="editorRailBlock">
          <div className="sectionLabel">Protocol editor</div>
          <h2 className="workspaceTitle">Editor</h2>
          <p className="workspaceText">Upload, validate, and adjust the plan without leaving the working surface.</p>
        </div>

        <div className="editorRailBlock">
          <motion.button type="button" whileTap={{ scale: 0.98 }} className="actionButton" onClick={onOpenUpload}>
            <Upload className="actionButtonIcon" />
            Upload JSON
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            className="actionButton actionButtonSecondary"
            onClick={safeDownload}
            disabled={!canDownload}
            title={validationHint}
          >
            <Download className="actionButtonIcon" />
            Download JSON
          </motion.button>
        </div>

        {uploadError ? <div className="statusNote statusNoteError">{uploadError}</div> : null}

        <div className={`validationBox ${canDownload ? "validationBoxOk" : "validationBoxBad"}`} aria-live="polite">
          <div className="validationHeader">
            <AlertTriangle className="validationIcon" />
            {canDownload ? "Schedule is valid" : `Validation issues: ${validationErrors.length}`}
          </div>
          {!canDownload ? (
            <ul className="validationList">
              {validationErrors.slice(0, 8).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : (
            <p className="sectionText">Ready for export.</p>
          )}
        </div>

        <div className="editorRailBlock">
          <div className="sectionLabel">Metadata</div>
          <div className="editorGridTwo">
            <label className="field">
              <span>Version</span>
              <input
                className="fieldInput"
                type="number"
                value={schedule.version}
                onChange={(e) => setSchedule((prev) => ({ ...prev, version: Number(e.target.value) || 1 }))}
              />
            </label>
            <label className="field">
              <span>Anchor type</span>
              <input className="fieldInput" type="text" value={schedule.metadata?.anchor?.type ?? ""} onChange={(e) => updateMeta("type", e.target.value)} />
            </label>
            <label className="field fieldSpanTwo">
              <span>Anchor datetime</span>
              <input className="fieldInput" type="text" value={schedule.metadata?.anchor?.at ?? ""} onChange={(e) => updateMeta("at", e.target.value)} />
            </label>
          </div>
        </div>
      </aside>

      <div className="editorContent">
        <div className="editorContentHeader">
          <div>
            <div className="sectionLabel">Weeks</div>
            <h3 className="sectionTitle">Protocol structure</h3>
            <p className="sectionText">One week per stage. Keep sessions clear, progression explicit, and gates easy to verify.</p>
          </div>
          <motion.button type="button" whileTap={{ scale: 0.98 }} className="actionButton actionButtonSecondary" onClick={() => setSchedule((prev) => addWeek(prev))}>
            <Plus className="actionButtonIcon" />
            Add week
          </motion.button>
        </div>

        <div className="editorWeekList">
          {schedule.weeks.map((week, weekIndex) => (
            <WeekEditor
              key={`${week.weekNumber}-${weekIndex}`}
              week={week}
              onChange={(patch) => setSchedule((prev) => updateWeek(prev, weekIndex, patch))}
              onRemove={() => setSchedule((prev) => removeWeek(prev, weekIndex))}
              canDeleteWeek={schedule.weeks.length > 1}
              onSessionChange={(sessionIndex, patch) => setSchedule((prev) => updateSession(prev, weekIndex, sessionIndex, patch))}
              onSessionRemove={(sessionIndex) => setSchedule((prev) => removeSession(prev, weekIndex, sessionIndex))}
              onSessionAdd={() => setSchedule((prev) => addSession(prev, weekIndex))}
              onExerciseChange={(sessionIndex, exerciseIndex, patch) =>
                setSchedule((prev) => updateExercise(prev, weekIndex, sessionIndex, exerciseIndex, patch))
              }
              onExerciseRemove={(sessionIndex, exerciseIndex) => setSchedule((prev) => removeExercise(prev, weekIndex, sessionIndex, exerciseIndex))}
              onExerciseAdd={(sessionIndex) => setSchedule((prev) => addExercise(prev, weekIndex, sessionIndex))}
              onGateChange={(gateIndex, patch) => setSchedule((prev) => updateGate(prev, weekIndex, gateIndex, patch))}
              onGateRemove={(gateIndex) => setSchedule((prev) => removeGate(prev, weekIndex, gateIndex))}
              onGateAdd={() => setSchedule((prev) => addGate(prev, weekIndex))}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
