import { LINE_BY_ID, compareLineIds } from "../data/lines";
import type { GameState } from "../game/GameState";
import {
  getConnectionFirstStepDirection,
  getDirectionAngle,
  getStation,
  type MovementDirection,
} from "../game/movement";
import type { Connection, LineId, NetworkData, Point } from "../data/types";
import { getSvgPoint } from "../input/mouse";
import { GRID_CELL_SIZE, gridPointToSvgPoint } from "./grid";
import { CorridorLayout, type StationMarkerGroup } from "./corridorLayout";
import { STUB_STROKE_WIDTH } from "./lineStyles";
import { renderRevealedLine } from "./lineRenderer";
import {
  getCanonicalPath,
  getCanonicalPathKey,
  getCenteredOffset,
  PARALLEL_LINE_SPACING,
  PARALLEL_STUB_SPACING,
} from "./pathOffset";
import { renderRiverThames } from "./riverRenderer";
import {
  isInterchangeStation,
  renderStationMarker,
  type CurrentStationLabelPlacement,
} from "./stationRenderer";

const SVG_NS = "http://www.w3.org/2000/svg";
const BASE_VIEWBOX_WIDTH = 760;
const BASE_VIEWBOX_HEIGHT = 560;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.4;
const ZOOM_STEP = 1.25;
const STUB_LENGTH = 40;
const STUB_ARROW_LENGTH = 11;
const STUB_ARROW_HALF_WIDTH = STUB_STROKE_WIDTH / 2;
const STUB_ARROW_OVERLAP = 0.2;
const LABEL_RADII = [26, 32, 40, 50, 62, 76, 92, 112];
const LABEL_SAMPLE_COLUMNS = 5;
const LABEL_SAMPLE_ROWS = 3;
const LABEL_COLLISION_PADDING = 3;
const MAP_PAN_PADDING = GRID_CELL_SIZE * 3;
const LABEL_OBSTACLE_SELECTOR = [
  ".map-line",
  ".direction-stub",
  ".direction-stub-arrow",
  ".interchange-marker",
  ".station-bar-marker",
  ".conjoined-station-link",
  ".current-station-highlight",
  ".river-thames-outline",
  ".river-thames-fill",
  ".hud-panel",
  ".line-indicator",
  ".seed-controls",
  ".zoom-controls",
  ".completion-overlay:not([hidden])",
].join(",");

export class MapRenderer {
  readonly svg: SVGSVGElement;

  private readonly network: NetworkData;

  private readonly mapBounds: MapBounds;

  private readonly corridorLayout: CorridorLayout;

  private zoom = 1;

  private completedCameraCenter: Point | null = null;

  private labelPlacementCache: { key: string; placement: CurrentStationLabelPlacement } | null = null;

  constructor(container: HTMLElement, network: NetworkData) {
    this.network = network;
    this.corridorLayout = new CorridorLayout(network);
    this.mapBounds = getNetworkBounds(network);
    this.svg = document.createElementNS(SVG_NS, "svg");
    this.svg.setAttribute("class", "tube-map");
    this.svg.setAttribute("role", "img");
    this.svg.setAttribute("aria-label", "London transport speedrun map");
    this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    container.append(this.svg);
  }

  render(
    state: GameState,
    pointerPoint: Point | null,
    pointerDirection: MovementDirection,
    lineReveal: LineRevealAnimation | null = null,
    stationWipe: StationWipeAnimation | null = null,
    cameraPan: CameraPanAnimation | null = null,
  ): void {
    this.svg.classList.toggle("tube-map-running", !state.completed);
    this.svg.classList.toggle("tube-map-completed", state.completed);
    const hiddenCurrentStationId = lineReveal?.hiddenCurrentStationId ?? null;
    const isCurrentStationWiping = stationWipe?.stationId === hiddenCurrentStationId;
    const hideCurrentStation = hiddenCurrentStationId === state.currentStationId && !isCurrentStationWiping;
    const suppressCurrentStationStubs = hiddenCurrentStationId === state.currentStationId;
    const visibleConnections = this.getVisibleConnections(state);
    const visibleConnectionPaths = visibleConnections.map((connection) => ({
      connection,
      points: this.corridorLayout.getConnectionPoints(connection),
    }));
    const currentStation = getStation(this.network, state.currentStationId);
    const currentPoint = getSelectedStationMarkerPoint(
      this.corridorLayout.getStationMarkerGroups(state.currentStationId),
      state.selectedLineId,
      gridPointToSvgPoint(currentStation),
    );
    const revealCameraPoint = lineReveal
      ? this.getLineRevealCameraPoint(visibleConnectionPaths, lineReveal)
      : null;
    const cameraPanPoint = cameraPan ? interpolatePoint(cameraPan.from, cameraPan.to, cameraPan.progress) : null;
    const cameraAnchor = revealCameraPoint ?? cameraPanPoint ?? currentPoint;
    const viewBoxSize = this.getViewBoxSize();
    if (!state.completed) {
      this.completedCameraCenter = null;
    }
    const cameraCenter = state.completed
      ? clampViewCenter(
          revealCameraPoint ?? this.completedCameraCenter ?? cameraAnchor,
          viewBoxSize,
          this.mapBounds,
          MAP_PAN_PADDING,
        )
      : cameraAnchor;
    if (state.completed) {
      this.completedCameraCenter = cameraCenter;
    }
    const viewBox = {
      x: cameraCenter.x - viewBoxSize.width / 2,
      y: cameraCenter.y - viewBoxSize.height / 2,
      width: viewBoxSize.width,
      height: viewBoxSize.height,
    };
    this.svg.setAttribute(
      "viewBox",
      `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`,
    );
    this.svg.replaceChildren();

    this.renderGrid(viewBox);
    renderRiverThames(this.svg, viewBox);

    const revealedLayer = document.createElementNS(SVG_NS, "g");
    revealedLayer.setAttribute("class", "revealed-lines");
    this.svg.append(revealedLayer);

    const visibleStationIds = new Set<string>(hideCurrentStation ? [] : [state.currentStationId]);
    for (const group of groupConnectionsByRenderedPath(visibleConnectionPaths)) {
      group.forEach(({ connection, points }, index) => {
        const reveal = lineReveal?.revealLine && lineReveal.connectionId === connection.id
          ? { fromStationId: lineReveal.fromStationId, progress: lineReveal.progress }
          : null;
        renderRevealedLine(
          revealedLayer,
          connection,
          this.network,
          getCenteredOffset(index, group.length, PARALLEL_LINE_SPACING),
          points,
          reveal,
        );
      });
    }

    for (const connection of visibleConnections) {
      if (connection.from !== hiddenCurrentStationId || isCurrentStationWiping) {
        visibleStationIds.add(connection.from);
      }
      if (connection.to !== hiddenCurrentStationId || isCurrentStationWiping) {
        visibleStationIds.add(connection.to);
      }
    }

    if (!state.completed && !suppressCurrentStationStubs) {
      const stubLayer = document.createElementNS(SVG_NS, "g");
      stubLayer.setAttribute("class", "direction-stubs");
      this.svg.append(stubLayer);
      const directionStubs = this.getDirectionStubs(state.currentStationId, state.revealedConnections);
      this.renderDirectionStubs(
        stubLayer,
        directionStubs,
        !isInterchangeStation(currentStation),
      );
    }

    const stationLayer = document.createElementNS(SVG_NS, "g");
    stationLayer.setAttribute("class", "stations");
    this.svg.append(stationLayer);

    let currentLabel: SVGTextElement | null = null;
    for (const stationId of visibleStationIds) {
      const station = getStation(this.network, stationId);
      const label = renderStationMarker(
        stationLayer,
        station,
        this.network,
        state.selectedLineId,
        station.id === state.currentStationId,
        1 / this.zoom,
        this.corridorLayout.getStationMarkerGroups(station.id),
        undefined,
        stationWipe?.stationId === station.id
          ? {
              wipe: {
                id: `station-wipe-${station.id}`,
                direction: stationWipe.direction,
                progress: stationWipe.progress,
              },
            }
          : undefined,
      );
      if (label) currentLabel = label;
    }
    if (currentLabel) this.positionCurrentStationLabel(currentLabel, state);

    if (!state.completed) {
      const pointerLayer = document.createElementNS(SVG_NS, "g");
      pointerLayer.setAttribute("class", "pointer-layer");
      this.svg.append(pointerLayer);
      this.renderPointer(pointerLayer, pointerPoint, pointerDirection, state.rejectedMoveAt !== null);
    }
  }

  renderIdle(): void {
    this.svg.classList.remove("tube-map-running");
    this.svg.classList.remove("tube-map-completed", "tube-map-panning");
    this.completedCameraCenter = null;
    const viewBoxSize = this.getViewBoxSize();
    const baseViewBoxSize = this.getBaseViewBoxSize();
    const viewBox = {
      x: (baseViewBoxSize.width - viewBoxSize.width) / 2,
      y: (baseViewBoxSize.height - viewBoxSize.height) / 2,
      width: viewBoxSize.width,
      height: viewBoxSize.height,
    };
    this.svg.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
    this.svg.replaceChildren();
    this.renderGrid(viewBox);
    renderRiverThames(this.svg, viewBox);
  }

  zoomIn(): void {
    this.zoom = Math.min(MAX_ZOOM, this.zoom * ZOOM_STEP);
  }

  zoomOut(): void {
    this.zoom = Math.max(MIN_ZOOM, this.zoom / ZOOM_STEP);
  }

  zoomByWheel(deltaY: number): void {
    const factor = Math.exp(-Math.max(-100, Math.min(100, deltaY)) * 0.0018);
    this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom * factor));
  }

  panByClientDelta(deltaX: number, deltaY: number): void {
    if (!this.completedCameraCenter || this.svg.clientWidth <= 0 || this.svg.clientHeight <= 0) {
      return;
    }

    const viewBoxSize = this.getViewBoxSize();
    this.completedCameraCenter = clampViewCenter(
      {
        x: this.completedCameraCenter.x - deltaX * (viewBoxSize.width / this.svg.clientWidth),
        y: this.completedCameraCenter.y - deltaY * (viewBoxSize.height / this.svg.clientHeight),
      },
      viewBoxSize,
      this.mapBounds,
      MAP_PAN_PADDING,
    );
  }

  getLineSwitchCameraPan(fromState: GameState, toState: GameState): { from: Point; to: Point } | null {
    if (fromState.currentStationId !== toState.currentStationId || fromState.selectedLineId === toState.selectedLineId) {
      return null;
    }

    const from = this.getCurrentStationCameraPoint(fromState);
    const to = this.getCurrentStationCameraPoint(toState);
    if (distance(from, to) < 0.01) {
      return null;
    }
    return { from, to };
  }

  private renderGrid(viewBox: { x: number; y: number; width: number; height: number }): void {
    const layer = document.createElementNS(SVG_NS, "g");
    layer.setAttribute("class", "grid-layer");

    const minX = Math.floor(viewBox.x / GRID_CELL_SIZE) * GRID_CELL_SIZE - GRID_CELL_SIZE;
    const maxX = viewBox.x + viewBox.width + GRID_CELL_SIZE;
    const minY = Math.floor(viewBox.y / GRID_CELL_SIZE) * GRID_CELL_SIZE - GRID_CELL_SIZE;
    const maxY = viewBox.y + viewBox.height + GRID_CELL_SIZE;

    for (let x = minX; x <= maxX; x += GRID_CELL_SIZE) {
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", String(x));
      line.setAttribute("y1", String(minY));
      line.setAttribute("x2", String(x));
      line.setAttribute("y2", String(maxY));
      line.setAttribute("class", isMajorGridLine(x) ? "grid-line grid-line-major" : "grid-line");
      layer.append(line);
    }

    for (let y = minY; y <= maxY; y += GRID_CELL_SIZE) {
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", String(minX));
      line.setAttribute("y1", String(y));
      line.setAttribute("x2", String(maxX));
      line.setAttribute("y2", String(y));
      line.setAttribute("class", isMajorGridLine(y) ? "grid-line grid-line-major" : "grid-line");
      layer.append(line);
    }

    this.svg.append(layer);
  }

  private renderPointer(layer: SVGGElement, pointerPoint: Point | null, pointerDirection: MovementDirection, rejected: boolean): void {
    if (!pointerPoint) {
      return;
    }

    const svgPoint = getSvgPoint(this.svg, pointerPoint.x, pointerPoint.y);
    const arrow = document.createElementNS(SVG_NS, "g");
    arrow.setAttribute(
      "transform",
      `translate(${svgPoint.x} ${svgPoint.y}) scale(${1 / this.zoom}) rotate(${getDirectionAngle(pointerDirection)})`,
    );
    arrow.setAttribute("class", rejected ? "cursor-arrow cursor-arrow-rejected" : "cursor-arrow");

    const shape = document.createElementNS(SVG_NS, "path");
    shape.setAttribute(
      "d",
      "M -15 -3 L 4 -3 L 4 -9 L 17 0 L 4 9 L 4 3 L -15 3 Z",
    );
    shape.setAttribute("class", "cursor-arrow-shape");
    arrow.append(shape);
    layer.append(arrow);
  }

  private getLineRevealCameraPoint(
    visibleConnectionPaths: RenderedConnectionPath[],
    lineReveal: LineRevealAnimation,
  ): Point | null {
    for (const group of groupConnectionsByRenderedPath(visibleConnectionPaths)) {
      const revealIndex = group.findIndex(({ connection }) => connection.id === lineReveal.connectionId);
      if (revealIndex < 0) continue;

      const { connection, points } = group[revealIndex];
      const path = getCanonicalPath(points);
      const fromPoint = this.corridorLayout.getStationLinePoint(lineReveal.fromStationId, connection.line);
      const orientedPath = isCloserToPoint(path.at(-1)!, fromPoint, path[0])
        ? [...path].reverse()
        : path;
      return getPointAlongPolyline(orientedPath, lineReveal.progress);
    }

    return null;
  }

  private getVisibleConnections(state: GameState): Connection[] {
    return this.network.connections.filter((connection) => state.revealedConnections.has(connection.id));
  }

  private getCurrentStationCameraPoint(state: GameState): Point {
    const station = getStation(this.network, state.currentStationId);
    return getSelectedStationMarkerPoint(
      this.corridorLayout.getStationMarkerGroups(state.currentStationId),
      state.selectedLineId,
      gridPointToSvgPoint(station),
    );
  }

  private getViewBoxSize(): { width: number; height: number } {
    const baseSize = this.getBaseViewBoxSize();
    return {
      width: baseSize.width / this.zoom,
      height: baseSize.height / this.zoom,
    };
  }

  private getBaseViewBoxSize(): { width: number; height: number } {
    const width = this.svg.clientWidth;
    const height = this.svg.clientHeight;
    if (width <= 0 || height <= 0) {
      return { width: BASE_VIEWBOX_WIDTH, height: BASE_VIEWBOX_HEIGHT };
    }

    const targetAspect = width / height;
    const baseAspect = BASE_VIEWBOX_WIDTH / BASE_VIEWBOX_HEIGHT;
    if (targetAspect >= baseAspect) {
      return {
        width: BASE_VIEWBOX_HEIGHT * targetAspect,
        height: BASE_VIEWBOX_HEIGHT,
      };
    }

    return {
      width: BASE_VIEWBOX_WIDTH,
      height: BASE_VIEWBOX_WIDTH / targetAspect,
    };
  }

  private getDirectionStubs(stationId: string, revealedConnectionIds: Set<string>) {
    return this.network.connections.flatMap((connection) => {
      if (revealedConnectionIds.has(connection.id)) {
        return [];
      }
      if (connection.from !== stationId && connection.to !== stationId) {
        return [];
      }

      const unit = getDirectionStubUnit(connection, stationId);
      if (!unit) {
        return [];
      }

      const linePoint = this.corridorLayout.getStationLinePoint(stationId, connection.line);
      const start = getDirectionStubStart(
        this.corridorLayout.getStationMarkerGroups(stationId).map((group) => group.point),
        linePoint,
        unit,
      );

      return [
        {
          connection,
          key: `${unit.x},${unit.y}|${start.x},${start.y}`,
          start,
          unit,
          normal: { x: -unit.y, y: unit.x },
        },
      ];
    });
  }

  private renderDirectionStubs(
    layer: SVGGElement,
    stubs: ReturnType<MapRenderer["getDirectionStubs"]>,
    showArrowHeads: boolean,
  ): void {

    const groups = new Map<string, typeof stubs>();
    for (const stub of stubs) {
      const group = groups.get(stub.key) ?? [];
      group.push(stub);
      groups.set(stub.key, group);
    }

    for (const group of groups.values()) {
      group.sort((a, b) => compareLineIds(a.connection.line, b.connection.line) || a.connection.id.localeCompare(b.connection.id));
      group.forEach((stub, index) => {
        const offset = getCenteredOffset(index, group.length, PARALLEL_STUB_SPACING);
        const start = {
          x: stub.start.x + stub.normal.x * offset,
          y: stub.start.y + stub.normal.y * offset,
        };
        const arrowTip = {
          x: stub.start.x + stub.unit.x * STUB_LENGTH + stub.normal.x * offset,
          y: stub.start.y + stub.unit.y * STUB_LENGTH + stub.normal.y * offset,
        };
        const lineEnd = showArrowHeads
          ? {
              x: arrowTip.x - stub.unit.x * (STUB_ARROW_LENGTH - STUB_ARROW_OVERLAP),
              y: arrowTip.y - stub.unit.y * (STUB_ARROW_LENGTH - STUB_ARROW_OVERLAP),
            }
          : arrowTip;
        const line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("x1", String(start.x));
        line.setAttribute("y1", String(start.y));
        line.setAttribute("x2", String(lineEnd.x));
        line.setAttribute("y2", String(lineEnd.y));
        line.setAttribute("stroke", LINE_BY_ID[stub.connection.line].color);
        line.setAttribute("stroke-width", String(STUB_STROKE_WIDTH));
        line.setAttribute("class", "direction-stub");
        if (stub.connection.line === "walk") {
          line.setAttribute("stroke-dasharray", "8 6");
        }
        layer.append(line);

        if (showArrowHeads) {
          const arrow = document.createElementNS(SVG_NS, "polygon");
          arrow.setAttribute(
            "points",
            getStubArrowHeadPoints(arrowTip, stub.unit, stub.normal)
              .map((point) => `${point.x},${point.y}`)
              .join(" "),
          );
          arrow.setAttribute("fill", LINE_BY_ID[stub.connection.line].color);
          arrow.setAttribute("class", "direction-stub-arrow");
          layer.append(arrow);
        }
      });
    }
  }

  private positionCurrentStationLabel(label: SVGTextElement, state: GameState): void {
    const cacheKey = [
      state.currentStationId,
      this.zoom,
      this.svg.clientWidth,
      this.svg.clientHeight,
      [...state.revealedConnections].sort().join(","),
    ].join("|");
    if (this.labelPlacementCache?.key === cacheKey) {
      applyCurrentStationLabelPlacement(label, this.labelPlacementCache.placement);
      return;
    }

    let best = getCurrentStationLabelPlacements()[0];
    let bestCollisionCount = Number.POSITIVE_INFINITY;
    for (const placement of getCurrentStationLabelPlacements()) {
      applyCurrentStationLabelPlacement(label, placement);
      const collisionCount = countLabelCollisions(label);
      if (collisionCount < bestCollisionCount) {
        best = placement;
        bestCollisionCount = collisionCount;
      }
      if (collisionCount === 0) break;
    }

    applyCurrentStationLabelPlacement(label, best);
    this.labelPlacementCache = { key: cacheKey, placement: best };
  }
}

export type MapBounds = { minX: number; maxX: number; minY: number; maxY: number };

export function clampViewCenter(
  center: Point,
  viewBoxSize: { width: number; height: number },
  bounds: MapBounds,
  padding = 0,
): Point {
  return {
    x: clampAxis(center.x, viewBoxSize.width, bounds.minX - padding, bounds.maxX + padding),
    y: clampAxis(center.y, viewBoxSize.height, bounds.minY - padding, bounds.maxY + padding),
  };
}

export function getSelectedStationMarkerPoint(
  markerGroups: StationMarkerGroup[],
  selectedLineId: LineId,
  fallback: Point,
): Point {
  return markerGroups.find((group) => group.lines.includes(selectedLineId))?.point ?? fallback;
}

export function getStubArrowHeadPoints(end: Point, unit: Point, normal: Point): Point[] {
  const base = {
    x: end.x - unit.x * STUB_ARROW_LENGTH,
    y: end.y - unit.y * STUB_ARROW_LENGTH,
  };
  return [
    end,
    {
      x: base.x + normal.x * STUB_ARROW_HALF_WIDTH,
      y: base.y + normal.y * STUB_ARROW_HALF_WIDTH,
    },
    {
      x: base.x - normal.x * STUB_ARROW_HALF_WIDTH,
      y: base.y - normal.y * STUB_ARROW_HALF_WIDTH,
    },
  ];
}

export function getCurrentStationLabelPlacements(): CurrentStationLabelPlacement[] {
  const directions = [
    { x: 1, y: 0 },
    diagonal(1, -1),
    { x: 0, y: -1 },
    diagonal(-1, -1),
    { x: -1, y: 0 },
    diagonal(-1, 1),
    { x: 0, y: 1 },
    diagonal(1, 1),
  ];
  return LABEL_RADII.flatMap((radius) =>
    directions.map((direction) => ({
      x: direction.x * radius,
      y: direction.y * radius + getLabelBaselineAdjustment(direction.y),
      textAnchor: direction.x > 0.35 ? "start" : direction.x < -0.35 ? "end" : "middle",
    })),
  );
}

function getLabelBaselineAdjustment(verticalDirection: number): number {
  if (verticalDirection > 0.35) return 12;
  if (verticalDirection < -0.35) return 0;
  return 5;
}

function diagonal(x: number, y: number): Point {
  const length = Math.SQRT2;
  return { x: x / length, y: y / length };
}

function applyCurrentStationLabelPlacement(
  label: SVGTextElement,
  placement: CurrentStationLabelPlacement,
): void {
  label.setAttribute("x", String(placement.x));
  label.setAttribute("y", String(placement.y));
  label.setAttribute("text-anchor", placement.textAnchor);
}

function countLabelCollisions(label: SVGTextElement): number {
  const rect = label.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return 0;

  const left = rect.left - LABEL_COLLISION_PADDING;
  const right = rect.right + LABEL_COLLISION_PADDING;
  const top = rect.top - LABEL_COLLISION_PADDING;
  const bottom = rect.bottom + LABEL_COLLISION_PADDING;
  const collisions = new Set<Element>();
  for (let row = 0; row < LABEL_SAMPLE_ROWS; row += 1) {
    const y = top + ((bottom - top) * row) / (LABEL_SAMPLE_ROWS - 1);
    for (let column = 0; column < LABEL_SAMPLE_COLUMNS; column += 1) {
      const x = left + ((right - left) * column) / (LABEL_SAMPLE_COLUMNS - 1);
      for (const element of document.elementsFromPoint(x, y)) {
        if (element !== label && element.matches(LABEL_OBSTACLE_SELECTOR)) collisions.add(element);
      }
    }
  }
  return collisions.size;
}

function getNetworkBounds(network: NetworkData): MapBounds {
  const points = [
    ...network.stations.map(gridPointToSvgPoint),
    ...network.connections.flatMap((connection) => connection.path.map(gridPointToSvgPoint)),
  ];
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function clampAxis(value: number, viewportLength: number, minimum: number, maximum: number): number {
  if (viewportLength >= maximum - minimum) {
    return (minimum + maximum) / 2;
  }
  return Math.max(minimum + viewportLength / 2, Math.min(maximum - viewportLength / 2, value));
}

function isMajorGridLine(value: number): boolean {
  return Math.round(value / GRID_CELL_SIZE) % 5 === 0;
}

type RenderedConnectionPath = {
  connection: Connection;
  points: Point[];
};

export function groupConnectionsByRenderedPath(items: RenderedConnectionPath[]): RenderedConnectionPath[][] {
  const groups = new Map<string, RenderedConnectionPath[]>();

  for (const item of items) {
    const key = getCanonicalPathKey(item.points);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  return [...groups.values()].map((group) =>
    group.sort((a, b) =>
      compareLineIds(a.connection.line, b.connection.line) ||
      a.connection.id.localeCompare(b.connection.id),
    ),
  );
}

export function getPointAlongPolyline(points: Point[], progress: number): Point {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }
  if (points.length === 1) {
    return points[0];
  }

  const clampedProgress = Math.max(0, Math.min(1, progress));
  const segmentLengths = points.slice(0, -1).map((point, index) =>
    Math.hypot(points[index + 1].x - point.x, points[index + 1].y - point.y),
  );
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  if (totalLength === 0) {
    return points[0];
  }

  let remainingLength = totalLength * clampedProgress;
  for (let index = 0; index < segmentLengths.length; index += 1) {
    const segmentLength = segmentLengths[index];
    if (remainingLength > segmentLength) {
      remainingLength -= segmentLength;
      continue;
    }

    const from = points[index];
    const to = points[index + 1];
    const segmentProgress = segmentLength === 0 ? 0 : remainingLength / segmentLength;
    return {
      x: from.x + (to.x - from.x) * segmentProgress,
      y: from.y + (to.y - from.y) * segmentProgress,
    };
  }

  return points.at(-1)!;
}

export type LineRevealAnimation = {
  connectionId: string;
  fromStationId: string;
  hiddenCurrentStationId: string | null;
  revealLine: boolean;
  progress: number;
};

export type StationWipeAnimation = {
  stationId: string;
  direction: MovementDirection;
  progress: number;
};

export type CameraPanAnimation = {
  from: Point;
  to: Point;
  progress: number;
};

function isCloserToPoint(candidate: Point, target: Point, other: Point): boolean {
  return distance(candidate, target) < distance(other, target);
}

function distance(first: Point, second: Point): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function interpolatePoint(from: Point, to: Point, progress: number): Point {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  return {
    x: from.x + (to.x - from.x) * clampedProgress,
    y: from.y + (to.y - from.y) * clampedProgress,
  };
}

export function getDirectionStubUnit(connection: Connection, stationId: string): Point | null {
  const direction = getConnectionFirstStepDirection(connection, stationId);
  if (!direction) return null;
  const radians = (getDirectionAngle(direction) * Math.PI) / 180;
  return {
    x: snapUnitComponent(Math.cos(radians)),
    y: snapUnitComponent(Math.sin(radians)),
  };
}

export function getDirectionStubStart(
  markerPoints: Point[],
  linePoint: Point,
  unit: Point,
): Point {
  if (markerPoints.length < 2) return linePoint;

  const minX = Math.min(...markerPoints.map((point) => point.x));
  const maxX = Math.max(...markerPoints.map((point) => point.x));
  const minY = Math.min(...markerPoints.map((point) => point.y));
  const maxY = Math.max(...markerPoints.map((point) => point.y));
  const isVertical = Math.abs(maxX - minX) < 0.01;
  const isHorizontal = Math.abs(maxY - minY) < 0.01;

  if (isVertical && unit.y !== 0) {
    const targetY = unit.y < 0 ? minY : maxY;
    return markerPoints.find((point) => Math.abs(point.y - targetY) < 0.01) ?? linePoint;
  }
  if (isHorizontal && unit.x !== 0) {
    const targetX = unit.x < 0 ? minX : maxX;
    return markerPoints.find((point) => Math.abs(point.x - targetX) < 0.01) ?? linePoint;
  }
  return linePoint;
}

function snapUnitComponent(value: number): number {
  if (Math.abs(value) < 0.000_001) return 0;
  if (Math.abs(Math.abs(value) - 1) < 0.000_001) return Math.sign(value);
  if (Math.abs(Math.abs(value) - Math.SQRT1_2) < 0.000_001) {
    return Math.sign(value) * Math.SQRT1_2;
  }
  return value;
}
