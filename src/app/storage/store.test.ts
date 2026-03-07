import { beforeEach, describe, expect, it, vi } from "vitest";
import { readJson, updateJson, writeJson } from "./store";

class LocalStorageMock {
  private store = new Map<string, string>();

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  get length() {
    return this.store.size;
  }
}

describe("storage/store", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new LocalStorageMock());
  });

  it("returns fallback for missing keys", () => {
    const fallback = { ok: true };
    expect(readJson("missing", fallback)).toEqual(fallback);
  });

  it("returns fallback for invalid JSON", () => {
    localStorage.setItem("broken", "not-json");
    expect(readJson("broken", { safe: true })).toEqual({ safe: true });
  });

  it("returns fallback when localStorage throws", () => {
    const getItemSpy = vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("boom");
    });

    expect(readJson("any", { safe: true })).toEqual({ safe: true });

    getItemSpy.mockRestore();
  });

  it("writes and reads a JSON value", () => {
    writeJson("roundtrip", { a: 1, b: [2, 3] });
    expect(readJson("roundtrip", null)).toEqual({ a: 1, b: [2, 3] });
  });

  it("updateJson preserves unrelated keys while updating the target shape", () => {
    localStorage.setItem("state", JSON.stringify({ keep: { x: true }, update: { y: false } }));

    updateJson("state", {}, (current) => ({
      ...current,
      update: { y: true },
    }));

    expect(readJson("state", {})).toEqual({
      keep: { x: true },
      update: { y: true },
    });
  });

  it("updateJson no-ops when mutate throws", () => {
    localStorage.setItem("state", JSON.stringify({ keep: true }));

    updateJson("state", {}, () => {
      throw new Error("mutate failed");
    });

    expect(readJson("state", {})).toEqual({ keep: true });
  });
});
