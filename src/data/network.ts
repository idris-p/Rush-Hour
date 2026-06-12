import { compareLineIds } from "./lines";
import { connectionSeeds, stationSeeds } from "./network.generated";
import type { Connection, LineId, NetworkData, Station } from "./types";

export function createConnectionId(line: LineId, from: string, to: string): string {
  const [a, b] = [from, to].sort();
  return `${line}:${a}:${b}`;
}

const linesByStation = new Map<string, Set<LineId>>();
for (const connection of connectionSeeds) {
  for (const stationId of [connection.from, connection.to]) {
    const lines = linesByStation.get(stationId) ?? new Set<LineId>();
    lines.add(connection.line);
    linesByStation.set(stationId, lines);
  }
}

const stations: Station[] = stationSeeds.map((station) => ({
  ...station,
  lines: [...(linesByStation.get(station.id) ?? [])].sort(compareLineIds),
}));

const connections: Connection[] = connectionSeeds.map((connection) => ({
  ...connection,
  id: createConnectionId(connection.line, connection.from, connection.to),
  path: connection.path ?? missingConnectionPath(connection.line, connection.from, connection.to),
}));

export const networkData: NetworkData = {
  stations,
  connections,
  temporary: false,
  notes: [
    "Station positions and route geometry are generated from the bundled TfL network SVG.",
    "London Underground and Elizabeth line services are included.",
    "Out-of-station interchanges are represented as playable Walk connections.",
    "DLR, London Overground, London Trams, and Thameslink are excluded.",
  ],
};

function missingConnectionPath(line: LineId, from: string, to: string): never {
  throw new Error(`Generated connection is missing a path: ${line} ${from} -> ${to}`);
}
