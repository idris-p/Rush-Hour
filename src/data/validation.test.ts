import { describe, expect, it } from "vitest";
import type { NetworkData } from "./types";
import { networkData } from "./network";
import { validateNetworkData } from "./validation";

describe("network data validation", () => {
  it("has internally consistent generated network data", () => {
    expect(validateNetworkData(networkData)).toEqual([]);
    expect(networkData.temporary).toBe(false);
    expect(networkData.stations).toHaveLength(302);
    expect(networkData.connections).toHaveLength(421);
  });

  it("excludes London Trams", () => {
    expect(networkData.connections.some((connection) => connection.line.includes("tram"))).toBe(false);
    expect(networkData.stations.some((station) => station.name.toLowerCase().includes("tram"))).toBe(false);
  });

  it("only includes London Underground, Elizabeth line, and walk connections", () => {
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
      "walk",
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
      circle: 35,
      district: 59,
      elizabeth: 40,
      "hammersmith-city": 28,
      jubilee: 26,
      metropolitan: 33,
      northern: 53,
      piccadilly: 53,
      victoria: 15,
      walk: 5,
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

  it("rejects a line that creates an unnecessary hump", () => {
    const network = createPathValidationNetwork([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: -1 },
      { x: 3, y: -1 },
      { x: 4, y: 0 },
      { x: 5, y: 0 },
    ]);

    expect(validateNetworkData(network)).toContain("Connection central:a:b contains an unnecessary hump");
  });

  it("rejects a short stair-step zig-zag", () => {
    const network = createPathValidationNetwork([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ]);

    expect(validateNetworkData(network)).toContain("Connection central:a:b contains a short zig-zag");
  });

  it("rejects an excessive avoidable detour", () => {
    const network = createPathValidationNetwork([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 1, y: 3 },
      { x: 0, y: 3 },
      { x: -1, y: 3 },
    ]);

    expect(validateNetworkData(network)).toContain("Connection central:a:b has an excessive detour");
  });

  it("keeps named out-of-station interchanges as separate walk-linked nodes", () => {
    const stationByName = new Map(networkData.stations.map((station) => [station.name, station]));
    const bank = stationByName.get("Bank");
    const monument = stationByName.get("Monument");
    const liverpoolStreet = stationByName.get("Liverpool Street");
    const moorgate = stationByName.get("Moorgate");

    expect(bank?.lines).not.toContain("circle");
    expect(monument?.lines).toEqual(expect.arrayContaining(["circle", "district", "walk"]));
    expect(liverpoolStreet?.lines).not.toContain("northern");
    expect(moorgate?.lines).toEqual(expect.arrayContaining(["northern", "walk"]));
    expect(hasConnection("Bank", "Monument", "walk")).toBe(true);
    expect(hasConnection("Liverpool Street", "Moorgate", "walk")).toBe(true);
  });

  it("rejects stations in adjacent grid cells without a walk link", () => {
    const network = createPathValidationNetwork([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    expect(validateNetworkData(network)).toContain("Stations a and b are in adjacent grid cells");
  });

  it("allows adjacent stations when they are directly walk-linked", () => {
    const network = createPathValidationNetwork([{ x: 0, y: 0 }, { x: 1, y: 1 }], "walk");
    expect(validateNetworkData(network)).toEqual([]);
  });

  it("rejects duplicate first-step directions at a line branch", () => {
    const network: NetworkData = {
      stations: [
        { id: "a", name: "A", x: 0, y: 0, lines: ["central"] },
        { id: "b", name: "B", x: 3, y: 0, lines: ["central"] },
        { id: "c", name: "C", x: 3, y: 2, lines: ["central"] },
      ],
      connections: [
        { id: "central:a:b", from: "a", to: "b", line: "central", path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }] },
        { id: "central:a:c", from: "a", to: "c", line: "central", path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 1 }, { x: 3, y: 2 }] },
      ],
      temporary: true,
      notes: [],
    };

    expect(validateNetworkData(network)).toContain(
      "Station/line a:central has duplicate exit direction for central:a:b and central:a:c",
    );
  });

  it("rejects a branch that initially points away from its destination", () => {
    const network: NetworkData = {
      stations: [
        { id: "a", name: "A", x: 0, y: 0, lines: ["central"] },
        { id: "b", name: "B", x: 3, y: 0, lines: ["central"] },
        { id: "c", name: "C", x: 0, y: 3, lines: ["central"] },
        { id: "d", name: "D", x: -3, y: 0, lines: ["central"] },
      ],
      connections: [
        {
          id: "central:a:b",
          from: "a",
          to: "b",
          line: "central",
          path: [
            { x: 0, y: 0 },
            { x: 0, y: -1 },
            { x: 1, y: -2 },
            { x: 2, y: -2 },
            { x: 3, y: -1 },
            { x: 3, y: 0 },
          ],
        },
        { id: "central:a:c", from: "a", to: "c", line: "central", path: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }] },
        { id: "central:a:d", from: "a", to: "d", line: "central", path: [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -2, y: 0 }, { x: -3, y: 0 }] },
      ],
      temporary: true,
      notes: [],
    };

    expect(validateNetworkData(network)).toContain(
      "Station/line a:central has misleading branch exit for central:a:b",
    );
  });

  it("keeps critical same-line branches directionally distinct", () => {
    for (const [stationName, line] of [
      ["Woodford", "central"],
      ["Leytonstone", "central"],
      ["Finchley Central", "northern"],
      ["Chalfont & Latimer", "metropolitan"],
    ] as const) {
      const station = networkData.stations.find((candidate) => candidate.name === stationName);
      const connections = networkData.connections.filter(
        (connection) =>
          connection.line === line && (connection.from === station?.id || connection.to === station?.id),
      );
      const directions = connections.map((connection) => firstStepKey(connection.path, connection.to === station?.id));
      expect(new Set(directions).size, `${stationName} ${line} branch exits`).toBe(connections.length);
    }
  });

  it("routes the Piccadilly line straight through skipped District stations", () => {
    const earlCourt = stationByName("Earl's Court");
    const baronsCourt = stationByName("Barons Court");
    const westKensington = stationByName("West Kensington");
    const connection = networkData.connections.find(
      (candidate) =>
        candidate.line === "piccadilly" &&
        ((candidate.from === earlCourt.id && candidate.to === baronsCourt.id) ||
          (candidate.from === baronsCourt.id && candidate.to === earlCourt.id)),
    );

    expect(connection?.path).toContainEqual({ x: westKensington.x, y: westKensington.y });
  });

  it("labels the separate Hammersmith stations by their actual services", () => {
    expect(stationByName("Hammersmith (Circle and Hammersmith & City)").lines).toEqual(
      expect.arrayContaining(["circle", "hammersmith-city", "walk"]),
    );
    expect(stationByName("Hammersmith (District and Piccadilly)").lines).toEqual(
      expect.arrayContaining(["district", "piccadilly", "walk"]),
    );
  });
});

function createPathValidationNetwork(
  path: Array<{ x: number; y: number }>,
  line: "central" | "walk" = "central",
): NetworkData {
  const start = path[0];
  const end = path[path.length - 1];

  return {
    stations: [
      { id: "a", name: "A", x: start.x, y: start.y, lines: [line] },
      { id: "b", name: "B", x: end.x, y: end.y, lines: [line] },
    ],
    connections: [
      {
        id: `${line}:a:b`,
        from: "a",
        to: "b",
        line,
        path,
      },
    ],
    temporary: true,
    notes: [],
  };
}

function hasConnection(fromName: string, toName: string, line: string): boolean {
  const from = networkData.stations.find((station) => station.name === fromName);
  const to = networkData.stations.find((station) => station.name === toName);
  return Boolean(
    from &&
      to &&
      networkData.connections.some(
        (connection) =>
          connection.line === line &&
          ((connection.from === from.id && connection.to === to.id) ||
            (connection.from === to.id && connection.to === from.id)),
      ),
  );
}

function firstStepKey(path: Array<{ x: number; y: number }>, reverse: boolean): string {
  const oriented = reverse ? [...path].reverse() : path;
  return `${Math.sign(oriented[1].x - oriented[0].x)},${Math.sign(oriented[1].y - oriented[0].y)}`;
}

function stationByName(name: string) {
  const station = networkData.stations.find((candidate) => candidate.name === name);
  if (!station) throw new Error(`Missing station ${name}`);
  return station;
}
