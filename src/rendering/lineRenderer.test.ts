import { describe, expect, it } from "vitest";
import { getWalkRevealDashArray } from "./lineRenderer";

describe("walk line reveal dash pattern", () => {
  it("keeps walk dashes visible while hiding the unrevealed tail", () => {
    expect(getWalkRevealDashArray(100, 0)).toBe("0 100");
    expect(getWalkRevealDashArray(100, 0.15)).toBe("12 3 0 85");
    expect(getWalkRevealDashArray(100, 0.25)).toBe("12 10 3 75");
    expect(getWalkRevealDashArray(100, 1)).toBe("12 10");
  });
});
