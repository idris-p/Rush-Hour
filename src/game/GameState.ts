import type { LineId, NetworkData } from "../data/types";
import { pickStartAndDestination } from "./seed";

export type GameState = {
  seed: string;
  startStationId: string;
  destinationStationId: string;
  currentStationId: string;
  selectedLineId: LineId;
  revealedConnections: Set<string>;
  moveCount: number;
  startTime: number;
  endTime: number | null;
  completed: boolean;
  rejectedMoveAt: number | null;
};

export function createGameState(seed: string, network: NetworkData, now: number): GameState {
  const selection = pickStartAndDestination(seed, network);
  const startStation = network.stations.find((station) => station.id === selection.startStationId);

  if (!startStation || startStation.lines.length === 0) {
    throw new Error(`Seed selected invalid start station: ${selection.startStationId}`);
  }

  return {
    seed,
    startStationId: selection.startStationId,
    destinationStationId: selection.destinationStationId,
    currentStationId: selection.startStationId,
    selectedLineId: startStation.lines[0],
    revealedConnections: new Set<string>(),
    moveCount: 0,
    startTime: now,
    endTime: null,
    completed: false,
    rejectedMoveAt: null,
  };
}

export function getElapsedMilliseconds(state: GameState, now: number): number {
  return Math.max(0, (state.endTime ?? now) - state.startTime);
}

