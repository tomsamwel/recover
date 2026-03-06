import { describe, expect, it } from "vitest";
import { TEMPLATE_SCHEDULE } from "../../domain/schedule";
import { getScheduleErrors } from "../scheduleEditorValidation";

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
});
