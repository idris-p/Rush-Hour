import type { Point } from "../data/types";

export const GRID_CELL_SIZE = 32;

export function gridPointToSvgPoint(point: Point): Point {
  return {
    x: point.x * GRID_CELL_SIZE + GRID_CELL_SIZE / 2,
    y: point.y * GRID_CELL_SIZE + GRID_CELL_SIZE / 2,
  };
}

