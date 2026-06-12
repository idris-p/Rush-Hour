import { describe, expect, it } from "vitest";
import { clampViewCenter, getCurrentStationLabelPlacements, getStubArrowHeadPoints } from "./mapRenderer";

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

describe("completed map panning", () => {
  it("clamps the camera so it cannot leave the padded map bounds", () => {
    const bounds = { minX: 0, maxX: 1_000, minY: 0, maxY: 800 };
    expect(clampViewCenter({ x: -500, y: 2_000 }, { width: 400, height: 300 }, bounds, 50))
      .toEqual({ x: 150, y: 700 });
  });

  it("centres a viewport that is larger than the map", () => {
    const bounds = { minX: 0, maxX: 100, minY: 20, maxY: 80 };
    expect(clampViewCenter({ x: 0, y: 0 }, { width: 500, height: 400 }, bounds, 20))
      .toEqual({ x: 50, y: 50 });
  });
});
