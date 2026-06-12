import { riverThamesPath } from "./mapDecorations.generated";
import type { GridPoint } from "./types";

export { riverThamesPath };

export function validateRiverThamesPath(path: GridPoint[]): string[] {
  const errors: string[] = [];
  if (path.length < 2) {
    return ["River Thames path must include at least two grid cells"];
  }

  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const current = path[index];
    const dx = Math.abs(current.x - previous.x);
    const dy = Math.abs(current.y - previous.y);
    if (dx > 1 || dy > 1 || (dx === 0 && dy === 0)) {
      errors.push(`River Thames has invalid grid step ${index - 1} -> ${index}`);
    }

    if (index < 2) continue;
    const previousDirection = directionIndex(path[index - 2], previous);
    const currentDirection = directionIndex(previous, current);
    if (previousDirection === null || currentDirection === null) continue;
    if (turnAmount(previousDirection, currentDirection) > 2) {
      errors.push(`River Thames has illegal turn at path point ${index - 1}`);
    }
  }

  return errors;
}

function directionIndex(from: GridPoint, to: GridPoint): number | null {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  return [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]
    .findIndex(([x, y]) => x === dx && y === dy);
}

function turnAmount(previousDirection: number, nextDirection: number): number {
  const difference = Math.abs(previousDirection - nextDirection);
  return Math.min(difference, 8 - difference);
}
