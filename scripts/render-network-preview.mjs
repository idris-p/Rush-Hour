import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connectionSeeds, stationSeeds } from "../src/data/network.generated.ts";
import { riverThamesPath } from "../src/data/mapDecorations.generated.ts";
import { createRoundedPathData } from "../src/rendering/roundedPath.ts";

const COLORS = {
  bakerloo: "#B36305",
  central: "#E32017",
  circle: "#FFD300",
  district: "#00782A",
  "hammersmith-city": "#F3A9BB",
  jubilee: "#A0A5A9",
  metropolitan: "#9B0056",
  northern: "#000000",
  piccadilly: "#003688",
  victoria: "#0098D4",
  "waterloo-city": "#95CDBA",
  elizabeth: "#6950A1",
  walk: "#111111",
};

const SCALE = 5;
const LINE_CORNER_RADIUS = (20 / 32) * SCALE;
const PADDING = 30;
const points = [...stationSeeds, ...riverThamesPath, ...connectionSeeds.flatMap((connection) => connection.path ?? [])];
const minX = Math.min(...points.map((point) => point.x));
const maxX = Math.max(...points.map((point) => point.x));
const minY = Math.min(...points.map((point) => point.y));
const maxY = Math.max(...points.map((point) => point.y));
const width = (maxX - minX) * SCALE + PADDING * 2;
const height = (maxY - minY) * SCALE + PADDING * 2;
const project = (point) => `${(point.x - minX) * SCALE + PADDING},${(point.y - minY) * SCALE + PADDING}`;

const lines = connectionSeeds.map((connection) => {
  const dash = connection.line === "walk" ? ' stroke-dasharray="7 6"' : "";
  const path = connection.path.map((point) => {
    const [x, y] = project(point).split(",").map(Number);
    return { x, y };
  });
  return `<path d="${createRoundedPathData(path, LINE_CORNER_RADIUS)}" fill="none" stroke="${COLORS[connection.line]}" stroke-width="4" stroke-linecap="butt" stroke-linejoin="round"${dash}/>`;
});
const riverPoints = riverThamesPath.map(project).join(" ");
const river = [
  `<polyline points="${riverPoints}" fill="none" stroke="hsl(195,44%,71%)" stroke-width="12" stroke-linecap="square" stroke-linejoin="round"/>`,
  `<polyline points="${riverPoints}" fill="none" stroke="hsl(195,44%,86%)" stroke-width="9" stroke-linecap="square" stroke-linejoin="round"/>`,
];
const stations = stationSeeds.map((station) => {
  const [cx, cy] = project(station).split(",");
  return `<circle cx="${cx}" cy="${cy}" r="3.5" fill="white" stroke="#111" stroke-width="1.5"><title>${escapeXml(station.name)}</title></circle>`;
});

const output = join(tmpdir(), "tube-speedrun-network-preview.svg");
await writeFile(
  output,
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background:#f7f5ef">${river.join("")}${lines.join("")}${stations.join("")}</svg>`,
  "utf8",
);
console.log(output);

function escapeXml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
