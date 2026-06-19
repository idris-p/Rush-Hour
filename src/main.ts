import "./style.css";
import { createConnectionId, networkData } from "./data/network";
import { validateNetworkData } from "./data/validation";
import { createGameState, type GameState } from "./game/GameState";
import { generateSeed } from "./game/seed";
import { cycleSelectedLine } from "./game/lineSelection";
import { attemptMoveInDirection } from "./game/movement";
import { bindKeyboardControls } from "./input/keyboard";
import {
  clearMouseIntentPosition,
  createMouseIntentState,
  updateMouseIntent,
} from "./input/mouseIntent";
import { MapRenderer } from "./rendering/mapRenderer";
import { LINE_REVEAL_ANIMATION_SPEED } from "./rendering/lineRenderer";
import { Hud } from "./ui/hud";
import type { Point } from "./data/types";

const REJECTED_MOVE_FLASH_MS = 180;
const STATION_FADE_IN_ANIMATION_SPEED = 1 / 60;

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
let panPointerId: number | null = null;
let lastPanPoint: Point | null = null;
let lineRevealAnimation: {
  connectionId: string;
  fromStationId: string;
  hiddenCurrentStationId: string | null;
  revealLine: boolean;
  startedAt: number;
} | null = null;
let stationFadeAnimation: {
  stationId: string;
  startedAt: number;
} | null = null;

const hud = new Hud(root, networkData, {
  onPlaySeed: (seed) => startRun(seed.trim() === "" ? pendingSeed : seed.trim()),
  onRandomSeed: () => {
    pendingSeed = generateSeed();
    state = null;
    lineRevealAnimation = null;
    stationFadeAnimation = null;
    pointerPoint = null;
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
  lineRevealAnimation = null;
  stationFadeAnimation = null;
  render();
}

function render(now = performance.now()): void {
  if (state) {
    renderer.render(
      state,
      pointerPoint,
      mouseIntent.direction,
      getActiveLineRevealAnimation(now),
      getActiveStationFadeAnimation(now),
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
    const hadStationFadeAnimation = stationFadeAnimation !== null;
    if (lineRevealAnimation && getLineRevealAnimationProgress(now) >= 1) {
      if (lineRevealAnimation.hiddenCurrentStationId) {
        stationFadeAnimation = {
          stationId: lineRevealAnimation.hiddenCurrentStationId,
          startedAt: now,
        };
      }
      lineRevealAnimation = null;
    }
    if (stationFadeAnimation && getStationFadeAnimationProgress(now) >= 1) {
      stationFadeAnimation = null;
    }
    if (hadLineRevealAnimation || hadStationFadeAnimation) {
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

function getActiveStationFadeAnimation(now: number) {
  if (!stationFadeAnimation) {
    return null;
  }

  return {
    stationId: stationFadeAnimation.stationId,
    progress: getStationFadeAnimationProgress(now),
  };
}

function getStationFadeAnimationProgress(now: number): number {
  if (!stationFadeAnimation) {
    return 1;
  }

  return Math.max(0, Math.min(1, (now - stationFadeAnimation.startedAt) * STATION_FADE_IN_ANIMATION_SPEED));
}

bindKeyboardControls((direction) => {
  if (!state) {
    return;
  }

  state = cycleSelectedLine(state, networkData, direction);
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
  mouseIntent = updateMouseIntent(mouseIntent, currentMousePosition, performance.now());
  pointerPoint = currentMousePosition;
  render();
});

renderer.svg.addEventListener("pointerleave", () => {
  if (panPointerId !== null) {
    return;
  }
  pointerPoint = null;
  mouseIntent = clearMouseIntentPosition(mouseIntent);
  render();
});

renderer.svg.addEventListener("click", () => {
  if (!state || state.completed) {
    return;
  }

  const now = performance.now();
  const previousState = state;
  const fromStationId = state.currentStationId;
  const selectedLineId = state.selectedLineId;
  const revealedConnectionsBeforeMove = state.revealedConnections;
  const result = attemptMoveInDirection(state, networkData, mouseIntent.direction, now);
  state = result.state;

  if (result.moved && result.targetStationId) {
    const connectionId = createConnectionId(selectedLineId, fromStationId, result.targetStationId);
    const revealLine = !revealedConnectionsBeforeMove.has(connectionId);
    stationFadeAnimation = null;
    lineRevealAnimation = {
      connectionId,
      fromStationId,
      hiddenCurrentStationId: revealLine && !isStationVisible(result.targetStationId, previousState, revealedConnectionsBeforeMove)
        ? result.targetStationId
        : null,
      revealLine,
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

  render();
});

renderer.svg.addEventListener("wheel", (event) => {
  if (!state) {
    return;
  }

  event.preventDefault();
  renderer.zoomByWheel(event.deltaY);
  render();
}, { passive: false });

renderer.svg.addEventListener("pointerdown", (event) => {
  if (!state?.completed || event.button !== 0) {
    return;
  }

  panPointerId = event.pointerId;
  lastPanPoint = { x: event.clientX, y: event.clientY };
  renderer.svg.setPointerCapture(event.pointerId);
  renderer.svg.classList.add("tube-map-panning");
  event.preventDefault();
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

renderer.svg.addEventListener("pointerup", endPan);
renderer.svg.addEventListener("pointercancel", endPan);

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
