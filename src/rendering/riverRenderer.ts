import { riverThamesPath } from "../data/mapDecorations";
import { gridPointToSvgPoint } from "./grid";

const SVG_NS = "http://www.w3.org/2000/svg";
const RIVER_OUTLINE_COLOR = "hsl(195, 44%, 71%)";
const RIVER_FILL_COLOR = "hsl(195, 44%, 86%)";

export function renderRiverThames(svg: SVGSVGElement): void {
  const layer = document.createElementNS(SVG_NS, "g");
  layer.setAttribute("class", "river-layer");
  layer.setAttribute("aria-hidden", "true");
  layer.setAttribute("pointer-events", "none");

  const points = riverThamesPath
    .map(gridPointToSvgPoint)
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  layer.append(
    createRiverStroke(points, RIVER_OUTLINE_COLOR, 24, "river-thames-outline"),
    createRiverStroke(points, RIVER_FILL_COLOR, 18, "river-thames-fill"),
  );
  svg.append(layer);
}

function createRiverStroke(points: string, color: string, width: number, className: string): SVGPolylineElement {
  const polyline = document.createElementNS(SVG_NS, "polyline");
  polyline.setAttribute("points", points);
  polyline.setAttribute("fill", "none");
  polyline.setAttribute("stroke", color);
  polyline.setAttribute("stroke-width", String(width));
  polyline.setAttribute("stroke-linecap", "square");
  polyline.setAttribute("stroke-linejoin", "round");
  polyline.setAttribute("class", className);
  return polyline;
}
