import { describe, expect, it } from "vitest";
import { TEMPLATE_SCHEDULE } from "../../domain/schedule";
import {
  addExercise,
  addGate,
  addSession,
  addWeek,
  makeUniqueId,
  removeExercise,
  removeGate,
  removeSession,
  removeWeek,
  updateExercise,
  updateGate,
  updateSession,
  updateWeek,
} from "../scheduleEditorMutations";

describe("scheduleEditorMutations", () => {
  it("generates unique ids with suffixes", () => {
    const id = makeUniqueId(["session-new", "session-new-2"], "session", "new");
    expect(id).toBe("session-new-3");
  });

  it("adds and removes week", () => {
    const withWeek = addWeek(TEMPLATE_SCHEDULE);
    expect(withWeek.weeks.length).toBe(TEMPLATE_SCHEDULE.weeks.length + 1);
    const removed = removeWeek(withWeek, withWeek.weeks.length - 1);
    expect(removed.weeks.length).toBe(TEMPLATE_SCHEDULE.weeks.length);
  });


  it("does not remove the last remaining week", () => {
    const removed = removeWeek(TEMPLATE_SCHEDULE, 0);
    expect(removed.weeks.length).toBe(1);
    expect(removed.weeks[0].weekNumber).toBe(TEMPLATE_SCHEDULE.weeks[0].weekNumber);
  });
  it("updates nested entities immutably", () => {
    const w = 0;
    const updatedWeek = updateWeek(TEMPLATE_SCHEDULE, w, { label: "Changed" });
    expect(updatedWeek.weeks[w].label).toBe("Changed");

    const updatedSession = updateSession(updatedWeek, w, 0, { title: "AM Prime" });
    expect(updatedSession.weeks[w].sessions[0].title).toBe("AM Prime");

    const updatedExercise = updateExercise(updatedSession, w, 0, 0, { name: "Pump" });
    expect(updatedExercise.weeks[w].sessions[0].exercises[0].name).toBe("Pump");

    const updatedGate = updateGate(updatedExercise, w, 0, { title: "Gate changed" });
    expect(updatedGate.weeks[w].gates[0].title).toBe("Gate changed");
  });

  it("adds and removes session, exercise and gate", () => {
    const w = 0;
    const withSession = addSession(TEMPLATE_SCHEDULE, w);
    expect(withSession.weeks[w].sessions.length).toBe(TEMPLATE_SCHEDULE.weeks[w].sessions.length + 1);

    const withExercise = addExercise(withSession, w, 0);
    expect(withExercise.weeks[w].sessions[0].exercises.length).toBe(withSession.weeks[w].sessions[0].exercises.length + 1);

    const withGate = addGate(withExercise, w);
    expect(withGate.weeks[w].gates.length).toBe(withExercise.weeks[w].gates.length + 1);

    const noGate = removeGate(withGate, w, withGate.weeks[w].gates.length - 1);
    const noExercise = removeExercise(noGate, w, 0, noGate.weeks[w].sessions[0].exercises.length - 1);
    const noSession = removeSession(noExercise, w, noExercise.weeks[w].sessions.length - 1);

    expect(noGate.weeks[w].gates.length).toBe(withExercise.weeks[w].gates.length);
    expect(noExercise.weeks[w].sessions[0].exercises.length).toBe(withSession.weeks[w].sessions[0].exercises.length);
    expect(noSession.weeks[w].sessions.length).toBe(TEMPLATE_SCHEDULE.weeks[w].sessions.length);
  });
});
