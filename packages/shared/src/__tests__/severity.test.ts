import { describe, expect, it } from "bun:test";
import { compareSeverity, isBlockingSeverity, severityWeight } from "../severity";
import type { Severity } from "../types";

// ---------------------------------------------------------------------------
// severityWeight
// ---------------------------------------------------------------------------

describe("severityWeight", () => {
  it("returns 10 for critical", () => {
    expect(severityWeight("critical")).toBe(10);
  });

  it("returns 7 for high", () => {
    expect(severityWeight("high")).toBe(7);
  });

  it("returns 4 for medium", () => {
    expect(severityWeight("medium")).toBe(4);
  });

  it("returns 2 for low", () => {
    expect(severityWeight("low")).toBe(2);
  });

  it("returns 0 for info", () => {
    expect(severityWeight("info")).toBe(0);
  });

  it("returns weights in strictly descending order", () => {
    const levels: Severity[] = ["critical", "high", "medium", "low", "info"];
    for (let i = 0; i < levels.length - 1; i++) {
      expect(severityWeight(levels[i])).toBeGreaterThan(severityWeight(levels[i + 1]));
    }
  });
});

// ---------------------------------------------------------------------------
// compareSeverity
// ---------------------------------------------------------------------------

describe("compareSeverity", () => {
  it("returns 0 when both severities are equal", () => {
    const levels: Severity[] = ["critical", "high", "medium", "low", "info"];
    for (const level of levels) {
      expect(compareSeverity(level, level)).toBe(0);
    }
  });

  it("returns negative when first severity is more severe", () => {
    expect(compareSeverity("critical", "high")).toBeLessThan(0);
    expect(compareSeverity("critical", "info")).toBeLessThan(0);
    expect(compareSeverity("high", "medium")).toBeLessThan(0);
    expect(compareSeverity("medium", "low")).toBeLessThan(0);
    expect(compareSeverity("low", "info")).toBeLessThan(0);
  });

  it("returns positive when first severity is less severe", () => {
    expect(compareSeverity("info", "critical")).toBeGreaterThan(0);
    expect(compareSeverity("low", "high")).toBeGreaterThan(0);
    expect(compareSeverity("medium", "critical")).toBeGreaterThan(0);
  });

  it("can be used to sort an array from most to least severe", () => {
    const unsorted: Severity[] = ["low", "critical", "info", "high", "medium"];
    const sorted = [...unsorted].sort(compareSeverity);
    expect(sorted).toEqual(["critical", "high", "medium", "low", "info"]);
  });

  it("preserves stable order for equal elements during sort", () => {
    const input: Severity[] = ["high", "high", "low", "low"];
    const sorted = [...input].sort(compareSeverity);
    expect(sorted).toEqual(["high", "high", "low", "low"]);
  });
});

// ---------------------------------------------------------------------------
// isBlockingSeverity
// ---------------------------------------------------------------------------

describe("isBlockingSeverity", () => {
  it("returns true for critical severity", () => {
    expect(isBlockingSeverity("critical")).toBe(true);
  });

  it("returns true for high severity", () => {
    expect(isBlockingSeverity("high")).toBe(true);
  });

  it("returns false for medium severity", () => {
    expect(isBlockingSeverity("medium")).toBe(false);
  });

  it("returns false for low severity", () => {
    expect(isBlockingSeverity("low")).toBe(false);
  });

  it("returns false for info severity", () => {
    expect(isBlockingSeverity("info")).toBe(false);
  });

  it("only the two highest severities are blocking", () => {
    const blocking: Severity[] = ["critical", "high"];
    const nonBlocking: Severity[] = ["medium", "low", "info"];

    for (const s of blocking) {
      expect(isBlockingSeverity(s)).toBe(true);
    }
    for (const s of nonBlocking) {
      expect(isBlockingSeverity(s)).toBe(false);
    }
  });
});
