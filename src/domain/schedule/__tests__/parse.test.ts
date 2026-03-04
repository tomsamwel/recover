import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSchedule } from "../parse";

function loadFixture(name: string) {
  const raw = readFileSync(join(process.cwd(), "schedules/defaults", name), "utf-8");
  return JSON.parse(raw);
}

describe("parseSchedule", () => {
  it("parses supported default fixtures", () => {
    for (const name of ["template-v1.json", "demo-small-plan-v1.json", "latarjet_schedule.json"]) {
      const result = parseSchedule(loadFixture(name));
      expect(result.ok, name).toBe(true);
    }
  });


  it("rejects malformed anchors", () => {
    const fixture = loadFixture("template-v1.json");
    fixture.metadata.anchor.at = "not-a-date";
    const result = parseSchedule(fixture);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("Anchor date is malformed");
  });

  it("rejects unsupported versions", () => {
    const fixture = loadFixture("template-v1.json");
    fixture.version = 2;
    const result = parseSchedule(fixture);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain("Unsupported schedule version: 2");
  });

  it("rejects invalid periods and empty required fields", () => {
    const fixture = loadFixture("template-v1.json");
    fixture.metadata.periods[0].endDay = -1;
    fixture.weeks[0].sessions[0].title = "";
    fixture.weeks[0].sessions[0].exercises[0].instructions = "   ";
    const result = parseSchedule(fixture);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((x) => x.includes("endDay before startDay"))).toBe(true);
      expect(result.errors.some((x) => x.includes("title is required"))).toBe(true);
      expect(result.errors.some((x) => x.includes("instructions are required"))).toBe(true);
    }
  });
});
