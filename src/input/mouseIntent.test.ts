import { describe, expect, it } from "vitest";
import {
  clearMouseIntentPosition,
  createMouseIntentState,
  updateMouseIntent,
} from "./mouseIntent";

describe("mouse intent", () => {
  it("keeps the current direction for micro movements", () => {
    let state = createMouseIntentState("north");
    state = updateMouseIntent(state, { x: 100, y: 100 }, 0);
    state = updateMouseIntent(state, { x: 103, y: 101 }, 10);
    state = updateMouseIntent(state, { x: 104, y: 98 }, 20);

    expect(state.direction).toBe("north");
  });

  it("updates direction after accumulated deliberate movement", () => {
    let state = createMouseIntentState("north");
    state = updateMouseIntent(state, { x: 100, y: 100 }, 0);
    state = updateMouseIntent(state, { x: 108, y: 100 }, 10);
    state = updateMouseIntent(state, { x: 116, y: 100 }, 20);

    expect(state.direction).toBe("east");
    expect(state.accumulatedDelta).toEqual({ x: 0, y: 0 });
  });

  it("keeps the latest direction when position tracking is cleared", () => {
    const state = clearMouseIntentPosition(createMouseIntentState("southwest"));

    expect(state.direction).toBe("southwest");
    expect(state.previousPosition).toBeNull();
  });
});

