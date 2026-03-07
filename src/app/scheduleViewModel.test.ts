import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Gate, Schedule } from "../domain/schedule";
import type { Session } from "./scheduleViewModel";
import { loadDone, loadGates, loadSchedule, saveDone, saveGates, saveSchedule } from "./scheduleViewModel";
import { DONE_STORAGE_KEY, GATES_STORAGE_KEY, SCHEDULE_STORAGE_KEY } from "./storage/keys";

class LocalStorageMock {
  private store = new Map<string, string>();

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

const sessions: Session[] = [
  {
    id: "am",
    time: "08:00",
    title: "AM",
    items: [
      { id: "a", title: "A", icon: "hand", how: [], why: "" },
      { id: "b", title: "B", icon: "rotate", how: [], why: "" },
    ],
  },
];

const gates: Gate[] = [
  { id: "g1", title: "A", detail: [] },
  { id: "g2", title: "B", detail: [] },
];

const schedule: Schedule = {
  version: 2,
  weeks: [],
};

describe("scheduleViewModel storage behavior", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new LocalStorageMock());
  });

  it("loadSchedule falls back when payload is malformed", () => {
    localStorage.setItem(SCHEDULE_STORAGE_KEY, "{broken");
    const parsed = loadSchedule({ id: "fallback" }, () => ({ id: "ok" }));
    expect(parsed).toEqual({ id: "fallback" });
  });

  it("loadSchedule falls back when parser rejects payload", () => {
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify({ version: 2 }));
    const parsed = loadSchedule({ id: "fallback" }, () => null);
    expect(parsed).toEqual({ id: "fallback" });
  });

  it("saveSchedule writes to the expected storage key", () => {
    saveSchedule(schedule);
    expect(localStorage.getItem(SCHEDULE_STORAGE_KEY)).toEqual(JSON.stringify(schedule));
  });

  it("saveDone updates only the requested doneKey", () => {
    localStorage.setItem(DONE_STORAGE_KEY, JSON.stringify({ old: { am: { a: true, b: false } } }));

    saveDone("new", { am: { a: false, b: true } });

    expect(JSON.parse(localStorage.getItem(DONE_STORAGE_KEY) || "{}")).toEqual({
      old: { am: { a: true, b: false } },
      new: { am: { a: false, b: true } },
    });
  });

  it("loadDone keeps structural defaults and overlays saved values", () => {
    localStorage.setItem(DONE_STORAGE_KEY, JSON.stringify({ today: { am: { a: true } } }));

    expect(loadDone("today", sessions)).toEqual({ am: { a: true, b: false } });
  });

  it("loadDone falls back to structural defaults on malformed payload", () => {
    localStorage.setItem(DONE_STORAGE_KEY, "{broken");

    expect(loadDone("today", sessions)).toEqual({ am: { a: false, b: false } });
  });

  it("saveGates updates only the requested gate key", () => {
    localStorage.setItem(GATES_STORAGE_KEY, JSON.stringify({ old: { g1: true } }));

    saveGates("today", { g1: false });

    expect(JSON.parse(localStorage.getItem(GATES_STORAGE_KEY) || "{}")).toEqual({
      old: { g1: true },
      today: { g1: false },
    });
  });

  it("loadGates keeps structural defaults and overlays saved values", () => {
    localStorage.setItem(GATES_STORAGE_KEY, JSON.stringify({ today: { g1: true } }));

    expect(loadGates("today", gates)).toEqual({
      g1: true,
      g2: false,
    });
  });

  it("loadGates falls back to structural defaults on malformed payload", () => {
    localStorage.setItem(GATES_STORAGE_KEY, "{broken");

    expect(loadGates("today", gates)).toEqual({
      g1: false,
      g2: false,
    });
  });
});
