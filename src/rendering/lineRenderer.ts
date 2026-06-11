import { LINE_BY_ID } from "../data/lines";
import type { Connection, NetworkData } from "../data/types";
import { gridPointToSvgPoint } from "./grid";
import { getCanonicalPath, offsetPolylinePoints } from "./pathOffset";

const SVG_NS = "http://www.w3.org/2000/svg";

export function renderRevealedLine(
  layer: SVGGElement,
  connection: Connection,
  network: NetworkData,
  offset = 0,
): void {
  const hasFromStation = network.stations.some((station) => station.id === connection.from);
  const hasToStation = network.stations.some((station) => station.id === connection.to);

  if (!hasFromStation || !hasToStation) {
    return;
  }

  const polyline = document.createElementNS(SVG_NS, "polyline");
  polyline.setAttribute(
    "points",
    offsetPolylinePoints(getCanonicalPath(connection.path).map(gridPointToSvgPoint), offset)
      .map((point) => `${point.x},${point.y}`)
      .join(" "),
  );
  polyline.setAttribute("fill", "none");
  polyline.setAttribute("stroke", LINE_BY_ID[connection.line].color);
  polyline.setAttribute("stroke-width", "9");
  polyline.setAttribute("stroke-linecap", "round");
  polyline.setAttribute("stroke-linejoin", "round");
  polyline.setAttribute("class", "map-line");
  layer.append(polyline);
}
