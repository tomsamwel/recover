export type Gate = { id: string; title: string; detail: string[] };

export type ScheduleExercise = {
  id?: string;
  name: string;
  purpose: string;
  instructions: string;
  progression?: string;
  link?: string;
};

export type ScheduleSession = {
  id: string;
  title: string;
  timeOfDay?: string | null;
  exercises: ScheduleExercise[];
};

export type SchedulePeriod = { id: string; label: string; startDay: number; endDay: number };

export type ScheduleAnchor = { type?: string; at: string };

export type ScheduleMeta = {
  anchor?: ScheduleAnchor;
  periods?: SchedulePeriod[];
  weekLengthDays?: number;
  [k: string]: any;
};

export type ScheduleWeek = {
  weekNumber: number;
  label?: string;
  description?: string;
  gates: Gate[];
  sessions: ScheduleSession[];
};

export type Schedule = { version: number; metadata?: ScheduleMeta; weeks: ScheduleWeek[] };
