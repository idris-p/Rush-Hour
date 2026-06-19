import { describe, expect, it } from "vitest";
import type { GridPoint, LineId, NetworkData } from "./types";
import { networkData } from "./network";
import { validateNetworkData } from "./validation";

describe("network data validation", () => {
  it("has internally consistent generated network data", () => {
    expect(validateNetworkData(networkData)).toEqual([]);
    expect(networkData.temporary).toBe(false);
    expect(networkData.stations).toHaveLength(302);
    expect(networkData.connections).toHaveLength(424);
  });

  it("excludes London Trams", () => {
    expect(networkData.connections.some((connection) => connection.line.includes("tram"))).toBe(false);
    expect(networkData.stations.some((station) => station.name.toLowerCase().includes("tram"))).toBe(false);
  });

  it("only includes London Underground, Elizabeth line, and walk connections", () => {
    const allowedLines = new Set([
      "bakerloo",
      "central",
      "circle",
      "district",
      "hammersmith-city",
      "jubilee",
      "metropolitan",
      "northern",
      "piccadilly",
      "victoria",
      "waterloo-city",
      "elizabeth",
      "walk",
    ]);

    expect(networkData.connections.every((connection) => allowedLines.has(connection.line))).toBe(true);
    expect(networkData.stations.every((station) => station.lines.every((line) => allowedLines.has(line)))).toBe(true);
  });

  it("contains full line-scale coverage and major branch termini", () => {
    const connectionCounts = new Map<string, number>();
    for (const connection of networkData.connections) {
      connectionCounts.set(connection.line, (connectionCounts.get(connection.line) ?? 0) + 1);
    }

    expect(Object.fromEntries(connectionCounts)).toEqual({
      bakerloo: 24,
      central: 49,
      circle: 35,
      district: 59,
      elizabeth: 40,
      "hammersmith-city": 28,
      jubilee: 26,
      metropolitan: 33,
      northern: 53,
      piccadilly: 53,
      victoria: 15,
      walk: 8,
      "waterloo-city": 1,
    });

    const stationNames = new Set(networkData.stations.map((station) => station.name));
    for (const terminus of [
      "Abbey Wood",
      "Amersham",
      "Cockfosters",
      "Epping",
      "Heathrow Terminal 5",
      "High Barnet",
      "Reading",
      "Richmond",
      "Shenfield",
      "Stanmore",
      "Uxbridge",
      "Watford",
      "West Ruislip",
    ]) {
      expect(stationNames.has(terminus), `Missing terminus ${terminus}`).toBe(true);
    }
  });

  it("excludes stations that are only on unsupported modes", () => {
    const stationNames = new Set(networkData.stations.map((station) => station.name));
    for (const excluded of [
      "Bow Church",
      "City Thameslink",
      "Clapham High Street",
      "Hackney Central",
      "Heron Quays",
      "Star Lane",
      "Tower Gateway",
      "West Croydon",
      "West India Quay",
      "Woolwich Arsenal",
    ]) {
      expect(stationNames.has(excluded), `Unexpected unsupported station ${excluded}`).toBe(false);
    }
  });

  it("includes the requested out-of-station walk interchanges", () => {
    const walkPairs = new Set(
      networkData.connections
        .filter((connection) => connection.line === "walk")
        .map((connection) => [connection.from, connection.to].sort().join(":")),
    );

    expect(walkPairs).toContain("euston:euston-square");
    expect(walkPairs).toContain("hanger-lane:park-royal");
    expect(walkPairs).toContain("kenton:northwick-park");
    expect(walkPairs).toContain("white-city:wood-lane");
  });

  it("labels the separate Bakerloo-side Paddington station correctly", () => {
    expect(networkData.stations.find((station) => station.id === "paddington-bakerloo")?.name)
      .toBe("Paddington (Bakerloo)");
  });

  it("keeps the north-west Metropolitan trunk straight from Harrow-on-the-Hill", () => {
    const trunkIds = [
      "harrow-on-the-hill",
      "north-harrow",
      "pinner",
      "northwood-hills",
      "northwood",
      "moor-park",
      "rickmansworth",
      "chorleywood",
      "chalfont-and-latimer",
    ];
    const trunk = trunkIds.map((id) => networkData.stations.find((station) => station.id === id));

    expect(trunk.every((station) => station && station.x - station.y === 38)).toBe(true);
    expect(networkData.stations.find((station) => station.id === "croxley")?.x).toBe(-36);
    expect(networkData.stations.find((station) => station.id === "watford")?.x).toBe(-36);
  });

  it("aligns the requested Jubilee stations", () => {
    const station = (id: string) => networkData.stations.find((candidate) => candidate.id === id);

    expect(station("canning-town")?.x).toBe(station("west-ham")?.x);
    expect(station("canada-water")?.y).toBe(station("canary-wharf-jubilee")?.y);
    expect(station("canada-water")?.y).toBe(station("north-greenwich")?.y);
  });

  it("aligns the North Ealing to South Harrow Piccadilly stations with Rayners Lane", () => {
    const ids = [
      "north-ealing",
      "park-royal",
      "alperton",
      "sudbury-town",
      "sudbury-hill",
      "south-harrow",
      "rayners-lane",
    ];
    const stations = ids.map((id) => networkData.stations.find((station) => station.id === id));

    expect(stations.every((station) => station?.x === -38)).toBe(true);
  });

  it("uses the cleaned Baker Street geometry", () => {
    expect(stationByName("Baker Street")).toMatchObject({ x: 42, y: -22 });
    expect(stationByName("Regent's Park")).toMatchObject({ x: 47, y: -17 });
    expect(directionRuns(findConnectionPath("circle", "baker-street", "great-portland-street")))
      .toEqual(["1,0"]);
    expect(directionRuns(findConnectionPath("hammersmith-city", "baker-street", "edgware-road")))
      .toEqual(["-1,0"]);
    expect(directionRuns(findConnectionPath("metropolitan", "baker-street", "finchley-road"))[0])
      .toBe("-1,-1");
    const intoBakerStreet = directionRuns(findConnectionPath("bakerloo", "marylebone", "baker-street"));
    const outOfBakerStreet = directionRuns(findConnectionPath("bakerloo", "baker-street", "regent-s-park"));
    expect(intoBakerStreet).toEqual(["1,0", "1,1"]);
    expect(outOfBakerStreet).toEqual(["1,1"]);
    expect(intoBakerStreet.at(-1)).toBe(outOfBakerStreet[0]);
  });

  it("routes Bakerloo cleanly through the moved Regent's Park", () => {
    expect(directionRuns(findConnectionPath("bakerloo", "baker-street", "regent-s-park")))
      .toEqual(["1,1"]);
    expect(directionRuns(findConnectionPath("bakerloo", "regent-s-park", "oxford-circus")))
      .toEqual(["1,1", "0,1"]);
  });

  it("moves Russell Square west and straightens Piccadilly through it", () => {
    expect(networkData.stations.find((station) => station.id === "russell-square"))
      .toMatchObject({ x: 74, y: -18 });
    expect(directionRuns(findConnectionPath("piccadilly", "holborn", "russell-square")))
      .toEqual(["1,-1", "0,-1"]);
    expect(directionRuns(findConnectionPath(
      "piccadilly",
      "russell-square",
      "king-s-cross-st-pancras",
    ))).toEqual(["0,-1"]);
  });

  it("routes Jubilee straight north-west from Baker Street to St John's Wood", () => {
    expect(stationByName("St John's Wood")).toMatchObject({ x: 38, y: -26 });
    const connection = networkData.connections.find(
      (candidate) =>
        candidate.line === "jubilee" &&
        candidate.from === "baker-street" &&
        candidate.to === "st-john-s-wood",
    );
    expect(directionRuns(connection?.path ?? []))
      .toEqual(["-1,-1"]);
    expect(connection?.directionOverrides?.from).toEqual({ x: -1, y: 0 });
  });

  it("routes Jubilee north from Bond Street then north-west along Bakerloo to Baker Street", () => {
    expect(directionRuns(findConnectionPath("jubilee", "bond-street", "baker-street")))
      .toEqual(["0,-1", "-1,-1"]);
    expect(findConnectionPath("jubilee", "bond-street", "baker-street"))
      .toContainEqual({ x: 44, y: -20 });
  });

  it("routes District and Piccadilly identically from Acton Town to Ealing Common", () => {
    const connections = networkData.connections.filter(
      (candidate) =>
        ["district", "piccadilly"].includes(candidate.line) &&
        candidate.from === "acton-town" &&
        candidate.to === "ealing-common",
    );

    expect(connections).toHaveLength(2);
    expect(connections[0].path).toEqual(connections[1].path);
    expect(connections[0].path.slice(0, 5)).toEqual([
      { x: -34, y: 14 },
      { x: -35, y: 13 },
      { x: -36, y: 12 },
      { x: -37, y: 11 },
      { x: -38, y: 10 },
    ]);
    expect(connections[0].path.slice(-2)).toEqual([{ x: -38, y: 9 }, { x: -38, y: 8 }]);
  });

  it("keeps the requested west and branch direction sequences around Acton and Earl's Court", () => {
    expect(directionRuns(findConnectionPath("piccadilly", "acton-town", "south-ealing")))
      .toEqual(["-1,0", "-1,1"]);
    expect(findConnectionPath("piccadilly", "acton-town", "south-ealing"))
      .toEqual(expect.arrayContaining([{ x: -46, y: 14 }]));
    expect(directionRuns(findConnectionPath("district", "ealing-common", "ealing-broadway")))
      .toEqual(["0,-1", "-1,-1"]);
    expect(directionRuns(findConnectionPath("district", "earl-s-court", "west-brompton")))
      .toEqual(["-1,1", "0,1"]);
    expect(directionRuns(findConnectionPath("district", "earl-s-court", "kensington-olympia")))
      .toEqual(["-1,-1", "0,-1"]);
    expect(directionRuns(findConnectionPath("district", "earl-s-court", "high-street-kensington")))
      .toEqual(["1,-1", "0,-1"]);
    expect(directionRuns(findConnectionPath("jubilee", "wembley-park", "kingsbury")))
      .toEqual(["-1,-1", "0,-1"]);
  });

  it("moves Piccadilly stations from South Ealing to Hounslow West southwest two cells", () => {
    for (const [name, x, y] of [
      ["South Ealing", -48, 16],
      ["Northfields", -50, 18],
      ["Boston Manor", -52, 20],
      ["Osterley", -54, 22],
      ["Hounslow Central", -56, 24],
      ["Hounslow East", -58, 26],
      ["Hounslow West", -60, 28],
    ] as const) {
      expect(stationByName(name)).toMatchObject({ x, y });
    }

    for (const pair of [
      ["south-ealing", "northfields"],
      ["northfields", "boston-manor"],
      ["boston-manor", "osterley"],
      ["osterley", "hounslow-central"],
      ["hounslow-central", "hounslow-east"],
      ["hounslow-east", "hounslow-west"],
      ["hounslow-west", "hatton-cross"],
    ] as const) {
      expect(directionRuns(findConnectionPath("piccadilly", pair[0], pair[1]))).toEqual(["-1,1"]);
    }
  });

  it("routes Metropolitan exactly along the Jubilee corridor from Baker Street to Finchley Road", () => {
    const metropolitan = findConnectionPath("metropolitan", "baker-street", "finchley-road");
    const jubileeEdges = new Set([
      findConnectionPath("jubilee", "baker-street", "st-john-s-wood"),
      findConnectionPath("jubilee", "st-john-s-wood", "swiss-cottage"),
      findConnectionPath("jubilee", "swiss-cottage", "finchley-road"),
    ].flatMap(pathEdges));

    expect(metropolitan.slice(0, 3)).toEqual([
      { x: 42, y: -22 },
      { x: 41, y: -23 },
      { x: 40, y: -24 },
    ]);
    expect(pathEdges(metropolitan).every((edge) => jubileeEdges.has(edge))).toBe(true);
  });

  it("aligns the Jubilee corridor from St John's Wood through Wembley Park", () => {
    const stations = [
      ["st-john-s-wood", 38, -26],
      ["swiss-cottage", 36, -28],
      ["finchley-road", 32, -32],
      ["west-hampstead", 30, -34],
      ["kilburn", 24, -40],
      ["willesden-green", 20, -44],
      ["dollis-hill", 18, -46],
      ["neasden", 16, -48],
      ["wembley-park", 14, -50],
    ] as const;

    for (const [stationId, x, y] of stations) {
      expect(networkData.stations.find((station) => station.id === stationId))
        .toMatchObject({ x, y });
      expect(y - x).toBe(-64);
    }

    for (let index = 0; index < stations.length - 1; index += 1) {
      expect(directionRuns(findConnectionPath(
        "jubilee",
        stations[index][0],
        stations[index + 1][0],
      ))).toEqual(["-1,-1"]);
    }
  });

  it("keeps the Preston Road link northwest then west from the moved Wembley Park", () => {
    const path = findConnectionPath("metropolitan", "wembley-park", "preston-road");

    expect(networkData.stations.find((station) => station.id === "preston-road"))
      .toMatchObject({ x: 6, y: -54 });
    expect(path.slice(0, 3)).toEqual([
      { x: 14, y: -50 },
      { x: 13, y: -51 },
      { x: 12, y: -52 },
    ]);
    expect(directionRuns(path)).toEqual(["-1,-1", "-1,0"]);
    expect(path.slice(4).every((point) => point.y === -54)).toBe(true);
  });

  it("keeps the Kingsbury link northwest then north from the moved Wembley Park", () => {
    expect(networkData.stations.find((station) => station.id === "kingsbury"))
      .toMatchObject({ x: 12, y: -58 });
    expect(directionRuns(findConnectionPath("jubilee", "wembley-park", "kingsbury")))
      .toEqual(["-1,-1", "0,-1"]);
  });

  it("uses the requested east, north-east, and north routes in east London", () => {
    expect(directionRuns(findConnectionPath("jubilee", "north-greenwich", "canning-town")))
      .toEqual(["1,0", "1,-1", "0,-1"]);
    expect(directionRuns(findConnectionPath("jubilee", "west-ham", "stratford")))
      .toEqual(["0,-1", "-1,-1"]);
    expect(directionRuns(findConnectionPath("circle", "tower-hill", "aldgate")))
      .toEqual(["1,0", "1,-1", "0,-1"]);
    expect(directionRuns(findConnectionPath("district", "tower-hill", "aldgate-east")))
      .toEqual(["1,0", "1,-1", "0,-1", "1,-1"]);

    const towerHillToAldgate = findConnectionPath("circle", "tower-hill", "aldgate");
    expect(towerHillToAldgate.slice(0, 5)).toEqual([
      { x: 104, y: 0 },
      { x: 105, y: 0 },
      { x: 106, y: 0 },
      { x: 107, y: 0 },
      { x: 108, y: -1 },
    ]);
  });

  it("routes Circle and Metropolitan north, north-west, then west from Aldgate", () => {
    for (const line of ["circle", "metropolitan"] as const) {
      const path = findConnectionPath(line, "aldgate", "liverpool-street");
      expect(directionRuns(path)).toEqual(["0,-1", "-1,-1", "-1,0"]);
      expect(path.slice(0, 5)).toEqual([
        { x: 108, y: -8 },
        { x: 108, y: -9 },
        { x: 108, y: -10 },
        { x: 108, y: -11 },
        { x: 107, y: -12 },
      ]);
    }
  });

  it("moves Euston, Mornington Crescent and Old Street while preserving schematic Northern paths", () => {
    expect(networkData.stations.find((station) => station.id === "euston"))
      .toMatchObject({ x: 64, y: -28 });
    expect(networkData.stations.find((station) => station.id === "mornington-crescent"))
      .toMatchObject({ x: 62, y: -31 });
    expect(networkData.stations.find((station) => station.id === "old-street"))
      .toMatchObject({ x: 87, y: -21 });

    expect([
      ...findConnectionPath("northern", "euston", "mornington-crescent"),
      ...findConnectionPath("northern", "mornington-crescent", "camden-town").slice(1),
    ]).toEqual([
      { x: 64, y: -28 }, { x: 63, y: -29 }, { x: 62, y: -30 }, { x: 62, y: -31 },
      { x: 62, y: -32 }, { x: 63, y: -33 }, { x: 64, y: -34 },
    ]);
    expect(findConnectionPath("walk", "euston", "euston-square")).toEqual([
      { x: 64, y: -28 }, { x: 63, y: -27 }, { x: 62, y: -26 },
      { x: 61, y: -25 }, { x: 60, y: -24 }, { x: 59, y: -23 },
      { x: 58, y: -22 },
    ]);
    expect(findConnectionPath("northern", "euston", "camden-town")).toEqual([
      { x: 64, y: -28 }, { x: 65, y: -29 }, { x: 66, y: -30 },
      { x: 66, y: -31 }, { x: 66, y: -32 }, { x: 65, y: -33 },
      { x: 64, y: -34 },
    ]);
    expect([
      ...findConnectionPath("northern", "moorgate", "old-street"),
      ...findConnectionPath("northern", "old-street", "angel").slice(1),
    ]).toEqual([
      { x: 88, y: -12 }, { x: 88, y: -13 }, { x: 88, y: -14 },
      { x: 88, y: -15 }, { x: 88, y: -16 }, { x: 88, y: -17 },
      { x: 88, y: -18 }, { x: 88, y: -19 }, { x: 88, y: -20 },
      { x: 87, y: -21 }, { x: 86, y: -22 }, { x: 85, y: -22 },
      { x: 84, y: -22 }, { x: 83, y: -22 }, { x: 82, y: -22 },
      { x: 81, y: -22 },
    ]);
  });

  it("routes the Northern Edgware branch straight northwest from Camden Town", () => {
    const branchStations = [
      ["camden-town", 64, -34],
      ["chalk-farm", 62, -36],
      ["belsize-park", 58, -40],
      ["hampstead", 46, -52],
      ["golders-green", 42, -56],
      ["brent-cross", 38, -60],
      ["hendon-central", 34, -64],
      ["colindale", 28, -70],
      ["burnt-oak", 24, -74],
      ["edgware", 20, -78],
    ] as const;

    for (const [stationId, x, y] of branchStations) {
      expect(networkData.stations.find((station) => station.id === stationId))
        .toMatchObject({ x, y });
    }

    for (let index = 0; index < branchStations.length - 1; index += 1) {
      expect(directionRuns(findConnectionPath(
        "northern",
        branchStations[index][0],
        branchStations[index + 1][0],
      ))).toEqual(["-1,-1"]);
    }
  });

  it("moves Angel west three cells without changing the Northern path through it", () => {
    expect(networkData.stations.find((station) => station.id === "angel"))
      .toMatchObject({ x: 81, y: -22 });
    expect([
      ...findConnectionPath("northern", "old-street", "angel"),
      ...findConnectionPath("northern", "angel", "king-s-cross-st-pancras").slice(1),
    ]).toEqual([
      { x: 87, y: -21 }, { x: 86, y: -22 }, { x: 85, y: -22 },
      { x: 84, y: -22 }, { x: 83, y: -22 }, { x: 82, y: -22 },
      { x: 81, y: -22 }, { x: 80, y: -22 }, { x: 79, y: -22 },
      { x: 78, y: -22 }, { x: 77, y: -22 }, { x: 76, y: -22 },
      { x: 75, y: -22 }, { x: 74, y: -22 },
    ]);
  });

  it("evenly redistributes Piccadilly stations without changing the King's Cross to Finsbury Park path", () => {
    expect(networkData.stations.find((station) => station.id === "caledonian-road"))
      .toMatchObject({ x: 75, y: -29 });
    expect(networkData.stations.find((station) => station.id === "holloway-road"))
      .toMatchObject({ x: 81, y: -35 });
    expect(networkData.stations.find((station) => station.id === "arsenal"))
      .toMatchObject({ x: 88, y: -42 });

    const sections = [
      findConnectionPath("piccadilly", "king-s-cross-st-pancras", "caledonian-road"),
      findConnectionPath("piccadilly", "caledonian-road", "holloway-road"),
      findConnectionPath("piccadilly", "holloway-road", "arsenal"),
      findConnectionPath("piccadilly", "arsenal", "finsbury-park"),
    ];
    expect(sections.map((path) => path.length - 1)).toEqual([7, 6, 7, 6]);
    expect(sections.flatMap((path, index) => index === 0 ? path : path.slice(1))).toEqual([
      { x: 74, y: -22 }, { x: 74, y: -23 }, { x: 74, y: -24 },
      { x: 74, y: -25 }, { x: 74, y: -26 }, { x: 74, y: -27 },
      { x: 74, y: -28 }, { x: 75, y: -29 }, { x: 76, y: -30 },
      { x: 77, y: -31 }, { x: 78, y: -32 }, { x: 79, y: -33 },
      { x: 80, y: -34 }, { x: 81, y: -35 }, { x: 82, y: -36 },
      { x: 83, y: -37 }, { x: 84, y: -38 }, { x: 85, y: -39 },
      { x: 86, y: -40 }, { x: 87, y: -41 }, { x: 88, y: -42 },
      { x: 89, y: -43 }, { x: 90, y: -44 }, { x: 91, y: -45 },
      { x: 92, y: -46 }, { x: 93, y: -47 }, { x: 94, y: -48 },
    ]);
  });

  it("centres Highbury & Islington without changing the Victoria path", () => {
    expect(networkData.stations.find((station) => station.id === "highbury-and-islington"))
      .toMatchObject({ x: 87, y: -35 });

    const south = findConnectionPath("victoria", "king-s-cross-st-pancras", "highbury-and-islington");
    const north = findConnectionPath("victoria", "highbury-and-islington", "finsbury-park");
    expect([south.length - 1, north.length - 1]).toEqual([13, 13]);
    expect([...south, ...north.slice(1)]).toEqual([
      { x: 74, y: -22 }, { x: 75, y: -23 }, { x: 76, y: -24 },
      { x: 77, y: -25 }, { x: 78, y: -26 }, { x: 79, y: -27 },
      { x: 80, y: -28 }, { x: 81, y: -29 }, { x: 82, y: -30 },
      { x: 83, y: -31 }, { x: 84, y: -32 }, { x: 85, y: -33 },
      { x: 86, y: -34 }, { x: 87, y: -35 }, { x: 88, y: -36 },
      { x: 89, y: -37 }, { x: 90, y: -38 }, { x: 91, y: -39 },
      { x: 92, y: -40 }, { x: 92, y: -41 }, { x: 92, y: -42 },
      { x: 92, y: -43 }, { x: 92, y: -44 }, { x: 92, y: -45 },
      { x: 92, y: -46 }, { x: 93, y: -47 }, { x: 94, y: -48 },
    ]);
  });

  it("moves Bethnal Green down to the same row as Mile End", () => {
    const bethnalGreen = networkData.stations.find((station) => station.id === "bethnal-green");
    const mileEnd = networkData.stations.find((station) => station.id === "mile-end");

    expect(bethnalGreen).toMatchObject({ x: 122, y: -14 });
    expect(bethnalGreen?.y).toBe(mileEnd?.y);
    expect(directionRuns(findConnectionPath("central", "bethnal-green", "mile-end")))
      .toEqual(["1,0"]);
  });

  it("moves Tottenham Court Road two cells east and keeps its routes schematic", () => {
    expect(networkData.stations.find((station) => station.id === "tottenham-court-road"))
      .toMatchObject({ x: 62, y: -8 });
    expect(directionRuns(findConnectionPath("central", "oxford-circus", "tottenham-court-road")))
      .toEqual(["1,0"]);
    expect(directionRuns(findConnectionPath("central", "tottenham-court-road", "holborn")))
      .toEqual(["1,0", "1,1"]);
    expect(directionRuns(findConnectionPath("northern", "leicester-square", "tottenham-court-road")))
      .toEqual(["0,-1"]);
    expect(directionRuns(findConnectionPath("northern", "tottenham-court-road", "goodge-street")))
      .toEqual(["0,-1"]);
  });

  it("moves Elizabeth line Canary Wharf north and keeps Whitechapel to Canary Wharf diagonal", () => {
    expect(networkData.stations.find((station) => station.id === "canary-wharf-elizabeth-line"))
      .toMatchObject({ x: 140, y: 9 });
    expect(directionRuns(findConnectionPath(
      "elizabeth",
      "whitechapel",
      "canary-wharf-elizabeth-line",
    ))).toEqual(["1,0", "1,1"]);
  });

  it("keeps Acton Main Line fixed and reshapes the Elizabeth line west of Paddington", () => {
    expect(stationByName("Acton Main Line")).toMatchObject({ x: -20, y: -14 });
    expect(directionRuns(findConnectionPath("elizabeth", "paddington", "acton-main-line")))
      .toEqual(["-1,0", "-1,1"]);
    expect(findConnectionPath("elizabeth", "paddington", "acton-main-line"))
      .toContainEqual({ x: -16, y: -18 });
    expect(directionRuns(findConnectionPath("elizabeth", "acton-main-line", "ealing-broadway")))
      .toEqual(["-1,1", "-1,0"]);
    expect(findConnectionPath("elizabeth", "acton-main-line", "ealing-broadway"))
      .toContainEqual({ x: -34, y: 0 });
  });

  it("aligns the Elizabeth line from West Ealing to Hayes & Harlington with Ealing Broadway", () => {
    expect(stationByName("West Ealing")).toMatchObject({ x: -46, y: 0 });
    expect(stationByName("Hanwell")).toMatchObject({ x: -50, y: 0 });
    expect(stationByName("Southall")).toMatchObject({ x: -54, y: 0 });
    expect(stationByName("Hayes & Harlington")).toMatchObject({ x: -58, y: 0 });

    for (const pair of [
      ["ealing-broadway", "west-ealing"],
      ["west-ealing", "hanwell"],
      ["hanwell", "southall"],
      ["southall", "hayes-and-harlington"],
    ] as const) {
      expect(directionRuns(findConnectionPath("elizabeth", pair[0], pair[1]))).toEqual(["-1,0"]);
    }

    expect(directionRuns(findConnectionPath(
      "elizabeth",
      "hayes-and-harlington",
      "heathrow-terminal-2-and-3",
    ))).toEqual(["-1,1", "0,1"]);
  });

  it("keeps the Elizabeth line Reading branch horizontal with four-cell spacing", () => {
    const branchStations = [
      ["West Drayton", -62, 0],
      ["Iver", -66, 0],
      ["Langley", -70, 0],
      ["Slough", -74, 0],
      ["Burnham", -78, 0],
      ["Taplow", -82, 0],
      ["Maidenhead", -86, 0],
      ["Twyford", -90, 0],
      ["Reading", -94, 0],
    ] as const;

    for (const [name, x, y] of branchStations) {
      expect(stationByName(name)).toMatchObject({ x, y });
    }

    for (const pair of [
      ["west-drayton", "iver"],
      ["iver", "langley"],
      ["langley", "slough"],
      ["slough", "burnham"],
      ["burnham", "taplow"],
      ["taplow", "maidenhead"],
      ["maidenhead", "twyford"],
      ["twyford", "reading"],
    ] as const) {
      expect(directionRuns(findConnectionPath("elizabeth", pair[0], pair[1]))).toEqual(["-1,0"]);
    }
  });

  it("places Heathrow Terminal 4 due south and marks the Piccadilly loop one-way", () => {
    expect(stationByName("Heathrow Terminal 2 & 3")).toMatchObject({ x: -66, y: 34 });
    expect(stationByName("Heathrow Terminal 4")).toMatchObject({ x: -66, y: 44 });

    expect(directionRuns(findConnectionPath("piccadilly", "hatton-cross", "heathrow-terminal-4")))
      .toEqual(["0,1", "-1,0"]);
    expect(directionRuns(findConnectionPath("piccadilly", "heathrow-terminal-4", "heathrow-terminal-2-and-3")))
      .toEqual(["-1,0", "0,-1", "1,-1"]);
    expect(findConnectionPath("piccadilly", "heathrow-terminal-4", "heathrow-terminal-2-and-3"))
      .toEqual(expect.arrayContaining([
        { x: -70, y: 44 },
        { x: -70, y: 38 },
      ]));
    expect(directionRuns(findConnectionPath("elizabeth", "heathrow-terminal-4", "heathrow-terminal-2-and-3")))
      .toEqual(["0,-1"]);

    expect(findConnection("piccadilly", "hatton-cross", "heathrow-terminal-4")?.oneWay)
      .toBe(true);
    expect(findConnection("piccadilly", "heathrow-terminal-4", "heathrow-terminal-2-and-3")?.oneWay)
      .toBe(true);
    expect(findConnection("piccadilly", "hatton-cross", "heathrow-terminal-2-and-3")?.oneWay)
      .not.toBe(true);
    expect(findConnection("piccadilly", "heathrow-terminal-2-and-3", "heathrow-terminal-5")?.oneWay)
      .not.toBe(true);
  });

  it("moves Heathrow Terminal 5 while preserving the Piccadilly branch direction", () => {
    expect(stationByName("Heathrow Terminal 5")).toMatchObject({ x: -74, y: 44 });
    expect(directionRuns(findConnectionPath("piccadilly", "heathrow-terminal-2-and-3", "heathrow-terminal-5")))
      .toEqual(["-1,1", "0,1"]);
  });

  it("routes Elizabeth northeast and above Mile End from Whitechapel to Stratford", () => {
    const path = findConnectionPath("elizabeth", "whitechapel", "stratford");

    expect(path.slice(0, 3)).toEqual([
      { x: 118, y: -12 },
      { x: 118, y: -13 },
      { x: 119, y: -14 },
    ]);
    expect(path).toContainEqual({ x: 130, y: -18 });
    expect(directionRuns(path)).toEqual(["0,-1", "1,-1", "1,0", "1,-1"]);
    const connection = networkData.connections.find(
      (candidate) =>
        candidate.line === "elizabeth" &&
        candidate.from === "stratford" &&
        candidate.to === "whitechapel",
    );
    expect(connection?.directionOverrides?.to).toEqual({ x: 1, y: -1 });
  });

  it("keeps Central loop stations off path vertices except Leytonstone and Woodford", () => {
    const straightLoopStations = [
      ["wanstead", ["-1,0", "1,0"]],
      ["gants-hill", ["-1,0", "1,0"]],
      ["newbury-park", ["0,-1", "0,1"]],
      ["hainault", ["0,-1", "0,1"]],
      ["grange-hill", ["-1,0", "1,0"]],
      ["roding-valley", ["-1,0", "1,0"]],
    ] as const;

    expect(stationByName("Wanstead")).toMatchObject({ x: 160, y: -46 });
    expect(stationByName("Redbridge")).toMatchObject({ x: 165, y: -46 });
    expect(stationByName("Gants Hill")).toMatchObject({ x: 170, y: -46 });
    expect(stationByName("Newbury Park")).toMatchObject({ x: 172, y: -48 });
    expect(stationByName("Barkingside")).toMatchObject({ x: 172, y: -52 });
    expect(stationByName("Fairlop")).toMatchObject({ x: 172, y: -56 });
    expect(stationByName("Hainault")).toMatchObject({ x: 172, y: -60 });
    expect(stationByName("Grange Hill")).toMatchObject({ x: 170, y: -62 });
    expect(stationByName("Chigwell")).toMatchObject({ x: 165, y: -62 });
    expect(stationByName("Roding Valley")).toMatchObject({ x: 160, y: -62 });
    expect(172 - 158).toBe(14);
    expect(loopStationSpacing(["Wanstead", "Redbridge", "Gants Hill"], "x")).toEqual([5, 5]);
    expect(loopStationSpacing(["Newbury Park", "Barkingside", "Fairlop", "Hainault"], "y"))
      .toEqual([4, 4, 4]);
    expect(loopStationSpacing(["Roding Valley", "Chigwell", "Grange Hill"], "x")).toEqual([5, 5]);

    for (const [stationId, expectedDirections] of straightLoopStations) {
      expect(centralExitDirections(stationId)).toEqual(expectedDirections);
    }
    expect(directionRuns(findConnectionPath("central", "leytonstone", "wanstead")))
      .toEqual(["1,-1", "1,0"]);
    expect(directionRuns(findConnectionPath("central", "woodford", "roding-valley")))
      .toEqual(["1,-1", "1,0"]);
    expect(findConnectionPath("central", "leytonstone", "wanstead").slice(0, 3)).toEqual([
      { x: 156, y: -44 },
      { x: 157, y: -45 },
      { x: 158, y: -46 },
    ]);
    expect(findConnectionPath("central", "woodford", "roding-valley").slice(0, 3)).toEqual([
      { x: 156, y: -60 },
      { x: 157, y: -61 },
      { x: 158, y: -62 },
    ]);
    expect(directionRuns(findConnectionPath("central", "gants-hill", "newbury-park")))
      .toEqual(["1,0", "0,-1"]);
    expect(directionRuns(findConnectionPath("central", "hainault", "grange-hill")))
      .toEqual(["0,-1", "-1,0"]);
  });

  it("uses east and west movement between Stepney Green and Mile End", () => {
    for (const line of ["district", "hammersmith-city"] as const) {
      const connection = networkData.connections.find(
        (candidate) =>
          candidate.line === line &&
          candidate.from === "stepney-green" &&
          candidate.to === "mile-end",
      );

      expect(connection?.directionOverrides).toEqual({
        from: { x: 1, y: 0 },
        to: { x: -1, y: 0 },
      });
    }
  });

  it("uses west and east movement between Bow Road and Mile End", () => {
    for (const line of ["district", "hammersmith-city"] as const) {
      const connection = networkData.connections.find(
        (candidate) =>
          candidate.line === line &&
          candidate.from === "mile-end" &&
          candidate.to === "bow-road",
      );

      expect(connection?.directionOverrides).toEqual({
        from: { x: 1, y: 0 },
        to: { x: -1, y: 0 },
      });
    }
  });

  it("allows Waterloo & City to follow the central Tube-map corridor", () => {
    const connection = networkData.connections.find((candidate) => candidate.line === "waterloo-city");

    expect(connection?.path.slice(0, 2)).toEqual([{ x: 88, y: -8 }, { x: 88, y: -7 }]);
    expect(connection?.path).toContainEqual({ x: 88, y: 9 });
    expect(connection?.path).toContainEqual({ x: 76, y: 21 });
    expect(connection?.path.at(-1)).toEqual({ x: 62, y: 21 });
    expect(connection?.path).not.toContainEqual({ x: 90, y: 10 });
  });

  it("routes Jubilee west then north-west from Canada Water to Bermondsey", () => {
    const connection = networkData.connections.find(
      (candidate) =>
        candidate.line === "jubilee" &&
        candidate.from === "bermondsey" &&
        candidate.to === "canada-water",
    );
    const westboundPath = [...(connection?.path ?? [])].reverse();

    expect(westboundPath.slice(0, 3)).toEqual([
      { x: 118, y: 16 },
      { x: 117, y: 16 },
      { x: 116, y: 16 },
    ]);
    expect(westboundPath).toContainEqual({ x: 110, y: 16 });
    expect(westboundPath.at(-1)).toEqual({ x: 106, y: 12 });
  });

  it("aligns the Battersea extension with Kennington", () => {
    const station = (id: string) => networkData.stations.find((candidate) => candidate.id === id);

    expect(station("battersea-power-station")?.y).toBe(station("kennington")?.y);
    expect(station("nine-elms")?.y).toBe(station("kennington")?.y);
  });

  it("keeps the Richmond branch collinear with Turnham Green", () => {
    const branchStations = [
      ["gunnersbury", -25, 20],
      ["kew-gardens", -31, 26],
      ["richmond", -37, 32],
    ] as const;

    for (const [stationId, x, y] of branchStations) {
      expect(networkData.stations.find((station) => station.id === stationId))
        .toMatchObject({ x, y });
      expect(x + y).toBe(-5);
    }
    expect(directionRuns(findConnectionPath("district", "gunnersbury", "kew-gardens")))
      .toEqual(["-1,1"]);
    expect(directionRuns(findConnectionPath("district", "kew-gardens", "richmond")))
      .toEqual(["-1,1"]);
  });

  it("moves Hanger Lane northwest and links it to Park Royal", () => {
    expect(stationByName("Hanger Lane")).toMatchObject({ x: -35, y: -21 });
    expect(stationByName("Hanger Lane").lines).toContain("walk");
    expect(stationByName("Park Royal").lines).toContain("walk");
    expect(hasConnection("Hanger Lane", "Park Royal", "walk")).toBe(true);
    expect(directionRuns(findConnectionPath("central", "hanger-lane", "perivale")))
      .toEqual(["-1,-1"]);
    expect(directionRuns(findConnectionPath("central", "north-acton", "hanger-lane")))
      .toEqual(["-1,-1"]);
  });

  it("routes Bakerloo straight from Elephant & Castle to Lambeth North", () => {
    const connection = networkData.connections.find(
      (candidate) =>
        candidate.line === "bakerloo" &&
        candidate.from === "lambeth-north" &&
        candidate.to === "elephant-and-castle",
    );
    const directions = connection?.path.slice(1).map((point, index) => ({
      x: point.x - connection.path[index].x,
      y: point.y - connection.path[index].y,
    }));

    expect(directions).toEqual(Array(4).fill({ x: 1, y: 1 }));
  });

  it("routes Bakerloo northwest twice then north from Lambeth North to Waterloo", () => {
    const path = findConnectionPath("bakerloo", "lambeth-north", "waterloo");

    expect(path.slice(0, 3)).toEqual([
      { x: 64, y: 30 },
      { x: 63, y: 29 },
      { x: 62, y: 28 },
    ]);
    expect(directionRuns(path)).toEqual(["-1,-1", "0,-1"]);
    expect(path.slice(2).every((point) => point.x === 62)).toBe(true);
  });

  it("aligns Embankment with Charing Cross and Waterloo", () => {
    const ids = ["charing-cross", "embankment", "waterloo"];
    const stations = ids.map((id) => networkData.stations.find((station) => station.id === id));

    expect(stations.every((station) => station?.x === 62)).toBe(true);
  });

  it("routes Jubilee northwest then north from Westminster to Green Park", () => {
    const path = findConnectionPath("jubilee", "westminster", "green-park");

    expect(directionRuns(path)).toEqual(["-1,-1", "0,-1"]);
    expect(path.at(-3)).toEqual({ x: 44, y: 2 });
    expect(path.slice(-2)).toEqual([{ x: 44, y: 1 }, { x: 44, y: 0 }]);
  });

  it("moves the Circle and District corridor from Sloane Square through Temple down one cell", () => {
    const corridorStations = [
      ["sloane-square", 38],
      ["victoria", 44],
      ["st-james-s-park", 50],
      ["westminster", 56],
      ["embankment", 62],
      ["temple", 72],
    ] as const;

    for (const [stationId, x] of corridorStations) {
      expect(networkData.stations.find((station) => station.id === stationId))
        .toMatchObject({ x, y: 15 });
    }

    for (const line of ["circle", "district"] as const) {
      for (let index = 0; index < corridorStations.length - 1; index += 1) {
        expect(directionRuns(findConnectionPath(
          line,
          corridorStations[index][0],
          corridorStations[index + 1][0],
        ))).toEqual(["1,0"]);
      }
    }
  });

  it("joins every Waterloo line at the lower marker", () => {
    expect(networkData.stations.find((station) => station.id === "waterloo"))
      .toMatchObject({ x: 62, y: 21 });
    expect(directionRuns(findConnectionPath("bakerloo", "waterloo", "lambeth-north")))
      .toEqual(["0,1", "1,1"]);
    expect(directionRuns(findConnectionPath("northern", "embankment", "waterloo")))
      .toEqual(["0,1"]);
    expect(findConnectionPath("waterloo-city", "bank", "waterloo").at(-1))
      .toEqual({ x: 62, y: 21 });
  });

  it("routes Northern north then north-east from Kennington to Waterloo", () => {
    const connection = networkData.connections.find(
      (candidate) =>
        candidate.line === "northern" &&
        candidate.from === "waterloo" &&
        candidate.to === "kennington",
    );
    const northboundPath = [...(connection?.path ?? [])].reverse();

    expect(northboundPath.slice(0, 3)).toEqual([
      { x: 60, y: 38 },
      { x: 60, y: 37 },
      { x: 60, y: 36 },
    ]);
    expect(northboundPath.at(-3)).toEqual({ x: 60, y: 23 });
    expect(northboundPath.slice(-2)).toEqual([{ x: 61, y: 22 }, { x: 62, y: 21 }]);
  });

  it("keeps every playable station in one connected network", () => {
    const firstStation = networkData.stations[0];
    const visited = new Set<string>([firstStation.id]);
    const queue = [firstStation.id];

    while (queue.length > 0) {
      const stationId = queue.shift();
      for (const connection of networkData.connections) {
        const neighbour =
          connection.from === stationId
            ? connection.to
            : connection.to === stationId
              ? connection.from
              : null;
        if (neighbour && !visited.has(neighbour)) {
          visited.add(neighbour);
          queue.push(neighbour);
        }
      }
    }

    expect(visited.size).toBe(networkData.stations.length);
  });

  it("allows smooth path turns of at most 45 degrees", () => {
    const network = createPathValidationNetwork([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 1, y: 3 },
      { x: 0, y: 3 },
    ]);

    expect(validateNetworkData(network)).toEqual([]);
  });

  it("rejects sharp 90 degree turns inside a path", () => {
    const network = createPathValidationNetwork([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]);

    expect(validateNetworkData(network)).toContain("Connection central:a:b has sharp turn at path point 1");
  });

  it("rejects direct backtracking inside a path", () => {
    const network = createPathValidationNetwork([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);

    expect(validateNetworkData(network)).toContain("Connection central:a:b has sharp turn at path point 1");
  });

  it("rejects a line that creates an unnecessary hump", () => {
    const network = createPathValidationNetwork([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: -1 },
      { x: 3, y: -1 },
      { x: 4, y: 0 },
      { x: 5, y: 0 },
    ]);

    expect(validateNetworkData(network)).toContain("Connection central:a:b contains an unnecessary hump");
  });

  it("rejects a short stair-step zig-zag", () => {
    const network = createPathValidationNetwork([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ]);

    expect(validateNetworkData(network)).toContain("Connection central:a:b contains a short zig-zag");
  });

  it("rejects an excessive avoidable detour", () => {
    const network = createPathValidationNetwork([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 1, y: 3 },
      { x: 0, y: 3 },
      { x: -1, y: 3 },
    ]);

    expect(validateNetworkData(network)).toContain("Connection central:a:b has an excessive detour");
  });

  it("keeps named out-of-station interchanges as separate walk-linked nodes", () => {
    const stationByName = new Map(networkData.stations.map((station) => [station.name, station]));
    const bank = stationByName.get("Bank");
    const monument = stationByName.get("Monument");
    const liverpoolStreet = stationByName.get("Liverpool Street");
    const moorgate = stationByName.get("Moorgate");
    const whiteCity = stationByName.get("White City");
    const woodLane = stationByName.get("Wood Lane");

    expect(bank?.lines).not.toContain("circle");
    expect(monument?.lines).toEqual(expect.arrayContaining(["circle", "district", "walk"]));
    expect(liverpoolStreet?.lines).not.toContain("northern");
    expect(moorgate?.lines).toContain("northern");
    expect(moorgate?.lines).not.toContain("walk");
    expect(whiteCity?.lines).toContain("walk");
    expect(woodLane?.lines).toContain("walk");
    expect(hasConnection("Bank", "Monument", "walk")).toBe(true);
    expect(hasConnection("White City", "Wood Lane", "walk")).toBe(true);
    expect(hasConnection("Liverpool Street", "Moorgate", "walk")).toBe(false);
  });

  it("rejects stations in adjacent grid cells without a walk link", () => {
    const network = createPathValidationNetwork([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    expect(validateNetworkData(network)).toContain("Stations a and b are in adjacent grid cells");
  });

  it("allows adjacent stations when they are directly walk-linked", () => {
    const network = createPathValidationNetwork([{ x: 0, y: 0 }, { x: 1, y: 1 }], "walk");
    expect(validateNetworkData(network)).toEqual([]);
  });

  it("rejects duplicate first-step directions at a line branch", () => {
    const network: NetworkData = {
      stations: [
        { id: "a", name: "A", x: 0, y: 0, lines: ["central"] },
        { id: "b", name: "B", x: 3, y: 0, lines: ["central"] },
        { id: "c", name: "C", x: 3, y: 2, lines: ["central"] },
      ],
      connections: [
        { id: "central:a:b", from: "a", to: "b", line: "central", path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }] },
        { id: "central:a:c", from: "a", to: "c", line: "central", path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 1 }, { x: 3, y: 2 }] },
      ],
      temporary: true,
      notes: [],
    };

    expect(validateNetworkData(network)).toContain(
      "Station/line a:central has duplicate exit direction for central:a:b and central:a:c",
    );
  });

  it("rejects a branch that initially points away from its destination", () => {
    const network: NetworkData = {
      stations: [
        { id: "a", name: "A", x: 0, y: 0, lines: ["central"] },
        { id: "b", name: "B", x: 3, y: 0, lines: ["central"] },
        { id: "c", name: "C", x: 0, y: 3, lines: ["central"] },
        { id: "d", name: "D", x: -3, y: 0, lines: ["central"] },
      ],
      connections: [
        {
          id: "central:a:b",
          from: "a",
          to: "b",
          line: "central",
          path: [
            { x: 0, y: 0 },
            { x: 0, y: -1 },
            { x: 1, y: -2 },
            { x: 2, y: -2 },
            { x: 3, y: -1 },
            { x: 3, y: 0 },
          ],
        },
        { id: "central:a:c", from: "a", to: "c", line: "central", path: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }] },
        { id: "central:a:d", from: "a", to: "d", line: "central", path: [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -2, y: 0 }, { x: -3, y: 0 }] },
      ],
      temporary: true,
      notes: [],
    };

    expect(validateNetworkData(network)).toContain(
      "Station/line a:central has misleading branch exit for central:a:b",
    );
  });

  it("keeps critical same-line branches directionally distinct", () => {
    for (const [stationName, line] of [
      ["Woodford", "central"],
      ["Leytonstone", "central"],
      ["Finchley Central", "northern"],
      ["Chalfont & Latimer", "metropolitan"],
    ] as const) {
      const station = networkData.stations.find((candidate) => candidate.name === stationName);
      const connections = networkData.connections.filter(
        (connection) =>
          connection.line === line && (connection.from === station?.id || connection.to === station?.id),
      );
      const directions = connections.map((connection) => firstStepKey(connection.path, connection.to === station?.id));
      expect(new Set(directions).size, `${stationName} ${line} branch exits`).toBe(connections.length);
    }
  });

  it("routes the Piccadilly line straight through skipped District stations", () => {
    const earlCourt = stationByName("Earl's Court");
    const baronsCourt = stationByName("Barons Court");
    const westKensington = stationByName("West Kensington");
    const connection = networkData.connections.find(
      (candidate) =>
        candidate.line === "piccadilly" &&
        ((candidate.from === earlCourt.id && candidate.to === baronsCourt.id) ||
          (candidate.from === baronsCourt.id && candidate.to === earlCourt.id)),
    );

    expect(connection?.path).toContainEqual({ x: westKensington.x, y: westKensington.y });
  });

  it("labels the separate Hammersmith stations by their actual services", () => {
    expect(stationByName("Hammersmith (Circle and Hammersmith & City)").lines).toEqual(
      expect.arrayContaining(["circle", "hammersmith-city", "walk"]),
    );
    expect(stationByName("Hammersmith (District and Piccadilly)").lines).toEqual(
      expect.arrayContaining(["district", "piccadilly", "walk"]),
    );
  });
});

function createPathValidationNetwork(
  path: Array<{ x: number; y: number }>,
  line: "central" | "walk" = "central",
): NetworkData {
  const start = path[0];
  const end = path[path.length - 1];

  return {
    stations: [
      { id: "a", name: "A", x: start.x, y: start.y, lines: [line] },
      { id: "b", name: "B", x: end.x, y: end.y, lines: [line] },
    ],
    connections: [
      {
        id: `${line}:a:b`,
        from: "a",
        to: "b",
        line,
        path,
      },
    ],
    temporary: true,
    notes: [],
  };
}

function hasConnection(fromName: string, toName: string, line: string): boolean {
  const from = networkData.stations.find((station) => station.name === fromName);
  const to = networkData.stations.find((station) => station.name === toName);
  return Boolean(
    from &&
      to &&
      networkData.connections.some(
        (connection) =>
          connection.line === line &&
          ((connection.from === from.id && connection.to === to.id) ||
            (connection.from === to.id && connection.to === from.id)),
      ),
  );
}

function firstStepKey(path: Array<{ x: number; y: number }>, reverse: boolean): string {
  const oriented = reverse ? [...path].reverse() : path;
  return `${Math.sign(oriented[1].x - oriented[0].x)},${Math.sign(oriented[1].y - oriented[0].y)}`;
}

function centralExitDirections(stationId: string): string[] {
  return networkData.connections
    .filter(
      (connection) =>
        connection.line === "central" &&
        (connection.from === stationId || connection.to === stationId),
    )
    .map((connection) => firstStepKey(connection.path, connection.to === stationId))
    .sort();
}

function loopStationSpacing(names: string[], axis: "x" | "y"): number[] {
  return names.slice(1).map((name, index) =>
    Math.abs(stationByName(name)[axis] - stationByName(names[index])[axis]));
}

function findConnectionPath(line: LineId, from: string, to: string): GridPoint[] {
  const connection = findConnection(line, from, to);
  if (!connection) throw new Error(`Missing ${line} connection ${from} -> ${to}`);
  return connection.from === from ? connection.path : [...connection.path].reverse();
}

function findConnection(line: LineId, from: string, to: string) {
  const connection = networkData.connections.find(
    (candidate) =>
      candidate.line === line &&
      ((candidate.from === from && candidate.to === to) ||
        (candidate.from === to && candidate.to === from)),
  );
  return connection;
}

function pathEdges(path: GridPoint[]): string[] {
  return path.slice(0, -1).map((point, index) => {
    const keys = [point, path[index + 1]].map(({ x, y }) => `${x},${y}`).sort();
    return keys.join(";");
  });
}

function directionRuns(path: GridPoint[]): string[] {
  return path.slice(1)
    .map((point, index) => `${Math.sign(point.x - path[index].x)},${Math.sign(point.y - path[index].y)}`)
    .filter((direction, index, all) => index === 0 || direction !== all[index - 1]);
}

function stationByName(name: string) {
  const station = networkData.stations.find((candidate) => candidate.name === name);
  if (!station) throw new Error(`Missing station ${name}`);
  return station;
}
