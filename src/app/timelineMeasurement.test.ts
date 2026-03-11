import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachTimelineMeasurement, scheduleTimelineMeasurement } from "./timelineMeasurement";

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = [];
  observe = vi.fn();
  disconnect = vi.fn();
  constructor(_cb: ResizeObserverCallback) {
    ResizeObserverMock.instances.push(this);
  }
}

describe("timelineMeasurement", () => {
  beforeEach(() => {
    ResizeObserverMock.instances = [];
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("addEventListener", vi.fn());
    vi.stubGlobal("removeEventListener", vi.fn());
    vi.stubGlobal("requestAnimationFrame", vi.fn((cb: FrameRequestCallback) => {
      cb(16);
      return 7;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("attaches one observer + resize listener and cleans up", () => {
    const addSpy = vi.spyOn(globalThis, "addEventListener");
    const removeSpy = vi.spyOn(globalThis, "removeEventListener");
    const measure = vi.fn();
    const container = {} as Element;

    const cleanup = attachTimelineMeasurement(container, measure);

    expect(addSpy).toHaveBeenCalledWith("resize", measure);
    expect(ResizeObserverMock.instances).toHaveLength(1);
    expect(ResizeObserverMock.instances[0].observe).toHaveBeenCalledWith(container);

    cleanup();

    expect(ResizeObserverMock.instances[0].disconnect).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledWith("resize", measure);
  });

  it("schedules and cancels requestAnimationFrame measurement", () => {
    const measure = vi.fn();
    const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame");
    const cancelSpy = vi.spyOn(globalThis, "cancelAnimationFrame");

    const cleanup = scheduleTimelineMeasurement(measure);
    expect(rafSpy).toHaveBeenCalledTimes(1);
    expect(measure).toHaveBeenCalledTimes(1);

    cleanup();
    expect(cancelSpy).toHaveBeenCalledWith(7);
  });
});
