import { describe, expect, it } from "vitest";
import { createGameState } from "./GameState";
import {
  angleBetweenPoints,
  attemptMove,
  directionFromVelocity,
  findDirectionalNeighbour,
  getStation,
  snapAngleToDirection,
} from "./movement";
import { cycleSelectedLine, getLineCyclePreview } from "./lineSelection";
import type { NetworkData } from "../data/types";

const testNetwork: NetworkData = {
  temporary: true,
  notes: [],
  stations: [
    { id: "a", name: "A", x: 0, y: 0, lines: ["central", "victoria"] },
    { id: "b", name: "B", x: 2, y: -1, lines: ["central"] },
    { id: "c", name: "C", x: 0, y: 1, lines: ["victoria"] },
    { id: "d", name: "D", x: 3, y: -1, lines: ["central"] },
  ],
  connections: [
    { id: "central:a:b", from: "a", to: "b", line: "central", path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: -1 }] },
    { id: "central:b:d", from: "b", to: "d", line: "central", path: [{ x: 2, y: -1 }, { x: 3, y: -1 }] },
    { id: "victoria:a:c", from: "a", to: "c", line: "victoria", path: [{ x: 0, y: 0 }, { x: 0, y: 1 }] },
  ],
};

describe("movement", () => {
  it("snaps pointer angles to the eight tube-map directions", () => {
    expect(snapAngleToDirection(0)).toBe("east");
    expect(snapAngleToDirection(45)).toBe("southeast");
    expect(snapAngleToDirection(90)).toBe("south");
    expect(snapAngleToDirection(135)).toBe("southwest");
    expect(snapAngleToDirection(180)).toBe("west");
    expect(snapAngleToDirection(225)).toBe("northwest");
    expect(snapAngleToDirection(270)).toBe("north");
    expect(snapAngleToDirection(315)).toBe("northeast");
  });

  it("snaps mouse velocity to direction and preserves latest direction when velocity is zero", () => {
    expect(directionFromVelocity(12, 0, "north")).toBe("east");
    expect(directionFromVelocity(8, -8, "south")).toBe("northeast");
    expect(directionFromVelocity(0, 0, "southwest")).toBe("southwest");
  });

  it("finds the line neighbour closest to the intended direction", () => {
    const target = findDirectionalNeighbour(testNetwork, "a", "central", "east");

    expect(target?.id).toBe("b");
  });

  it("rejects movement outside the selected grid direction", () => {
    const state = {
      ...createGameState("movement-reject", testNetwork, 0),
      startStationId: "a",
      destinationStationId: "d",
      currentStationId: "a",
      selectedLineId: "central" as const,
    };

    const result = attemptMove(state, testNetwork, 90, 100);

    expect(result.moved).toBe(false);
    expect(result.state.currentStationId).toBe("a");
    expect(result.state.moveCount).toBe(0);
  });

  it("rejects neighbours that are outside the selected compass direction", () => {
    const state = {
      ...createGameState("movement-snapped-reject", testNetwork, 0),
      startStationId: "a",
      destinationStationId: "d",
      currentStationId: "a",
      selectedLineId: "central" as const,
    };

    const result = attemptMove(state, testNetwork, 24, 100);

    expect(snapAngleToDirection(24)).toBe("southeast");
    expect(result.moved).toBe(false);
    expect(result.reason).toBe("direction-mismatch");
  });

  it("uses the first grid step rather than the overall station direction", () => {
    const state = {
      ...createGameState("movement-first-step", testNetwork, 0),
      startStationId: "a",
      destinationStationId: "d",
      currentStationId: "a",
      selectedLineId: "central" as const,
    };

    const current = getStation(testNetwork, "a");
    const target = getStation(testNetwork, "b");
    const overallDirection = angleBetweenPoints(current, target);

    expect(snapAngleToDirection(overallDirection)).toBe("northeast");
    expect(attemptMove(state, testNetwork, overallDirection, 100).moved).toBe(false);
    expect(attemptMove(state, testNetwork, 0, 100).targetStationId).toBe("b");
  });

  it("moves along connected stations and reveals the travelled connection", () => {
    const state = {
      ...createGameState("movement-accept", testNetwork, 0),
      startStationId: "a",
      destinationStationId: "d",
      currentStationId: "a",
      selectedLineId: "central" as const,
    };

    const result = attemptMove(state, testNetwork, 0, 100);

    expect(result.moved).toBe(true);
    expect(result.state.currentStationId).toBe("b");
    expect(result.state.moveCount).toBe(1);
    expect(result.state.revealedConnections.has("central:a:b")).toBe(true);
  });

  it("marks the run complete when reaching the destination", () => {
    const state = {
      ...createGameState("movement-complete", testNetwork, 0),
      startStationId: "a",
      destinationStationId: "b",
      currentStationId: "a",
      selectedLineId: "central" as const,
    };

    const result = attemptMove(state, testNetwork, 0, 250);

    expect(result.state.completed).toBe(true);
    expect(result.state.endTime).toBe(250);
  });
});

describe("line selection", () => {
  it("cycles only through lines served by the current station", () => {
    const state = {
      ...createGameState("line-cycle", testNetwork, 0),
      currentStationId: "a",
      selectedLineId: "central" as const,
    };

    const next = cycleSelectedLine(state, testNetwork, 1);

    expect(next.selectedLineId).toBe("victoria");
  });

  it("previews the previous and next lines for A and D", () => {
    const state = {
      ...createGameState("line-preview", testNetwork, 0),
      currentStationId: "a",
      selectedLineId: "central" as const,
    };

    expect(getLineCyclePreview(state, testNetwork)).toEqual({
      previous: "victoria",
      current: "central",
      next: "victoria",
      lineCount: 2,
    });
  });

  it("selects and traverses a walk connection", () => {
    const walkNetwork: NetworkData = {
      temporary: true,
      notes: [],
      stations: [
        { id: "bank", name: "Bank", x: 0, y: 0, lines: ["central", "walk"] },
        { id: "monument", name: "Monument", x: 2, y: 0, lines: ["district", "walk"] },
      ],
      connections: [
        { id: "walk:bank:monument", from: "bank", to: "monument", line: "walk", path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] },
      ],
    };
    const initial = {
      ...createGameState("walk", walkNetwork, 0),
      startStationId: "bank",
      destinationStationId: "monument",
      currentStationId: "bank",
      selectedLineId: "central" as const,
    };
    const walking = cycleSelectedLine(initial, walkNetwork, 1);
    const result = attemptMove(walking, walkNetwork, 0, 100);

    expect(walking.selectedLineId).toBe("walk");
    expect(result.moved).toBe(true);
    expect(result.targetStationId).toBe("monument");
  });
});
