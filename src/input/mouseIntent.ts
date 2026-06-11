import type { Point } from "../data/types";
import { directionFromVelocity, type MovementDirection } from "../game/movement";

export const POINTER_DIRECTION_UPDATE_DISTANCE = 14;
export const POINTER_IDLE_RESET_MS = 180;

export type MouseIntentState = {
  previousPosition: Point | null;
  accumulatedDelta: Point;
  direction: MovementDirection;
  lastMoveAt: number | null;
};

export function createMouseIntentState(direction: MovementDirection = "east"): MouseIntentState {
  return {
    previousPosition: null,
    accumulatedDelta: { x: 0, y: 0 },
    direction,
    lastMoveAt: null,
  };
}

export function clearMouseIntentPosition(state: MouseIntentState): MouseIntentState {
  return {
    ...state,
    previousPosition: null,
    accumulatedDelta: { x: 0, y: 0 },
    lastMoveAt: null,
  };
}

export function updateMouseIntent(
  state: MouseIntentState,
  currentPosition: Point,
  timestamp: number,
): MouseIntentState {
  if (!state.previousPosition) {
    return {
      ...state,
      previousPosition: currentPosition,
      lastMoveAt: timestamp,
    };
  }

  const shouldResetAccumulation = state.lastMoveAt !== null && timestamp - state.lastMoveAt > POINTER_IDLE_RESET_MS;
  const baseDelta = shouldResetAccumulation ? { x: 0, y: 0 } : state.accumulatedDelta;
  const accumulatedDelta = {
    x: baseDelta.x + currentPosition.x - state.previousPosition.x,
    y: baseDelta.y + currentPosition.y - state.previousPosition.y,
  };

  if (Math.hypot(accumulatedDelta.x, accumulatedDelta.y) < POINTER_DIRECTION_UPDATE_DISTANCE) {
    return {
      ...state,
      previousPosition: currentPosition,
      accumulatedDelta,
      lastMoveAt: timestamp,
    };
  }

  return {
    previousPosition: currentPosition,
    accumulatedDelta: { x: 0, y: 0 },
    direction: directionFromVelocity(
      accumulatedDelta.x,
      accumulatedDelta.y,
      state.direction,
      POINTER_DIRECTION_UPDATE_DISTANCE,
    ),
    lastMoveAt: timestamp,
  };
}

