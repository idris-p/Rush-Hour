import "./style.css";
import { createConnectionId, networkData } from "./data/network";
import { validateNetworkData } from "./data/validation";
import { createGameState, type GameState } from "./game/GameState";
import { generateSeed } from "./game/seed";
import { cycleSelectedLine } from "./game/lineSelection";
import { attemptMoveInDirection, type MovementDirection } from "./game/movement";
import { bindKeyboardControls } from "./input/keyboard";
import {
  clearMouseIntentPosition,
  createMouseIntentState,
  updateMouseIntent,
} from "./input/mouseIntent";
import { MapRenderer } from "./rendering/mapRenderer";
import { LINE_REVEAL_ANIMATION_SPEED } from "./rendering/lineRenderer";
import { GRID_CELL_SIZE } from "./rendering/grid";
import { STATION_WIPE_COMPONENT_RADIUS } from "./rendering/stationRenderer";
import { Hud } from "./ui/hud";
import type { Point } from "./data/types";

const REJECTED_MOVE_FLASH_MS = 180;
const LINE_SWITCH_CAMERA_PAN_SPEED = 1 / 160;
const LINE_REVEAL_ANIMATION_DURATION_MS = 1 / LINE_REVEAL_ANIMATION_SPEED;

// Start when the line head reaches the largest current-station marker radius on the shortest grid move,
// then finish the wipe exactly as the line reveal reaches the station centre.
const STATION_WIPE_START_LINE_PROGRESS = Math.max(
  0,
  1 - STATION_WIPE_COMPONENT_RADIUS / GRID_CELL_SIZE,
);
const STATION_WIPE_ANIMATION_SPEED =
  1 / ((1 - STATION_WIPE_START_LINE_PROGRESS) * LINE_REVEAL_ANIMATION_DURATION_MS);

const root = document.querySelector<HTMLElement>("#app");
if (!root) {
  throw new Error("Missing #app root.");
}

const validationErrors = validateNetworkData(networkData);
if (validationErrors.length > 0) {
  throw new Error(`Invalid network data:\n${validationErrors.join("\n")}`);
}

let state: GameState | null = null;
let pointerPoint: Point | null = null;
let mouseIntent = createMouseIntentState();
let pendingSeed = generateSeed();
let activeMovePointerId: number | null = null;
let heldMoveConsumed = false;
let lastHeldMoveAttemptDirection: MovementDirection | null = null;
let panPointerId: number | null = null;
let lastPanPoint: Point | null = null;
let lineRevealAnimation: {
  connectionId: string;
  fromStationId: string;
  hiddenCurrentStationId: string | null;
  revealLine: boolean;
  direction: MovementDirection;
  stationWipeStarted: boolean;
  startedAt: number;
} | null = null;
let stationWipeAnimation: {
  stationId: string;
  direction: MovementDirection;
  startedAt: number;
} | null = null;
let cameraPanAnimation: {
  from: Point;
  to: Point;
  startedAt: number;
} | null = null;

const hud = new Hud(root, networkData, {
  onPlaySeed: (seed) => startRun(seed.trim() === "" ? pendingSeed : seed.trim()),
  onRandomSeed: () => {
    pendingSeed = generateSeed();
    state = null;
    lineRevealAnimation = null;
    stationWipeAnimation = null;
    cameraPanAnimation = null;
    pointerPoint = null;
    activeMovePointerId = null;
    heldMoveConsumed = false;
    lastHeldMoveAttemptDirection = null;
    mouseIntent = createMouseIntentState();
    hud.setSeed(pendingSeed);
    render();
  },
  onZoomIn: () => {
    renderer.zoomIn();
    render();
  },
  onZoomOut: () => {
    renderer.zoomOut();
    render();
  },
});

const renderer = new MapRenderer(hud.mapHost, networkData);
hud.setSeed(pendingSeed);

function startRun(seed: string): void {
  pendingSeed = seed;
  state = createGameState(seed, networkData, performance.now());
  pointerPoint = null;
  mouseIntent = createMouseIntentState();
  activeMovePointerId = null;
  heldMoveConsumed = false;
  lastHeldMoveAttemptDirection = null;
  lineRevealAnimation = null;
  stationWipeAnimation = null;
  cameraPanAnimation = null;
  render();
}

function render(now = performance.now()): void {
  if (state) {
    renderer.render(
      state,
      pointerPoint,
      mouseIntent.direction,
      getActiveLineRevealAnimation(now),
      getActiveStationWipeAnimation(now),
      getActiveCameraPanAnimation(now),
    );
  } else {
    renderer.renderIdle();
  }
  hud.update(state, now);
}

function tick(): void {
  const now = performance.now();
  if (state) {
    const hadLineRevealAnimation = lineRevealAnimation !== null;
    const hadStationWipeAnimation = stationWipeAnimation !== null;
    const hadCameraPanAnimation = cameraPanAnimation !== null;
    const lineRevealProgress = getLineRevealAnimationProgress(now);
    if (
      lineRevealAnimation?.hiddenCurrentStationId &&
      !lineRevealAnimation.stationWipeStarted &&
      lineRevealProgress >= STATION_WIPE_START_LINE_PROGRESS
    ) {
      stationWipeAnimation = {
        stationId: lineRevealAnimation.hiddenCurrentStationId,
        direction: lineRevealAnimation.direction,
        startedAt: now,
      };
      lineRevealAnimation.stationWipeStarted = true;
    }
    if (lineRevealAnimation && lineRevealProgress >= 1) {
      lineRevealAnimation = null;
    }
    if (stationWipeAnimation && getStationWipeAnimationProgress(now) >= 1) {
      stationWipeAnimation = null;
    }
    if (cameraPanAnimation && getCameraPanAnimationProgress(now) >= 1) {
      cameraPanAnimation = null;
    }
    if (hadLineRevealAnimation || hadStationWipeAnimation || hadCameraPanAnimation) {
      render(now);
    } else {
      hud.update(state, now);
    }
  }
  requestAnimationFrame(tick);
}

function getActiveLineRevealAnimation(now: number) {
  if (!lineRevealAnimation) {
    return null;
  }

  return {
    connectionId: lineRevealAnimation.connectionId,
    fromStationId: lineRevealAnimation.fromStationId,
    hiddenCurrentStationId: lineRevealAnimation.hiddenCurrentStationId,
    revealLine: lineRevealAnimation.revealLine,
    progress: getLineRevealAnimationProgress(now),
  };
}

function getLineRevealAnimationProgress(now: number): number {
  if (!lineRevealAnimation) {
    return 1;
  }

  return Math.max(0, Math.min(1, (now - lineRevealAnimation.startedAt) * LINE_REVEAL_ANIMATION_SPEED));
}

function getActiveStationWipeAnimation(now: number) {
  if (!stationWipeAnimation) {
    return null;
  }

  return {
    stationId: stationWipeAnimation.stationId,
    direction: stationWipeAnimation.direction,
    progress: getStationWipeAnimationProgress(now),
  };
}

function getStationWipeAnimationProgress(now: number): number {
  if (!stationWipeAnimation) {
    return 1;
  }

  return Math.max(0, Math.min(1, (now - stationWipeAnimation.startedAt) * STATION_WIPE_ANIMATION_SPEED));
}

function getActiveCameraPanAnimation(now: number) {
  if (!cameraPanAnimation) {
    return null;
  }

  return {
    from: cameraPanAnimation.from,
    to: cameraPanAnimation.to,
    progress: getCameraPanAnimationProgress(now),
  };
}

function getCameraPanAnimationProgress(now: number): number {
  if (!cameraPanAnimation) {
    return 1;
  }

  return Math.max(0, Math.min(1, (now - cameraPanAnimation.startedAt) * LINE_SWITCH_CAMERA_PAN_SPEED));
}

bindKeyboardControls((direction) => {
  if (!state) {
    return;
  }

  const previousState = state;
  state = cycleSelectedLine(state, networkData, direction);
  const pan = renderer.getLineSwitchCameraPan(previousState, state);
  if (!lineRevealAnimation && pan) {
    cameraPanAnimation = { ...pan, startedAt: performance.now() };
  } else {
    cameraPanAnimation = null;
  }
  tryHeldPointerMove(performance.now(), true);
  render();
});

renderer.svg.addEventListener("pointermove", (event) => {
  if (!state) {
    return;
  }

  if (panPointerId === event.pointerId && lastPanPoint) {
    renderer.panByClientDelta(event.clientX - lastPanPoint.x, event.clientY - lastPanPoint.y);
    lastPanPoint = { x: event.clientX, y: event.clientY };
    render();
    return;
  }

  if (state.completed) {
    return;
  }

  const currentMousePosition = { x: event.clientX, y: event.clientY };
  const previousDirection = mouseIntent.direction;
  mouseIntent = updateMouseIntent(mouseIntent, currentMousePosition, performance.now());
  pointerPoint = currentMousePosition;
  if (activeMovePointerId === event.pointerId) {
    tryHeldPointerMove(performance.now(), mouseIntent.direction !== previousDirection);
  }
  render();
});

renderer.svg.addEventListener("pointerleave", () => {
  if (panPointerId !== null || activeMovePointerId !== null) {
    return;
  }
  pointerPoint = null;
  mouseIntent = clearMouseIntentPosition(mouseIntent);
  render();
});

function attemptMoveFromCurrentIntent(now: number): boolean {
  if (!state || state.completed) {
    return false;
  }

  const previousState = state;
  const fromStationId = state.currentStationId;
  const selectedLineId = state.selectedLineId;
  const revealedConnectionsBeforeMove = state.revealedConnections;
  const result = attemptMoveInDirection(state, networkData, mouseIntent.direction, now);
  state = result.state;

  if (result.moved && result.targetStationId) {
    const connectionId = createConnectionId(selectedLineId, fromStationId, result.targetStationId);
    const revealLine = !revealedConnectionsBeforeMove.has(connectionId);
    stationWipeAnimation = null;
    cameraPanAnimation = null;
    lineRevealAnimation = {
      connectionId,
      fromStationId,
      hiddenCurrentStationId: revealLine && !isStationVisible(result.targetStationId, previousState, revealedConnectionsBeforeMove)
        ? result.targetStationId
        : null,
      revealLine,
      direction: mouseIntent.direction,
      stationWipeStarted: false,
      startedAt: now,
    };
  }

  if (state.completed) {
    pointerPoint = null;
    mouseIntent = clearMouseIntentPosition(mouseIntent);
  }

  if (!result.moved && state.rejectedMoveAt !== null) {
    const rejectedMoveAt = state.rejectedMoveAt;
    window.setTimeout(() => {
      if (!state || state.rejectedMoveAt !== rejectedMoveAt) {
        return;
      }

      state = { ...state, rejectedMoveAt: null };
      render();
    }, REJECTED_MOVE_FLASH_MS);
  }

  return result.moved;
}

function tryHeldPointerMove(now: number, forceAttempt = false): void {
  if (activeMovePointerId === null || heldMoveConsumed || !state || state.completed) {
    return;
  }

  if (!forceAttempt && lastHeldMoveAttemptDirection === mouseIntent.direction) {
    return;
  }

  lastHeldMoveAttemptDirection = mouseIntent.direction;
  heldMoveConsumed = attemptMoveFromCurrentIntent(now);
}

renderer.svg.addEventListener("wheel", (event) => {
  if (!state) {
    return;
  }

  event.preventDefault();
  renderer.zoomByWheel(event.deltaY);
  render();
}, { passive: false });

renderer.svg.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) {
    return;
  }

  if (state && !state.completed) {
    activeMovePointerId = event.pointerId;
    heldMoveConsumed = false;
    lastHeldMoveAttemptDirection = null;
    pointerPoint = { x: event.clientX, y: event.clientY };
    mouseIntent = updateMouseIntent(mouseIntent, pointerPoint, performance.now());
    renderer.svg.setPointerCapture(event.pointerId);
    event.preventDefault();
    tryHeldPointerMove(performance.now(), true);
    render();
    return;
  }

  if (state?.completed) {
    panPointerId = event.pointerId;
    lastPanPoint = { x: event.clientX, y: event.clientY };
    renderer.svg.setPointerCapture(event.pointerId);
    renderer.svg.classList.add("tube-map-panning");
    event.preventDefault();
  }
});

function endPan(event: PointerEvent): void {
  if (panPointerId !== event.pointerId) {
    return;
  }

  if (renderer.svg.hasPointerCapture(event.pointerId)) {
    renderer.svg.releasePointerCapture(event.pointerId);
  }
  panPointerId = null;
  lastPanPoint = null;
  renderer.svg.classList.remove("tube-map-panning");
}

function endMovePointer(event: PointerEvent): void {
  if (activeMovePointerId !== event.pointerId) {
    return;
  }

  if (renderer.svg.hasPointerCapture(event.pointerId)) {
    renderer.svg.releasePointerCapture(event.pointerId);
  }
  activeMovePointerId = null;
  heldMoveConsumed = false;
  lastHeldMoveAttemptDirection = null;
}

renderer.svg.addEventListener("pointerup", (event) => {
  endMovePointer(event);
  endPan(event);
});
renderer.svg.addEventListener("pointercancel", (event) => {
  endMovePointer(event);
  endPan(event);
});

render();
requestAnimationFrame(tick);

function isStationVisible(
  stationId: string,
  currentState: GameState,
  revealedConnectionIds: Set<string>,
): boolean {
  if (currentState.currentStationId === stationId || currentState.startStationId === stationId) {
    return true;
  }

  return networkData.connections.some(
    (connection) =>
      revealedConnectionIds.has(connection.id) &&
      (connection.from === stationId || connection.to === stationId),
  );
}
