import { LINE_BY_ID } from "../data/lines";
import type { LineId, NetworkData, Point, Station } from "../data/types";
import { GRID_CELL_SIZE, gridPointToSvgPoint } from "./grid";

const SVG_NS = "http://www.w3.org/2000/svg";
const INTERCHANGE_OUTLINE_WIDTH = 12;
const INTERCHANGE_OUTER_RADIUS = GRID_CELL_SIZE / 2;
const INTERCHANGE_RADIUS = INTERCHANGE_OUTER_RADIUS - INTERCHANGE_OUTLINE_WIDTH / 2;
const BAR_HALF_LENGTH = 8;
const BAR_WIDTH = 5;
const CURRENT_HIGHLIGHT_WIDTH = 4;
const CURRENT_HIGHLIGHT_RADIUS =
  INTERCHANGE_OUTER_RADIUS + CURRENT_HIGHLIGHT_WIDTH / 2;
const NORTHERN_BRANCH_INTERCHANGES = new Set(["Camden Town", "Kennington"]);

export type CurrentStationLabelPlacement = {
  x: number;
  y: number;
  textAnchor: "start" | "middle" | "end";
};

export function renderStationMarker(
  layer: SVGGElement,
  station: Station,
  network: NetworkData,
  selectedLineId: LineId,
  isCurrent: boolean,
  currentLabelScale = 1,
  currentLabelPlacement: CurrentStationLabelPlacement = { x: 28, y: -24, textAnchor: "start" },
): SVGTextElement | null {
  const point = gridPointToSvgPoint(station);
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("class", isCurrent ? "station station-current" : "station station-revealed");
  group.setAttribute("transform", `translate(${point.x} ${point.y})`);

  const isInterchange = isInterchangeStation(station);
  if (isCurrent && isInterchange) {
    group.append(createCurrentHighlight(selectedLineId));
  }

  if (isInterchange) {
    group.append(createInterchangeMarker());
  } else {
    const markerLineId = station.lines.find((line) => line !== "walk") ?? selectedLineId;
    group.append(createBarMarker(getStationLineDirection(network, station.id, markerLineId), LINE_BY_ID[markerLineId].color));
  }

  let currentLabel: SVGTextElement | null = null;
  if (isCurrent) {
    const label = document.createElementNS(SVG_NS, "text");
    label.textContent = station.name;
    label.setAttribute("x", String(currentLabelPlacement.x));
    label.setAttribute("y", String(currentLabelPlacement.y));
    label.setAttribute("text-anchor", currentLabelPlacement.textAnchor);
    label.setAttribute("transform", `scale(${currentLabelScale})`);
    label.setAttribute("class", "current-station-label");
    group.append(label);
    currentLabel = label;
  }

  layer.append(group);
  return currentLabel;
}

export function isInterchangeStation(station: Station): boolean {
  return new Set(station.lines).size > 1 || NORTHERN_BRANCH_INTERCHANGES.has(station.name);
}

export function getStationLineDirection(network: NetworkData, stationId: string, lineId: LineId): Point {
  const directions = network.connections
    .filter(
      (connection) =>
        connection.line === lineId && (connection.from === stationId || connection.to === stationId),
    )
    .map((connection) => {
      const path = connection.from === stationId ? connection.path : [...connection.path].reverse();
      return normalize({ x: path[1].x - path[0].x, y: path[1].y - path[0].y });
    })
    .filter((direction): direction is Point => direction !== null);

  if (directions.length === 0) return { x: 1, y: 0 };
  if (directions.length === 1) return canonicalizeAxis(directions[0]);

  let bestPair = [directions[0], directions[1]];
  let bestDotProduct = dot(bestPair[0], bestPair[1]);
  for (let first = 0; first < directions.length - 1; first += 1) {
    for (let second = first + 1; second < directions.length; second += 1) {
      const dotProduct = dot(directions[first], directions[second]);
      if (dotProduct < bestDotProduct) {
        bestPair = [directions[first], directions[second]];
        bestDotProduct = dotProduct;
      }
    }
  }

  return canonicalizeAxis(
    normalize({ x: bestPair[0].x - bestPair[1].x, y: bestPair[0].y - bestPair[1].y }) ?? bestPair[0],
  );
}

function createCurrentHighlight(lineId: LineId): SVGCircleElement {
  const highlight = document.createElementNS(SVG_NS, "circle");
  highlight.setAttribute("r", String(CURRENT_HIGHLIGHT_RADIUS));
  highlight.setAttribute("fill", "none");
  highlight.setAttribute("stroke", LINE_BY_ID[lineId].color);
  highlight.setAttribute("stroke-width", String(CURRENT_HIGHLIGHT_WIDTH));
  if (lineId === "walk") {
    highlight.setAttribute("stroke-dasharray", "8 6");
    highlight.setAttribute("stroke-linecap", "butt");
  }
  highlight.setAttribute("class", "current-station-highlight");
  return highlight;
}

function createInterchangeMarker(): SVGCircleElement {
  const marker = document.createElementNS(SVG_NS, "circle");
  marker.setAttribute("r", String(INTERCHANGE_RADIUS));
  marker.setAttribute("fill", "#ffffff");
  marker.setAttribute("stroke", "#111111");
  marker.setAttribute("stroke-width", String(INTERCHANGE_OUTLINE_WIDTH));
  marker.setAttribute("class", "interchange-marker");
  return marker;
}

function createBarMarker(lineDirection: Point, color: string): SVGLineElement {
  const perpendicular = { x: -lineDirection.y, y: lineDirection.x };
  const marker = document.createElementNS(SVG_NS, "line");
  marker.setAttribute("x1", String(-perpendicular.x * BAR_HALF_LENGTH));
  marker.setAttribute("y1", String(-perpendicular.y * BAR_HALF_LENGTH));
  marker.setAttribute("x2", String(perpendicular.x * BAR_HALF_LENGTH));
  marker.setAttribute("y2", String(perpendicular.y * BAR_HALF_LENGTH));
  marker.setAttribute("stroke", color);
  marker.setAttribute("stroke-width", String(BAR_WIDTH));
  marker.setAttribute("stroke-linecap", "butt");
  marker.setAttribute("class", "station-bar-marker");
  return marker;
}

function normalize(point: Point): Point | null {
  const length = Math.hypot(point.x, point.y);
  return length === 0 ? null : { x: point.x / length, y: point.y / length };
}

function canonicalizeAxis(direction: Point): Point {
  const canonical = direction.x < 0 || (direction.x === 0 && direction.y < 0)
    ? { x: -direction.x, y: -direction.y }
    : direction;
  return {
    x: Object.is(canonical.x, -0) ? 0 : canonical.x,
    y: Object.is(canonical.y, -0) ? 0 : canonical.y,
  };
}

function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}
