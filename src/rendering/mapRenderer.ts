import { LINE_BY_ID, compareLineIds } from "../data/lines";
import type { GameState } from "../game/GameState";
import {
  getConnectionPathFrom,
  getDirectionAngle,
  getStation,
  type MovementDirection,
} from "../game/movement";
import type { Connection, NetworkData, Point } from "../data/types";
import { GRID_CELL_SIZE, gridPointToSvgPoint } from "./grid";
import { renderRevealedLine } from "./lineRenderer";
import { getCanonicalPathKey, getCenteredOffset, PARALLEL_LINE_SPACING, PARALLEL_STUB_SPACING } from "./pathOffset";
import { renderRiverThames } from "./riverRenderer";
import { renderStationMarker } from "./stationRenderer";

const SVG_NS = "http://www.w3.org/2000/svg";
const BASE_VIEWBOX_WIDTH = 760;
const BASE_VIEWBOX_HEIGHT = 560;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.4;
const ZOOM_STEP = 1.25;
const STUB_LENGTH = 26;

export class MapRenderer {
  readonly svg: SVGSVGElement;

  private readonly network: NetworkData;

  private zoom = 1;

  constructor(container: HTMLElement, network: NetworkData) {
    this.network = network;
    this.svg = document.createElementNS(SVG_NS, "svg");
    this.svg.setAttribute("class", "tube-map");
    this.svg.setAttribute("role", "img");
    this.svg.setAttribute("aria-label", "London transport speedrun map");
    this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    container.append(this.svg);
  }

  render(state: GameState, pointerPoint: Point | null, pointerDirection: MovementDirection): void {
    this.svg.classList.add("tube-map-running");
    const currentStation = getStation(this.network, state.currentStationId);
    const currentPoint = gridPointToSvgPoint(currentStation);
    const viewBoxSize = this.getViewBoxSize();
    const viewBox = {
      x: currentPoint.x - viewBoxSize.width / 2,
      y: currentPoint.y - viewBoxSize.height / 2,
      width: viewBoxSize.width,
      height: viewBoxSize.height,
    };
    this.svg.setAttribute(
      "viewBox",
      `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`,
    );
    this.svg.replaceChildren();

    this.renderGrid(viewBox);
    renderRiverThames(this.svg);

    const revealedLayer = document.createElementNS(SVG_NS, "g");
    revealedLayer.setAttribute("class", "revealed-lines");
    this.svg.append(revealedLayer);

    const visibleStationIds = new Set<string>([state.currentStationId]);
    for (const group of groupConnectionsByPath(this.getVisibleConnections(state))) {
      group.forEach((connection, index) => {
        renderRevealedLine(
          revealedLayer,
          connection,
          this.network,
          getCenteredOffset(index, group.length, PARALLEL_LINE_SPACING),
        );
      });
    }

    for (const connection of this.getVisibleConnections(state)) {
      visibleStationIds.add(connection.from);
      visibleStationIds.add(connection.to);
    }

    const stubLayer = document.createElementNS(SVG_NS, "g");
    stubLayer.setAttribute("class", "direction-stubs");
    this.svg.append(stubLayer);
    this.renderDirectionStubs(stubLayer, state.currentStationId, currentPoint, state.revealedConnections);

    const pointerLayer = document.createElementNS(SVG_NS, "g");
    pointerLayer.setAttribute("class", "pointer-layer");
    this.svg.append(pointerLayer);
    this.renderPointer(pointerLayer, pointerPoint, pointerDirection, state.rejectedMoveAt !== null);

    const stationLayer = document.createElementNS(SVG_NS, "g");
    stationLayer.setAttribute("class", "stations");
    this.svg.append(stationLayer);

    for (const stationId of visibleStationIds) {
      const station = getStation(this.network, stationId);
      renderStationMarker(
        stationLayer,
        station,
        this.network,
        state.selectedLineId,
        station.id === state.currentStationId,
        1 / this.zoom,
      );
    }
  }

  renderIdle(): void {
    this.svg.classList.remove("tube-map-running");
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
    renderRiverThames(this.svg);
  }

  zoomIn(): void {
    this.zoom = Math.min(MAX_ZOOM, this.zoom * ZOOM_STEP);
  }

  zoomOut(): void {
    this.zoom = Math.max(MIN_ZOOM, this.zoom / ZOOM_STEP);
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

    const arrow = document.createElementNS(SVG_NS, "g");
    arrow.setAttribute(
      "transform",
      `translate(${pointerPoint.x} ${pointerPoint.y}) rotate(${getDirectionAngle(pointerDirection)})`,
    );
    arrow.setAttribute("class", rejected ? "cursor-arrow cursor-arrow-rejected" : "cursor-arrow");

    const shaft = document.createElementNS(SVG_NS, "path");
    shaft.setAttribute("d", "M -14 0 L 12 0");
    shaft.setAttribute("class", "cursor-arrow-shaft");
    arrow.append(shaft);

    const head = document.createElementNS(SVG_NS, "path");
    head.setAttribute("d", "M 16 0 L 2 -9 L 5 0 L 2 9 Z");
    head.setAttribute("class", "cursor-arrow-head");
    arrow.append(head);
    layer.append(arrow);
  }

  private getVisibleConnections(state: GameState): Connection[] {
    return this.network.connections.filter((connection) => state.revealedConnections.has(connection.id));
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

  private renderDirectionStubs(
    layer: SVGGElement,
    stationId: string,
    currentPoint: Point,
    revealedConnectionIds: Set<string>,
  ): void {
    const stubs = this.network.connections.flatMap((connection) => {
      if (revealedConnectionIds.has(connection.id)) {
        return [];
      }
      if (connection.from !== stationId && connection.to !== stationId) {
        return [];
      }

      const path = getConnectionPathFrom(connection, stationId);
      if (!path || path.length < 2) {
        return [];
      }

      const first = path[0];
      const second = path[1];
      const dx = Math.sign(second.x - first.x);
      const dy = Math.sign(second.y - first.y);
      const length = Math.hypot(dx, dy);

      if (length === 0) {
        return [];
      }

      return [
        {
          connection,
          key: `${dx},${dy}`,
          unit: { x: dx / length, y: dy / length },
          normal: { x: -dy / length, y: dx / length },
        },
      ];
    });

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
          x: currentPoint.x + stub.normal.x * offset,
          y: currentPoint.y + stub.normal.y * offset,
        };
        const end = {
          x: currentPoint.x + stub.unit.x * STUB_LENGTH + stub.normal.x * offset,
          y: currentPoint.y + stub.unit.y * STUB_LENGTH + stub.normal.y * offset,
        };
        const line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("x1", String(start.x));
        line.setAttribute("y1", String(start.y));
        line.setAttribute("x2", String(end.x));
        line.setAttribute("y2", String(end.y));
        line.setAttribute("stroke", LINE_BY_ID[stub.connection.line].color);
        line.setAttribute("class", "direction-stub");
        if (stub.connection.line === "walk") {
          line.setAttribute("stroke-dasharray", "8 6");
        }
        layer.append(line);
      });
    }
  }
}

function isMajorGridLine(value: number): boolean {
  return Math.round(value / GRID_CELL_SIZE) % 5 === 0;
}

function groupConnectionsByPath(connections: Connection[]): Connection[][] {
  const groups = new Map<string, Connection[]>();

  for (const connection of connections) {
    const key = getCanonicalPathKey(connection.path);
    const group = groups.get(key) ?? [];
    group.push(connection);
    groups.set(key, group);
  }

  return [...groups.values()].map((group) =>
    group.sort((a, b) => compareLineIds(a.line, b.line) || a.id.localeCompare(b.id)),
  );
}
