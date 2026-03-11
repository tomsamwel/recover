import { beforeEach, describe, expect, it, vi } from "vitest";
import { SURGERY_DATE_OVERRIDE_KEY } from "./storage/keys";
import {
  canResetSurgeryDate,
  calendarDayDiff,
  dateOnlyFromDateTime,
  formatSurgeryDateLabel,
  formatDateOnly,
  loadManualSurgeryDateOverride,
  normalizeDateOnly,
  resolveSurgeryDate,
  surgeryDateSourceHint,
  saveManualSurgeryDateOverride,
} from "./surgeryDate";

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

describe("surgeryDate", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new LocalStorageMock());
  });

  it("prioritizes manual selection over schedule date", () => {
    const resolved = resolveSurgeryDate({
      manualSelection: "2026-03-10",
      scheduleAnchorAt: "2026-02-13T16:00:00+01:00",
      now: new Date(2026, 2, 11, 8, 0),
    });

    expect(resolved.source).toBe("manual");
    expect(resolved.value).toBe("2026-03-10");
  });

  it("falls back to schedule date when manual selection is invalid", () => {
    const anchor = "2026-02-13T16:00:00+01:00";
    const resolved = resolveSurgeryDate({
      manualSelection: "not-a-date",
      scheduleAnchorAt: anchor,
      now: new Date(2026, 2, 11, 8, 0),
    });

    expect(resolved.source).toBe("schedule");
    expect(resolved.value).toBe(dateOnlyFromDateTime(anchor));
  });

  it("falls back to today when no manual or schedule date exists", () => {
    const now = new Date(2026, 2, 11, 21, 45);
    const resolved = resolveSurgeryDate({ now });

    expect(resolved.source).toBe("today");
    expect(resolved.value).toBe(formatDateOnly(now));
  });

  it("normalizes datetime inputs to date-only strings", () => {
    const datetime = "2026-02-13T16:00:00+01:00";
    expect(dateOnlyFromDateTime(datetime)).toBe(formatDateOnly(new Date(datetime)));
  });

  it("preserves date-only inputs without UTC day shifting", () => {
    expect(dateOnlyFromDateTime("2026-03-11")).toBe("2026-03-11");
  });

  it("computes calendar day differences without time-of-day drift", () => {
    const anchor = new Date(2026, 2, 11, 0, 1);
    expect(calendarDayDiff(new Date(2026, 2, 11, 23, 59), anchor)).toBe(0);
    expect(calendarDayDiff(new Date(2026, 2, 12, 0, 0), anchor)).toBe(1);
  });

  it("normalizes and validates date-only strings", () => {
    expect(normalizeDateOnly("2026-03-11")).toBe("2026-03-11");
    expect(normalizeDateOnly("2026-13-11")).toBeNull();
  });

  it("returns source hints for each source", () => {
    expect(surgeryDateSourceHint("manual")).toBe("Manual override");
    expect(surgeryDateSourceHint("schedule")).toBe("Using schedule");
    expect(surgeryDateSourceHint("today")).toBe("Using today");
  });

  it("formats date-only values for display labels", () => {
    expect(formatSurgeryDateLabel("2026-02-13", "en-US")).toBe("Feb 13, 2026");
  });

  it("shows reset only for manual source", () => {
    expect(canResetSurgeryDate("manual")).toBe(true);
    expect(canResetSurgeryDate("schedule")).toBe(false);
    expect(canResetSurgeryDate("today")).toBe(false);
  });

  it("persists and clears manual override in localStorage", () => {
    saveManualSurgeryDateOverride("2026-03-11");
    expect(localStorage.getItem(SURGERY_DATE_OVERRIDE_KEY)).toBe("2026-03-11");
    expect(loadManualSurgeryDateOverride()).toBe("2026-03-11");

    saveManualSurgeryDateOverride(null);
    expect(localStorage.getItem(SURGERY_DATE_OVERRIDE_KEY)).toBeNull();
    expect(loadManualSurgeryDateOverride()).toBeNull();
  });

  it("ignores malformed persisted override values", () => {
    localStorage.setItem(SURGERY_DATE_OVERRIDE_KEY, "bad");
    expect(loadManualSurgeryDateOverride()).toBeNull();
  });
});
