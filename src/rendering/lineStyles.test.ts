import { describe, expect, it } from "vitest";
import { GRID_CELL_SIZE } from "./grid";
import { LINE_STROKE_WIDTH, STUB_STROKE_WIDTH } from "./lineStyles";
import { getCenteredOffset, PARALLEL_LINE_SPACING, PARALLEL_STUB_SPACING } from "./pathOffset";

describe("line style geometry", () => {
  it("uses one third of a grid cell for underground line strokes", () => {
    expect(LINE_STROKE_WIDTH).toBe(GRID_CELL_SIZE / 3);
    expect(STUB_STROKE_WIDTH).toBe(LINE_STROKE_WIDTH);
  });

  it("centres three parallel lines within one grid cell", () => {
    expect(PARALLEL_LINE_SPACING).toBe(LINE_STROKE_WIDTH);
    expect(PARALLEL_STUB_SPACING).toBe(STUB_STROKE_WIDTH);
    expect([0, 1, 2].map((index) => getCenteredOffset(index, 3, PARALLEL_LINE_SPACING)))
      .toEqual([-GRID_CELL_SIZE / 3, 0, GRID_CELL_SIZE / 3]);
  });
});
