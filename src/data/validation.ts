import { LINE_BY_ID } from "./lines";
import type { LineId, NetworkData } from "./types";

export function validateNetworkData(network: NetworkData): string[] {
  const errors: string[] = [];
  const stationIds = new Set<string>();
  const occupiedCells = new Map<string, string>();
  const connectionIds = new Set<string>();
  const actualLinesByStation = new Map<string, Set<LineId>>();

  for (const station of network.stations) {
    if (stationIds.has(station.id)) {
      errors.push(`Duplicate station id: ${station.id}`);
    }
    stationIds.add(station.id);

    if (station.name.toLowerCase().includes("tram")) {
      errors.push(`Station appears to reference trams: ${station.name}`);
    }

    const cellKey = `${station.x},${station.y}`;
    const occupiedBy = occupiedCells.get(cellKey);
    if (occupiedBy) {
      errors.push(`Stations ${occupiedBy} and ${station.id} share grid cell ${cellKey}`);
    }
    occupiedCells.set(cellKey, station.id);
  }

  for (const connection of network.connections) {
    if (connectionIds.has(connection.id)) {
      errors.push(`Duplicate connection id: ${connection.id}`);
    }
    connectionIds.add(connection.id);

    if (!LINE_BY_ID[connection.line]) {
      errors.push(`Unknown line id: ${connection.line}`);
    }

    if (!stationIds.has(connection.from)) {
      errors.push(`Connection ${connection.id} has missing from station ${connection.from}`);
    }

    if (!stationIds.has(connection.to)) {
      errors.push(`Connection ${connection.id} has missing to station ${connection.to}`);
    }

    const fromStation = network.stations.find((station) => station.id === connection.from);
    const toStation = network.stations.find((station) => station.id === connection.to);
    const firstPathPoint = connection.path[0];
    const lastPathPoint = connection.path[connection.path.length - 1];

    if (connection.path.length < 2) {
      errors.push(`Connection ${connection.id} path must include at least two grid cells`);
    }

    if (
      fromStation &&
      (!firstPathPoint || firstPathPoint.x !== fromStation.x || firstPathPoint.y !== fromStation.y)
    ) {
      errors.push(`Connection ${connection.id} path must start at ${connection.from}`);
    }

    if (toStation && (!lastPathPoint || lastPathPoint.x !== toStation.x || lastPathPoint.y !== toStation.y)) {
      errors.push(`Connection ${connection.id} path must end at ${connection.to}`);
    }

    for (let index = 1; index < connection.path.length; index += 1) {
      const previous = connection.path[index - 1];
      const current = connection.path[index];
      const dx = Math.abs(current.x - previous.x);
      const dy = Math.abs(current.y - previous.y);

      if (dx > 1 || dy > 1 || (dx === 0 && dy === 0)) {
        errors.push(`Connection ${connection.id} has invalid grid step ${index - 1} -> ${index}`);
      }

      if (index < 2) {
        continue;
      }

      const beforePrevious = connection.path[index - 2];
      const previousDirection = getGridDirectionIndex(beforePrevious, previous);
      const currentDirection = getGridDirectionIndex(previous, current);

      if (previousDirection === null || currentDirection === null) {
        continue;
      }

      const turnAmount = getDirectionTurnAmount(previousDirection, currentDirection);
      if (turnAmount > 1) {
        errors.push(`Connection ${connection.id} has sharp turn at path point ${index - 1}`);
      }
    }

    for (const stationId of [connection.from, connection.to]) {
      const lines = actualLinesByStation.get(stationId) ?? new Set<LineId>();
      lines.add(connection.line);
      actualLinesByStation.set(stationId, lines);
    }
  }

  for (const station of network.stations) {
    const declared = [...station.lines].sort();
    const actual = [...(actualLinesByStation.get(station.id) ?? [])].sort();

    if (declared.join(",") !== actual.join(",")) {
      errors.push(`Station ${station.id} declares lines [${declared.join(",")}] but connections imply [${actual.join(",")}]`);
    }
  }

  return errors;
}

function getGridDirectionIndex(from: { x: number; y: number }, to: { x: number; y: number }): number | null {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);

  if (dx === 1 && dy === 0) {
    return 0;
  }
  if (dx === 1 && dy === 1) {
    return 1;
  }
  if (dx === 0 && dy === 1) {
    return 2;
  }
  if (dx === -1 && dy === 1) {
    return 3;
  }
  if (dx === -1 && dy === 0) {
    return 4;
  }
  if (dx === -1 && dy === -1) {
    return 5;
  }
  if (dx === 0 && dy === -1) {
    return 6;
  }
  if (dx === 1 && dy === -1) {
    return 7;
  }

  return null;
}

function getDirectionTurnAmount(previousDirection: number, nextDirection: number): number {
  const difference = Math.abs(previousDirection - nextDirection);
  return Math.min(difference, 8 - difference);
}
