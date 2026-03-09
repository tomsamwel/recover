import type { Schedule, ScheduleDayOfWeek } from "./model";
import { parseHHMM } from "./utils";

const DAY_SET = new Set<ScheduleDayOfWeek>(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);

export function validateSchedule(schedule: Schedule): string[] {
  const errors: string[] = [];

  if (!schedule.weeks.length) errors.push("Schedule must include at least one week.");

  const badPeriods = schedule.metadata?.periods?.some((p) => p.endDay < p.startDay);
  if (badPeriods) errors.push("One or more periods have endDay before startDay.");

  if (schedule.metadata?.anchor?.at && !Number.isFinite(new Date(schedule.metadata.anchor.at).getTime())) {
    errors.push("Anchor date is malformed.");
  }

  for (const week of schedule.weeks) {
    if (!week.sessions.length) errors.push(`Week ${week.weekNumber} must include at least one session.`);
    for (const session of week.sessions) {
      if (!session.exercises.length) errors.push(`Week ${week.weekNumber} session '${session.id}' must include at least one exercise.`);
      if (!session.title.trim()) errors.push(`Week ${week.weekNumber} session '${session.id}' title is required.`);
      if (session.timing?.mode === "exact" && !Number.isFinite(parseHHMM(session.timing.time))) {
        errors.push(`Week ${week.weekNumber} session '${session.title || session.id}' has invalid exact time '${session.timing.time}'. Use HH:MM.`);
      }
      if (session.timing?.mode === "recurring") {
        if (!session.timing.days.length || session.timing.days.some((d) => !DAY_SET.has(d))) {
          errors.push(`Week ${week.weekNumber} session '${session.title || session.id}' has invalid recurring days.`);
        }
        if (session.timing.time && !Number.isFinite(parseHHMM(session.timing.time))) {
          errors.push(`Week ${week.weekNumber} session '${session.title || session.id}' has invalid recurring time '${session.timing.time}'. Use HH:MM.`);
        }
      }
      for (const [exerciseIndex, exercise] of session.exercises.entries()) {
        if (!exercise.name.trim()) errors.push(`Week ${week.weekNumber} session '${session.id}' exercise #${exerciseIndex + 1} name is required.`);
        if (!exercise.instructions.trim()) {
          errors.push(`Week ${week.weekNumber} session '${session.id}' exercise '${exercise.name || exerciseIndex + 1}' instructions are required.`);
        }
      }
    }
  }

  return errors;
}
