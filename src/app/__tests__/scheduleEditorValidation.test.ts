import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSchedule, TEMPLATE_SCHEDULE } from "../../domain/schedule";
import type { Schedule } from "../../domain/schedule";
import { getScheduleErrors } from "../scheduleEditorValidation";

function loadFixture(name: string) {
  const raw = readFileSync(join(process.cwd(), "schedules/defaults", name), "utf-8");
  return JSON.parse(raw);
}

describe("getScheduleErrors", () => {
  it("returns no errors for template schedule", () => {
    expect(getScheduleErrors(TEMPLATE_SCHEDULE)).toEqual([]);
  });

  it("flags malformed session times", () => {
    const bad = {
      ...TEMPLATE_SCHEDULE,
      weeks: [
        {
          ...TEMPLATE_SCHEDULE.weeks[0],
          sessions: [{ ...TEMPLATE_SCHEDULE.weeks[0].sessions[0], timeOfDay: "8am" }],
        },
      ],
    };
    const errors = getScheduleErrors(bad);
    expect(errors.some((x) => x.includes("invalid time"))).toBe(true);
  });

  it("accepts flexible timing modes", () => {
    const flexible: Schedule = {
      ...TEMPLATE_SCHEDULE,
      weeks: [
        {
          ...TEMPLATE_SCHEDULE.weeks[0],
          sessions: [
            {
              ...TEMPLATE_SCHEDULE.weeks[0].sessions[0],
              timing: { mode: "anytime", label: "Throughout day" },
              timeOfDay: "throughout day",
            },
            {
              ...TEMPLATE_SCHEDULE.weeks[0].sessions[0],
              id: "strength",
              title: "Strength",
              timing: { mode: "recurring", days: ["Mon", "Wed", "Fri"], time: "12:00" },
              timeOfDay: "Mon/Wed/Fri 12:00",
            },
          ],
        },
      ],
    };
    expect(getScheduleErrors(flexible)).toEqual([]);
  });

  it("accepts the latarjet default schedule timing", () => {
    const parsed = parseSchedule(loadFixture("latarjet_schedule.json"));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const errors = getScheduleErrors(parsed.value);
      expect(errors.filter((x) => x.includes("invalid time"))).toEqual([]);
    }
  });
});
