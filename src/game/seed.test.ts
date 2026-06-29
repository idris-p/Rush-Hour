import { describe, expect, it } from "vitest";
import { networkData } from "../data/network";
import { generateRoundConfigs, pickStartAndDestination } from "./seed";

describe("seed selection", () => {
  it("selects the same stations for the same seed", () => {
    const first = pickStartAndDestination("test-seed", networkData);
    const second = pickStartAndDestination("test-seed", networkData);

    expect(second).toEqual(first);
  });

  it("selects different start and destination stations", () => {
    const selection = pickStartAndDestination("not-a-trivial-route", networkData);

    expect(selection.startStationId).not.toBe(selection.destinationStationId);
  });

  it("generates the same five rounds for the same seed", () => {
    const first = generateRoundConfigs("five-round-seed", networkData);
    const second = generateRoundConfigs("five-round-seed", networkData);

    expect(first).toHaveLength(5);
    expect(second).toEqual(first);
  });

  it("generates valid start and destination stations for each round", () => {
    const stationIds = new Set(networkData.stations.map((station) => station.id));
    const rounds = generateRoundConfigs("valid-rounds", networkData);

    for (const round of rounds) {
      expect(stationIds.has(round.startStationId)).toBe(true);
      expect(stationIds.has(round.destinationStationId)).toBe(true);
      expect(round.startStationId).not.toBe(round.destinationStationId);
    }
  });
});
