import { isAnytimeLabel, parseHHMM, parseRecurringTimingLabel, parseSchedule } from "../domain/schedule";
import type { Schedule } from "../domain/schedule";
import { validateSchedule } from "../domain/schedule/validate";

export function getScheduleErrors(schedule: Schedule): string[] {
  const errors = [...validateSchedule(schedule)];

  const parsed = parseSchedule(schedule);
  if (!parsed.ok) errors.push(...parsed.errors);

  for (const week of schedule.weeks) {
    for (const session of week.sessions) {
      if (session.timing) continue;
      if (typeof session.timeOfDay !== "string") continue;
      const raw = session.timeOfDay.trim();
      if (!raw) continue;
      if (!Number.isFinite(parseHHMM(raw)) && !isAnytimeLabel(raw) && !parseRecurringTimingLabel(raw)) {
        errors.push(`Week ${week.weekNumber} session '${session.title || session.id}' has invalid time '${session.timeOfDay}'. Use HH:MM.`);
      }
    }
  }

  return Array.from(new Set(errors));
}
