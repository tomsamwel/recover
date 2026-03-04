import type { Schedule } from "./model";

export const TEMPLATE_SCHEDULE: Schedule = {
  version: 1,
  metadata: {
    template: true,
    anchor: { type: "surgeryEnd", at: "2026-02-13T16:00:00+01:00" },
    weekLengthDays: 7,
    periods: [
      { id: "p0", label: "Week 0–2 (Protection)", startDay: 0, endDay: 13 },
      { id: "p1", label: "Week 3–4 (PROM)", startDay: 14, endDay: 27 },
    ],
  },
  weeks: [
    {
      weekNumber: 0,
      label: "Template",
      description: "Upload your schedule JSON (auto-saved).",
      gates: [
        {
          id: "pain-rules",
          title: "Pain rules met",
          detail: [
            "Rest pain target ≤ 3/10.",
            "During exercises max 6/10.",
            "Return to baseline within 30 minutes.",
          ],
        },
      ],
      sessions: [
        {
          id: "am",
          title: "Morning",
          timeOfDay: "08:00",
          exercises: [
            {
              id: "handpump",
              name: "Hand/wrist pump",
              purpose: "Promote circulation.",
              instructions: "Make a fist 20x\nSpread fingers 20x\nWrist circles 10 each direction",
            },
          ],
        },
      ],
    },
  ],
};
