import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SOURCE_URL = new URL("../src/map/Transport%2520for%2520London%2520-%2520Tube%2520map.svg", import.meta.url);
const OUTPUT_URL = new URL("../src/data/network.generated.ts", import.meta.url);

const LINE_SOURCES = {
  bakerloo: ["hsl(29,100%,40%)", "24.5,-4.5"],
  central: ["hsl(0,100%,50%)", "24.5,-4.5"],
  circle: ["hsl(58,100%,60%)", "-1.5,4.5"],
  district: ["hsl(116,100%,30%)", "-1.5,6.5"],
  "hammersmith-city": ["hsl(319,100%,80%)", "-1.5,4.5"],
  jubilee: ["hsl(348,0%,62.5%)", "27.5,5.5"],
  metropolitan: ["hsl(290,100%,30%)", "20.5,-11.5"],
  northern: ["hsl(348,0%,0%)", "30.5,3.5"],
  piccadilly: ["hsl(232,100%,40%)", "21.5,-0.5"],
  victoria: ["hsl(203,100%,60%)", "21.5,-0.5"],
  "waterloo-city": ["hsl(174,100%,40%)", "44.5,-3.5"],
  elizabeth: ["hsl(261,100%,70%)", "38.5,-8.5"],
};

const LABEL_CORRECTIONS = new Map([
  ["Godhawk Road", "Goldhawk Road"],
  ["Landbroke Grove", "Ladbroke Grove"],
  ["Kensal Garden", "Kensal Green"],
  ["East Date", "Hounslow East"],
  ["Totting Bec", "Tooting Bec"],
  ["Totting Broadway", "Tooting Broadway"],
  ["King's Cross & St Pancras International", "King's Cross St Pancras"],
  ["Custom House (for ExCeL)", "Custom House"],
  ["St. James's Park", "St James's Park"],
]);

const UNLABELLED_COMPONENTS = new Map([
  ["22.5,-5.5", "Bond Street"],
  ["-1.5,5.5", "Hammersmith"],
  ["14.5,-18.5", "West Hampstead"],
  ["-20.5,-43.5", "Watford"],
  ["-26.5,-36.5", "West Ruislip"],
  ["3.5,0.5", "Shepherd's Bush"],
  ["33.5,16.5", "Elephant & Castle"],
  ["35.5,-45.5", "High Barnet"],
  ["-36.5,-44.5", "Amersham"],
  ["-40.5,-21.5", "Reading"],
  ["49.5,-45.5", "Cockfosters"],
  ["5.5,-35.5", "Stanmore"],
  ["67.5,7.5", "Canary Wharf"],
  ["69.5,4.5", "Canary Wharf"],
]);

const MERGED_STATION_NAMES = new Set([
  "Hammersmith",
  "Shepherd's Bush",
  "Elephant & Castle",
  "Canary Wharf",
]);

class UnionFind {
  constructor(values) { this.parents = new Map([...values].map((value) => [value, value])); }
  has(value) { return this.parents.has(value); }
  find(value) {
    if (!this.parents.has(value)) this.parents.set(value, value);
    if (this.parents.get(value) !== value) this.parents.set(value, this.find(this.parents.get(value)));
    return this.parents.get(value);
  }
  union(a, b) {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parents.set(rootB, rootA);
  }
}

const svg = await readFile(SOURCE_URL, "utf8");
const groups = extractTopLevelGroups(svg);
if (groups.length < 5) throw new Error(`Expected five SVG map groups, found ${groups.length}.`);

const routeElements = extractElements(groups[3], "path").map(parseElement);
const labelTokens = [...groups[4].matchAll(/<ellipse\b[^>]*\/>|<path\b[^>]*\/>|<g\b[^>]*\/>|<g\b[^>]*>.*?<\/g>/gs)].map(
  (match) => match[0],
);
const whitePaths = new Set(
  routeElements
    .filter(({ attributes }) => ["white", "#fff"].includes(attributes.stroke))
    .map(({ attributes }) => canonicalPath(attributes.d)),
);

const routeEdges = [];
for (const [line, [color, anchor]] of Object.entries(LINE_SOURCES)) {
  const candidates = routeElements
    .filter(({ attributes }) => attributes.stroke === color && !attributes["stroke-dasharray"])
    .filter(({ attributes }) => line !== "northern" || !whitePaths.has(canonicalPath(attributes.d)))
    .map(({ attributes }) => createRouteEdge(line, attributes.d));
  const selected = selectConnectedComponent(candidates, anchor);
  if (selected.length === 0) throw new Error(`Missing ${line} route component at ${anchor}.`);
  routeEdges.push(...selected);
}

const routeNodes = new Set(routeEdges.flatMap(({ fromNode, toNode }) => [fromNode, toNode]));
const unionFind = new UnionFind(routeNodes);
for (const { attributes } of routeElements) {
  if (attributes.stroke !== "hsl(348,0%,0%)" || !whitePaths.has(canonicalPath(attributes.d))) continue;
  const points = parsePathPoints(attributes.d);
  if (points.length >= 2) unionFind.union(pointKey(points[0]), pointKey(points.at(-1)));
}

const labelsByRoot = new Map();
for (const label of extractStationLabels(labelTokens, routeNodes)) {
  for (const candidate of label.candidates) {
    if (unionFind.has(candidate)) addToMapSet(labelsByRoot, unionFind.find(candidate), correctLabel(label.name));
  }
}

const rootsByRouteNode = new Map([...routeNodes].map((node) => [node, unionFind.find(node)]));
const nodesByRoot = new Map();
for (const node of routeNodes) addToMapSet(nodesByRoot, rootsByRouteNode.get(node), node);

for (const [node, name] of UNLABELLED_COMPONENTS) {
  if (!routeNodes.has(node)) continue;
  const root = rootsByRouteNode.get(node);
  if (!labelsByRoot.has(root)) addToMapSet(labelsByRoot, root, name);
}

const unnamed = [...nodesByRoot.keys()].filter((root) => !labelsByRoot.has(root));
if (unnamed.length > 0) {
  throw new Error(`Unlabelled route components: ${unnamed.map((root) => [...nodesByRoot.get(root)].join(";")).join(" | ")}`);
}

const stationGroupByRoot = new Map();
const stationGroups = new Map();
for (const root of nodesByRoot.keys()) {
  const names = [...labelsByRoot.get(root)].sort();
  const name = names.join(" / ");
  const groupKey = MERGED_STATION_NAMES.has(name) ? `merged:${name}` : `root:${root}`;
  stationGroupByRoot.set(root, groupKey);
  const group = stationGroups.get(groupKey) ?? { names: new Set(), nodes: new Set() };
  names.forEach((value) => group.names.add(value));
  nodesByRoot.get(root).forEach((node) => group.nodes.add(node));
  stationGroups.set(groupKey, group);
}

const stationByGroup = new Map();
const usedIds = new Set();
for (const [groupKey, group] of stationGroups) {
  let name = [...group.names].sort().join(" / ");
  if (name === "Edgware Road" && group.nodes.has("8.5,-12.5")) {
    name = "Edgware Road (Bakerloo)";
  }
  const sourcePoint = chooseMedoid([...group.nodes].map(keyToPoint));
  stationByGroup.set(groupKey, {
    id: uniqueId(slugify(name), usedIds),
    name,
    x: toGridCoordinate(sourcePoint.x),
    y: toGridCoordinate(sourcePoint.y),
  });
}

const connectionById = new Map();
for (const edge of routeEdges) {
  const fromStation = stationByGroup.get(stationGroupByRoot.get(rootsByRouteNode.get(edge.fromNode)));
  const toStation = stationByGroup.get(stationGroupByRoot.get(rootsByRouteNode.get(edge.toNode)));
  if (!fromStation || !toStation || fromStation.id === toStation.id) continue;
  const [a, b] = [fromStation.id, toStation.id].sort();
  const id = `${edge.line}:${a}:${b}`;
  if (connectionById.has(id)) continue;
  connectionById.set(id, {
    from: fromStation.id,
    to: toStation.id,
    line: edge.line,
    path: joinStationPath(fromStation, edge.points.map(toGridPoint), toStation),
  });
}

const stationLines = new Map();
for (const connection of connectionById.values()) {
  addToMapSet(stationLines, connection.from, connection.line);
  addToMapSet(stationLines, connection.to, connection.line);
}
const stations = [...stationByGroup.values()]
  .filter(({ id }) => stationLines.has(id))
  .sort((a, b) => a.name.localeCompare(b.name));
const connections = [...connectionById.values()].sort(
  (a, b) => a.line.localeCompare(b.line) || a.from.localeCompare(b.from) || a.to.localeCompare(b.to),
);

const output = `// Generated by scripts/generate-network.mjs from the bundled TfL SVG.\n` +
  `// Do not edit directly; update the SVG or generator corrections.\n\n` +
  `import type { ConnectionSeed, StationSeed } from "./types";\n\n` +
  `export const stationSeeds: StationSeed[] = ${JSON.stringify(stations, null, 2)};\n\n` +
  `export const connectionSeeds: ConnectionSeed[] = ${JSON.stringify(connections, null, 2)};\n`;
await writeFile(OUTPUT_URL, output, "utf8");

console.log(`Generated ${stations.length} stations and ${connections.length} connections in ${fileURLToPath(OUTPUT_URL)}.`);
console.log(Object.fromEntries(Object.keys(LINE_SOURCES).map((line) => [line, connections.filter((item) => item.line === line).length])));

function extractTopLevelGroups(source) {
  const result = [];
  const matcher = /<\/?g(?:\s[^>]*)?\/?>/g;
  let depth = 0;
  let start = -1;
  for (const match of source.matchAll(matcher)) {
    if (match[0].endsWith("/>")) {
      if (depth === 0) result.push(match[0]);
      continue;
    }
    if (!match[0].startsWith("</")) {
      if (depth === 0) start = match.index;
      depth += 1;
    } else {
      depth -= 1;
      if (depth === 0) result.push(source.slice(start, match.index + match[0].length));
    }
  }
  return result;
}

function extractElements(source, tagName) {
  return [...source.matchAll(new RegExp(`<${tagName}\\b[^>]*\\/>`, "g"))].map((match) => match[0]);
}

function parseElement(element) {
  const attributes = {};
  for (const match of element.matchAll(/([:\w-]+)="([^"]*)"/g)) attributes[match[1]] = match[2];
  return { attributes };
}

function parsePathPoints(path = "") {
  const values = [...path.matchAll(/[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?/gi)].map((match) => Number(match[0]));
  const points = [];
  for (let index = 0; index + 1 < values.length; index += 2) {
    points.push({ x: roundHalf(values[index]), y: roundHalf(values[index + 1]) });
  }
  return deduplicatePoints(points);
}

function createRouteEdge(line, path) {
  const points = parsePathPoints(path);
  if (points.length < 2) throw new Error(`Invalid ${line} path.`);
  return { line, fromNode: pointKey(points[0]), toNode: pointKey(points.at(-1)), points };
}

function selectConnectedComponent(edges, anchor) {
  const edgesByNode = new Map();
  edges.forEach((edge, index) => {
    addToMapSet(edgesByNode, edge.fromNode, index);
    addToMapSet(edgesByNode, edge.toNode, index);
  });
  if (!edgesByNode.has(anchor)) return [];
  const selected = new Set();
  const visited = new Set([anchor]);
  const queue = [anchor];
  while (queue.length > 0) {
    const node = queue.shift();
    for (const edgeIndex of edgesByNode.get(node) ?? []) {
      selected.add(edgeIndex);
      const edge = edges[edgeIndex];
      const other = edge.fromNode === node ? edge.toNode : edge.fromNode;
      if (!visited.has(other)) {
        visited.add(other);
        queue.push(other);
      }
    }
  }
  return [...selected].map((index) => edges[index]);
}

function extractStationLabels(tokens, routeNodes) {
  const labels = [];
  let pending = [];
  for (const token of tokens) {
    if (token.startsWith("<ellipse")) {
      const { attributes } = parseElement(token);
      pending.push(pointKey({ x: Number(attributes.cx), y: Number(attributes.cy) }));
      continue;
    }
    if (token.startsWith("<path")) {
      const points = parsePathPoints(parseElement(token).attributes.d);
      if (points.length > 0) pending.push(pointKey(points[0]));
      continue;
    }
    const texts = [...token.matchAll(/<text\b([^>]*)>(.*?)<\/text>/gs)];
    const name = texts
      .map((match) => decodeXml(match[2].replace(/<[^>]+>/g, "")))
      .join(" ")
      .replace(/[^A-Za-z0-9&'(). -]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (/[A-Za-z]/.test(name)) {
      const attributes = texts.length > 0 ? parseElement(`<text ${texts[0][1]}/>`).attributes : {};
      const anchor = { x: Number(attributes.x), y: Number(attributes.y) };
      let candidates = [...new Set(pending)].filter(
        (node) => distance(keyToPoint(node), anchor) <= 4,
      );
      if (candidates.length === 0 && (pending.length === 0 || pending.some((node) => distance(keyToPoint(node), anchor) > 8))) {
        const nearest = findNearestNode(anchor, routeNodes);
        if (nearest && nearest.distance <= 2.5) candidates = [nearest.node];
      }
      labels.push({ name, candidates });
    }
    pending = [];
  }
  return labels;
}

function findNearestNode(point, nodes) {
  let nearest = null;
  for (const node of nodes) {
    const candidateDistance = distance(point, keyToPoint(node));
    if (!nearest || candidateDistance < nearest.distance) nearest = { node, distance: candidateDistance };
  }
  return nearest;
}

function joinStationPath(fromStation, routePath, toStation) {
  const start = createOctilinearPath(fromStation, routePath[0]);
  const end = createOctilinearPath(routePath.at(-1), toStation);
  return simplifyPath([...start, ...routePath.slice(1), ...end.slice(1)]);
}

function createOctilinearPath(from, to) {
  const path = [{ x: from.x, y: from.y }];
  let { x, y } = from;
  while (x !== to.x || y !== to.y) {
    x += Math.sign(to.x - x);
    y += Math.sign(to.y - y);
    path.push({ x, y });
  }
  return path;
}

function simplifyPath(points) {
  const path = deduplicatePoints(points);
  for (let pass = 0; pass < 20; pass += 1) {
    let changed = false;
    for (let index = 1; index < path.length - 1; index += 1) {
      const a = directionIndex(path[index - 1], path[index]);
      const b = directionIndex(path[index], path[index + 1]);
      const difference = a < 0 || b < 0 ? 0 : Math.min(Math.abs(a - b), 8 - Math.abs(a - b));
      if (difference <= 1) continue;
      path.splice(index - 1, 3, ...createOctilinearPath(path[index - 1], path[index + 1]));
      changed = true;
      break;
    }
    if (!changed) break;
  }
  return deduplicatePoints(path);
}

function directionIndex(from, to) {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  return [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]
    .findIndex(([x, y]) => x === dx && y === dy);
}

function chooseMedoid(points) {
  return points.reduce((best, point) => {
    const score = points.reduce((sum, candidate) => sum + distance(point, candidate), 0);
    return !best || score < best.score ? { point, score } : best;
  }, null).point;
}

function canonicalPath(path = "") { return path.replace(/\s+/g, ""); }
function correctLabel(name) { return LABEL_CORRECTIONS.get(name) ?? name; }
function toGridPoint(point) { return { x: toGridCoordinate(point.x), y: toGridCoordinate(point.y) }; }
function toGridCoordinate(value) { return roundHalf(value) + 0.5; }
function roundHalf(value) { return Math.round(value * 2) / 2; }
function pointKey(point) { return `${roundHalf(point.x)},${roundHalf(point.y)}`; }
function keyToPoint(key) { const [x, y] = key.split(",").map(Number); return { x, y }; }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function deduplicatePoints(points) { return points.filter((point, index) => index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y); }
function slugify(value) { return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function decodeXml(value) { return value.replace(/&amp;/g, "&").replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">"); }

function uniqueId(base, used) {
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  used.add(id);
  return id;
}

function addToMapSet(map, key, value) {
  const set = map.get(key) ?? new Set();
  set.add(value);
  map.set(key, set);
}
