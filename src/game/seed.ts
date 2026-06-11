import type { NetworkData } from "../data/types";

export function generateSeed(): string {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${Date.now().toString(36)}-${randomPart}`;
}

export function createSeededRandom(seed: string): () => number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return () => {
    hash += 0x6d2b79f5;
    let value = hash;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickStartAndDestination(seed: string, network: NetworkData): {
  startStationId: string;
  destinationStationId: string;
} {
  const random = createSeededRandom(seed.trim() === "" ? "tube-speedrun" : seed.trim());
  const stations = network.stations.filter((station) => station.lines.length > 0);
  if (stations.length < 2) {
    throw new Error("Network must contain at least two playable stations.");
  }

  const startStation = stations[Math.floor(random() * stations.length)];
  const minimumDistance = Math.min(6, Math.max(2, Math.floor(stations.length / 30)));

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const destinationStation = stations[Math.floor(random() * stations.length)];
    if (destinationStation.id === startStation.id) {
      continue;
    }

    const distance = getNetworkDistance(network, startStation.id, destinationStation.id);
    if (distance >= minimumDistance) {
      return {
        startStationId: startStation.id,
        destinationStationId: destinationStation.id,
      };
    }
  }

  const fallbackDestination = stations.find((station) => station.id !== startStation.id);
  if (!fallbackDestination) {
    throw new Error("Unable to select a destination station.");
  }

  return {
    startStationId: startStation.id,
    destinationStationId: fallbackDestination.id,
  };
}

export function getNetworkDistance(network: NetworkData, from: string, to: string): number {
  if (from === to) {
    return 0;
  }

  const visited = new Set<string>([from]);
  const queue: Array<{ stationId: string; distance: number }> = [{ stationId: from, distance: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    for (const connection of network.connections) {
      const next =
        connection.from === current.stationId ? connection.to : connection.to === current.stationId ? connection.from : null;

      if (!next || visited.has(next)) {
        continue;
      }

      if (next === to) {
        return current.distance + 1;
      }

      visited.add(next);
      queue.push({ stationId: next, distance: current.distance + 1 });
    }
  }

  return Number.POSITIVE_INFINITY;
}

