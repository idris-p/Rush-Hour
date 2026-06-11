import { LINE_BY_ID } from "../data/lines";
import type { LineId, Station } from "../data/types";
import { gridPointToSvgPoint } from "./grid";

const SVG_NS = "http://www.w3.org/2000/svg";

export function renderStationMarker(layer: SVGGElement, station: Station, selectedLineId: LineId, isCurrent: boolean): void {
  const point = gridPointToSvgPoint(station);
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("class", isCurrent ? "station station-current" : "station station-revealed");
  group.setAttribute("transform", `translate(${point.x} ${point.y})`);

  const halo = document.createElementNS(SVG_NS, "circle");
  halo.setAttribute("r", isCurrent ? "16" : "9");
  halo.setAttribute("fill", "#ffffff");
  halo.setAttribute("stroke", isCurrent ? LINE_BY_ID[selectedLineId].color : "#111111");
  halo.setAttribute("stroke-width", isCurrent ? "5" : "3");
  group.append(halo);

  const dot = document.createElementNS(SVG_NS, "circle");
  dot.setAttribute("r", isCurrent ? "5" : "3");
  dot.setAttribute("fill", "#111111");
  group.append(dot);

  if (isCurrent) {
    const label = document.createElementNS(SVG_NS, "text");
    label.textContent = station.name;
    label.setAttribute("x", "20");
    label.setAttribute("y", "-18");
    label.setAttribute("class", "current-station-label");
    group.append(label);
  }

  layer.append(group);
}
