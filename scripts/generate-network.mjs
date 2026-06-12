import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SOURCE_URL = new URL("../src/map/Transport%2520for%2520London%2520-%2520Tube%2520map.svg", import.meta.url);
const OUTPUT_URL = new URL("../src/data/network.generated.ts", import.meta.url);
const DECORATIONS_OUTPUT_URL = new URL("../src/data/mapDecorations.generated.ts", import.meta.url);
const GRID_DIRECTIONS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const MAXIMUM_SOURCE_DEVIATION = 8;

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
  "Shepherd's Bush",
  "Elephant & Castle",
]);

const WALK_LINKED_STATION_FAMILIES = new Set(["Hammersmith", "Canary Wharf"]);
const STATION_NAME_BY_NODE = new Map([
  ["44.5,-7.5", "Moorgate"],
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
const decorationElements = extractElements(groups[2], "path").map(parseElement);
const riverElement = decorationElements.find(
  ({ attributes }) => normalizeCssColor(attributes.stroke) === "hsl(195,44%,71%)",
);
if (!riverElement) throw new Error("Unable to find the River Thames in the bundled TfL SVG.");
const riverThamesPath = expandGridPath(parsePathPoints(riverElement.attributes.d).map(toGridPoint));
validateDecorationPath("River Thames", riverThamesPath, 2);
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
const interchangeEdges = [];
for (const { attributes } of routeElements) {
  if (attributes.stroke !== "hsl(348,0%,0%)" || !whitePaths.has(canonicalPath(attributes.d))) continue;
  const points = parsePathPoints(attributes.d);
  if (points.length >= 2) {
    interchangeEdges.push({
      fromNode: pointKey(points[0]),
      toNode: pointKey(points.at(-1)),
      dashed: Boolean(attributes["stroke-dasharray"]),
      points,
    });
    unionFind.union(pointKey(points[0]), pointKey(points.at(-1)));
  }
}

const stationLabels = extractStationLabels(labelTokens, routeNodes);
const labelsByRoot = new Map();
for (const label of stationLabels) {
  for (const candidate of label.candidates) {
    if (unionFind.has(candidate)) addToMapSet(labelsByRoot, unionFind.find(candidate), correctLabel(label.name));
  }
}

if (process.env.AUDIT_INTERCHANGES === "1") {
  const labelsByNode = new Map();
  for (const label of stationLabels) {
    for (const node of label.candidates) addToMapSet(labelsByNode, node, correctLabel(label.name));
  }
  for (const edge of interchangeEdges) {
    console.log("INTERCHANGE", edge.fromNode, [...(labelsByNode.get(edge.fromNode) ?? [])], "->", edge.toNode, [...(labelsByNode.get(edge.toNode) ?? [])]);
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

if (process.env.AUDIT_INTERCHANGES === "1") {
  for (const [root, nodes] of nodesByRoot) {
    const names = [...(labelsByRoot.get(root) ?? [])];
    if (names.length < 2) continue;
    console.log("COMPOSITE", names);
    for (const node of nodes) {
      const lines = [...new Set(routeEdges.filter((edge) => edge.fromNode === node || edge.toNode === node).map((edge) => edge.line))];
      console.log(" NODE", node, lines);
    }
  }
}

const stationGroupByNode = new Map();
const stationGroups = new Map();
for (const root of nodesByRoot.keys()) {
  const names = [...labelsByRoot.get(root)].sort();
  const name = names.join(" / ");
  const labelledNodesByName = new Map();
  for (const label of stationLabels) {
    const correctedName = correctLabel(label.name);
    if (!names.includes(correctedName)) continue;
    for (const node of label.candidates) {
      if (rootsByRouteNode.get(node) === root) addToMapSet(labelledNodesByName, correctedName, node);
    }
  }

  for (const node of nodesByRoot.get(root)) {
    const identity = chooseStationIdentity(root, node, names, labelledNodesByName);
    const groupKey = MERGED_STATION_NAMES.has(identity.name) ? `merged:${identity.name}` : identity.groupKey;
    stationGroupByNode.set(node, groupKey);
    const group = stationGroups.get(groupKey) ?? { names: new Set(), nodes: new Set() };
    group.names.add(identity.name);
    group.nodes.add(node);
    stationGroups.set(groupKey, group);
  }
}

const stationByGroup = new Map();
const usedIds = new Set();
for (const [groupKey, group] of stationGroups) {
  let name = [...group.names].sort().join(" / ");
  name = disambiguateStationName(name, group.nodes);
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
  const fromStation = stationByGroup.get(stationGroupByNode.get(edge.fromNode));
  const toStation = stationByGroup.get(stationGroupByNode.get(edge.toNode));
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

for (const nodes of nodesByRoot.values()) {
  const groups = [...new Set([...nodes].map((node) => stationGroupByNode.get(node)).filter(Boolean))];
  for (let index = 1; index < groups.length; index += 1) {
    addWalkConnection(connectionById, stationByGroup.get(groups[index - 1]), stationByGroup.get(groups[index]));
  }
}

for (const edge of interchangeEdges) {
  const fromStation = stationByGroup.get(stationGroupByNode.get(edge.fromNode));
  const toStation = stationByGroup.get(stationGroupByNode.get(edge.toNode));
  addWalkConnection(connectionById, fromStation, toStation, edge.points.map(toGridPoint));
}

for (const name of WALK_LINKED_STATION_FAMILIES) {
  const matches = [...stationByGroup.values()].filter(
    (station) => station.name === name || station.name.startsWith(`${name} (`),
  );
  for (let index = 1; index < matches.length; index += 1) {
    addWalkConnection(connectionById, matches[index - 1], matches[index]);
  }
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
const geometryStats = enforcePlayableGeometry(stations, connections);

const output = `// Generated by scripts/generate-network.mjs from the bundled TfL SVG.\n` +
  `// Do not edit directly; update the SVG or generator corrections.\n\n` +
  `import type { ConnectionSeed, StationSeed } from "./types";\n\n` +
  `export const stationSeeds: StationSeed[] = ${JSON.stringify(stations, null, 2)};\n\n` +
  `export const connectionSeeds: ConnectionSeed[] = ${JSON.stringify(connections, null, 2)};\n`;
await writeFile(OUTPUT_URL, output, "utf8");
const decorationsOutput = `// Generated by scripts/generate-network.mjs from the bundled TfL SVG.\n` +
  `// Decorative map geometry only. It is not part of the playable network.\n\n` +
  `import type { GridPoint } from "./types";\n\n` +
  `export const riverThamesPath: GridPoint[] = ${JSON.stringify(riverThamesPath, null, 2)};\n`;
await writeFile(DECORATIONS_OUTPUT_URL, decorationsOutput, "utf8");

console.log(`Generated ${stations.length} stations and ${connections.length} connections in ${fileURLToPath(OUTPUT_URL)}.`);
console.log(`Generated ${riverThamesPath.length} River Thames grid points in ${fileURLToPath(DECORATIONS_OUTPUT_URL)}.`);
console.log(Object.fromEntries(Object.keys(LINE_SOURCES).map((line) => [line, connections.filter((item) => item.line === line).length])));
console.log(`Maximum smooth-path deviation from the scaled source: ${geometryStats.maximumDeviation} grid cells.`);

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

function chooseStationIdentity(root, node, names, labelledNodesByName) {
  const forcedName = STATION_NAME_BY_NODE.get(node);
  if (forcedName && names.includes(forcedName)) {
    return { name: forcedName, groupKey: `split:${root}:${forcedName}` };
  }

  if (names.length === 1 && names[0] === "Paddington" && node === "5.5,-12.5") {
    return {
      name: "Paddington (Hammersmith & City)",
      groupKey: `split:${root}:paddington-hammersmith-city`,
    };
  }

  if (names.length <= 1) {
    return { name: names[0], groupKey: `root:${root}` };
  }

  const point = keyToPoint(node);
  const nearestName = names.reduce((best, candidateName) => {
    const candidates = [...(labelledNodesByName.get(candidateName) ?? [])];
    const candidateDistance = candidates.reduce(
      (minimum, candidate) => Math.min(minimum, distance(point, keyToPoint(candidate))),
      Number.POSITIVE_INFINITY,
    );
    return !best || candidateDistance < best.distance
      ? { name: candidateName, distance: candidateDistance }
      : best;
  }, null).name;

  return { name: nearestName, groupKey: `split:${root}:${nearestName}` };
}

function disambiguateStationName(name, nodes) {
  if (name === "Hammersmith") {
    const lines = new Set(
      routeEdges
        .filter((edge) => nodes.has(edge.fromNode) || nodes.has(edge.toNode))
        .map((edge) => edge.line),
    );
    return lines.has("circle") || lines.has("hammersmith-city")
      ? "Hammersmith (Circle and Hammersmith & City)"
      : "Hammersmith (District and Piccadilly)";
  }
  if (name === "Canary Wharf") {
    return nodes.has("67.5,7.5") ? "Canary Wharf (Jubilee)" : "Canary Wharf (Elizabeth line)";
  }
  return name;
}

function addWalkConnection(connectionById, fromStation, toStation, sourcePath = null) {
  if (!fromStation || !toStation || fromStation.id === toStation.id) return;
  const [a, b] = [fromStation.id, toStation.id].sort();
  const id = `walk:${a}:${b}`;
  if (connectionById.has(id)) return;
  const path = sourcePath
    ? joinStationPath(fromStation, sourcePath, toStation)
    : createOctilinearPath(fromStation, toStation);
  connectionById.set(id, {
    from: fromStation.id,
    to: toStation.id,
    line: "walk",
    path,
  });
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

function expandGridPath(points) {
  if (points.length === 0) return [];
  const path = [points[0]];
  for (let index = 1; index < points.length; index += 1) {
    path.push(...createOctilinearPath(points[index - 1], points[index]).slice(1));
  }
  return deduplicatePoints(path);
}

function validateDecorationPath(name, path, maximumTurnAmount) {
  if (path.length < 2) throw new Error(`${name} must contain at least two grid points.`);
  for (let index = 1; index < path.length; index += 1) {
    const dx = Math.abs(path[index].x - path[index - 1].x);
    const dy = Math.abs(path[index].y - path[index - 1].y);
    if (dx > 1 || dy > 1 || (dx === 0 && dy === 0)) {
      throw new Error(`${name} has an invalid grid step at ${index - 1} -> ${index}.`);
    }
    if (index < 2) continue;
    const previousDirection = directionIndex(path[index - 2], path[index - 1]);
    const currentDirection = directionIndex(path[index - 1], path[index]);
    if (directionTurnAmount(previousDirection, currentDirection) > maximumTurnAmount) {
      throw new Error(`${name} has an illegal turn at grid point ${index - 1}.`);
    }
  }
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

function enforcePlayableGeometry(stations, connections) {
  const guidePaths = new Map(connections.map((connection) => [connectionKey(connection), connection.path]));
  const exitsByStationAndLine = new Map();
  for (const connection of connections) {
    addExit(exitsByStationAndLine, connection, connection.from, connection.path);
    addExit(exitsByStationAndLine, connection, connection.to, [...connection.path].reverse());
  }

  const assignedDirections = new Map();
  for (const exits of exitsByStationAndLine.values()) {
    const assignment = chooseExitDirections(exits.map((exit) => exit.desiredDirection), exits[0]?.line);
    exits.forEach((exit, index) => assignedDirections.set(`${exit.connectionKey}:${exit.stationId}`, assignment[index]));
  }

  for (const connection of connections) {
    const startDirection = assignedDirections.get(`${connectionKey(connection)}:${connection.from}`);
    const endDirection = assignedDirections.get(`${connectionKey(connection)}:${connection.to}`);
    const guidePath = connection.path;
    connection.path = findSmoothPath(
      connection.path[0],
      connection.path.at(-1),
      startDirection,
      endDirection,
      guidePath,
    );
  }
  simplifyConnectionRoutes(connections, guidePaths);
  const maximumDeviation = Math.max(
    ...connections.flatMap((connection) => {
      const guidePath = guidePaths.get(connectionKey(connection));
      return connection.path.map((point) => nearestGuideDistance(point, guidePath));
    }),
  );
  if (maximumDeviation > MAXIMUM_SOURCE_DEVIATION) {
    throw new Error(
      `Smooth routing deviated ${maximumDeviation} grid cells from the source; maximum is ${MAXIMUM_SOURCE_DEVIATION}.`,
    );
  }
  return { maximumDeviation };
}

function simplifyConnectionRoutes(connections, guidePaths) {
  const exitsByStationAndLine = buildCurrentExits(connections);
  for (let pass = 0; pass < 3; pass += 1) {
    let changed = false;
    for (const connection of connections) {
      const guidePath = guidePaths.get(connectionKey(connection));
      const currentQuality = routeQuality(connection.path, guidePath);
      if (currentQuality.turns <= 1) continue;

      let bestPath = connection.path;
      for (let startDirection = 0; startDirection < 8; startDirection += 1) {
        if (!canAssignExit(exitsByStationAndLine, connection, connection.from, startDirection, connection.to)) continue;
        for (let endTravelDirection = 0; endTravelDirection < 8; endTravelDirection += 1) {
          const endExitDirection = (endTravelDirection + 4) % 8;
          if (!canAssignExit(exitsByStationAndLine, connection, connection.to, endExitDirection, connection.from)) continue;
          const candidate = createSimplePath(
            connection.path[0],
            connection.path.at(-1),
            startDirection,
            endTravelDirection,
          );
          if (!candidate || maximumGuideDeviation(candidate, guidePath) > MAXIMUM_SOURCE_DEVIATION) continue;
          if (compareRouteQuality(candidate, bestPath, guidePath) < 0) bestPath = candidate;
        }
      }

      if (bestPath !== connection.path) {
        updateCurrentExit(exitsByStationAndLine, connection, connection.from, directionIndex(bestPath[0], bestPath[1]));
        const reversed = [...bestPath].reverse();
        updateCurrentExit(exitsByStationAndLine, connection, connection.to, directionIndex(reversed[0], reversed[1]));
        connection.path = bestPath;
        changed = true;
      }
    }
    if (!changed) break;
  }
}

function buildCurrentExits(connections) {
  const exits = new Map();
  for (const connection of connections) {
    for (const stationId of [connection.from, connection.to]) {
      const path = stationId === connection.from ? connection.path : [...connection.path].reverse();
      const key = `${stationId}:${connection.line}`;
      const items = exits.get(key) ?? [];
      items.push({ connectionKey: connectionKey(connection), direction: directionIndex(path[0], path[1]) });
      exits.set(key, items);
    }
  }
  return exits;
}

function canAssignExit(exitsByStationAndLine, connection, stationId, direction, targetStationId) {
  const key = `${stationId}:${connection.line}`;
  const exits = exitsByStationAndLine.get(key) ?? [];
  const others = exits.filter((exit) => exit.connectionKey !== connectionKey(connection));
  if (others.some((exit) => exit.direction === direction)) return false;
  if (connection.line !== "walk" && exits.length === 2 && directionTurnAmount(direction, others[0].direction) < 3) {
    return false;
  }
  if (connection.line !== "walk" && exits.length >= 3) {
    const station = connection.path[connection.from === stationId ? 0 : connection.path.length - 1];
    const target = connection.path[connection.from === targetStationId ? 0 : connection.path.length - 1];
    if (directionTurnAmount(direction, nearestDirection(station, target)) > 1) return false;
  }
  return true;
}

function updateCurrentExit(exitsByStationAndLine, connection, stationId, direction) {
  const exits = exitsByStationAndLine.get(`${stationId}:${connection.line}`);
  const exit = exits.find((candidate) => candidate.connectionKey === connectionKey(connection));
  exit.direction = direction;
}

function createSimplePath(start, end, startDirection, endDirection) {
  if (directionTurnAmount(startDirection, endDirection) > 1) return null;
  const startVector = GRID_DIRECTIONS[startDirection];
  const endVector = GRID_DIRECTIONS[endDirection];
  const delta = { x: end.x - start.x, y: end.y - start.y };

  if (startDirection === endDirection) {
    const length = vectorMultiple(delta, startVector);
    return length && length > 0 ? buildTwoRunPath(start, startVector, length, endVector, 0) : null;
  }

  const determinant = startVector[0] * endVector[1] - startVector[1] * endVector[0];
  if (determinant === 0) return null;
  const firstLength = (delta.x * endVector[1] - delta.y * endVector[0]) / determinant;
  const secondLength = (startVector[0] * delta.y - startVector[1] * delta.x) / determinant;
  if (!Number.isInteger(firstLength) || !Number.isInteger(secondLength) || firstLength <= 0 || secondLength <= 0) {
    return null;
  }
  return buildTwoRunPath(start, startVector, firstLength, endVector, secondLength);
}

function vectorMultiple(delta, vector) {
  if (vector[0] === 0) return delta.x === 0 ? delta.y / vector[1] : null;
  if (vector[1] === 0) return delta.y === 0 ? delta.x / vector[0] : null;
  const xLength = delta.x / vector[0];
  const yLength = delta.y / vector[1];
  return xLength === yLength ? xLength : null;
}

function buildTwoRunPath(start, firstVector, firstLength, secondVector, secondLength) {
  const path = [{ ...start }];
  for (const [vector, length] of [[firstVector, firstLength], [secondVector, secondLength]]) {
    for (let step = 0; step < length; step += 1) {
      const previous = path.at(-1);
      path.push({ x: previous.x + vector[0], y: previous.y + vector[1] });
    }
  }
  return path;
}

function maximumGuideDeviation(path, guidePath) {
  return Math.max(...path.map((point) => nearestGuideDistance(point, guidePath)));
}

function addExit(exitsByStationAndLine, connection, stationId, path) {
  const key = `${stationId}:${connection.line}`;
  const exits = exitsByStationAndLine.get(key) ?? [];
  exits.push({
    connectionKey: connectionKey(connection),
    stationId,
    line: connection.line,
    desiredDirection: nearestDirection(path[0], path.at(-1)),
  });
  exitsByStationAndLine.set(key, exits);
}

function connectionKey(connection) {
  return `${connection.line}:${connection.from}:${connection.to}`;
}

function chooseExitDirections(desiredDirections, line) {
  if (desiredDirections.length === 1) return desiredDirections;
  let best = null;
  const assignment = [];
  const used = new Set();

  function visit(index, score) {
    if (best && score >= best.score) return;
    if (index === desiredDirections.length) {
      if (line !== "walk" && assignment.length === 2 && directionTurnAmount(assignment[0], assignment[1]) < 3) return;
      best = { directions: [...assignment], score };
      return;
    }

    for (let direction = 0; direction < GRID_DIRECTIONS.length; direction += 1) {
      if (used.has(direction)) continue;
      assignment.push(direction);
      used.add(direction);
      const mismatch = directionTurnAmount(desiredDirections[index], direction);
      visit(index + 1, score + mismatch * mismatch * 4 + mismatch);
      used.delete(direction);
      assignment.pop();
    }
  }

  visit(0, 0);
  if (!best) throw new Error(`Unable to assign ${desiredDirections.length} distinct line exits.`);
  return best.directions;
}

function findSmoothPath(start, end, startDirection, endExitDirection, guidePath) {
  const candidates = [];
  for (const maximumFinalTurn of [0, 1]) {
    for (const margin of [4, 8, 12, 20]) {
      const path = searchSmoothPath(
        start,
        end,
        startDirection,
        endExitDirection,
        guidePath,
        margin,
        maximumFinalTurn,
      );
      if (path) candidates.push(path);
    }
  }
  if (candidates.length > 0) {
    return candidates.sort((a, b) => compareRouteQuality(a, b, guidePath))[0];
  }
  throw new Error(`Unable to route smooth path from ${pointKey(start)} to ${pointKey(end)}.`);
}

function compareRouteQuality(a, b, guidePath) {
  const qualityA = routeQuality(a, guidePath);
  const qualityB = routeQuality(b, guidePath);
  return (
    qualityA.turns - qualityB.turns ||
    qualityA.shortRuns - qualityB.shortRuns ||
    qualityA.length - qualityB.length ||
    qualityA.maximumDeviation - qualityB.maximumDeviation
  );
}

function routeQuality(path, guidePath) {
  const directions = path.slice(1).map((point, index) => directionIndex(path[index], point));
  const runLengths = [];
  let previousDirection;
  for (const direction of directions) {
    if (direction !== previousDirection) runLengths.push(1);
    else runLengths[runLengths.length - 1] += 1;
    previousDirection = direction;
  }
  return {
    turns: Math.max(0, runLengths.length - 1),
    shortRuns: runLengths.filter((length, index) => index > 0 && index < runLengths.length - 1 && length <= 2).length,
    length: path.length - 1,
    maximumDeviation: Math.max(...path.map((point) => nearestGuideDistance(point, guidePath))),
  };
}

function searchSmoothPath(start, end, startDirection, endExitDirection, guidePath, margin, maximumFinalTurn) {
  const startVector = GRID_DIRECTIONS[startDirection];
  const endVector = GRID_DIRECTIONS[endExitDirection];
  const first = { x: start.x + startVector[0], y: start.y + startVector[1] };
  const target = { x: end.x + endVector[0], y: end.y + endVector[1] };
  const finalDirection = (endExitDirection + 4) % 8;
  const guideXs = guidePath.map((point) => point.x);
  const guideYs = guidePath.map((point) => point.y);
  const minX = Math.min(...guideXs, start.x, end.x) - margin;
  const maxX = Math.max(...guideXs, start.x, end.x) + margin;
  const minY = Math.min(...guideYs, start.y, end.y) - margin;
  const maxY = Math.max(...guideYs, start.y, end.y) + margin;
  const startKey = stateKey(first, startDirection);
  const open = [];
  const costs = new Map([[startKey, 0]]);
  const previous = new Map();
  open.push({ point: first, direction: startDirection, score: gridDistance(first, target) });

  while (open.length > 0) {
    open.sort((a, b) => b.score - a.score);
    const current = open.pop();
    const currentKey = stateKey(current.point, current.direction);
    const currentCost = costs.get(currentKey);
    if (currentCost === undefined) continue;

    if (
      samePoint(current.point, target) &&
      directionTurnAmount(current.direction, finalDirection) <= maximumFinalTurn
    ) {
      const middle = rebuildPath(previous, currentKey);
      return deduplicatePoints([start, ...middle, end]);
    }

    for (const turn of [-1, 0, 1]) {
      const direction = (current.direction + turn + 8) % 8;
      const vector = GRID_DIRECTIONS[direction];
      const next = { x: current.point.x + vector[0], y: current.point.y + vector[1] };
      if (next.x < minX || next.x > maxX || next.y < minY || next.y > maxY) continue;
      const distanceFromGuide = nearestGuideDistance(next, guidePath);
      if (distanceFromGuide > MAXIMUM_SOURCE_DEVIATION) continue;

      const nextKey = stateKey(next, direction);
      const guidePenalty = distanceFromGuide * 0.08;
      const progressPenalty = gridDistance(next, target) > gridDistance(current.point, target) ? 1.5 : 0;
      const nextCost = currentCost + 1 + Math.abs(turn) * 8 + guidePenalty + progressPenalty;
      if (nextCost >= (costs.get(nextKey) ?? Number.POSITIVE_INFINITY)) continue;
      costs.set(nextKey, nextCost);
      previous.set(nextKey, { key: currentKey, point: next });
      open.push({
        point: next,
        direction,
        score: nextCost + gridDistance(next, target),
      });
    }
  }

  return null;
}

function rebuildPath(previous, finalKey) {
  const path = [];
  let key = finalKey;
  while (previous.has(key)) {
    const step = previous.get(key);
    path.push(step.point);
    key = step.key;
  }
  const [x, y] = key.split(":", 2).map(Number);
  path.push({ x, y });
  return path.reverse();
}

function stateKey(point, direction) { return `${point.x}:${point.y}:${direction}`; }
function samePoint(a, b) { return a.x === b.x && a.y === b.y; }
function gridDistance(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); }
function nearestGuideDistance(point, guidePath) {
  return guidePath.reduce((best, guide) => Math.min(best, gridDistance(point, guide)), Number.POSITIVE_INFINITY);
}
function nearestDirection(from, to) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  return Math.round(((angle / Math.PI) * 4 + 8) % 8) % 8;
}
function directionTurnAmount(a, b) {
  const difference = Math.abs(a - b);
  return Math.min(difference, 8 - difference);
}

function chooseMedoid(points) {
  return points.reduce((best, point) => {
    const score = points.reduce((sum, candidate) => sum + distance(point, candidate), 0);
    return !best || score < best.score ? { point, score } : best;
  }, null).point;
}

function canonicalPath(path = "") { return path.replace(/\s+/g, ""); }
function normalizeCssColor(value = "") { return value.replace(/\s+/g, "").toLowerCase(); }
function correctLabel(name) { return LABEL_CORRECTIONS.get(name) ?? name; }
function toGridPoint(point) { return { x: toGridCoordinate(point.x), y: toGridCoordinate(point.y) }; }
function toGridCoordinate(value) { return (roundHalf(value) + 0.5) * 2; }
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
