import { describe, expect, it } from "vitest";
import type { NetworkData } from "./types";
import { networkData } from "./network";
import { validateNetworkData } from "./validation";

describe("network data validation", () => {
  it("has internally consistent temporary network data", () => {
    expect(validateNetworkData(networkData)).toEqual([]);
  });

  it("excludes London Trams", () => {
    expect(networkData.connections.some((connection) => connection.line.includes("tram"))).toBe(false);
    expect(networkData.stations.some((station) => station.name.toLowerCase().includes("tram"))).toBe(false);
  });

  it("only includes London Underground and Elizabeth line services", () => {
    const allowedLines = new Set([
      "bakerloo",
      "central",
      "circle",
      "district",
      "hammersmith-city",
      "jubilee",
      "metropolitan",
      "northern",
      "piccadilly",
      "victoria",
      "waterloo-city",
      "elizabeth",
    ]);

    expect(networkData.connections.every((connection) => allowedLines.has(connection.line))).toBe(true);
    expect(networkData.stations.every((station) => station.lines.every((line) => allowedLines.has(line)))).toBe(true);
  });

  it("allows smooth path turns of at most 45 degrees", () => {
    const network = createPathValidationNetwork([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 1, y: 3 },
      { x: 0, y: 3 },
    ]);

    expect(validateNetworkData(network)).toEqual([]);
  });

  it("rejects sharp 90 degree turns inside a path", () => {
    const network = createPathValidationNetwork([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]);

    expect(validateNetworkData(network)).toContain("Connection central:a:b has sharp turn at path point 1");
  });

  it("rejects direct backtracking inside a path", () => {
    const network = createPathValidationNetwork([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);

    expect(validateNetworkData(network)).toContain("Connection central:a:b has sharp turn at path point 1");
  });
});

function createPathValidationNetwork(path: Array<{ x: number; y: number }>): NetworkData {
  const start = path[0];
  const end = path[path.length - 1];

  return {
    stations: [
      { id: "a", name: "A", x: start.x, y: start.y, lines: ["central"] },
      { id: "b", name: "B", x: end.x, y: end.y, lines: ["central"] },
    ],
    connections: [
      {
        id: "central:a:b",
        from: "a",
        to: "b",
        line: "central",
        path,
      },
    ],
    temporary: true,
    notes: [],
  };
}
