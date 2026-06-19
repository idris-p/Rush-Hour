import { describe, expect, it } from "vitest";
import type { NetworkData, Station } from "../data/types";
import {
  CONJOINED_CENTRE_LINE_WIDTH,
  STATION_BAR_MARKER_LENGTH,
  getSelectedLineDashArray,
  getStationLineDirection,
  isInterchangeStation,
} from "./stationRenderer";
import { GRID_CELL_SIZE } from "./grid";

describe("station marker geometry", () => {
  it("only treats playable multi-line and walk-linked stations as interchanges", () => {
    expect(isInterchangeStation(station(["central"]))).toBe(false);
    expect(isInterchangeStation(station(["central", "victoria"]))).toBe(true);
    expect(isInterchangeStation(station(["central", "walk"]))).toBe(true);
  });

  it("treats Northern line branch transfer stations as interchanges", () => {
    expect(isInterchangeStation(station(["northern"], "Camden Town"))).toBe(true);
    expect(isInterchangeStation(station(["northern"], "Kennington"))).toBe(true);
  });

  it("uses the through-axis of a station line", () => {
    const network = createNetwork([
      connection("west", "centre", [{ x: -2, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 0 }]),
      connection("centre", "east", [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]),
    ]);

    expect(getStationLineDirection(network, "centre", "central")).toEqual({ x: 1, y: 0 });
  });

  it("selects the most opposed pair as the through-axis at a branch", () => {
    const network = createNetwork([
      connection("west", "centre", [{ x: -2, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 0 }]),
      connection("centre", "east", [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]),
      connection("centre", "south-east", [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }]),
    ]);

    expect(getStationLineDirection(network, "centre", "central")).toEqual({ x: 1, y: 0 });
  });

  it("uses the walk dash pattern for selected station outlines", () => {
    expect(getSelectedLineDashArray("walk")).toBe("8 6");
    expect(getSelectedLineDashArray("district")).toBeNull();
  });

  it("keeps the conjoined centre line thin", () => {
    expect(CONJOINED_CENTRE_LINE_WIDTH).toBeGreaterThan(0);
  });

  it("uses a one-cell marker height for non-interchange stations", () => {
    expect(STATION_BAR_MARKER_LENGTH).toBe(GRID_CELL_SIZE);
  });
});

function station(lines: Station["lines"], name = "Centre"): Station {
  return { id: "centre", name, x: 0, y: 0, lines };
}

function connection(from: string, to: string, path: Array<{ x: number; y: number }>) {
  return { id: `central:${from}:${to}`, from, to, line: "central" as const, path };
}

function createNetwork(connections: NetworkData["connections"]): NetworkData {
  return { stations: [], connections, temporary: true, notes: [] };
}
