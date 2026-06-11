import { describe, expect, it } from "vitest";
import type { NetworkData } from "./types";
import { networkData } from "./network";
import { validateNetworkData } from "./validation";

describe("network data validation", () => {
  it("has internally consistent generated network data", () => {
    expect(validateNetworkData(networkData)).toEqual([]);
    expect(networkData.temporary).toBe(false);
    expect(networkData.stations).toHaveLength(297);
    expect(networkData.connections).toHaveLength(413);
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

  it("contains full line-scale coverage and major branch termini", () => {
    const connectionCounts = new Map<string, number>();
    for (const connection of networkData.connections) {
      connectionCounts.set(connection.line, (connectionCounts.get(connection.line) ?? 0) + 1);
    }

    expect(Object.fromEntries(connectionCounts)).toEqual({
      bakerloo: 24,
      central: 49,
      circle: 34,
      district: 59,
      elizabeth: 40,
      "hammersmith-city": 27,
      jubilee: 26,
      metropolitan: 32,
      northern: 53,
      piccadilly: 53,
      victoria: 15,
      "waterloo-city": 1,
    });

    const stationNames = new Set(networkData.stations.map((station) => station.name));
    for (const terminus of [
      "Abbey Wood",
      "Amersham",
      "Cockfosters",
      "Epping",
      "Heathrow Terminal 5",
      "High Barnet",
      "Reading",
      "Richmond",
      "Shenfield",
      "Stanmore",
      "Uxbridge",
      "Watford",
      "West Ruislip",
    ]) {
      expect(stationNames.has(terminus), `Missing terminus ${terminus}`).toBe(true);
    }
  });

  it("excludes stations that are only on unsupported modes", () => {
    const stationNames = new Set(networkData.stations.map((station) => station.name));
    for (const excluded of [
      "Bow Church",
      "City Thameslink",
      "Clapham High Street",
      "Hackney Central",
      "Heron Quays",
      "Star Lane",
      "Tower Gateway",
      "West Croydon",
      "West India Quay",
      "Woolwich Arsenal",
    ]) {
      expect(stationNames.has(excluded), `Unexpected unsupported station ${excluded}`).toBe(false);
    }
  });

  it("keeps every playable station in one connected network", () => {
    const firstStation = networkData.stations[0];
    const visited = new Set<string>([firstStation.id]);
    const queue = [firstStation.id];

    while (queue.length > 0) {
      const stationId = queue.shift();
      for (const connection of networkData.connections) {
        const neighbour =
          connection.from === stationId
            ? connection.to
            : connection.to === stationId
              ? connection.from
              : null;
        if (neighbour && !visited.has(neighbour)) {
          visited.add(neighbour);
          queue.push(neighbour);
        }
      }
    }

    expect(visited.size).toBe(networkData.stations.length);
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
