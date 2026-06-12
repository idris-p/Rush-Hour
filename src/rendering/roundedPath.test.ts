import { describe, expect, it } from "vitest";
import { createRoundedPathData, simplifyPolylinePoints } from "./roundedPath";

describe("rounded path geometry", () => {
  it("keeps straight routes straight", () => {
    expect(
      createRoundedPathData(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 20, y: 0 },
        ],
        4,
      ),
    ).toBe("M 0 0 L 20 0");
  });

  it("rounds a corner with a quadratic curve", () => {
    expect(
      createRoundedPathData(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
        ],
        4,
      ),
    ).toBe("M 0 0 L 6 0 Q 10 0 10 4 L 10 10");
  });

  it("caps the radius on short segments", () => {
    expect(
      createRoundedPathData(
        [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 4 },
        ],
        10,
      ),
    ).toBe("M 0 0 L 2 0 Q 4 0 4 2 L 4 4");
  });

  it("removes redundant collinear points", () => {
    expect(
      simplifyPolylinePoints([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 5 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
    ]);
  });
});
