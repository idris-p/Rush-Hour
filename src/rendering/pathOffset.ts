import type { Point } from "../data/types";
import { LINE_STROKE_WIDTH, STUB_STROKE_WIDTH } from "./lineStyles";

export const PARALLEL_LINE_SPACING = LINE_STROKE_WIDTH;
export const PARALLEL_STUB_SPACING = STUB_STROKE_WIDTH;

type PathPoint = {
  x: number;
  y: number;
};

export function getCanonicalPathKey(path: readonly PathPoint[]): string {
  const forward = serializePath(path);
  const reverse = serializePath([...path].reverse());
  return forward <= reverse ? forward : reverse;
}

export function getCanonicalPath<T extends PathPoint>(path: readonly T[]): T[] {
  const forward = serializePath(path);
  const reverse = serializePath([...path].reverse());
  return forward <= reverse ? [...path] : [...path].reverse();
}

export function getCenteredOffset(index: number, count: number, spacing: number): number {
  return (index - (count - 1) / 2) * spacing;
}

export function offsetPolylinePoints(points: Point[], offset: number): Point[] {
  if (points.length < 2 || offset === 0) {
    return points;
  }

  const normals = points.slice(0, -1).map((point, index) => getSegmentNormal(point, points[index + 1]));

  return points.map((point, index) => {
    const normal =
      index === 0
        ? normals[0]
        : index === points.length - 1
          ? normals[normals.length - 1]
          : normalizePoint({
              x: normals[index - 1].x + normals[index].x,
              y: normals[index - 1].y + normals[index].y,
            }) ?? normals[index];

    return {
      x: point.x + normal.x * offset,
      y: point.y + normal.y * offset,
    };
  });
}

function serializePath(path: readonly PathPoint[]): string {
  return path.map((point) => `${point.x},${point.y}`).join(";");
}

function getSegmentNormal(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);

  if (length === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: -dy / length,
    y: dx / length,
  };
}

function normalizePoint(point: Point): Point | null {
  const length = Math.hypot(point.x, point.y);

  if (length === 0) {
    return null;
  }

  return {
    x: point.x / length,
    y: point.y / length,
  };
}
