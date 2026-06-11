import { describe, expect, it } from "vitest";
import { networkData } from "../data/network";
import { pickStartAndDestination } from "./seed";

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
});

