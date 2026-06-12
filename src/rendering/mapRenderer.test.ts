import { describe, expect, it } from "vitest";
import { getCurrentStationLabelPlacements, getStubArrowHeadPoints } from "./mapRenderer";

describe("direction stub arrows", () => {
  it("aligns an arrow head with the outgoing route direction", () => {
    expect(
      getStubArrowHeadPoints(
        { x: 40, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ),
    ).toEqual([
      { x: 40, y: 0 },
      { x: 29, y: 8 },
      { x: 29, y: -8 },
    ]);
  });
});

describe("current station label placement", () => {
  it("searches close positions before progressively farther ones", () => {
    const placements = getCurrentStationLabelPlacements();
    expect(placements[0]).toEqual({ x: 26, y: 5, textAnchor: "start" });
    expect(Math.hypot(placements[7].x, placements[7].y - 12)).toBeCloseTo(26);
    expect(Math.hypot(placements[8].x, placements[8].y - 5)).toBeCloseTo(32);
  });
});
