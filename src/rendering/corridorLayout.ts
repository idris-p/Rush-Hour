import { compareLineIds } from "../data/lines";
import type { Connection, GridPoint, LineId, NetworkData, Point } from "../data/types";
import { GRID_CELL_SIZE, gridPointToSvgPoint } from "./grid";
import { LINE_STROKE_WIDTH } from "./lineStyles";
import { offsetPolylinePoints } from "./pathOffset";
import { simplifyPolylinePoints } from "./roundedPath";

const POINT_TOLERANCE = 0.01;
const HIGH_STREET_KENSINGTON_VERTICAL_SPLIT = LINE_STROKE_WIDTH / 2;

export type SharedCorridor = {
  lanes: readonly (readonly LineId[])[];
  from: string;
  to: string;
};

export const SHARED_CORRIDORS: readonly SharedCorridor[] = [
  {
    lanes: [["piccadilly"], ["district"]],
    from: "earl-s-court",
    to: "acton-town",
  },
  {
    lanes: [["piccadilly"], ["district"]],
    from: "earl-s-court",
    to: "gloucester-road",
  },
  {
    lanes: [["piccadilly"], ["district", "circle"]],
    from: "gloucester-road",
    to: "south-kensington",
  },
  {
    lanes: [["piccadilly"], ["district"]],
    from: "acton-town",
    to: "ealing-common",
  },
  {
    lanes: [["metropolitan"], ["jubilee"]],
    from: "baker-street",
    to: "wembley-park",
  },
];

const MERGED_CORRIDOR_STATIONS = new Set(["baker-street"]);

const STATION_LINE_POINT_OVERRIDES = new Map<string, GridPoint>([
  ["liverpool-street|elizabeth", { x: 92, y: -13 }],
  ["whitechapel|elizabeth", { x: 118, y: -13 }],
  ["mile-end|central", { x: 130, y: -14 }],
  ["mile-end|district", { x: 132, y: -12 }],
  ["mile-end|hammersmith-city", { x: 132, y: -12 }],
  ["bond-street|elizabeth", { x: 45, y: -9 }],
  ["tottenham-court-road|elizabeth", { x: 63, y: -9 }],
  ["paddington|bakerloo", { x: 16, y: -20 }],
  ["euston|victoria", { x: 67, y: -25 }],
  ["king-s-cross-st-pancras|northern", { x: 77, y: -25 }],
  ["king-s-cross-st-pancras|victoria", { x: 77, y: -25 }],
  ["finsbury-park|victoria", { x: 96, y: -44 }],
  ["stratford|central", { x: 148, y: -30 }],
  ["stratford|elizabeth", { x: 150, y: -30 }],
  ["stratford|jubilee", { x: 150, y: -30 }],
  ["leyton|central", { x: 153, y: -35 }],
]);

const CONNECTION_POINT_OVERRIDES = new Map<string, GridPoint[]>([
  ["district:mile-end:stepney-green", [{ x: 128, y: -12 }, { x: 132, y: -12 }]],
  ["hammersmith-city:mile-end:stepney-green", [{ x: 128, y: -12 }, { x: 132, y: -12 }]],
  ["district:bow-road:mile-end", [{ x: 132, y: -12 }, { x: 136, y: -12 }]],
  ["hammersmith-city:bow-road:mile-end", [{ x: 132, y: -12 }, { x: 136, y: -12 }]],
  ["elizabeth:bond-street:paddington", [{ x: 18, y: -18 }, { x: 27, y: -18 }, { x: 36, y: -9 }, { x: 45, y: -9 }]],
  ["elizabeth:bond-street:tottenham-court-road", [{ x: 63, y: -9 }, { x: 45, y: -9 }]],
  [
    "elizabeth:farringdon:tottenham-court-road",
    [{ x: 80, y: -18 }, { x: 77, y: -18 }, { x: 68, y: -9 }, { x: 63, y: -9 }],
  ],
  [
    "central:mile-end:stratford",
    [{ x: 130, y: -14 }, { x: 132, y: -14 }, { x: 148, y: -30 }],
  ],
  [
    "central:leyton:stratford",
    [{ x: 148, y: -30 }, { x: 153, y: -35 }],
  ],
  ["victoria:euston:warren-street", [{ x: 62, y: -20 }, { x: 67, y: -25 }]],
  ["victoria:euston:king-s-cross-st-pancras", [{ x: 67, y: -25 }, { x: 77, y: -25 }]],
  ["victoria:highbury-and-islington:king-s-cross-st-pancras", [{ x: 77, y: -25 }, { x: 87, y: -35 }]],
  ["victoria:finsbury-park:highbury-and-islington", [{ x: 87, y: -35 }, { x: 96, y: -44 }]],
  ["victoria:finsbury-park:seven-sisters", [{ x: 96, y: -44 }, { x: 106, y: -54 }, { x: 120, y: -54 }]],
  ["bakerloo:edgware-road-bakerloo:marylebone", [{ x: 32, y: -24 }, { x: 24, y: -24 }]],
  ["bakerloo:edgware-road-bakerloo:paddington", [{ x: 24, y: -24 }, { x: 22, y: -24 }, { x: 18, y: -20 }, { x: 16, y: -20 }]],
  ["bakerloo:paddington:warwick-avenue", [{ x: 16, y: -20 }, { x: 10, y: -20 }]],
  ["bakerloo:maida-vale:warwick-avenue", [{ x: 4, y: -22 }, { x: 6, y: -20 }, { x: 10, y: -20 }]],
  ["bakerloo:kilburn-park:maida-vale", [{ x: 4, y: -22 }, { x: 0, y: -26 }]],
  ["bakerloo:kilburn-park:queen-s-park", [{ x: -2, y: -30 }, { x: -2, y: -28 }, { x: 0, y: -26 }]],
  ["bakerloo:kensal-green:queen-s-park", [{ x: -2, y: -34 }, { x: -2, y: -30 }]],
  ["northern:angel:king-s-cross-st-pancras", [{ x: 82, y: -22 }, { x: 80, y: -22 }, { x: 77, y: -25 }]],
  ["northern:euston:king-s-cross-st-pancras", [{ x: 65, y: -27 }, { x: 75, y: -27 }, { x: 77, y: -25 }]],
]);

export type StationMarkerGroup = {
  point: Point;
  lines: LineId[];
};

export class CorridorLayout {
  private readonly network: NetworkData;

  private readonly corridorLanesByEdge = new Map<string, readonly (readonly LineId[])[]>();

  private readonly rawConnectionPoints = new Map<string, Point[]>();

  private readonly connectionPoints = new Map<string, Point[]>();

  private readonly stationLinePoints = new Map<string, Point>();

  constructor(
    network: NetworkData,
    corridors: readonly SharedCorridor[] = SHARED_CORRIDORS,
  ) {
    this.network = network;
    this.buildCorridorEdges(corridors);
  }

  getConnectionPoints(connection: Connection): Point[] {
    const cached = this.connectionPoints.get(connection.id);
    if (cached) return cached;

    const override = CONNECTION_POINT_OVERRIDES.get(connection.id);
    if (override) {
      const points = override.map(gridPointToSvgPoint);
      this.connectionPoints.set(connection.id, points);
      return points;
    }

    let points = [...this.getRawConnectionPoints(connection)];
    const [startStationId, endStationId] = this.getPathEndpointStationIds(connection);
    const startPoint = this.getStationLinePoint(startStationId, connection.line);
    const endPoint = this.getStationLinePoint(endStationId, connection.line);
    if (!this.isCorridorConnection(connection)) {
      points =
        getMarkerAdjustedStraightPath(connection.path, startPoint, endPoint) ??
        getMarkerAdjustedTwoLegPath(connection.path, startPoint, endPoint) ??
        points;
    }
    points[0] = startPoint;
    points[points.length - 1] = endPoint;

    const simplified = simplifyPolylinePoints(points);
    this.connectionPoints.set(connection.id, simplified);
    return simplified;
  }

  getConnectionRenderPoints(connection: Connection, visibleConnectionIds: ReadonlySet<string>): Point[] {
    return this.getHighStreetKensingtonBranchSplitPath(connection, visibleConnectionIds) ??
      this.getConnectionPoints(connection);
  }

  getConnectionCameraPoints(connection: Connection): Point[] {
    return this.getConnectionPoints(connection);
  }

  getConnectionSegmentOffsets(connection: Connection): number[] {
    return getPathEdges(connection.path).map((edge) => {
      const corridorLanes = this.corridorLanesByEdge.get(edge.key) ?? [];
      const laneIndex = corridorLanes.findIndex((lane) => lane.includes(connection.line));
      if (corridorLanes.length < 2 || laneIndex < 0) return 0;
      const offset = getGridCellOffset(edge, laneIndex);
      return compareGridPoints(edge.from, edge.to) <= 0 ? offset : -offset;
    });
  }

  getCorridorLines(first: GridPoint, second: GridPoint): LineId[] {
    return (this.corridorLanesByEdge.get(getEdgeKey(first, second)) ?? [])
      .flatMap((lane) => [...lane]);
  }

  isCorridorConnection(connection: Connection): boolean {
    return getPathEdges(connection.path).some((edge) =>
      (this.corridorLanesByEdge.get(edge.key) ?? []).some((lane) => lane.includes(connection.line)),
    );
  }

  getStationLinePoint(stationId: string, lineId: LineId): Point {
    if (lineId === "walk") {
      return this.getBaseStationPoint(stationId);
    }

    if (MERGED_CORRIDOR_STATIONS.has(stationId)) {
      return this.getBaseStationPoint(stationId);
    }

    const key = getStationLineKey(stationId, lineId);
    const override = STATION_LINE_POINT_OVERRIDES.get(key);
    if (override) {
      return gridPointToSvgPoint(override);
    }
    const cached = this.stationLinePoints.get(key);
    if (cached) return cached;

    const basePoint = this.getBaseStationPoint(stationId);
    const endpointOffsets = this.network.connections
      .filter(
        (connection) =>
          connection.line === lineId &&
          (connection.from === stationId || connection.to === stationId),
      )
      .map((connection) => this.getRawOffsetEndpoint(connection, stationId))
      .filter((point): point is Point => point !== null)
      .map((point) => ({ x: point.x - basePoint.x, y: point.y - basePoint.y }))
      .filter((point) => Math.hypot(point.x, point.y) > POINT_TOLERANCE);

    if (endpointOffsets.length === 0) {
      this.stationLinePoints.set(key, basePoint);
      return basePoint;
    }

    const average = endpointOffsets.reduce(
      (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
      { x: 0, y: 0 },
    );
    const averageLength = Math.hypot(average.x, average.y);
    const targetLength = Math.max(...endpointOffsets.map((point) => Math.hypot(point.x, point.y)));
    const chosen = averageLength > POINT_TOLERANCE
      ? {
          x: (average.x / averageLength) * targetLength,
          y: (average.y / averageLength) * targetLength,
        }
      : endpointOffsets[0];
    const point = {
      x: basePoint.x + Math.round(chosen.x / GRID_CELL_SIZE) * GRID_CELL_SIZE,
      y: basePoint.y + Math.round(chosen.y / GRID_CELL_SIZE) * GRID_CELL_SIZE,
    };
    this.stationLinePoints.set(key, point);
    return point;
  }

  getStationMarkerGroups(stationId: string): StationMarkerGroup[] {
    const station = this.network.stations.find((candidate) => candidate.id === stationId);
    if (!station) return [];

    const groups: StationMarkerGroup[] = [];
    for (const lineId of station.lines.filter((line) => line !== "walk").sort(compareLineIds)) {
      const point = this.getStationLinePoint(stationId, lineId);
      const existing = groups.find((group) => pointsMatch(group.point, point));
      if (existing) {
        existing.lines.push(lineId);
      } else {
        groups.push({ point, lines: [lineId] });
      }
    }

    if (groups.length === 0) {
      groups.push({ point: this.getBaseStationPoint(stationId), lines: [...station.lines] });
    }
    return groups;
  }

  private buildCorridorEdges(corridors: readonly SharedCorridor[]): void {
    for (const corridor of corridors) {
      const routes = corridor.lanes.flatMap((lane) =>
        lane.map((lineId) => findLineRoute(this.network, lineId, corridor.from, corridor.to)),
      );
      if (routes.some((route) => route === null)) continue;

      const edgeSets = routes.map((route) => new Set(
        route!.flatMap((connection) => getPathEdges(connection.path).map((edge) => edge.key)),
      ));
      for (const edgeKey of edgeSets[0]) {
        if (edgeSets.every((edgeSet) => edgeSet.has(edgeKey))) {
          this.corridorLanesByEdge.set(edgeKey, corridor.lanes);
        }
      }
    }
  }

  private getRawConnectionPoints(connection: Connection): Point[] {
    const cached = this.rawConnectionPoints.get(connection.id);
    if (cached) return cached;

    const points = offsetPolylinePointsBySegment(
      connection.path.map(gridPointToSvgPoint),
      this.getConnectionSegmentOffsets(connection),
    );
    this.rawConnectionPoints.set(connection.id, points);
    return points;
  }

  private getRawOffsetEndpoint(connection: Connection, stationId: string): Point | null {
    const points = this.getRawConnectionPoints(connection);
    const [startStationId] = this.getPathEndpointStationIds(connection);
    return startStationId === stationId ? points[0] : points.at(-1) ?? null;
  }

  private getPathEndpointStationIds(connection: Connection): [string, string] {
    const fromPoint = this.getBaseStationPoint(connection.from);
    return pointsMatch(gridPointToSvgPoint(connection.path[0]), fromPoint)
      ? [connection.from, connection.to]
      : [connection.to, connection.from];
  }

  private getHighStreetKensingtonBranchSplitPath(
    connection: Connection,
    visibleConnectionIds: ReadonlySet<string>,
  ): Point[] | null {
    if (
      !visibleConnectionIds.has("circle:gloucester-road:high-street-kensington") ||
      !visibleConnectionIds.has("district:earl-s-court:high-street-kensington")
    ) {
      return null;
    }

    const horizontalSign =
      connection.id === "circle:gloucester-road:high-street-kensington"
        ? 1
        : connection.id === "district:earl-s-court:high-street-kensington"
          ? -1
          : 0;
    if (horizontalSign === 0) return null;

    const [startStationId, endStationId] = this.getPathEndpointStationIds(connection);
    if (startStationId !== "high-street-kensington") return null;

    const highStreetKensington = this.getStationLinePoint(startStationId, connection.line);
    const branchEnd = this.getStationLinePoint(endStationId, connection.line);
    const splitX = highStreetKensington.x + horizontalSign * HIGH_STREET_KENSINGTON_VERTICAL_SPLIT;
    return [
      { x: splitX, y: highStreetKensington.y },
      { x: splitX, y: gridPointToSvgPoint({ x: 18, y: 11 }).y },
      branchEnd,
    ];
  }

  private getBaseStationPoint(stationId: string): Point {
    const station = this.network.stations.find((candidate) => candidate.id === stationId);
    if (!station) throw new Error(`Unknown station: ${stationId}`);
    return gridPointToSvgPoint(station);
  }
}

function getMarkerAdjustedStraightPath(path: GridPoint[], start: Point, end: Point): Point[] | null {
  const directions = getDirectionRuns(path);
  if (directions.length !== 1 || path.length < 3) return null;

  const rawPoints = path.map(gridPointToSvgPoint);
  const rawStart = rawPoints[0];
  const rawEnd = rawPoints.at(-1)!;
  const startOffset = subtractPoints(start, rawStart);
  const endOffset = subtractPoints(end, rawEnd);
  const startMoved = Math.hypot(startOffset.x, startOffset.y) > POINT_TOLERANCE;
  const endMoved = Math.hypot(endOffset.x, endOffset.y) > POINT_TOLERANCE;

  if (startMoved === endMoved) return null;
  const midpoint = Math.floor((rawPoints.length - 1) / 2);
  if (startMoved) {
    const shiftedBeforeMidpoint = addPoints(rawPoints[Math.max(0, midpoint - 1)], startOffset);
    return [start, shiftedBeforeMidpoint, rawPoints[midpoint], end];
  }

  const shiftedAfterMidpoint = addPoints(rawPoints[Math.min(rawPoints.length - 1, midpoint + 1)], endOffset);
  return [start, rawPoints[midpoint], shiftedAfterMidpoint, end];
}

function getMarkerAdjustedTwoLegPath(path: GridPoint[], start: Point, end: Point): Point[] | null {
  const directions = getDirectionRuns(path);
  if (directions.length !== 2) return null;

  const first = directions[0];
  const last = directions[1];
  const corner = getLineIntersection(
    start,
    { x: start.x + first.x, y: start.y + first.y },
    end,
    { x: end.x - last.x, y: end.y - last.y },
  );
  if (!corner || !isForwardFrom(start, corner, first) || !isForwardFrom(corner, end, last)) {
    return null;
  }
  return [start, corner, end];
}

function getDirectionRuns(path: GridPoint[]): Point[] {
  return path.slice(1)
    .map((point, index) => ({
      x: Math.sign(point.x - path[index].x),
      y: Math.sign(point.y - path[index].y),
    }))
    .filter(
      (direction, index, all) =>
        index === 0 || direction.x !== all[index - 1].x || direction.y !== all[index - 1].y,
    );
}

function addPoints(first: Point, second: Point): Point {
  return { x: first.x + second.x, y: first.y + second.y };
}

function subtractPoints(first: Point, second: Point): Point {
  return { x: first.x - second.x, y: first.y - second.y };
}

function isForwardFrom(from: Point, to: Point, direction: Point): boolean {
  return (to.x - from.x) * direction.x + (to.y - from.y) * direction.y >= -POINT_TOLERANCE;
}

function findLineRoute(
  network: NetworkData,
  lineId: LineId,
  fromStationId: string,
  toStationId: string,
): Connection[] | null {
  if (!network.stations.some((station) => station.id === fromStationId)) return null;
  if (!network.stations.some((station) => station.id === toStationId)) return null;

  const connections = network.connections.filter((connection) => connection.line === lineId);
  const queue = [fromStationId];
  const visited = new Set(queue);
  const previous = new Map<string, { stationId: string; connection: Connection }>();

  while (queue.length > 0) {
    const stationId = queue.shift()!;
    if (stationId === toStationId) break;
    for (const connection of connections) {
      const neighbour = connection.from === stationId
        ? connection.to
        : connection.to === stationId
          ? connection.from
          : null;
      if (!neighbour || visited.has(neighbour)) continue;
      visited.add(neighbour);
      previous.set(neighbour, { stationId, connection });
      queue.push(neighbour);
    }
  }

  if (!visited.has(toStationId)) return null;
  const route: Connection[] = [];
  let stationId = toStationId;
  while (stationId !== fromStationId) {
    const step = previous.get(stationId);
    if (!step) return null;
    route.unshift(step.connection);
    stationId = step.stationId;
  }
  return route;
}

function offsetPolylinePointsBySegment(points: Point[], offsets: number[]): Point[] {
  if (points.length < 2 || offsets.length !== points.length - 1) return points;
  const offsetSegments = points.slice(0, -1).map((from, index) =>
    offsetPolylinePoints([from, points[index + 1]], offsets[index]),
  );

  return points.map((_, index) => {
    if (index === 0) return offsetSegments[0][0];
    if (index === points.length - 1) return offsetSegments.at(-1)![1];
    const previousSegment = offsetSegments[index - 1];
    const nextSegment = offsetSegments[index];
    return getLineIntersection(previousSegment[0], previousSegment[1], nextSegment[0], nextSegment[1]) ?? {
      x: (previousSegment[1].x + nextSegment[0].x) / 2,
      y: (previousSegment[1].y + nextSegment[0].y) / 2,
    };
  });
}

function getLineIntersection(firstStart: Point, firstEnd: Point, secondStart: Point, secondEnd: Point): Point | null {
  const firstDirection = { x: firstEnd.x - firstStart.x, y: firstEnd.y - firstStart.y };
  const secondDirection = { x: secondEnd.x - secondStart.x, y: secondEnd.y - secondStart.y };
  const denominator = firstDirection.x * secondDirection.y - firstDirection.y * secondDirection.x;
  if (Math.abs(denominator) < POINT_TOLERANCE) return null;
  const delta = { x: secondStart.x - firstStart.x, y: secondStart.y - firstStart.y };
  const firstScale = (delta.x * secondDirection.y - delta.y * secondDirection.x) / denominator;
  return {
    x: firstStart.x + firstDirection.x * firstScale,
    y: firstStart.y + firstDirection.y * firstScale,
  };
}

type GridEdge = {
  key: string;
  from: GridPoint;
  to: GridPoint;
};

function getPathEdges(path: GridPoint[]): GridEdge[] {
  return path.slice(0, -1).map((from, index) => {
    const to = path[index + 1];
    return { key: getEdgeKey(from, to), from, to };
  });
}

function getEdgeKey(first: GridPoint, second: GridPoint): string {
  const firstKey = getPointKey(first);
  const secondKey = getPointKey(second);
  return firstKey <= secondKey ? `${firstKey};${secondKey}` : `${secondKey};${firstKey}`;
}

function getStationLineKey(stationId: string, lineId: LineId): string {
  return `${stationId}|${lineId}`;
}

function getPointKey(point: GridPoint): string {
  return `${point.x},${point.y}`;
}

function compareGridPoints(first: GridPoint, second: GridPoint): number {
  return first.x - second.x || first.y - second.y;
}

function getGridCellOffset(edge: GridEdge, lineIndex: number): number {
  if (lineIndex === 0) return 0;
  const dx = Math.sign(edge.to.x - edge.from.x);
  const dy = Math.sign(edge.to.y - edge.from.y);
  const perpendicularGridSteps = Math.hypot(dy, dx);
  return lineIndex * GRID_CELL_SIZE * perpendicularGridSteps;
}

function pointsMatch(first: Point, second: Point): boolean {
  return Math.abs(first.x - second.x) < POINT_TOLERANCE && Math.abs(first.y - second.y) < POINT_TOLERANCE;
}
