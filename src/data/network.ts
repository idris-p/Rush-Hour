import { compareLineIds } from "./lines";
import type { Connection, ConnectionSeed, GridPoint, LineId, NetworkData, Station, StationSeed } from "./types";

const TEMPORARY_SOURCE_GRID_SCALE = 10;
const TEMPORARY_GRID_OVERRIDES: Partial<Record<string, GridPoint>> = {};

export function createConnectionId(line: LineId, from: string, to: string): string {
  const [a, b] = [from, to].sort();
  return `${line}:${a}:${b}`;
}

const stationSeeds: StationSeed[] = [
  { id: "abbey-wood", name: "Abbey Wood", x: 1070, y: 430 },
  { id: "aldgate", name: "Aldgate", x: 700, y: 252 },
  { id: "aldgate-east", name: "Aldgate East", x: 725, y: 286 },
  { id: "angel", name: "Angel", x: 570, y: 138 },
  { id: "bank", name: "Bank", x: 628, y: 275 },
  { id: "barbican", name: "Barbican", x: 598, y: 218 },
  { id: "barons-court", name: "Barons Court", x: 90, y: 330 },
  { id: "baker-street", name: "Baker Street", x: 280, y: 220 },
  { id: "bayswater", name: "Bayswater", x: 180, y: 274 },
  { id: "bermondsey", name: "Bermondsey", x: 690, y: 405 },
  { id: "bethnal-green", name: "Bethnal Green", x: 735, y: 238 },
  { id: "blackfriars", name: "Blackfriars", x: 520, y: 330 },
  { id: "bond-street", name: "Bond Street", x: 335, y: 245 },
  { id: "borough", name: "Borough", x: 600, y: 430 },
  { id: "canada-water", name: "Canada Water", x: 740, y: 410 },
  { id: "canary-wharf", name: "Canary Wharf", x: 810, y: 380 },
  { id: "canning-town", name: "Canning Town", x: 890, y: 340 },
  { id: "cannon-street", name: "Cannon Street", x: 600, y: 310 },
  { id: "charing-cross", name: "Charing Cross", x: 450, y: 330 },
  { id: "chancery-lane", name: "Chancery Lane", x: 540, y: 245 },
  { id: "covent-garden", name: "Covent Garden", x: 480, y: 270 },
  { id: "custom-house", name: "Custom House", x: 930, y: 360 },
  { id: "earls-court", name: "Earl's Court", x: 150, y: 330 },
  { id: "edgware-road", name: "Edgware Road", x: 220, y: 260 },
  { id: "edgware-road-bakerloo", name: "Edgware Road (Bakerloo)", x: 222, y: 228 },
  { id: "elephant-castle", name: "Elephant & Castle", x: 560, y: 470 },
  { id: "embankment", name: "Embankment", x: 440, y: 350 },
  { id: "euston", name: "Euston", x: 430, y: 145 },
  { id: "euston-square", name: "Euston Square", x: 382, y: 185 },
  { id: "farringdon", name: "Farringdon", x: 560, y: 200 },
  { id: "gloucester-road", name: "Gloucester Road", x: 190, y: 325 },
  { id: "goldhawk-road", name: "Goldhawk Road", x: 72, y: 292 },
  { id: "goodge-street", name: "Goodge Street", x: 410, y: 202 },
  { id: "great-portland-street", name: "Great Portland Street", x: 330, y: 190 },
  { id: "green-park", name: "Green Park", x: 360, y: 310 },
  { id: "hammersmith", name: "Hammersmith", x: 40, y: 340 },
  { id: "high-street-kensington", name: "High Street Kensington", x: 190, y: 295 },
  { id: "holborn", name: "Holborn", x: 500, y: 235 },
  { id: "holland-park", name: "Holland Park", x: 125, y: 235 },
  { id: "hyde-park-corner", name: "Hyde Park Corner", x: 320, y: 315 },
  { id: "kennington", name: "Kennington", x: 500, y: 465 },
  { id: "kings-cross-st-pancras", name: "King's Cross St Pancras", x: 520, y: 140 },
  { id: "knightsbridge", name: "Knightsbridge", x: 280, y: 315 },
  { id: "ladbroke-grove", name: "Ladbroke Grove", x: 150, y: 292 },
  { id: "lambeth-north", name: "Lambeth North", x: 480, y: 430 },
  { id: "lancaster-gate", name: "Lancaster Gate", x: 245, y: 240 },
  { id: "latimer-road", name: "Latimer Road", x: 125, y: 292 },
  { id: "leicester-square", name: "Leicester Square", x: 450, y: 285 },
  { id: "liverpool-street", name: "Liverpool Street", x: 680, y: 240 },
  { id: "london-bridge", name: "London Bridge", x: 630, y: 390 },
  { id: "mansion-house", name: "Mansion House", x: 560, y: 320 },
  { id: "marble-arch", name: "Marble Arch", x: 285, y: 245 },
  { id: "marylebone", name: "Marylebone", x: 245, y: 215 },
  { id: "mile-end", name: "Mile End", x: 840, y: 275 },
  { id: "monument", name: "Monument", x: 630, y: 300 },
  { id: "moorgate", name: "Moorgate", x: 650, y: 225 },
  { id: "north-greenwich", name: "North Greenwich", x: 860, y: 400 },
  { id: "notting-hill-gate", name: "Notting Hill Gate", x: 165, y: 240 },
  { id: "old-street", name: "Old Street", x: 610, y: 195 },
  { id: "oxford-circus", name: "Oxford Circus", x: 385, y: 245 },
  { id: "paddington", name: "Paddington", x: 180, y: 240 },
  { id: "piccadilly-circus", name: "Piccadilly Circus", x: 405, y: 290 },
  { id: "queensway", name: "Queensway", x: 205, y: 240 },
  { id: "regents-park", name: "Regent's Park", x: 315, y: 220 },
  { id: "royal-oak", name: "Royal Oak", x: 195, y: 292 },
  { id: "russell-square", name: "Russell Square", x: 510, y: 190 },
  { id: "shepherds-bush", name: "Shepherd's Bush", x: 80, y: 230 },
  { id: "shepherds-bush-market", name: "Shepherd's Bush Market", x: 98, y: 292 },
  { id: "sloane-square", name: "Sloane Square", x: 270, y: 350 },
  { id: "south-kensington", name: "South Kensington", x: 230, y: 330 },
  { id: "southwark", name: "Southwark", x: 500, y: 405 },
  { id: "st-jamess-park", name: "St James's Park", x: 360, y: 360 },
  { id: "st-pauls", name: "St Paul's", x: 590, y: 250 },
  { id: "stepney-green", name: "Stepney Green", x: 800, y: 285 },
  { id: "stratford", name: "Stratford", x: 920, y: 200 },
  { id: "temple", name: "Temple", x: 480, y: 340 },
  { id: "tottenham-court-road", name: "Tottenham Court Road", x: 435, y: 245 },
  { id: "tower-hill", name: "Tower Hill", x: 670, y: 295 },
  { id: "victoria", name: "Victoria", x: 320, y: 370 },
  { id: "warren-street", name: "Warren Street", x: 390, y: 165 },
  { id: "waterloo", name: "Waterloo", x: 450, y: 400 },
  { id: "west-ham", name: "West Ham", x: 920, y: 280 },
  { id: "westbourne-park", name: "Westbourne Park", x: 172, y: 292 },
  { id: "westminster", name: "Westminster", x: 400, y: 355 },
  { id: "west-kensington", name: "West Kensington", x: 115, y: 350 },
  { id: "whitechapel", name: "Whitechapel", x: 760, y: 285 },
  { id: "wood-lane", name: "Wood Lane", x: 112, y: 292 },
  { id: "woolwich", name: "Woolwich", x: 1005, y: 410 },
];

function sequence(line: LineId, stationIds: string[]): ConnectionSeed[] {
  return stationIds.slice(0, -1).map((from, index) => ({
    from,
    to: stationIds[index + 1],
    line,
  }));
}

function normalizeStationToGrid(station: StationSeed): StationSeed {
  const override = TEMPORARY_GRID_OVERRIDES[station.id];

  return {
    ...station,
    x: override?.x ?? Math.round(station.x / TEMPORARY_SOURCE_GRID_SCALE),
    y: override?.y ?? Math.round(station.y / TEMPORARY_SOURCE_GRID_SCALE),
  };
}

function createOctilinearGridPath(from: GridPoint, to: GridPoint): GridPoint[] {
  const path: GridPoint[] = [{ x: from.x, y: from.y }];
  let x = from.x;
  let y = from.y;

  while (x !== to.x || y !== to.y) {
    if (x !== to.x) {
      x += Math.sign(to.x - x);
    }

    if (y !== to.y) {
      y += Math.sign(to.y - y);
    }

    path.push({ x, y });
  }

  return path;
}

const connectionSeeds: ConnectionSeed[] = [
  ...sequence("bakerloo", [
    "paddington",
    "edgware-road-bakerloo",
    "marylebone",
    "baker-street",
    "regents-park",
    "oxford-circus",
    "piccadilly-circus",
    "charing-cross",
    "embankment",
    "waterloo",
    "lambeth-north",
    "elephant-castle",
  ]),
  ...sequence("central", [
    "shepherds-bush",
    "holland-park",
    "notting-hill-gate",
    "queensway",
    "lancaster-gate",
    "marble-arch",
    "bond-street",
    "oxford-circus",
    "tottenham-court-road",
    "holborn",
    "chancery-lane",
    "st-pauls",
    "bank",
    "liverpool-street",
    "bethnal-green",
    "mile-end",
    "stratford",
  ]),
  ...sequence("circle", [
    "hammersmith",
    "goldhawk-road",
    "shepherds-bush-market",
    "wood-lane",
    "latimer-road",
    "ladbroke-grove",
    "westbourne-park",
    "royal-oak",
    "paddington",
    "edgware-road",
    "baker-street",
    "great-portland-street",
    "euston-square",
    "kings-cross-st-pancras",
    "farringdon",
    "barbican",
    "moorgate",
    "liverpool-street",
    "aldgate",
    "tower-hill",
    "monument",
    "cannon-street",
    "mansion-house",
    "blackfriars",
    "temple",
    "embankment",
    "westminster",
    "st-jamess-park",
    "victoria",
    "sloane-square",
    "south-kensington",
    "gloucester-road",
    "high-street-kensington",
    "notting-hill-gate",
    "bayswater",
    "paddington",
  ]),
  ...sequence("district", [
    "hammersmith",
    "barons-court",
    "west-kensington",
    "earls-court",
    "gloucester-road",
    "south-kensington",
    "sloane-square",
    "victoria",
    "st-jamess-park",
    "westminster",
    "embankment",
    "temple",
    "blackfriars",
    "mansion-house",
    "cannon-street",
    "monument",
    "tower-hill",
    "aldgate-east",
    "whitechapel",
    "stepney-green",
    "mile-end",
  ]),
  ...sequence("hammersmith-city", [
    "hammersmith",
    "goldhawk-road",
    "shepherds-bush-market",
    "wood-lane",
    "latimer-road",
    "ladbroke-grove",
    "westbourne-park",
    "royal-oak",
    "paddington",
    "edgware-road",
    "baker-street",
    "great-portland-street",
    "euston-square",
    "kings-cross-st-pancras",
    "farringdon",
    "barbican",
    "moorgate",
    "liverpool-street",
    "aldgate-east",
    "whitechapel",
    "stepney-green",
    "mile-end",
  ]),
  ...sequence("jubilee", [
    "baker-street",
    "bond-street",
    "green-park",
    "westminster",
    "waterloo",
    "southwark",
    "london-bridge",
    "bermondsey",
    "canada-water",
    "canary-wharf",
    "north-greenwich",
    "canning-town",
    "west-ham",
    "stratford",
  ]),
  ...sequence("metropolitan", [
    "baker-street",
    "great-portland-street",
    "euston-square",
    "kings-cross-st-pancras",
    "farringdon",
    "barbican",
    "moorgate",
    "liverpool-street",
    "aldgate",
  ]),
  ...sequence("northern", [
    "euston",
    "kings-cross-st-pancras",
    "angel",
    "old-street",
    "moorgate",
    "bank",
    "london-bridge",
    "borough",
    "elephant-castle",
  ]),
  ...sequence("northern", [
    "euston",
    "warren-street",
    "goodge-street",
    "tottenham-court-road",
    "leicester-square",
    "charing-cross",
    "embankment",
    "waterloo",
    "kennington",
    "elephant-castle",
  ]),
  ...sequence("piccadilly", [
    "hammersmith",
    "barons-court",
    "earls-court",
    "gloucester-road",
    "south-kensington",
    "knightsbridge",
    "hyde-park-corner",
    "green-park",
    "piccadilly-circus",
    "leicester-square",
    "covent-garden",
    "holborn",
    "russell-square",
    "kings-cross-st-pancras",
  ]),
  ...sequence("victoria", [
    "victoria",
    "green-park",
    "oxford-circus",
    "warren-street",
    "euston",
    "kings-cross-st-pancras",
  ]),
  ...sequence("waterloo-city", ["waterloo", "bank"]),
  ...sequence("elizabeth", [
    "paddington",
    "bond-street",
    "tottenham-court-road",
    "farringdon",
    "liverpool-street",
    "whitechapel",
    "canary-wharf",
    "custom-house",
    "woolwich",
    "abbey-wood",
  ]),
  ...sequence("elizabeth", ["whitechapel", "stratford"]),
];

function defineNetwork(stations: StationSeed[], connections: ConnectionSeed[]): NetworkData {
  const gridStations = stations.map(normalizeStationToGrid);
  const stationById = new Map(gridStations.map((station) => [station.id, station]));
  const linesByStation = new Map<string, Set<LineId>>();

  for (const connection of connections) {
    if (!stationById.has(connection.from) || !stationById.has(connection.to)) {
      throw new Error(`Connection references missing station: ${connection.line} ${connection.from} -> ${connection.to}`);
    }

    for (const stationId of [connection.from, connection.to]) {
      const lines = linesByStation.get(stationId) ?? new Set<LineId>();
      lines.add(connection.line);
      linesByStation.set(stationId, lines);
    }
  }

  const fullStations: Station[] = gridStations.map((station) => ({
    ...station,
    lines: [...(linesByStation.get(station.id) ?? [])].sort(compareLineIds),
  }));

  const fullConnections: Connection[] = connections.map((connection) => ({
    ...connection,
    id: createConnectionId(connection.line, connection.from, connection.to),
    path:
      connection.path ??
      createOctilinearGridPath(
        stationById.get(connection.from) ?? missingStation(connection.from),
        stationById.get(connection.to) ?? missingStation(connection.to),
      ),
  }));

  return {
    stations: fullStations,
    connections: fullConnections,
    temporary: true,
    notes: [
      "TEMPORARY_DATA: central playable subset only.",
      "Temporary source coordinates are normalized onto a square grid at load time.",
      "Replace with full London Underground and Elizabeth line data before treating route coverage as complete.",
      "Unsupported TfL modes and London Trams are intentionally excluded.",
    ],
  };
}

export const networkData = defineNetwork(stationSeeds, connectionSeeds);

function missingStation(stationId: string): never {
  throw new Error(`Missing station while creating connection path: ${stationId}`);
}
