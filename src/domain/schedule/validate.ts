import type { Schedule } from "./model";

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
