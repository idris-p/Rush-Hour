import { riverThamesPath } from "../data/mapDecorations";
import { gridPointToSvgPoint } from "./grid";

const SVG_NS = "http://www.w3.org/2000/svg";
const RIVER_OUTLINE_COLOR = "hsl(195, 44%, 71%)";
const RIVER_FILL_COLOR = "hsl(195, 44%, 86%)";
const RIVER_OUTLINE_WIDTH = 24;

type ViewBox = { x: number; y: number; width: number; height: number };

export function renderRiverThames(svg: SVGSVGElement, viewBox: ViewBox): void {
  const layer = document.createElementNS(SVG_NS, "g");
  layer.setAttribute("class", "river-layer");
  layer.setAttribute("aria-hidden", "true");
  layer.setAttribute("pointer-events", "none");

  const points = getRiverRenderPoints(viewBox)
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  layer.append(
    createRiverStroke(points, RIVER_OUTLINE_COLOR, RIVER_OUTLINE_WIDTH, "river-thames-outline"),
    createRiverStroke(points, RIVER_FILL_COLOR, 18, "river-thames-fill"),
  );
  svg.append(layer);
}

export function getRiverRenderPoints(viewBox: ViewBox) {
  const points = riverThamesPath.map(gridPointToSvgPoint);
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return points;

  const edgePadding = RIVER_OUTLINE_WIDTH / 2;
  const extendedPoints = [...points];
  if (first.x > viewBox.x - edgePadding) {
    extendedPoints.unshift({ x: viewBox.x - edgePadding, y: first.y });
  }
  if (last.x < viewBox.x + viewBox.width + edgePadding) {
    extendedPoints.push({ x: viewBox.x + viewBox.width + edgePadding, y: last.y });
  }
  return extendedPoints;
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
