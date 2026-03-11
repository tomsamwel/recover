import { afterEach, describe, expect, it, vi } from "vitest";
import { createMinuteTicker, msUntilNextMinute, ONE_MINUTE_MS } from "./minuteTicker";

describe("minuteTicker", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("computes delay to next minute boundary", () => {
    expect(msUntilNextMinute(new Date("2026-03-11T10:15:20.250Z"))).toBe(39_750);
    expect(msUntilNextMinute(new Date("2026-03-11T10:15:00.000Z"))).toBe(ONE_MINUTE_MS);
  });

  it("ticks on minute boundary and then every minute", () => {
    vi.useFakeTimers();
    const onTick = vi.fn();
    const cleanup = createMinuteTicker(onTick, () => new Date("2026-03-11T10:15:20.000Z"));

    vi.advanceTimersByTime(39_999);
    expect(onTick).toHaveBeenCalledTimes(0);

    vi.advanceTimersByTime(1);
    expect(onTick).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(ONE_MINUTE_MS);
    expect(onTick).toHaveBeenCalledTimes(2);

    cleanup();
    vi.advanceTimersByTime(ONE_MINUTE_MS * 2);
    expect(onTick).toHaveBeenCalledTimes(2);
  });

  it("cleans up safely before first boundary", () => {
    vi.useFakeTimers();
    const onTick = vi.fn();
    const cleanup = createMinuteTicker(onTick, () => new Date("2026-03-11T10:15:59.500Z"));
    cleanup();

    vi.advanceTimersByTime(ONE_MINUTE_MS * 2);
    expect(onTick).toHaveBeenCalledTimes(0);
  });
});
