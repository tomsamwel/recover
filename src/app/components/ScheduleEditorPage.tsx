import React, { memo, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Download, Plus, Trash2, Upload } from "lucide-react";
import type { Gate, Schedule, ScheduleExercise, ScheduleSession, ScheduleWeek } from "../../domain/schedule";
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
    <div className="edExercise">
      <div className="edSessionTop">
        <div className="mut">Exercise</div>
        <button type="button" className="ib" aria-label={`Delete exercise ${exercise.name || "item"}`} onClick={onRemove}>
          <Trash2 className="h-[16px] w-[16px]" />
        </button>
      </div>
      <div className="edGrid2">
        <label className="edField">
          <span>Name</span>
          <input type="text" value={exercise.name} onChange={(e) => onChange({ name: e.target.value })} />
        </label>
        <label className="edField">
          <span>Purpose</span>
          <input type="text" value={exercise.purpose} onChange={(e) => onChange({ purpose: e.target.value })} />
        </label>
        <label className="edField edSpan2">
          <span>Instructions (one step per line)</span>
          <textarea rows={3} value={exercise.instructions} onChange={(e) => onChange({ instructions: e.target.value })} />
        </label>
        <label className="edField edSpan2">
          <span>Progression</span>
          <textarea rows={2} value={exercise.progression ?? ""} onChange={(e) => onChange({ progression: e.target.value })} />
        </label>
      </div>
    </div>
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
  return (
    <div className="edSession">
      <div className="edSessionTop">
        <div className="mut">Session</div>
        <button type="button" className="ib" aria-label={`Delete session ${session.title || session.id}`} onClick={onRemove}>
          <Trash2 className="h-[16px] w-[16px]" />
        </button>
      </div>

      <div className="edGrid3">
        <label className="edField">
          <span>ID</span>
          <input type="text" value={session.id} onChange={(e) => onChange({ id: e.target.value })} />
        </label>
        <label className="edField">
          <span>Title</span>
          <input type="text" value={session.title} onChange={(e) => onChange({ title: e.target.value })} />
        </label>
        <label className="edField">
          <span>Time (HH:MM)</span>
          <input type="text" value={session.timeOfDay ?? ""} onChange={(e) => onChange({ timeOfDay: e.target.value })} />
        </label>
      </div>

      {session.exercises.map((exercise, exerciseIndex) => (
        <ExerciseEditor
          key={`${exercise.id ?? "exercise"}-${exerciseIndex}`}
          exercise={exercise}
          onChange={(patch) => onExerciseChange(exerciseIndex, patch)}
          onRemove={() => onExerciseRemove(exerciseIndex)}
        />
      ))}

      <motion.button type="button" whileTap={{ scale: 0.98 }} className="rb edInlineBtn" onClick={onAddExercise}>
        <Plus className="h-4 w-4" />
        Add exercise
      </motion.button>
    </div>
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
    <div className="edGateRow">
      <div className="edSessionTop">
        <div className="mut">Gate #{gateIndex + 1}</div>
        <button type="button" className="ib" aria-label={`Delete gate ${gate.title || gate.id}`} onClick={onRemove}>
          <Trash2 className="h-[16px] w-[16px]" />
        </button>
      </div>
      <label className="edField">
        <span>Title</span>
        <input type="text" value={gate.title} onChange={(e) => onChange({ title: e.target.value })} />
      </label>
      <label className="edField">
        <span>Details (one item per line)</span>
        <textarea rows={3} value={joinLines(gate.detail)} onChange={(e) => onChange({ detail: parseLines(e.target.value) })} />
      </label>
    </div>
  );
});

const WeekEditor = memo(function WeekEditor({
  week,
  weekIndex,
  onChange,
  onRemove,
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
  weekIndex: number;
  onChange: (patch: Partial<ScheduleWeek>) => void;
  onRemove: () => void;
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
    <div className="pnl edWeek">
      <div className="edWeekTop">
        <div className="edWeekTitle">Week {week.weekNumber}</div>
        <button type="button" className="ib" title="Delete week" aria-label={`Delete week ${week.weekNumber}`} onClick={onRemove}>
          <Trash2 className="h-[18px] w-[18px]" />
        </button>
      </div>

      <div className="edGrid2">
        <label className="edField">
          <span>Week number</span>
          <input type="number" value={week.weekNumber} onChange={(e) => onChange({ weekNumber: Number(e.target.value) || 0 })} />
        </label>
        <label className="edField">
          <span>Label</span>
          <input type="text" value={week.label ?? ""} onChange={(e) => onChange({ label: e.target.value })} />
        </label>
        <label className="edField edSpan2">
          <span>Description</span>
          <textarea rows={2} value={week.description ?? ""} onChange={(e) => onChange({ description: e.target.value })} />
        </label>
      </div>

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

      <motion.button type="button" whileTap={{ scale: 0.98 }} className="rb edInlineBtn" onClick={onSessionAdd}>
        <Plus className="h-4 w-4" />
        Add session
      </motion.button>

      <div className="edGates">
        <div className="edGatesTop">
          <div className="mut">Gates</div>
          <motion.button type="button" whileTap={{ scale: 0.98 }} className="rb edInlineBtn" onClick={onGateAdd}>
            <Plus className="h-4 w-4" />
            Add gate
          </motion.button>
        </div>

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
    </div>
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
    <div className="edWrap">
      <div className="pnl edTop">
        <div className="edTopTitle">
          <div className="h1">Schedule editor</div>
          <div className="sub">Visual editor for upload, quick edits, and JSON export.</div>
        </div>
        <div className="edActions">
          <motion.button type="button" whileTap={{ scale: 0.98 }} className="rb edActionBtn" onClick={onOpenUpload}>
            <Upload className="h-4 w-4" />
            Upload JSON
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            className="rb edActionBtn"
            onClick={safeDownload}
            disabled={!canDownload}
            title={validationHint}
          >
            <Download className="h-4 w-4" />
            Download JSON
          </motion.button>
        </div>
      </div>

      {uploadError ? <div className="edErr">{uploadError}</div> : null}

      <div className={`edVal ${canDownload ? "edValOk" : "edValBad"}`} aria-live="polite">
        <div className="edValHead">
          <AlertTriangle className="h-4 w-4" />
          {canDownload ? "Schedule is valid" : `Validation issues: ${validationErrors.length}`}
        </div>
        {!canDownload ? (
          <ul className="edValList">
            {validationErrors.slice(0, 8).map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="pnl edMeta">
        <div className="cap">Metadata</div>
        <div className="edGrid2">
          <label className="edField">
            <span>Version</span>
            <input type="number" value={schedule.version} onChange={(e) => setSchedule((prev) => ({ ...prev, version: Number(e.target.value) || 1 }))} />
          </label>
          <label className="edField">
            <span>Anchor type</span>
            <input type="text" value={schedule.metadata?.anchor?.type ?? ""} onChange={(e) => updateMeta("type", e.target.value)} />
          </label>
          <label className="edField edSpan2">
            <span>Anchor datetime</span>
            <input type="text" value={schedule.metadata?.anchor?.at ?? ""} onChange={(e) => updateMeta("at", e.target.value)} />
          </label>
        </div>
      </div>

      <div className="edSectionHead">
        <div className="cap">Weeks</div>
        <motion.button type="button" whileTap={{ scale: 0.98 }} className="rb edInlineBtn" onClick={() => setSchedule((prev) => addWeek(prev))}>
          <Plus className="h-4 w-4" />
          Add week
        </motion.button>
      </div>

      <div className="edWeeks">
        {schedule.weeks.map((week, weekIndex) => (
          <WeekEditor
            key={`${week.weekNumber}-${weekIndex}`}
            week={week}
            weekIndex={weekIndex}
            onChange={(patch) => setSchedule((prev) => updateWeek(prev, weekIndex, patch))}
            onRemove={() => setSchedule((prev) => removeWeek(prev, weekIndex))}
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
  );
}
