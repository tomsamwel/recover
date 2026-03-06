import type { Gate, Schedule, ScheduleExercise, ScheduleSession, ScheduleWeek } from "../domain/schedule";

const randomId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";

export function makeUniqueId(existingIds: Iterable<string>, prefix: string, seed?: string): string {
  const taken = new Set(existingIds);
  const root = `${prefix}-${slugify(seed ?? prefix)}`;
  if (!taken.has(root)) return root;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${root}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${prefix}-${randomId()}`;
}

const collectSessionIds = (schedule: Schedule) =>
  schedule.weeks.flatMap((week) => week.sessions.map((session) => session.id));

const collectExerciseIds = (schedule: Schedule) =>
  schedule.weeks.flatMap((week) => week.sessions.flatMap((session) => session.exercises.map((exercise) => exercise.id).filter(Boolean) as string[]));

const collectGateIds = (schedule: Schedule) => schedule.weeks.flatMap((week) => week.gates.map((gate) => gate.id));

export function updateWeek(schedule: Schedule, weekIndex: number, patch: Partial<ScheduleWeek>): Schedule {
  const weeks = [...schedule.weeks];
  weeks[weekIndex] = { ...weeks[weekIndex], ...patch };
  return { ...schedule, weeks };
}

export function updateSession(schedule: Schedule, weekIndex: number, sessionIndex: number, patch: Partial<ScheduleSession>): Schedule {
  const weeks = [...schedule.weeks];
  const sessions = [...weeks[weekIndex].sessions];
  sessions[sessionIndex] = { ...sessions[sessionIndex], ...patch };
  weeks[weekIndex] = { ...weeks[weekIndex], sessions };
  return { ...schedule, weeks };
}

export function updateExercise(
  schedule: Schedule,
  weekIndex: number,
  sessionIndex: number,
  exerciseIndex: number,
  patch: Partial<ScheduleExercise>
): Schedule {
  const weeks = [...schedule.weeks];
  const sessions = [...weeks[weekIndex].sessions];
  const exercises = [...sessions[sessionIndex].exercises];
  exercises[exerciseIndex] = { ...exercises[exerciseIndex], ...patch };
  sessions[sessionIndex] = { ...sessions[sessionIndex], exercises };
  weeks[weekIndex] = { ...weeks[weekIndex], sessions };
  return { ...schedule, weeks };
}

export function updateGate(schedule: Schedule, weekIndex: number, gateIndex: number, patch: Partial<Gate>): Schedule {
  const weeks = [...schedule.weeks];
  const gates = [...weeks[weekIndex].gates];
  gates[gateIndex] = { ...gates[gateIndex], ...patch };
  weeks[weekIndex] = { ...weeks[weekIndex], gates };
  return { ...schedule, weeks };
}

export function addWeek(schedule: Schedule): Schedule {
  const highest = schedule.weeks.reduce((acc, w) => Math.max(acc, w.weekNumber), -1);
  const sessionId = makeUniqueId(collectSessionIds(schedule), "session", "new");
  const exerciseId = makeUniqueId(collectExerciseIds(schedule), "exercise", "new");
  return {
    ...schedule,
    weeks: [
      ...schedule.weeks,
      {
        weekNumber: highest + 1,
        label: `Week ${highest + 1}`,
        description: "",
        gates: [],
        sessions: [
          {
            id: sessionId,
            title: "New session",
            timeOfDay: "08:00",
            exercises: [{ id: exerciseId, name: "New exercise", purpose: "", instructions: "" }],
          },
        ],
      },
    ],
  };
}

export function removeWeek(schedule: Schedule, weekIndex: number): Schedule {
  if (schedule.weeks.length <= 1) return schedule;
  return { ...schedule, weeks: schedule.weeks.filter((_, idx) => idx !== weekIndex) };
}

export function addSession(schedule: Schedule, weekIndex: number): Schedule {
  const weeks = [...schedule.weeks];
  const sessionId = makeUniqueId(collectSessionIds(schedule), "session", "new");
  const exerciseId = makeUniqueId(collectExerciseIds(schedule), "exercise", "new");
  weeks[weekIndex] = {
    ...weeks[weekIndex],
    sessions: [
      ...weeks[weekIndex].sessions,
      {
        id: sessionId,
        title: "New session",
        timeOfDay: "08:00",
        exercises: [{ id: exerciseId, name: "New exercise", purpose: "", instructions: "" }],
      },
    ],
  };
  return { ...schedule, weeks };
}

export function removeSession(schedule: Schedule, weekIndex: number, sessionIndex: number): Schedule {
  const weeks = [...schedule.weeks];
  weeks[weekIndex] = { ...weeks[weekIndex], sessions: weeks[weekIndex].sessions.filter((_, idx) => idx !== sessionIndex) };
  return { ...schedule, weeks };
}

export function addExercise(schedule: Schedule, weekIndex: number, sessionIndex: number): Schedule {
  const weeks = [...schedule.weeks];
  const sessions = [...weeks[weekIndex].sessions];
  const exerciseId = makeUniqueId(collectExerciseIds(schedule), "exercise", "new");
  sessions[sessionIndex] = {
    ...sessions[sessionIndex],
    exercises: [...sessions[sessionIndex].exercises, { id: exerciseId, name: "New exercise", purpose: "", instructions: "" }],
  };
  weeks[weekIndex] = { ...weeks[weekIndex], sessions };
  return { ...schedule, weeks };
}

export function removeExercise(schedule: Schedule, weekIndex: number, sessionIndex: number, exerciseIndex: number): Schedule {
  const weeks = [...schedule.weeks];
  const sessions = [...weeks[weekIndex].sessions];
  sessions[sessionIndex] = { ...sessions[sessionIndex], exercises: sessions[sessionIndex].exercises.filter((_, idx) => idx !== exerciseIndex) };
  weeks[weekIndex] = { ...weeks[weekIndex], sessions };
  return { ...schedule, weeks };
}

export function addGate(schedule: Schedule, weekIndex: number): Schedule {
  const weeks = [...schedule.weeks];
  const gateId = makeUniqueId(collectGateIds(schedule), "gate", "new");
  weeks[weekIndex] = { ...weeks[weekIndex], gates: [...weeks[weekIndex].gates, { id: gateId, title: "New gate", detail: [] }] };
  return { ...schedule, weeks };
}

export function removeGate(schedule: Schedule, weekIndex: number, gateIndex: number): Schedule {
  const weeks = [...schedule.weeks];
  weeks[weekIndex] = { ...weeks[weekIndex], gates: weeks[weekIndex].gates.filter((_, idx) => idx !== gateIndex) };
  return { ...schedule, weeks };
}
