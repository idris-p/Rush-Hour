export const ROUND_COUNT = 5;

export type RoundConfig = {
  startStationId: string;
  destinationStationId: string;
};

export type RoundStats = {
  roundNumber: number;
  timeMs: number;
  moves: number;
  lineChanges: number;
};

export type RunState = {
  seed: string;
  seedSource: "random" | "set";
  rounds: RoundConfig[];
  currentRoundIndex: number;
  completedRoundStats: RoundStats[];
};

export type RunResults = {
  seed: string;
  seedSource: "random" | "set";
  rounds: RoundConfig[];
  roundStats: RoundStats[];
};
