import { LINE_BY_ID } from "../data/lines";
import type { Connection, NetworkData, Point } from "../data/types";
import { gridPointToSvgPoint } from "./grid";
import { getCanonicalPath, offsetPolylinePoints } from "./pathOffset";
import { createRoundedPathData, simplifyPolylinePoints } from "./roundedPath";

const SVG_NS = "http://www.w3.org/2000/svg";
const LINE_CORNER_RADIUS = 20;
const LINE_STROKE_WIDTH = 12;
const LOOP_ARROW_ARM_LENGTH = 13;

export function renderRevealedLine(
  layer: SVGGElement,
  connection: Connection,
  network: NetworkData,
  offset = 0,
  connectionPoints?: Point[],
): void {
  const hasFromStation = network.stations.some((station) => station.id === connection.from);
  const hasToStation = network.stations.some((station) => station.id === connection.to);

  if (!hasFromStation || !hasToStation) {
    return;
  }

  const path = document.createElementNS(SVG_NS, "path");
  const points = offsetPolylinePoints(
    connectionPoints ?? simplifyPolylinePoints(getCanonicalPath(connection.path).map(gridPointToSvgPoint)),
    offset,
  );
  path.setAttribute("d", createRoundedPathData(points, LINE_CORNER_RADIUS));
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", LINE_BY_ID[connection.line].color);
  path.setAttribute("stroke-width", String(LINE_STROKE_WIDTH));
  path.setAttribute("stroke-linecap", "butt");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("class", "map-line");
  if (connection.line === "walk") {
    path.setAttribute("stroke-dasharray", "12 10");
  }
  layer.append(path);

  if (connection.oneWay && connection.line !== "walk") {
    for (const arrow of getOneWayArrowLineSegments(connection)) {
      const group = document.createElementNS(SVG_NS, "g");
      group.setAttribute("class", "one-way-line-arrow");
      for (const segment of arrow) {
        const line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("x1", String(segment.from.x));
        line.setAttribute("y1", String(segment.from.y));
        line.setAttribute("x2", String(segment.to.x));
        line.setAttribute("y2", String(segment.to.y));
        group.append(line);
      }
      layer.append(group);
    }
  }
}

export type OneWayArrowLineSegment = {
  from: Point;
  to: Point;
};

export function getOneWayArrowLineSegments(connection: Connection): OneWayArrowLineSegment[][] {
  if (connection.line !== "piccadilly") return [];
  if (connection.from === "hatton-cross" && connection.to === "heathrow-terminal-4") {
    return [createLoopChevron(gridPointToSvgPoint({ x: -62, y: 38 }), "down")];
  }
  if (connection.from === "heathrow-terminal-4" && connection.to === "heathrow-terminal-2-and-3") {
    return [createLoopChevron(gridPointToSvgPoint({ x: -70, y: 41 }), "up")];
  }
  return [];
}

function createLoopChevron(point: Point, direction: "down" | "up"): OneWayArrowLineSegment[] {
  const tip = point;
  const verticalSign = direction === "down" ? -1 : 1;
  return [
    {
      from: {
        x: tip.x - LOOP_ARROW_ARM_LENGTH,
        y: tip.y + LOOP_ARROW_ARM_LENGTH * verticalSign,
      },
      to: tip,
    },
    {
      from: {
        x: tip.x + LOOP_ARROW_ARM_LENGTH,
        y: tip.y + LOOP_ARROW_ARM_LENGTH * verticalSign,
      },
      to: tip,
    },
  ];
}
