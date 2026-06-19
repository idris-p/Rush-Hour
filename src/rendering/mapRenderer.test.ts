import { describe, expect, it } from "vitest";
import type { Connection } from "../data/types";
import {
  clampViewCenter,
  getCurrentStationLabelPlacements,
  getDirectionStubStart,
  getDirectionStubUnit,
  getSelectedStationMarkerPoint,
  getStubArrowHeadPoints,
  groupConnectionsByRenderedPath,
} from "./mapRenderer";
import { getOneWayArrowLineSegments } from "./lineRenderer";
import { STUB_STROKE_WIDTH } from "./lineStyles";

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
      { x: 29, y: STUB_STROKE_WIDTH / 2 },
      { x: 29, y: -STUB_STROKE_WIDTH / 2 },
    ]);
  });

  it("uses the same first grid step direction as movement validation", () => {
    const connection: Connection = {
      id: "central:a:b",
      from: "a",
      to: "b",
      line: "central",
      path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: -1 }],
    };

    expect(getDirectionStubUnit(connection, "a")).toEqual({ x: 1, y: 0 });
    expect(getDirectionStubUnit(connection, "b")).toEqual({
      x: -Math.SQRT1_2,
      y: Math.SQRT1_2,
    });
  });

  it("anchors north-facing stubs to the top marker and south-facing stubs to the bottom marker", () => {
    const top = { x: 100, y: 100 };
    const bottom = { x: 100, y: 132 };

    for (const unit of [{ x: 0, y: -1 }, { x: -1, y: -1 }, { x: 1, y: -1 }]) {
      expect(getDirectionStubStart([bottom, top], bottom, unit)).toEqual(top);
    }
    for (const unit of [{ x: 0, y: 1 }, { x: -1, y: 1 }, { x: 1, y: 1 }]) {
      expect(getDirectionStubStart([top, bottom], top, unit)).toEqual(bottom);
    }
  });

  it("anchors east-facing stubs to the right marker and west-facing stubs to the left marker", () => {
    const left = { x: 100, y: 100 };
    const right = { x: 132, y: 100 };

    for (const unit of [{ x: 1, y: 0 }, { x: 1, y: -1 }, { x: 1, y: 1 }]) {
      expect(getDirectionStubStart([left, right], left, unit)).toEqual(right);
    }
    for (const unit of [{ x: -1, y: 0 }, { x: -1, y: -1 }, { x: -1, y: 1 }]) {
      expect(getDirectionStubStart([right, left], right, unit)).toEqual(left);
    }
  });

  it("keeps line-specific anchors for perpendicular and diagonal marker arrangements", () => {
    const linePoint = { x: 132, y: 132 };

    expect(getDirectionStubStart([{ x: 100, y: 100 }, { x: 100, y: 132 }], linePoint, { x: 1, y: 0 }))
      .toEqual(linePoint);
    expect(getDirectionStubStart([{ x: 100, y: 100 }, { x: 132, y: 132 }], linePoint, { x: 0, y: -1 }))
      .toEqual(linePoint);
  });
});

describe("one-way line arrows", () => {
  it("uses two line chevrons for the Piccadilly Heathrow loop", () => {
    expect(getOneWayArrowLineSegments({
      id: "piccadilly:hatton-cross:heathrow-terminal-4",
      from: "hatton-cross",
      to: "heathrow-terminal-4",
      line: "piccadilly",
      path: [],
      oneWay: true,
    })).toEqual([
      [
        { from: { x: -1981, y: 1219 }, to: { x: -1968, y: 1232 } },
        { from: { x: -1955, y: 1219 }, to: { x: -1968, y: 1232 } },
      ],
    ]);

    expect(getOneWayArrowLineSegments({
      id: "piccadilly:heathrow-terminal-2-and-3:heathrow-terminal-4",
      from: "heathrow-terminal-4",
      to: "heathrow-terminal-2-and-3",
      line: "piccadilly",
      path: [],
      oneWay: true,
    })).toEqual([
      [
        { from: { x: -2237, y: 1341 }, to: { x: -2224, y: 1328 } },
        { from: { x: -2211, y: 1341 }, to: { x: -2224, y: 1328 } },
      ],
    ]);
  });

  it("does not draw generic arrows on other one-way connections", () => {
    expect(getOneWayArrowLineSegments({
      id: "central:a:b",
      from: "a",
      to: "b",
      line: "central",
      path: [],
      oneWay: true,
    })).toEqual([]);
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

describe("current station camera anchor", () => {
  it("uses the conjoined marker that contains the selected line", () => {
    const fallback = { x: 100, y: 100 };
    const centralPoint = { x: 80, y: 100 };
    const elizabethPoint = { x: 120, y: 100 };

    expect(getSelectedStationMarkerPoint(
      [
        { point: centralPoint, lines: ["central"] },
        { point: elizabethPoint, lines: ["elizabeth", "jubilee"] },
      ],
      "jubilee",
      fallback,
    )).toBe(elizabethPoint);
  });

  it("falls back to the base station point when the selected line has no marker group", () => {
    const fallback = { x: 100, y: 100 };

    expect(getSelectedStationMarkerPoint(
      [{ point: { x: 80, y: 100 }, lines: ["central"] }],
      "walk",
      fallback,
    )).toBe(fallback);
  });
});

describe("revealed line grouping", () => {
  it("groups duplicate rendered paths even when the source directions are reversed", () => {
    const bakerloo: Connection = {
      id: "bakerloo:charing-cross:embankment",
      from: "charing-cross",
      to: "embankment",
      line: "bakerloo",
      path: [],
    };
    const northern: Connection = {
      id: "northern:charing-cross:embankment",
      from: "embankment",
      to: "charing-cross",
      line: "northern",
      path: [],
    };

    const groups = groupConnectionsByRenderedPath([
      { connection: northern, points: [{ x: 62, y: 15 }, { x: 62, y: 8 }] },
      { connection: bakerloo, points: [{ x: 62, y: 8 }, { x: 62, y: 15 }] },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].map((item) => item.connection.line)).toEqual(["bakerloo", "northern"]);
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
