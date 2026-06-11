import { describe, expect, it } from "vitest";
import { getCanonicalPathKey, getCenteredOffset, offsetPolylinePoints } from "./pathOffset";

describe("path offsets", () => {
  it("uses the same key for reversed paths", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 1 },
    ];

    expect(getCanonicalPathKey(path)).toBe(getCanonicalPathKey([...path].reverse()));
  });

  it("centres parallel offsets around the original path", () => {
    expect([0, 1].map((index) => getCenteredOffset(index, 2, 6))).toEqual([-3, 3]);
    expect([0, 1, 2].map((index) => getCenteredOffset(index, 3, 6))).toEqual([-6, 0, 6]);
  });

  it("offsets a horizontal path perpendicularly", () => {
    expect(
      offsetPolylinePoints(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        3,
      ),
    ).toEqual([
      { x: 0, y: 3 },
      { x: 10, y: 3 },
    ]);
  });
});

