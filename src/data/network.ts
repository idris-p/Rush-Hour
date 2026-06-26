import { compareLineIds } from "./lines";
import { connectionSeeds, stationSeeds } from "./network.generated";
import type { Connection, ConnectionSeed, LineId, NetworkData, Station } from "./types";

export function createConnectionId(line: LineId, from: string, to: string): string {
  const [a, b] = [from, to].sort();
  return `${line}:${a}:${b}`;
}

const localConnectionSeeds: ConnectionSeed[] = [
  {
    from: "hanger-lane",
    to: "park-royal",
    line: "walk",
    path: expandSchematicPath([{ x: -35, y: -21 }, { x: -38, y: -18 }]),
  },
  {
    from: "white-city",
    to: "wood-lane",
    line: "walk",
    path: expandSchematicPath([{ x: -4, y: 0 }, { x: -2, y: 2 }]),
  },
];

const removedStationIds = new Set(["paddington-bakerloo"]);
const stationIdRemaps = new Map<string, string>([
  ["paddington-bakerloo", "paddington"],
]);

const allConnectionSeeds = remapConnectionSeeds([...connectionSeeds, ...localConnectionSeeds]);

const linesByStation = new Map<string, Set<LineId>>();
for (const connection of allConnectionSeeds) {
  for (const stationId of [connection.from, connection.to]) {
    const lines = linesByStation.get(stationId) ?? new Set<LineId>();
    lines.add(connection.line);
    linesByStation.set(stationId, lines);
  }
}

const schematicStationPositionOverrides = new Map<string, Pick<Station, "x" | "y">>([
  ["north-ealing", { x: -38, y: -10 }],
  ["park-royal", { x: -38, y: -18 }],
  ["alperton", { x: -38, y: -32 }],
  ["sudbury-town", { x: -38, y: -38 }],
  ["sudbury-hill", { x: -38, y: -44 }],
  ["south-harrow", { x: -38, y: -50 }],
  ["hanger-lane", { x: -35, y: -21 }],
  ["west-ealing", { x: -46, y: -1 }],
  ["hanwell", { x: -50, y: -1 }],
  ["southall", { x: -54, y: -1 }],
  ["hayes-and-harlington", { x: -58, y: -1 }],
  ["south-ealing", { x: -48, y: 16 }],
  ["northfields", { x: -50, y: 18 }],
  ["boston-manor", { x: -52, y: 20 }],
  ["osterley", { x: -54, y: 22 }],
  ["hounslow-central", { x: -56, y: 24 }],
  ["hounslow-east", { x: -58, y: 26 }],
  ["hounslow-west", { x: -60, y: 28 }],
  ["heathrow-terminal-4", { x: -66, y: 44 }],
  ["heathrow-terminal-5", { x: -74, y: 44 }],
  ["west-drayton", { x: -62, y: -1 }],
  ["iver", { x: -66, y: -1 }],
  ["langley", { x: -70, y: -1 }],
  ["slough", { x: -74, y: -1 }],
  ["burnham", { x: -78, y: -1 }],
  ["taplow", { x: -82, y: -1 }],
  ["maidenhead", { x: -86, y: -1 }],
  ["twyford", { x: -90, y: -1 }],
  ["reading", { x: -94, y: -1 }],
  ["baker-street", { x: 42, y: -22 }],
  ["bond-street", { x: 42, y: -8 }],
  ["regent-s-park", { x: 46, y: -16 }],
  ["st-john-s-wood", { x: 39, y: -29 }],
  ["euston", { x: 65, y: -27 }],
  ["euston-square", { x: 60, y: -22 }],
  ["mornington-crescent", { x: 63, y: -30 }],
  ["old-street", { x: 87, y: -21 }],
  ["angel", { x: 82, y: -22 }],
  ["caledonian-road", { x: 76, y: -28 }],
  ["holloway-road", { x: 81, y: -33 }],
  ["arsenal", { x: 88, y: -40 }],
  ["finsbury-park", { x: 94, y: -46 }],
  ["highbury-and-islington", { x: 87, y: -35 }],
  ["canary-wharf-elizabeth-line", { x: 142, y: 10 }],
  ["whitechapel", { x: 119, y: -12 }],
  ["bethnal-green", { x: 122, y: -14 }],
  ["tottenham-court-road", { x: 62, y: -8 }],
  ["camden-town", { x: 65, y: -33 }],
  ["chalk-farm", { x: 63, y: -35 }],
  ["belsize-park", { x: 59, y: -39 }],
  ["hampstead", { x: 47, y: -51 }],
  ["golders-green", { x: 43, y: -55 }],
  ["brent-cross", { x: 39, y: -59 }],
  ["hendon-central", { x: 35, y: -63 }],
  ["colindale", { x: 29, y: -69 }],
  ["burnt-oak", { x: 25, y: -73 }],
  ["edgware", { x: 21, y: -77 }],
  ["kentish-town", { x: 73, y: -45 }],
  ["tufnell-park", { x: 73, y: -51 }],
  ["archway", { x: 73, y: -57 }],
  ["highgate", { x: 73, y: -61 }],
  ["east-finchley", { x: 73, y: -65 }],
  ["finchley-central", { x: 73, y: -69 }],
  ["mill-hill-east", { x: 70, y: -74 }],
  ["west-finchley", { x: 73, y: -77 }],
  ["woodside-park", { x: 73, y: -81 }],
  ["totteridge-and-whetstone", { x: 73, y: -85 }],
  ["high-barnet", { x: 73, y: -89 }],
  ["swiss-cottage", { x: 37, y: -31 }],
  ["finchley-road", { x: 32, y: -34 }],
  ["west-hampstead", { x: 31, y: -37 }],
  ["kilburn", { x: 25, y: -43 }],
  ["willesden-green", { x: 21, y: -47 }],
  ["dollis-hill", { x: 19, y: -49 }],
  ["neasden", { x: 17, y: -51 }],
  ["wembley-park", { x: 14, y: -52 }],
  ["kingsbury", { x: 12, y: -60 }],
  ["queensbury", { x: 12, y: -64 }],
  ["canons-park", { x: 12, y: -68 }],
  ["stanmore", { x: 12, y: -72 }],
  ["gunnersbury", { x: -25, y: 20 }],
  ["kew-gardens", { x: -31, y: 26 }],
  ["richmond", { x: -37, y: 32 }],
  ["russell-square", { x: 74, y: -18 }],
  ["wanstead", { x: 160, y: -46 }],
  ["redbridge", { x: 165, y: -46 }],
  ["gants-hill", { x: 170, y: -46 }],
  ["newbury-park", { x: 172, y: -48 }],
  ["barkingside", { x: 172, y: -52 }],
  ["fairlop", { x: 172, y: -56 }],
  ["hainault", { x: 172, y: -60 }],
  ["grange-hill", { x: 170, y: -62 }],
  ["chigwell", { x: 165, y: -62 }],
  ["roding-valley", { x: 160, y: -62 }],
  ["sloane-square", { x: 38, y: 15 }],
  ["victoria", { x: 44, y: 15 }],
  ["st-james-s-park", { x: 50, y: 15 }],
  ["westminster", { x: 56, y: 15 }],
  ["embankment", { x: 62, y: 15 }],
  ["temple", { x: 72, y: 15 }],
  ["waterloo", { x: 62, y: 21 }],
  ["southwark", { x: 70, y: 23 }],
  ["bermondsey", { x: 107, y: 13 }],
  ["hammersmith-circle-and-hammersmith-and-city", { x: -2, y: 12 }],
  ["edgware-road-bakerloo", { x: 24, y: -24 }],
  ["warwick-avenue", { x: 10, y: -20 }],
  ["maida-vale", { x: 4, y: -22 }],
  ["kilburn-park", { x: 0, y: -26 }],
  ["queen-s-park", { x: -2, y: -30 }],
  ["holborn", { x: 72, y: -8 }],
  ["chancery-lane", { x: 77, y: -8 }],
  ["st-paul-s", { x: 83, y: -8 }],
]);

const stations: Station[] = stationSeeds
  .filter((station) => !removedStationIds.has(station.id))
  .map((station) => ({
    ...station,
    ...schematicStationPositionOverrides.get(station.id),
    lines: [...(linesByStation.get(station.id) ?? [])].sort(compareLineIds),
  }));

const schematicPathOverrides = new Map<string, Connection["path"]>([
  [
    createConnectionId("central", "hanger-lane", "perivale"),
    expandSchematicPath([{ x: -35, y: -21 }, { x: -42, y: -28 }]),
  ],
  [
    createConnectionId("central", "north-acton", "hanger-lane"),
    expandSchematicPath([{ x: -14, y: 0 }, { x: -35, y: -21 }]),
  ],
  [
    createConnectionId("piccadilly", "ealing-common", "north-ealing"),
    expandSchematicPath([{ x: -38, y: 8 }, { x: -38, y: -10 }]),
  ],
  [
    createConnectionId("piccadilly", "north-ealing", "park-royal"),
    expandSchematicPath([{ x: -38, y: -10 }, { x: -38, y: -18 }]),
  ],
  [
    createConnectionId("piccadilly", "park-royal", "alperton"),
    expandSchematicPath([{ x: -38, y: -18 }, { x: -38, y: -32 }]),
  ],
  [
    createConnectionId("piccadilly", "alperton", "sudbury-town"),
    expandSchematicPath([{ x: -38, y: -32 }, { x: -38, y: -38 }]),
  ],
  [
    createConnectionId("piccadilly", "sudbury-town", "sudbury-hill"),
    expandSchematicPath([{ x: -38, y: -38 }, { x: -38, y: -44 }]),
  ],
  [
    createConnectionId("piccadilly", "sudbury-hill", "south-harrow"),
    expandSchematicPath([{ x: -38, y: -44 }, { x: -38, y: -50 }]),
  ],
  [
    createConnectionId("piccadilly", "south-harrow", "rayners-lane"),
    expandSchematicPath([{ x: -38, y: -50 }, { x: -38, y: -62 }]),
  ],
  [
    createConnectionId("piccadilly", "acton-town", "south-ealing"),
    expandSchematicPath([{ x: -34, y: 14 }, { x: -46, y: 14 }, { x: -48, y: 16 }]),
  ],
  [
    createConnectionId("piccadilly", "south-ealing", "northfields"),
    expandSchematicPath([{ x: -48, y: 16 }, { x: -50, y: 18 }]),
  ],
  [
    createConnectionId("piccadilly", "northfields", "boston-manor"),
    expandSchematicPath([{ x: -50, y: 18 }, { x: -52, y: 20 }]),
  ],
  [
    createConnectionId("piccadilly", "boston-manor", "osterley"),
    expandSchematicPath([{ x: -52, y: 20 }, { x: -54, y: 22 }]),
  ],
  [
    createConnectionId("piccadilly", "osterley", "hounslow-central"),
    expandSchematicPath([{ x: -54, y: 22 }, { x: -56, y: 24 }]),
  ],
  [
    createConnectionId("piccadilly", "hounslow-central", "hounslow-east"),
    expandSchematicPath([{ x: -56, y: 24 }, { x: -58, y: 26 }]),
  ],
  [
    createConnectionId("piccadilly", "hounslow-east", "hounslow-west"),
    expandSchematicPath([{ x: -58, y: 26 }, { x: -60, y: 28 }]),
  ],
  [
    createConnectionId("piccadilly", "hounslow-west", "hatton-cross"),
    expandSchematicPath([{ x: -60, y: 28 }, { x: -62, y: 30 }]),
  ],
  [
    createConnectionId("bakerloo", "baker-street", "marylebone"),
    expandSchematicPath([{ x: 42, y: -22 }, { x: 42, y: -20 }, { x: 38, y: -24 }, { x: 32, y: -24 }]),
  ],
  [
    createConnectionId("bakerloo", "baker-street", "regent-s-park"),
    expandSchematicPath([{ x: 42, y: -22 }, { x: 42, y: -20 }, { x: 46, y: -16 }]),
  ],
  [
    createConnectionId("bakerloo", "oxford-circus", "regent-s-park"),
    expandSchematicPath([{ x: 50, y: -8 }, { x: 50, y: -12 }, { x: 46, y: -16 }]),
  ],
  [
    createConnectionId("bakerloo", "waterloo", "lambeth-north"),
    expandSchematicPath([{ x: 62, y: 21 }, { x: 62, y: 28 }, { x: 64, y: 30 }]),
  ],
  [
    createConnectionId("bakerloo", "marylebone", "edgware-road-bakerloo"),
    expandSchematicPath([{ x: 32, y: -24 }, { x: 24, y: -24 }]),
  ],
  [
    createConnectionId("bakerloo", "edgware-road-bakerloo", "paddington"),
    expandSchematicPath([{ x: 24, y: -24 }, { x: 22, y: -24 }, { x: 18, y: -20 }, { x: 16, y: -20 }, { x: 18, y: -18 }]),
  ],
  [
    createConnectionId("bakerloo", "paddington", "warwick-avenue"),
    expandSchematicPath([{ x: 18, y: -18 }, { x: 16, y: -20 }, { x: 10, y: -20 }]),
  ],
  [
    createConnectionId("bakerloo", "maida-vale", "warwick-avenue"),
    expandSchematicPath([{ x: 4, y: -22 }, { x: 6, y: -20 }, { x: 10, y: -20 }]),
  ],
  [
    createConnectionId("bakerloo", "maida-vale", "kilburn-park"),
    expandSchematicPath([{ x: 4, y: -22 }, { x: 0, y: -26 }]),
  ],
  [
    createConnectionId("bakerloo", "queen-s-park", "kilburn-park"),
    expandSchematicPath([{ x: -2, y: -30 }, { x: -2, y: -28 }, { x: 0, y: -26 }]),
  ],
  [
    createConnectionId("bakerloo", "kensal-green", "queen-s-park"),
    expandSchematicPath([{ x: -2, y: -34 }, { x: -2, y: -30 }]),
  ],
  [
    createConnectionId("bakerloo", "charing-cross", "embankment"),
    expandSchematicPath([{ x: 62, y: 8 }, { x: 62, y: 15 }]),
  ],
  [
    createConnectionId("bakerloo", "embankment", "waterloo"),
    expandSchematicPath([{ x: 62, y: 15 }, { x: 62, y: 21 }]),
  ],
  [
    createConnectionId("circle", "baker-street", "edgware-road"),
    expandSchematicPath([{ x: 42, y: -22 }, { x: 24, y: -22 }]),
  ],
  [
    createConnectionId("circle", "great-portland-street", "baker-street"),
    expandSchematicPath([{ x: 50, y: -22 }, { x: 42, y: -22 }]),
  ],
  [
    createConnectionId("hammersmith-city", "baker-street", "edgware-road"),
    expandSchematicPath([{ x: 42, y: -22 }, { x: 24, y: -22 }]),
  ],
  [
    createConnectionId("hammersmith-city", "great-portland-street", "baker-street"),
    expandSchematicPath([{ x: 50, y: -22 }, { x: 42, y: -22 }]),
  ],
  [
    createConnectionId("jubilee", "baker-street", "bond-street"),
    expandSchematicPath([{ x: 42, y: -22 }, { x: 42, y: -8 }]),
  ],
  [
    createConnectionId("central", "marble-arch", "bond-street"),
    expandSchematicPath([{ x: 34, y: -6 }, { x: 36, y: -8 }, { x: 42, y: -8 }]),
  ],
  [
    createConnectionId("central", "oxford-circus", "bond-street"),
    expandSchematicPath([{ x: 50, y: -8 }, { x: 42, y: -8 }]),
  ],
  [
    createConnectionId("jubilee", "baker-street", "st-john-s-wood"),
    expandSchematicPath([{ x: 42, y: -22 }, { x: 42, y: -26 }, { x: 39, y: -29 }]),
  ],
  [
    createConnectionId("jubilee", "st-john-s-wood", "swiss-cottage"),
    expandSchematicPath([{ x: 39, y: -29 }, { x: 37, y: -31 }]),
  ],
  [
    createConnectionId("jubilee", "finchley-road", "swiss-cottage"),
    expandSchematicPath([{ x: 32, y: -34 }, { x: 33, y: -35 }, { x: 37, y: -31 }]),
  ],
  [
    createConnectionId("jubilee", "finchley-road", "west-hampstead"),
    expandSchematicPath([{ x: 32, y: -34 }, { x: 33, y: -35 }, { x: 31, y: -37 }]),
  ],
  [
    createConnectionId("jubilee", "west-hampstead", "kilburn"),
    expandSchematicPath([{ x: 31, y: -37 }, { x: 25, y: -43 }]),
  ],
  [
    createConnectionId("jubilee", "kilburn", "willesden-green"),
    expandSchematicPath([{ x: 25, y: -43 }, { x: 21, y: -47 }]),
  ],
  [
    createConnectionId("jubilee", "willesden-green", "dollis-hill"),
    expandSchematicPath([{ x: 21, y: -47 }, { x: 19, y: -49 }]),
  ],
  [
    createConnectionId("jubilee", "dollis-hill", "neasden"),
    expandSchematicPath([{ x: 19, y: -49 }, { x: 17, y: -51 }]),
  ],
  [
    createConnectionId("jubilee", "neasden", "wembley-park"),
    expandSchematicPath([{ x: 17, y: -51 }, { x: 15, y: -53 }, { x: 14, y: -52 }]),
  ],
  [
    createConnectionId("jubilee", "wembley-park", "kingsbury"),
    expandSchematicPath([{ x: 14, y: -52 }, { x: 15, y: -53 }, { x: 12, y: -56 }, { x: 12, y: -60 }]),
  ],
  [
    createConnectionId("jubilee", "kingsbury", "queensbury"),
    expandSchematicPath([{ x: 12, y: -60 }, { x: 12, y: -64 }]),
  ],
  [
    createConnectionId("jubilee", "queensbury", "canons-park"),
    expandSchematicPath([{ x: 12, y: -64 }, { x: 12, y: -68 }]),
  ],
  [
    createConnectionId("jubilee", "canons-park", "stanmore"),
    expandSchematicPath([{ x: 12, y: -68 }, { x: 12, y: -72 }]),
  ],
  [
    createConnectionId("jubilee", "west-ham", "stratford"),
    expandSchematicPath([{ x: 154, y: -12 }, { x: 154, y: -26 }, { x: 150, y: -30 }]),
  ],
  [
    createConnectionId("central", "leytonstone", "wanstead"),
    expandSchematicPath([{ x: 156, y: -44 }, { x: 158, y: -46 }, { x: 160, y: -46 }]),
  ],
  [
    createConnectionId("central", "wanstead", "redbridge"),
    expandSchematicPath([{ x: 160, y: -46 }, { x: 165, y: -46 }]),
  ],
  [
    createConnectionId("central", "redbridge", "gants-hill"),
    expandSchematicPath([{ x: 165, y: -46 }, { x: 170, y: -46 }]),
  ],
  [
    createConnectionId("central", "gants-hill", "newbury-park"),
    expandSchematicPath([{ x: 170, y: -46 }, { x: 172, y: -46 }, { x: 172, y: -48 }]),
  ],
  [
    createConnectionId("central", "newbury-park", "barkingside"),
    expandSchematicPath([{ x: 172, y: -48 }, { x: 172, y: -52 }]),
  ],
  [
    createConnectionId("central", "barkingside", "fairlop"),
    expandSchematicPath([{ x: 172, y: -52 }, { x: 172, y: -56 }]),
  ],
  [
    createConnectionId("central", "fairlop", "hainault"),
    expandSchematicPath([{ x: 172, y: -56 }, { x: 172, y: -60 }]),
  ],
  [
    createConnectionId("central", "hainault", "grange-hill"),
    expandSchematicPath([{ x: 172, y: -60 }, { x: 172, y: -62 }, { x: 170, y: -62 }]),
  ],
  [
    createConnectionId("central", "grange-hill", "chigwell"),
    expandSchematicPath([{ x: 170, y: -62 }, { x: 165, y: -62 }]),
  ],
  [
    createConnectionId("central", "chigwell", "roding-valley"),
    expandSchematicPath([{ x: 165, y: -62 }, { x: 160, y: -62 }]),
  ],
  [
    createConnectionId("central", "roding-valley", "woodford"),
    expandSchematicPath([{ x: 160, y: -62 }, { x: 158, y: -62 }, { x: 156, y: -60 }]),
  ],
  [
    createConnectionId("metropolitan", "baker-street", "finchley-road"),
    expandSchematicPath([{ x: 42, y: -22 }, { x: 32, y: -32 }, { x: 32, y: -34 }]),
  ],
  [
    createConnectionId("metropolitan", "wembley-park", "finchley-road"),
    expandSchematicPath([{ x: 14, y: -52 }, { x: 32, y: -34 }]),
  ],
  [
    createConnectionId("metropolitan", "great-portland-street", "baker-street"),
    expandSchematicPath([{ x: 50, y: -22 }, { x: 42, y: -22 }]),
  ],
  [
    createConnectionId("metropolitan", "wembley-park", "preston-road"),
    expandSchematicPath([{ x: 14, y: -52 }, { x: 12, y: -54 }, { x: 6, y: -54 }]),
  ],
  [
    createConnectionId("jubilee", "north-greenwich", "canning-town"),
    expandSchematicPath([{ x: 146, y: 16 }, { x: 148, y: 16 }, { x: 154, y: 10 }, { x: 154, y: 4 }]),
  ],
  [
    createConnectionId("jubilee", "green-park", "westminster"),
    expandSchematicPath([{ x: 44, y: 0 }, { x: 50, y: 6 }, { x: 50, y: 9 }, { x: 56, y: 15 }]),
  ],
  [
    createConnectionId("jubilee", "green-park", "bond-street"),
    expandSchematicPath([{ x: 44, y: 0 }, { x: 42, y: -2 }, { x: 42, y: -8 }]),
  ],
  [
    createConnectionId("jubilee", "westminster", "waterloo"),
    expandSchematicPath([{ x: 56, y: 15 }, { x: 62, y: 21 }]),
  ],
  [
    createConnectionId("jubilee", "waterloo", "southwark"),
    expandSchematicPath([{ x: 62, y: 21 }, { x: 64, y: 23 }, { x: 70, y: 23 }]),
  ],
  [
    createConnectionId("jubilee", "southwark", "london-bridge"),
    expandSchematicPath([{ x: 70, y: 23 }, { x: 77, y: 23 }, { x: 90, y: 10 }]),
  ],
  [
    createConnectionId("jubilee", "london-bridge", "bermondsey"),
    expandSchematicPath([{ x: 90, y: 10 }, { x: 104, y: 10 }, { x: 107, y: 13 }]),
  ],
  [
    createConnectionId("jubilee", "bermondsey", "canada-water"),
    expandSchematicPath([{ x: 107, y: 13 }, { x: 110, y: 16 }, { x: 118, y: 16 }]),
  ],
  [
    createConnectionId("circle", "hammersmith-circle-and-hammersmith-and-city", "goldhawk-road"),
    expandSchematicPath([{ x: -2, y: 12 }, { x: -2, y: 8 }]),
  ],
  [
    createConnectionId("hammersmith-city", "goldhawk-road", "hammersmith-circle-and-hammersmith-and-city"),
    expandSchematicPath([{ x: -2, y: 8 }, { x: -2, y: 12 }]),
  ],
  [
    createConnectionId("walk", "hammersmith-circle-and-hammersmith-and-city", "hammersmith-district-and-piccadilly"),
    expandSchematicPath([{ x: -2, y: 12 }, { x: -2, y: 14 }]),
  ],
  [
    createConnectionId("circle", "tower-hill", "aldgate"),
    expandSchematicPath([{ x: 104, y: 0 }, { x: 107, y: 0 }, { x: 108, y: -1 }, { x: 108, y: -8 }]),
  ],
  [
    createConnectionId("district", "tower-hill", "aldgate-east"),
    expandSchematicPath([
      { x: 104, y: 0 },
      { x: 107, y: 0 },
      { x: 111, y: -4 },
      { x: 111, y: -7 },
      { x: 116, y: -12 },
    ]),
  ],
  [
    createConnectionId("circle", "aldgate", "liverpool-street"),
    expandSchematicPath([{ x: 108, y: -8 }, { x: 108, y: -11 }, { x: 107, y: -12 }, { x: 92, y: -12 }]),
  ],
  [
    createConnectionId("metropolitan", "aldgate", "liverpool-street"),
    expandSchematicPath([{ x: 108, y: -8 }, { x: 108, y: -11 }, { x: 107, y: -12 }, { x: 92, y: -12 }]),
  ],
  [
    createConnectionId("central", "oxford-circus", "tottenham-court-road"),
    expandSchematicPath([{ x: 50, y: -8 }, { x: 62, y: -8 }]),
  ],
  [
    createConnectionId("central", "tottenham-court-road", "holborn"),
    expandSchematicPath([{ x: 62, y: -8 }, { x: 72, y: -8 }]),
  ],
  [
    createConnectionId("central", "holborn", "chancery-lane"),
    expandSchematicPath([{ x: 72, y: -8 }, { x: 77, y: -8 }]),
  ],
  [
    createConnectionId("central", "chancery-lane", "st-paul-s"),
    expandSchematicPath([{ x: 77, y: -8 }, { x: 83, y: -8 }]),
  ],
  [
    createConnectionId("central", "st-paul-s", "bank"),
    expandSchematicPath([{ x: 88, y: -8 }, { x: 83, y: -8 }]),
  ],
  [
    createConnectionId("northern", "leicester-square", "tottenham-court-road"),
    expandSchematicPath([{ x: 62, y: 0 }, { x: 62, y: -8 }]),
  ],
  [
    createConnectionId("northern", "tottenham-court-road", "goodge-street"),
    expandSchematicPath([{ x: 62, y: -8 }, { x: 62, y: -14 }]),
  ],
  [
    createConnectionId("northern", "embankment", "charing-cross"),
    expandSchematicPath([{ x: 62, y: 15 }, { x: 62, y: 8 }]),
  ],
  [
    createConnectionId("northern", "embankment", "waterloo"),
    expandSchematicPath([{ x: 62, y: 15 }, { x: 62, y: 21 }]),
  ],
  [
    createConnectionId("northern", "waterloo", "kennington"),
    expandSchematicPath([{ x: 62, y: 21 }, { x: 60, y: 23 }, { x: 60, y: 38 }]),
  ],
  [
    createConnectionId("piccadilly", "holborn", "russell-square"),
    expandSchematicPath([{ x: 72, y: -8 }, { x: 74, y: -10 }, { x: 74, y: -18 }]),
  ],
  [
    createConnectionId("piccadilly", "covent-garden", "holborn"),
    expandSchematicPath([{ x: 66, y: -2 }, { x: 72, y: -8 }]),
  ],
  [
    createConnectionId("piccadilly", "russell-square", "king-s-cross-st-pancras"),
    expandSchematicPath([{ x: 74, y: -18 }, { x: 74, y: -22 }]),
  ],
  [
    createConnectionId("elizabeth", "farringdon", "tottenham-court-road"),
    expandSchematicPath([
      { x: 80, y: -18 },
      { x: 77, y: -18 },
      { x: 67, y: -8 },
      { x: 62, y: -8 },
    ]),
  ],
  [
    createConnectionId("elizabeth", "farringdon", "liverpool-street"),
    expandSchematicPath([
      { x: 92, y: -12 },
      { x: 92, y: -13 },
      { x: 90, y: -13 },
      { x: 85, y: -18 },
      { x: 80, y: -18 },
    ]),
  ],
  [
    createConnectionId("elizabeth", "tottenham-court-road", "bond-street"),
    expandSchematicPath([
      { x: 62, y: -8 },
      { x: 61, y: -9 },
      { x: 43, y: -9 },
      { x: 42, y: -8 },
    ]),
  ],
  [
    createConnectionId("elizabeth", "paddington", "bond-street"),
    expandSchematicPath([
      { x: 18, y: -18 },
      { x: 25, y: -18 },
      { x: 35, y: -8 },
      { x: 42, y: -8 },
    ]),
  ],
  [
    createConnectionId("northern", "euston", "camden-town"),
    expandSchematicPath([{ x: 65, y: -27 }, { x: 67, y: -29 }, { x: 67, y: -31 }, { x: 65, y: -33 }]),
  ],
  [
    createConnectionId("northern", "euston", "king-s-cross-st-pancras"),
    expandSchematicPath([{ x: 65, y: -27 }, { x: 68, y: -27 }, { x: 73, y: -22 }, { x: 74, y: -22 }]),
  ],
  [
    createConnectionId("northern", "euston", "mornington-crescent"),
    expandSchematicPath([{ x: 65, y: -27 }, { x: 63, y: -29 }, { x: 63, y: -30 }]),
  ],
  [
    createConnectionId("northern", "warren-street", "euston"),
    expandSchematicPath([{ x: 62, y: -20 }, { x: 62, y: -22 }, { x: 65, y: -25 }, { x: 65, y: -27 }]),
  ],
  [
    createConnectionId("circle", "euston-square", "great-portland-street"),
    expandSchematicPath([{ x: 60, y: -22 }, { x: 50, y: -22 }]),
  ],
  [
    createConnectionId("circle", "euston-square", "king-s-cross-st-pancras"),
    expandSchematicPath([{ x: 74, y: -22 }, { x: 60, y: -22 }]),
  ],
  [
    createConnectionId("hammersmith-city", "euston-square", "great-portland-street"),
    expandSchematicPath([{ x: 60, y: -22 }, { x: 50, y: -22 }]),
  ],
  [
    createConnectionId("hammersmith-city", "euston-square", "king-s-cross-st-pancras"),
    expandSchematicPath([{ x: 74, y: -22 }, { x: 60, y: -22 }]),
  ],
  [
    createConnectionId("metropolitan", "euston-square", "great-portland-street"),
    expandSchematicPath([{ x: 60, y: -22 }, { x: 50, y: -22 }]),
  ],
  [
    createConnectionId("metropolitan", "euston-square", "king-s-cross-st-pancras"),
    expandSchematicPath([{ x: 74, y: -22 }, { x: 60, y: -22 }]),
  ],
  [
    createConnectionId("walk", "euston", "euston-square"),
    expandSchematicPath([{ x: 65, y: -27 }, { x: 60, y: -22 }]),
  ],
  [
    createConnectionId("northern", "mornington-crescent", "camden-town"),
    expandSchematicPath([{ x: 63, y: -30 }, { x: 63, y: -31 }, { x: 65, y: -33 }]),
  ],
  [
    createConnectionId("northern", "camden-town", "chalk-farm"),
    expandSchematicPath([{ x: 65, y: -33 }, { x: 63, y: -35 }]),
  ],
  [
    createConnectionId("northern", "chalk-farm", "belsize-park"),
    expandSchematicPath([{ x: 63, y: -35 }, { x: 59, y: -39 }]),
  ],
  [
    createConnectionId("northern", "belsize-park", "hampstead"),
    expandSchematicPath([{ x: 59, y: -39 }, { x: 47, y: -51 }]),
  ],
  [
    createConnectionId("northern", "hampstead", "golders-green"),
    expandSchematicPath([{ x: 43, y: -55 }, { x: 47, y: -51 }]),
  ],
  [
    createConnectionId("northern", "golders-green", "brent-cross"),
    expandSchematicPath([{ x: 39, y: -59 }, { x: 43, y: -55 }]),
  ],
  [
    createConnectionId("northern", "brent-cross", "hendon-central"),
    expandSchematicPath([{ x: 35, y: -63 }, { x: 39, y: -59 }]),
  ],
  [
    createConnectionId("northern", "hendon-central", "colindale"),
    expandSchematicPath([{ x: 29, y: -69 }, { x: 35, y: -63 }]),
  ],
  [
    createConnectionId("northern", "colindale", "burnt-oak"),
    expandSchematicPath([{ x: 29, y: -69 }, { x: 25, y: -73 }]),
  ],
  [
    createConnectionId("northern", "burnt-oak", "edgware"),
    expandSchematicPath([{ x: 25, y: -73 }, { x: 21, y: -77 }]),
  ],
  [
    createConnectionId("northern", "camden-town", "kentish-town"),
    expandSchematicPath([{ x: 65, y: -33 }, { x: 73, y: -41 }, { x: 73, y: -45 }]),
  ],
  [
    createConnectionId("northern", "kentish-town", "tufnell-park"),
    expandSchematicPath([{ x: 73, y: -51 }, { x: 73, y: -45 }]),
  ],
  [
    createConnectionId("northern", "tufnell-park", "archway"),
    expandSchematicPath([{ x: 73, y: -51 }, { x: 73, y: -57 }]),
  ],
  [
    createConnectionId("northern", "archway", "highgate"),
    expandSchematicPath([{ x: 73, y: -57 }, { x: 73, y: -61 }]),
  ],
  [
    createConnectionId("northern", "highgate", "east-finchley"),
    expandSchematicPath([{ x: 73, y: -61 }, { x: 73, y: -65 }]),
  ],
  [
    createConnectionId("northern", "east-finchley", "finchley-central"),
    expandSchematicPath([{ x: 73, y: -65 }, { x: 73, y: -69 }]),
  ],
  [
    createConnectionId("northern", "finchley-central", "mill-hill-east"),
    expandSchematicPath([{ x: 73, y: -69 }, { x: 70, y: -72 }, { x: 70, y: -74 }]),
  ],
  [
    createConnectionId("northern", "finchley-central", "west-finchley"),
    expandSchematicPath([{ x: 73, y: -69 }, { x: 73, y: -77 }]),
  ],
  [
    createConnectionId("northern", "west-finchley", "woodside-park"),
    expandSchematicPath([{ x: 73, y: -77 }, { x: 73, y: -81 }]),
  ],
  [
    createConnectionId("northern", "woodside-park", "totteridge-and-whetstone"),
    expandSchematicPath([{ x: 73, y: -81 }, { x: 73, y: -85 }]),
  ],
  [
    createConnectionId("northern", "totteridge-and-whetstone", "high-barnet"),
    expandSchematicPath([{ x: 73, y: -85 }, { x: 73, y: -89 }]),
  ],
  [
    createConnectionId("northern", "moorgate", "old-street"),
    expandSchematicPath([{ x: 88, y: -12 }, { x: 88, y: -20 }, { x: 87, y: -21 }]),
  ],
  [
    createConnectionId("northern", "old-street", "angel"),
    expandSchematicPath([{ x: 87, y: -21 }, { x: 86, y: -22 }, { x: 82, y: -22 }]),
  ],
  [
    createConnectionId("northern", "angel", "king-s-cross-st-pancras"),
    expandSchematicPath([{ x: 82, y: -22 }, { x: 74, y: -22 }]),
  ],
  [
    createConnectionId("piccadilly", "caledonian-road", "king-s-cross-st-pancras"),
    expandSchematicPath([{ x: 76, y: -28 }, { x: 74, y: -26 }, { x: 74, y: -22 }]),
  ],
  [
    createConnectionId("piccadilly", "caledonian-road", "holloway-road"),
    expandSchematicPath([{ x: 76, y: -28 }, { x: 81, y: -33 }]),
  ],
  [
    createConnectionId("piccadilly", "holloway-road", "arsenal"),
    expandSchematicPath([{ x: 81, y: -33 }, { x: 88, y: -40 }]),
  ],
  [
    createConnectionId("piccadilly", "arsenal", "finsbury-park"),
    expandSchematicPath([{ x: 88, y: -40 }, { x: 94, y: -46 }]),
  ],
  [
    createConnectionId("piccadilly", "finsbury-park", "manor-house"),
    expandSchematicPath([{ x: 94, y: -46 }, { x: 100, y: -52 }, { x: 100, y: -56 }]),
  ],
  [
    createConnectionId("victoria", "euston", "king-s-cross-st-pancras"),
    expandSchematicPath([{ x: 65, y: -27 }, { x: 67, y: -27 }, { x: 72, y: -22 }, { x: 74, y: -22 }]),
  ],
  [
    createConnectionId("victoria", "warren-street", "euston"),
    expandSchematicPath([{ x: 62, y: -20 }, { x: 62, y: -24 }, { x: 65, y: -27 }]),
  ],
  [
    createConnectionId("victoria", "king-s-cross-st-pancras", "highbury-and-islington"),
    expandSchematicPath([{ x: 74, y: -22 }, { x: 87, y: -35 }]),
  ],
  [
    createConnectionId("victoria", "highbury-and-islington", "finsbury-park"),
    expandSchematicPath([
      { x: 87, y: -35 },
      { x: 94, y: -42 },
      { x: 94, y: -46 },
    ]),
  ],
  [
    createConnectionId("victoria", "finsbury-park", "seven-sisters"),
    expandSchematicPath([{ x: 94, y: -46 }, { x: 102, y: -54 }, { x: 120, y: -54 }]),
  ],
  [
    createConnectionId("victoria", "victoria", "green-park"),
    expandSchematicPath([{ x: 44, y: 15 }, { x: 44, y: 0 }]),
  ],
  [
    createConnectionId("victoria", "victoria", "pimlico"),
    expandSchematicPath([{ x: 44, y: 15 }, { x: 44, y: 30 }]),
  ],
  [
    createConnectionId("waterloo-city", "bank", "waterloo"),
    expandSchematicPath([{ x: 88, y: -8 }, { x: 88, y: 9 }, { x: 76, y: 21 }, { x: 62, y: 21 }]),
  ],
  [
    createConnectionId("walk", "euston", "euston-square"),
    expandSchematicPath([{ x: 65, y: -27 }, { x: 60, y: -22 }]),
  ],
  [
    createConnectionId("district", "gunnersbury", "turnham-green"),
    expandSchematicPath([{ x: -25, y: 20 }, { x: -20, y: 15 }, { x: -20, y: 14 }]),
  ],
  [
    createConnectionId("district", "gunnersbury", "kew-gardens"),
    expandSchematicPath([{ x: -25, y: 20 }, { x: -31, y: 26 }]),
  ],
  [
    createConnectionId("district", "richmond", "kew-gardens"),
    expandSchematicPath([{ x: -37, y: 32 }, { x: -31, y: 26 }]),
  ],
  [
    createConnectionId("elizabeth", "liverpool-street", "whitechapel"),
    expandSchematicPath([
      { x: 119, y: -12 },
      { x: 118, y: -13 },
      { x: 93, y: -13 },
      { x: 92, y: -12 },
    ]),
  ],
  [
    createConnectionId("elizabeth", "acton-main-line", "paddington"),
    expandSchematicPath([{ x: -20, y: -14 }, { x: -16, y: -18 }, { x: 18, y: -18 }]),
  ],
  [
    createConnectionId("elizabeth", "acton-main-line", "ealing-broadway"),
    expandSchematicPath([{ x: -20, y: -14 }, { x: -33, y: -1 }, { x: -42, y: -1 }, { x: -42, y: 0 }]),
  ],
  [
    createConnectionId("elizabeth", "ealing-broadway", "west-ealing"),
    expandSchematicPath([{ x: -42, y: 0 }, { x: -42, y: -1 }, { x: -46, y: -1 }]),
  ],
  [
    createConnectionId("elizabeth", "west-ealing", "hanwell"),
    expandSchematicPath([{ x: -46, y: -1 }, { x: -50, y: -1 }]),
  ],
  [
    createConnectionId("elizabeth", "hanwell", "southall"),
    expandSchematicPath([{ x: -50, y: -1 }, { x: -54, y: -1 }]),
  ],
  [
    createConnectionId("elizabeth", "southall", "hayes-and-harlington"),
    expandSchematicPath([{ x: -54, y: -1 }, { x: -58, y: -1 }]),
  ],
  [
    createConnectionId("elizabeth", "hayes-and-harlington", "heathrow-terminal-2-and-3"),
    expandSchematicPath([{ x: -58, y: -1 }, { x: -66, y: 7 }, { x: -66, y: 34 }]),
  ],
  [
    createConnectionId("elizabeth", "heathrow-terminal-4", "heathrow-terminal-2-and-3"),
    expandSchematicPath([{ x: -66, y: 44 }, { x: -66, y: 34 }]),
  ],
  [
    createConnectionId("elizabeth", "heathrow-terminal-2-and-3", "heathrow-terminal-5"),
    expandSchematicPath([{ x: -66, y: 34 }, { x: -74, y: 42 }, { x: -74, y: 44 }]),
  ],
  [
    createConnectionId("elizabeth", "hayes-and-harlington", "west-drayton"),
    expandSchematicPath([{ x: -58, y: -1 }, { x: -62, y: -1 }]),
  ],
  [
    createConnectionId("elizabeth", "west-drayton", "iver"),
    expandSchematicPath([{ x: -62, y: -1 }, { x: -66, y: -1 }]),
  ],
  [
    createConnectionId("elizabeth", "iver", "langley"),
    expandSchematicPath([{ x: -66, y: -1 }, { x: -70, y: -1 }]),
  ],
  [
    createConnectionId("elizabeth", "langley", "slough"),
    expandSchematicPath([{ x: -70, y: -1 }, { x: -74, y: -1 }]),
  ],
  [
    createConnectionId("elizabeth", "slough", "burnham"),
    expandSchematicPath([{ x: -74, y: -1 }, { x: -78, y: -1 }]),
  ],
  [
    createConnectionId("elizabeth", "burnham", "taplow"),
    expandSchematicPath([{ x: -78, y: -1 }, { x: -82, y: -1 }]),
  ],
  [
    createConnectionId("elizabeth", "taplow", "maidenhead"),
    expandSchematicPath([{ x: -82, y: -1 }, { x: -86, y: -1 }]),
  ],
  [
    createConnectionId("elizabeth", "maidenhead", "twyford"),
    expandSchematicPath([{ x: -86, y: -1 }, { x: -90, y: -1 }]),
  ],
  [
    createConnectionId("elizabeth", "twyford", "reading"),
    expandSchematicPath([{ x: -90, y: -1 }, { x: -94, y: -1 }]),
  ],
  [
    createConnectionId("piccadilly", "hatton-cross", "heathrow-terminal-4"),
    expandSchematicPath([{ x: -62, y: 30 }, { x: -62, y: 44 }, { x: -66, y: 44 }]),
  ],
  [
    createConnectionId("piccadilly", "heathrow-terminal-4", "heathrow-terminal-2-and-3"),
    expandSchematicPath([{ x: -66, y: 44 }, { x: -70, y: 44 }, { x: -70, y: 38 }, { x: -66, y: 34 }]),
  ],
  [
    createConnectionId("piccadilly", "heathrow-terminal-2-and-3", "heathrow-terminal-5"),
    expandSchematicPath([{ x: -66, y: 34 }, { x: -74, y: 42 }, { x: -74, y: 44 }]),
  ],
  [
    createConnectionId("elizabeth", "whitechapel", "canary-wharf-elizabeth-line"),
    expandSchematicPath([{ x: 119, y: -12 }, { x: 141, y: 10 }, { x: 142, y: 10 }]),
  ],
  [
    createConnectionId("elizabeth", "canary-wharf-elizabeth-line", "custom-house"),
    expandSchematicPath([
      { x: 142, y: 10 },
      { x: 170, y: 10 },
      { x: 172, y: 12 },
    ]),
  ],
  [
    createConnectionId("walk", "canary-wharf-jubilee", "canary-wharf-elizabeth-line"),
    expandSchematicPath([{ x: 136, y: 16 }, { x: 142, y: 10 }]),
  ],
  [
    createConnectionId("central", "liverpool-street", "bethnal-green"),
    expandSchematicPath([{ x: 92, y: -12 }, { x: 94, y: -14 }, { x: 122, y: -14 }]),
  ],
  [
    createConnectionId("central", "bethnal-green", "mile-end"),
    expandSchematicPath([{ x: 122, y: -14 }, { x: 130, y: -14 }]),
  ],
  [
    createConnectionId("elizabeth", "whitechapel", "stratford"),
    expandSchematicPath([
      { x: 150, y: -30 },
      { x: 138, y: -18 },
      { x: 124, y: -18 },
      { x: 119, y: -13 },
      { x: 119, y: -12 },
    ]),
  ],
]);

for (const line of ["district", "hammersmith-city"] as const) {
  schematicPathOverrides.set(
    createConnectionId(line, "aldgate-east", "whitechapel"),
    expandSchematicPath([{ x: 116, y: -12 }, { x: 119, y: -12 }]),
  );
  schematicPathOverrides.set(
    createConnectionId(line, "whitechapel", "stepney-green"),
    expandSchematicPath([{ x: 119, y: -12 }, { x: 128, y: -12 }]),
  );
}

for (const line of ["circle", "district"] as const) {
  schematicPathOverrides.set(
    createConnectionId(line, "south-kensington", "sloane-square"),
    expandSchematicPath([{ x: 28, y: 14 }, { x: 37, y: 14 }, { x: 38, y: 15 }]),
  );
  schematicPathOverrides.set(
    createConnectionId(line, "sloane-square", "victoria"),
    expandSchematicPath([{ x: 38, y: 15 }, { x: 44, y: 15 }]),
  );
  schematicPathOverrides.set(
    createConnectionId(line, "victoria", "st-james-s-park"),
    expandSchematicPath([{ x: 44, y: 15 }, { x: 50, y: 15 }]),
  );
  schematicPathOverrides.set(
    createConnectionId(line, "st-james-s-park", "westminster"),
    expandSchematicPath([{ x: 50, y: 15 }, { x: 56, y: 15 }]),
  );
  schematicPathOverrides.set(
    createConnectionId(line, "westminster", "embankment"),
    expandSchematicPath([{ x: 56, y: 15 }, { x: 62, y: 15 }]),
  );
  schematicPathOverrides.set(
    createConnectionId(line, "embankment", "temple"),
    expandSchematicPath([{ x: 62, y: 15 }, { x: 72, y: 15 }]),
  );
  schematicPathOverrides.set(
    createConnectionId(line, "temple", "blackfriars"),
    expandSchematicPath([{ x: 72, y: 15 }, { x: 73, y: 15 }, { x: 78, y: 10 }]),
  );
}

const connectionDirectionOverrides = new Map<string, NonNullable<Connection["directionOverrides"]>>([
  [
    createConnectionId("bakerloo", "baker-street", "marylebone"),
    { from: { x: -1, y: -1 } },
  ],
  [
    createConnectionId("bakerloo", "baker-street", "regent-s-park"),
    { from: { x: 1, y: 1 }, to: { x: -1, y: -1 } },
  ],
  [
    createConnectionId("metropolitan", "baker-street", "finchley-road"),
    { from: { x: -1, y: -1 }, to: { x: 1, y: 1 } },
  ],
  [
    createConnectionId("elizabeth", "liverpool-street", "whitechapel"),
    { from: { x: -1, y: 0 }, to: { x: 1, y: 0 } },
  ],
  [
    createConnectionId("elizabeth", "farringdon", "liverpool-street"),
    { from: { x: -1, y: 0 }, to: { x: 1, y: 0 } },
  ],
  [
    createConnectionId("elizabeth", "whitechapel", "canary-wharf-elizabeth-line"),
    { from: { x: 1, y: 1 }, to: { x: -1, y: -1 } },
  ],
  [
    createConnectionId("elizabeth", "whitechapel", "stratford"),
    { to: { x: 1, y: -1 } },
  ],
  [
    createConnectionId("central", "leyton", "stratford"),
    { from: { x: 1, y: -1 }, to: { x: -1, y: 1 } },
  ],
  [
    createConnectionId("district", "stepney-green", "mile-end"),
    { from: { x: 1, y: 0 }, to: { x: -1, y: 0 } },
  ],
  [
    createConnectionId("hammersmith-city", "stepney-green", "mile-end"),
    { from: { x: 1, y: 0 }, to: { x: -1, y: 0 } },
  ],
  [
    createConnectionId("district", "mile-end", "bow-road"),
    { from: { x: 1, y: 0 }, to: { x: -1, y: 0 } },
  ],
  [
    createConnectionId("hammersmith-city", "mile-end", "bow-road"),
    { from: { x: 1, y: 0 }, to: { x: -1, y: 0 } },
  ],
  [
    createConnectionId("elizabeth", "farringdon", "tottenham-court-road"),
    { to: { x: 1, y: 0 } },
  ],
  [
    createConnectionId("elizabeth", "tottenham-court-road", "bond-street"),
    { from: { x: -1, y: 0 }, to: { x: 1, y: 0 } },
  ],
  [
    createConnectionId("elizabeth", "acton-main-line", "ealing-broadway"),
    { to: { x: 1, y: 0 } },
  ],
  [
    createConnectionId("elizabeth", "ealing-broadway", "west-ealing"),
    { from: { x: -1, y: 0 } },
  ],
  [
    createConnectionId("jubilee", "finchley-road", "swiss-cottage"),
    { from: { x: 1, y: 1 }, to: { x: -1, y: -1 } },
  ],
  [
    createConnectionId("jubilee", "finchley-road", "west-hampstead"),
    { from: { x: -1, y: -1 }, to: { x: 1, y: 1 } },
  ],
  [
    createConnectionId("jubilee", "neasden", "wembley-park"),
    { to: { x: 1, y: 1 } },
  ],
  [
    createConnectionId("jubilee", "wembley-park", "kingsbury"),
    { from: { x: -1, y: -1 }, to: { x: 0, y: 1 } },
  ],
  [
    createConnectionId("jubilee", "westminster", "waterloo"),
    { to: { x: -1, y: -1 } },
  ],
  [
    createConnectionId("circle", "south-kensington", "sloane-square"),
    { to: { x: -1, y: 0 } },
  ],
  [
    createConnectionId("district", "south-kensington", "sloane-square"),
    { to: { x: -1, y: 0 } },
  ],
  [
    createConnectionId("district", "gunnersbury", "turnham-green"),
    { to: { x: -1, y: 1 } },
  ],
  [
    createConnectionId("victoria", "warren-street", "euston"),
    { from: { x: 1, y: -1 }, to: { x: -1, y: 1 } },
  ],
  [
    createConnectionId("victoria", "euston", "king-s-cross-st-pancras"),
    { from: { x: 1, y: 0 }, to: { x: -1, y: 0 } },
  ],
  [
    createConnectionId("northern", "angel", "king-s-cross-st-pancras"),
    { from: { x: -1, y: 0 }, to: { x: 1, y: 1 } },
  ],
  [
    createConnectionId("northern", "euston", "king-s-cross-st-pancras"),
    { from: { x: 1, y: 0 }, to: { x: -1, y: -1 } },
  ],
  [
    createConnectionId("bakerloo", "edgware-road-bakerloo", "paddington"),
    { from: { x: -1, y: 0 }, to: { x: 1, y: 0 } },
  ],
  [
    createConnectionId("bakerloo", "paddington", "warwick-avenue"),
    { from: { x: -1, y: 0 }, to: { x: 1, y: 0 } },
  ],
  [
    createConnectionId("victoria", "highbury-and-islington", "finsbury-park"),
    { from: { x: 1, y: -1 }, to: { x: -1, y: 1 } },
  ],
]);

const oneWayConnectionIds = new Set<string>([
  createConnectionId("piccadilly", "hatton-cross", "heathrow-terminal-4"),
  createConnectionId("piccadilly", "heathrow-terminal-4", "heathrow-terminal-2-and-3"),
]);

const connections: Connection[] = allConnectionSeeds.map((connection) => {
  const id = createConnectionId(connection.line, connection.from, connection.to);
  return {
    ...connection,
    id,
    oneWay: oneWayConnectionIds.has(id) ? true : connection.oneWay,
    directionOverrides: connectionDirectionOverrides.get(id),
    path:
      schematicPathOverrides.get(id) ??
      connection.path ??
      missingConnectionPath(connection.line, connection.from, connection.to),
  };
});

export const networkData: NetworkData = {
  stations,
  connections,
  temporary: false,
  notes: [
    "Station positions and route geometry are generated from the bundled TfL network SVG.",
    "London Underground and Elizabeth line services are included.",
    "Out-of-station interchanges are represented as playable Walk connections.",
    "DLR, London Overground, London Trams, and Thameslink are excluded.",
  ],
};

function missingConnectionPath(line: LineId, from: string, to: string): never {
  throw new Error(`Generated connection is missing a path: ${line} ${from} -> ${to}`);
}

function remapConnectionSeeds(seeds: ConnectionSeed[]): ConnectionSeed[] {
  return seeds
    .map((connection) => ({
      ...connection,
      from: stationIdRemaps.get(connection.from) ?? connection.from,
      to: stationIdRemaps.get(connection.to) ?? connection.to,
    }))
    .filter((connection) => connection.from !== connection.to);
}

function expandSchematicPath(waypoints: Connection["path"]): Connection["path"] {
  const path = [waypoints[0]];
  for (let index = 1; index < waypoints.length; index += 1) {
    const target = waypoints[index];
    let current = path.at(-1)!;
    const dx = target.x - current.x;
    const dy = target.y - current.y;
    if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) {
      throw new Error(`Schematic segment is not cardinal or diagonal: ${JSON.stringify([current, target])}`);
    }
    while (current.x !== target.x || current.y !== target.y) {
      current = {
        x: current.x + Math.sign(target.x - current.x),
        y: current.y + Math.sign(target.y - current.y),
      };
      path.push(current);
    }
  }
  return path;
}
