import { LINE_BY_ID } from "../data/lines";
import type { Connection, NetworkData, Point } from "../data/types";
import { gridPointToSvgPoint } from "./grid";
import { getCanonicalPath, offsetPolylinePoints } from "./pathOffset";
import { createRoundedPathData, simplifyPolylinePoints } from "./roundedPath";

const SVG_NS = "http://www.w3.org/2000/svg";
const LINE_CORNER_RADIUS = 20;

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
  path.setAttribute("stroke-width", "9");
  path.setAttribute("stroke-linecap", "butt");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("class", "map-line");
  if (connection.line === "walk") {
    path.setAttribute("stroke-dasharray", "12 10");
  }
  layer.append(path);
}
