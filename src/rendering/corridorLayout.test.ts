import { describe, expect, it } from "vitest";
import type { GridPoint, NetworkData } from "../data/types";
import { networkData } from "../data/network";
import { GRID_CELL_SIZE, gridPointToSvgPoint } from "./grid";
import { CorridorLayout, type SharedCorridor } from "./corridorLayout";
import { LINE_STROKE_WIDTH } from "./lineStyles";

const corridorNetwork: NetworkData = {
  temporary: true,
  notes: [],
  stations: [
    { id: "a", name: "A", x: 0, y: 0, lines: ["district", "piccadilly"] },
    { id: "b", name: "B", x: 3, y: 0, lines: ["district"] },
    { id: "c", name: "C", x: 6, y: 0, lines: ["district", "piccadilly"] },
  ],
  connections: [
    {
      id: "district:a:b",
      from: "a",
      to: "b",
      line: "district",
      path: horizontalPath(0, 3),
    },
    {
      id: "district:b:c",
      from: "b",
      to: "c",
      line: "district",
      path: horizontalPath(3, 6),
    },
    {
      id: "piccadilly:a:c",
      from: "a",
      to: "c",
      line: "piccadilly",
      path: horizontalPath(0, 6),
    },
  ],
};

const syntheticCorridor: SharedCorridor = {
  lanes: [["piccadilly"], ["district"]],
  from: "a",
  to: "c",
};

describe("shared corridor layout", () => {
  it("places shared lines one full grid cell apart", () => {
    const layout = new CorridorLayout(corridorNetwork, [syntheticCorridor]);
    const district = corridorNetwork.connections[0];
    const piccadilly = corridorNetwork.connections[2];

    expect(new Set(layout.getConnectionSegmentOffsets(district))).toEqual(new Set([GRID_CELL_SIZE]));
    expect(new Set(layout.getConnectionSegmentOffsets(piccadilly))).toEqual(new Set([0]));
  });

  it("creates conjoined marker positions only where both lines stop", () => {
    const layout = new CorridorLayout(corridorNetwork, [syntheticCorridor]);
    const sharedGroups = layout.getStationMarkerGroups("a");
    const skippedGroups = layout.getStationMarkerGroups("b");

    expect(sharedGroups).toHaveLength(2);
    expect(Math.hypot(
      sharedGroups[0].point.x - sharedGroups[1].point.x,
      sharedGroups[0].point.y - sharedGroups[1].point.y,
    )).toBe(GRID_CELL_SIZE);
    expect(sharedGroups.every((group) => isCellCentre(group.point))).toBe(true);
    expect(skippedGroups).toHaveLength(1);
    expect(skippedGroups[0].lines).toEqual(["district"]);
    expect(skippedGroups[0].point).not.toEqual(gridPointToSvgPoint(corridorNetwork.stations[1]));
  });

  it("does not split lines that only cross briefly", () => {
    const network: NetworkData = {
      temporary: true,
      notes: [],
      stations: [
        { id: "a", name: "A", x: 0, y: 0, lines: ["district"] },
        { id: "b", name: "B", x: 2, y: 0, lines: ["district"] },
        { id: "c", name: "C", x: 1, y: 0, lines: ["piccadilly"] },
        { id: "d", name: "D", x: 3, y: 0, lines: ["piccadilly"] },
      ],
      connections: [
        { id: "district:a:b", from: "a", to: "b", line: "district", path: horizontalPath(0, 2) },
        { id: "piccadilly:c:d", from: "c", to: "d", line: "piccadilly", path: horizontalPath(1, 3) },
      ],
    };
    const layout = new CorridorLayout(network, [{
      lanes: [["district"], ["piccadilly"]],
      from: "a",
      to: "d",
    }]);

    expect(network.connections.map((connection) => layout.getConnectionSegmentOffsets(connection))).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it("conjoins the District and Piccadilly markers at Barons Court", () => {
    const layout = new CorridorLayout(networkData);
    const groups = layout.getStationMarkerGroups("barons-court");
    const district = groups.find((group) => group.lines.includes("district"));
    const piccadilly = groups.find((group) => group.lines.includes("piccadilly"));

    expect(district).toBeDefined();
    expect(piccadilly).toBeDefined();
    expect(Math.hypot(
      district!.point.x - piccadilly!.point.x,
      district!.point.y - piccadilly!.point.y,
    )).toBeCloseTo(GRID_CELL_SIZE);
    expect(district!.point.y).toBe(piccadilly!.point.y + GRID_CELL_SIZE);
    expect(district!.point.x).toBe(piccadilly!.point.x);
    expect(groups.every((group) => isCellCentre(group.point))).toBe(true);
  });

  it("conjoins the Jubilee and Metropolitan markers at Wembley Park", () => {
    const layout = new CorridorLayout(networkData);
    const groups = layout.getStationMarkerGroups("wembley-park");
    const jubilee = groups.find((group) => group.lines.includes("jubilee"));
    const metropolitan = groups.find((group) => group.lines.includes("metropolitan"));

    expect(jubilee).toBeDefined();
    expect(metropolitan).toBeDefined();
    expect(Math.hypot(
      jubilee!.point.x - metropolitan!.point.x,
      jubilee!.point.y - metropolitan!.point.y,
    )).toBeCloseTo(GRID_CELL_SIZE * Math.SQRT2);
    expect(groups.every((group) => isCellCentre(group.point))).toBe(true);
  });

  it("does not add a Piccadilly marker at skipped District stations", () => {
    const layout = new CorridorLayout(networkData);
    const groups = layout.getStationMarkerGroups("west-kensington");

    expect(groups.flatMap((group) => group.lines)).toEqual(["district"]);
  });

  it("keeps each line on the same side through successive corridor connections", () => {
    const layout = new CorridorLayout(networkData);
    const districtStations = [
      "barons-court",
      "hammersmith-district-and-piccadilly",
      "ravenscourt-park",
      "stamford-brook",
      "turnham-green",
      "chiswick-park",
      "acton-town",
    ];
    const piccadillyStations = [
      "barons-court",
      "hammersmith-district-and-piccadilly",
      "turnham-green",
      "acton-town",
    ];

    expect(new Set(districtStations.map((stationId) => layout.getStationLinePoint(stationId, "district").y)).size)
      .toBe(1);
    expect(new Set(piccadillyStations.map((stationId) => layout.getStationLinePoint(stationId, "piccadilly").y)).size)
      .toBe(1);
  });

  it("aligns the Richmond branch with the lower Turnham Green marker", () => {
    const layout = new CorridorLayout(networkData);
    const turnhamGreen = layout.getStationLinePoint("turnham-green", "district");
    const gunnersbury = layout.getStationLinePoint("gunnersbury", "district");
    const kewGardens = layout.getStationLinePoint("kew-gardens", "district");
    const richmond = layout.getStationLinePoint("richmond", "district");
    const gridPoints = [turnhamGreen, gunnersbury, kewGardens, richmond].map((point) => ({
      x: (point.x - GRID_CELL_SIZE / 2) / GRID_CELL_SIZE,
      y: (point.y - GRID_CELL_SIZE / 2) / GRID_CELL_SIZE,
    }));

    expect(gridPoints.every(({ x, y }) => x + y === -5)).toBe(true);
    expect(renderedDirectionRuns(layout, "district", "turnham-green", "gunnersbury"))
      .toEqual(["-1,1"]);
  });

  it("keeps ordinary interchanges outside the declared corridors joined", () => {
    const layout = new CorridorLayout(networkData);

    expect(layout.getStationMarkerGroups("baker-street")).toHaveLength(1);
  });

  it("uses the requested line groupings at the additional conjoined stations", () => {
    const layout = new CorridorLayout(networkData);

    expect(markerLines(layout, "south-kensington")).toEqual([
      ["piccadilly"],
      ["circle", "district"],
    ]);
    expect(markerLines(layout, "gloucester-road")).toEqual([
      ["piccadilly"],
      ["circle", "district"],
    ]);
    expect(markerLines(layout, "earl-s-court")).toEqual([
      ["piccadilly"],
      ["district"],
    ]);
    expect(markerLines(layout, "ealing-common")).toEqual([
      ["district"],
      ["piccadilly"],
    ]);
  });

  it("keeps Euston's bottom-right marker fixed while shortening the conjoined marker", () => {
    const layout = new CorridorLayout(networkData);
    const groups = layout.getStationMarkerGroups("euston");
    const northern = groups.find((group) => group.lines.includes("northern"));
    const victoria = groups.find((group) => group.lines.includes("victoria"));

    expect(groups).toHaveLength(2);
    expect(northern?.lines).toEqual(["northern"]);
    expect(victoria?.lines).toEqual(["victoria"]);
    expect(gridPointFromSvgPoint(northern!.point)).toEqual({ x: 65, y: -27 });
    expect(gridPointFromSvgPoint(layout.getStationLinePoint("euston", "walk"))).toEqual({ x: 65, y: -27 });
    expect(gridPointFromSvgPoint(victoria!.point)).toEqual({ x: 67, y: -25 });
    expect(victoria!.point.x - northern!.point.x).toBe(GRID_CELL_SIZE * 2);
    expect(victoria!.point.y - northern!.point.y).toBe(GRID_CELL_SIZE * 2);
  });

  it("renders Victoria straight northeast from Warren Street into the Euston Victoria marker", () => {
    const layout = new CorridorLayout(networkData);

    expect(renderedGridPoints(layout, "victoria", "warren-street", "euston"))
      .toEqual([{ x: 62, y: -20 }, { x: 67, y: -25 }]);
    expect(renderedDirectionRuns(layout, "victoria", "warren-street", "euston"))
      .toEqual(["1,-1"]);
  });

  it("makes King's Cross St Pancras a southwest-to-northeast conjoined marker", () => {
    const layout = new CorridorLayout(networkData);
    const groups = layout.getStationMarkerGroups("king-s-cross-st-pancras");
    const existing = groups.find((group) => !group.lines.includes("victoria") && !group.lines.includes("northern"));
    const top = groups.find((group) => group.lines.includes("victoria"));

    expect(groups).toHaveLength(2);
    expect(existing?.lines).toEqual(["circle", "hammersmith-city", "metropolitan", "piccadilly"]);
    expect(top?.lines).toEqual(["northern", "victoria"]);
    expect(gridPointFromSvgPoint(existing!.point)).toEqual({ x: 74, y: -22 });
    expect(gridPointFromSvgPoint(top!.point)).toEqual({ x: 77, y: -25 });
    expect(top!.point.x - existing!.point.x).toBe(GRID_CELL_SIZE * 3);
    expect(top!.point.y - existing!.point.y).toBe(-GRID_CELL_SIZE * 3);
  });

  it("renders Victoria horizontally from Euston to King's Cross St Pancras", () => {
    const layout = new CorridorLayout(networkData);

    expect(renderedGridPoints(layout, "victoria", "euston", "king-s-cross-st-pancras"))
      .toEqual([{ x: 67, y: -25 }, { x: 77, y: -25 }]);
    expect(renderedDirectionRuns(layout, "victoria", "euston", "king-s-cross-st-pancras"))
      .toEqual(["1,0"]);
  });

  it("renders Northern into the King's Cross top marker and then left to Euston", () => {
    const layout = new CorridorLayout(networkData);

    expect(renderedGridPoints(layout, "northern", "angel", "king-s-cross-st-pancras"))
      .toEqual([{ x: 82, y: -22 }, { x: 80, y: -22 }, { x: 77, y: -25 }]);
    expect(renderedDirectionRuns(layout, "northern", "angel", "king-s-cross-st-pancras"))
      .toEqual(["-1,0", "-1,-1"]);
    expect(renderedGridPoints(layout, "northern", "king-s-cross-st-pancras", "euston"))
      .toEqual([{ x: 77, y: -25 }, { x: 75, y: -27 }, { x: 65, y: -27 }]);
    expect(renderedDirectionRuns(layout, "northern", "king-s-cross-st-pancras", "euston"))
      .toEqual(["-1,-1", "-1,0"]);
  });

  it("makes Finsbury Park a northwest-to-southeast Piccadilly and Victoria marker", () => {
    const layout = new CorridorLayout(networkData);
    const groups = layout.getStationMarkerGroups("finsbury-park");
    const piccadilly = groups.find((group) => group.lines.includes("piccadilly"));
    const victoria = groups.find((group) => group.lines.includes("victoria"));

    expect(groups).toHaveLength(2);
    expect(piccadilly?.lines).toEqual(["piccadilly"]);
    expect(victoria?.lines).toEqual(["victoria"]);
    expect(gridPointFromSvgPoint(piccadilly!.point)).toEqual({ x: 94, y: -46 });
    expect(gridPointFromSvgPoint(victoria!.point)).toEqual({ x: 96, y: -44 });
    expect(victoria!.point.x - piccadilly!.point.x).toBe(GRID_CELL_SIZE * 2);
    expect(victoria!.point.y - piccadilly!.point.y).toBe(GRID_CELL_SIZE * 2);
  });

  it("renders the Piccadilly corridor diagonally from Caledonian Road to Finsbury Park", () => {
    const layout = new CorridorLayout(networkData);

    expect(renderedGridPoints(layout, "piccadilly", "king-s-cross-st-pancras", "caledonian-road"))
      .toEqual([{ x: 74, y: -22 }, { x: 74, y: -26 }, { x: 76, y: -28 }]);
    expect(renderedDirectionRuns(layout, "piccadilly", "caledonian-road", "holloway-road"))
      .toEqual(["1,-1"]);
    expect(renderedDirectionRuns(layout, "piccadilly", "holloway-road", "arsenal"))
      .toEqual(["1,-1"]);
    expect(renderedDirectionRuns(layout, "piccadilly", "arsenal", "finsbury-park"))
      .toEqual(["1,-1"]);
  });

  it("renders Piccadilly and Victoria outward from the Finsbury Park split marker", () => {
    const layout = new CorridorLayout(networkData);

    expect(renderedGridPoints(layout, "piccadilly", "finsbury-park", "manor-house"))
      .toEqual([{ x: 94, y: -46 }, { x: 100, y: -52 }, { x: 100, y: -56 }]);
    expect(renderedDirectionRuns(layout, "piccadilly", "finsbury-park", "manor-house"))
      .toEqual(["1,-1", "0,-1"]);
    expect(renderedGridPoints(layout, "victoria", "finsbury-park", "seven-sisters"))
      .toEqual([{ x: 96, y: -44 }, { x: 106, y: -54 }, { x: 120, y: -54 }]);
    expect(renderedDirectionRuns(layout, "victoria", "finsbury-park", "seven-sisters"))
      .toEqual(["1,-1", "1,0"]);
  });

  it("places Elizabeth above the other lines at Liverpool Street and Whitechapel", () => {
    const layout = new CorridorLayout(networkData);

    for (const stationId of ["liverpool-street", "whitechapel"]) {
      const groups = layout.getStationMarkerGroups(stationId);
      const elizabeth = groups.find((group) => group.lines.includes("elizabeth"));
      const other = groups.find((group) => !group.lines.includes("elizabeth"));

      expect(groups).toHaveLength(2);
      expect(elizabeth?.lines).toEqual(["elizabeth"]);
      expect(other?.lines.length).toBeGreaterThan(0);
      expect(elizabeth?.point.x).toBe(other?.point.x);
      expect(elizabeth?.point.y).toBe(other!.point.y - GRID_CELL_SIZE);
    }
  });

  it("renders Elizabeth one cell above the subsurface lines east of Liverpool Street", () => {
    const layout = new CorridorLayout(networkData);
    const elizabeth = renderedGridPoints(layout, "elizabeth", "liverpool-street", "whitechapel");
    const hammersmithCity = renderedGridPoints(
      layout,
      "hammersmith-city",
      "liverpool-street",
      "aldgate-east",
    );

    expect(elizabeth).toEqual([{ x: 92, y: -13 }, { x: 118, y: -13 }]);
    expect(hammersmithCity.every((point) => point.y === -12)).toBe(true);
  });

  it("renders Elizabeth west then diagonally from Canary Wharf to Whitechapel", () => {
    const layout = new CorridorLayout(networkData);

    expect(renderedDirectionRuns(
      layout,
      "elizabeth",
      "canary-wharf-elizabeth-line",
      "whitechapel",
    )).toEqual(["-1,0", "-1,-1"]);
  });

  it("makes Mile End a three-cell northwest-to-southeast conjoined marker", () => {
    const layout = new CorridorLayout(networkData);
    const groups = layout.getStationMarkerGroups("mile-end");
    const central = groups.find((group) => group.lines.includes("central"));
    const subsurface = groups.find((group) => group.lines.includes("district"));

    expect(groups).toHaveLength(2);
    expect(central?.lines).toEqual(["central"]);
    expect(subsurface?.lines).toEqual(["district", "hammersmith-city"]);
    expect(gridPointFromSvgPoint(central!.point)).toEqual({ x: 130, y: -14 });
    expect(gridPointFromSvgPoint(subsurface!.point)).toEqual({ x: 132, y: -12 });
    expect(Math.hypot(
      central!.point.x - subsurface!.point.x,
      central!.point.y - subsurface!.point.y,
    )).toBeCloseTo(GRID_CELL_SIZE * Math.SQRT2 * 2);
  });

  it("renders Elizabeth northeast from Whitechapel and above Mile End", () => {
    const layout = new CorridorLayout(networkData);
    const points = renderedGridPoints(layout, "elizabeth", "whitechapel", "stratford");

    expect(renderedDirectionRuns(layout, "elizabeth", "whitechapel", "stratford"))
      .toEqual(["1,-1", "1,0", "1,-1"]);
    expect(points.slice(1).some((point, index) => {
      const previous = points[index];
      return previous.y === -18 && point.y === -18 && previous.x <= 130 && point.x >= 130;
    })).toBe(true);
  });

  it("makes Stratford a horizontal Central and Elizabeth/Jubilee conjoined marker", () => {
    const layout = new CorridorLayout(networkData);
    const groups = layout.getStationMarkerGroups("stratford");
    const central = groups.find((group) => group.lines.includes("central"));
    const elizabethJubilee = groups.find((group) => group.lines.includes("elizabeth"));

    expect(groups).toHaveLength(2);
    expect(central?.lines).toEqual(["central"]);
    expect([...(elizabethJubilee?.lines ?? [])].sort()).toEqual(["elizabeth", "jubilee"]);
    expect(gridPointFromSvgPoint(central!.point)).toEqual({ x: 148, y: -30 });
    expect(gridPointFromSvgPoint(elizabethJubilee!.point)).toEqual({ x: 150, y: -30 });
  });

  it("renders Central collinear through the left Stratford marker into Leyton", () => {
    const layout = new CorridorLayout(networkData);
    const leyton = layout.getStationLinePoint("leyton", "central");

    expect(renderedGridPoints(layout, "central", "mile-end", "stratford")).toEqual([
      { x: 130, y: -14 },
      { x: 132, y: -14 },
      { x: 148, y: -30 },
    ]);
    expect(gridPointFromSvgPoint(leyton)).toEqual({ x: 153, y: -35 });
    expect(renderedDirectionRuns(layout, "central", "mile-end", "stratford"))
      .toEqual(["1,0", "1,-1"]);
    expect(renderedDirectionRuns(layout, "central", "stratford", "leyton"))
      .toEqual(["1,-1"]);
  });

  it("renders District and Hammersmith & City straight east from Stepney Green to Mile End", () => {
    const layout = new CorridorLayout(networkData);

    for (const line of ["district", "hammersmith-city"] as const) {
      expect(renderedGridPoints(layout, line, "stepney-green", "mile-end")).toEqual([
        { x: 128, y: -12 },
        { x: 132, y: -12 },
      ]);
      expect(renderedDirectionRuns(layout, line, "stepney-green", "mile-end"))
        .toEqual(["1,0"]);
    }
  });

  it("renders District and Hammersmith & City straight west from Bow Road to Mile End", () => {
    const layout = new CorridorLayout(networkData);

    for (const line of ["district", "hammersmith-city"] as const) {
      expect(renderedGridPoints(layout, line, "bow-road", "mile-end")).toEqual([
        { x: 136, y: -12 },
        { x: 132, y: -12 },
      ]);
      expect(renderedDirectionRuns(layout, line, "bow-road", "mile-end"))
        .toEqual(["-1,0"]);
    }
  });

  it("places Elizabeth northeast of the other lines at Bond Street and Tottenham Court Road", () => {
    const layout = new CorridorLayout(networkData);

    for (const stationId of ["bond-street", "tottenham-court-road"]) {
      const groups = layout.getStationMarkerGroups(stationId);
      const elizabeth = groups.find((group) => group.lines.includes("elizabeth"));
      const other = groups.find((group) => !group.lines.includes("elizabeth"));

      expect(groups).toHaveLength(2);
      expect(elizabeth?.lines).toEqual(["elizabeth"]);
      expect(elizabeth?.point.x).toBe(other!.point.x + GRID_CELL_SIZE);
      expect(elizabeth?.point.y).toBe(other!.point.y - GRID_CELL_SIZE);
    }
  });

  it("uses one shared lower marker at Waterloo", () => {
    const layout = new CorridorLayout(networkData);
    const groups = layout.getStationMarkerGroups("waterloo");

    expect(groups).toHaveLength(1);
    expect(groups[0].lines).toEqual(["bakerloo", "jubilee", "northern", "waterloo-city"]);
    expect(renderedDirectionRuns(layout, "jubilee", "westminster", "waterloo"))
      .toEqual(["1,1"]);
    expect(renderedDirectionRuns(layout, "northern", "embankment", "waterloo"))
      .toEqual(["0,1"]);
    expect(renderedDirectionRuns(layout, "waterloo-city", "bank", "waterloo"))
      .toEqual(["0,1", "-1,1", "-1,0"]);
  });

  it("renders Elizabeth one cell above between Bond Street and Tottenham Court Road", () => {
    const layout = new CorridorLayout(networkData);

    expect(renderedGridPoints(
      layout,
      "elizabeth",
      "bond-street",
      "tottenham-court-road",
    )).toEqual([
      { x: 45, y: -9 },
      { x: 63, y: -9 },
    ]);
    expect(renderedDirectionRuns(
      layout,
      "elizabeth",
      "bond-street",
      "tottenham-court-road",
    )).toEqual(["1,0"]);
  });

  it("renders Elizabeth west then northwest from Bond Street to Paddington", () => {
    const layout = new CorridorLayout(networkData);

    expect(renderedGridPoints(
      layout,
      "elizabeth",
      "bond-street",
      "paddington",
    )).toEqual([
      { x: 45, y: -9 },
      { x: 36, y: -9 },
      { x: 27, y: -18 },
      { x: 18, y: -18 },
    ]);
    expect(renderedDirectionRuns(
      layout,
      "elizabeth",
      "bond-street",
      "paddington",
    )).toEqual(["-1,0", "-1,-1", "-1,0"]);
  });

  it("makes Paddington a northwest-to-southeast Bakerloo and subsurface marker", () => {
    const layout = new CorridorLayout(networkData);
    const groups = layout.getStationMarkerGroups("paddington");
    const bakerloo = groups.find((group) => group.lines.includes("bakerloo"));
    const other = groups.find((group) => !group.lines.includes("bakerloo"));

    expect(groups).toHaveLength(2);
    expect(bakerloo?.lines).toEqual(["bakerloo"]);
    expect(other?.lines).toEqual(["circle", "district", "hammersmith-city", "elizabeth"]);
    expect(gridPointFromSvgPoint(bakerloo!.point)).toEqual({ x: 16, y: -20 });
    expect(gridPointFromSvgPoint(other!.point)).toEqual({ x: 18, y: -18 });
    expect(other!.point.x - bakerloo!.point.x).toBe(GRID_CELL_SIZE * 2);
    expect(other!.point.y - bakerloo!.point.y).toBe(GRID_CELL_SIZE * 2);
  });

  it("renders Bakerloo into the upper Paddington marker and onward to Warwick Avenue", () => {
    const layout = new CorridorLayout(networkData);

    expect(renderedGridPoints(layout, "bakerloo", "marylebone", "edgware-road-bakerloo"))
      .toEqual([{ x: 32, y: -24 }, { x: 24, y: -24 }]);
    expect(renderedGridPoints(layout, "bakerloo", "edgware-road-bakerloo", "paddington"))
      .toEqual([{ x: 24, y: -24 }, { x: 22, y: -24 }, { x: 18, y: -20 }, { x: 16, y: -20 }]);
    expect(renderedDirectionRuns(layout, "bakerloo", "edgware-road-bakerloo", "paddington"))
      .toEqual(["-1,0", "-1,1", "-1,0"]);
    expect(renderedGridPoints(layout, "bakerloo", "paddington", "warwick-avenue"))
      .toEqual([{ x: 16, y: -20 }, { x: 10, y: -20 }]);
    expect(renderedDirectionRuns(layout, "bakerloo", "paddington", "warwick-avenue"))
      .toEqual(["-1,0"]);
    expect(renderedGridPoints(layout, "bakerloo", "warwick-avenue", "maida-vale"))
      .toEqual([{ x: 10, y: -20 }, { x: 6, y: -20 }, { x: 4, y: -22 }]);
    expect(renderedGridPoints(layout, "bakerloo", "maida-vale", "kilburn-park"))
      .toEqual([{ x: 4, y: -22 }, { x: 0, y: -26 }]);
    expect(renderedGridPoints(layout, "bakerloo", "kilburn-park", "queen-s-park"))
      .toEqual([{ x: 0, y: -26 }, { x: -2, y: -28 }, { x: -2, y: -30 }]);
    expect(renderedGridPoints(layout, "bakerloo", "queen-s-park", "kensal-green"))
      .toEqual([{ x: -2, y: -30 }, { x: -2, y: -34 }]);
  });

  it("keeps every Tottenham Court Road exit visually clean after moving it east", () => {
    const layout = new CorridorLayout(networkData);

    expect(renderedDirectionRuns(layout, "central", "oxford-circus", "tottenham-court-road"))
      .toEqual(["1,0"]);
    expect(renderedDirectionRuns(layout, "central", "tottenham-court-road", "holborn"))
      .toEqual(["1,0"]);
    expect(renderedGridPoints(layout, "central", "holborn", "chancery-lane"))
      .toEqual([{ x: 72, y: -8 }, { x: 77, y: -8 }]);
    expect(renderedGridPoints(layout, "central", "chancery-lane", "st-paul-s"))
      .toEqual([{ x: 77, y: -8 }, { x: 83, y: -8 }]);
    expect(renderedGridPoints(layout, "central", "st-paul-s", "bank"))
      .toEqual([{ x: 83, y: -8 }, { x: 88, y: -8 }]);
    expect(renderedDirectionRuns(layout, "northern", "leicester-square", "tottenham-court-road"))
      .toEqual(["0,-1"]);
    expect(renderedDirectionRuns(layout, "northern", "tottenham-court-road", "goodge-street"))
      .toEqual(["0,-1"]);
    expect(renderedDirectionRuns(layout, "elizabeth", "bond-street", "tottenham-court-road"))
      .toEqual(["1,0"]);
    expect(renderedDirectionRuns(layout, "elizabeth", "farringdon", "tottenham-court-road"))
      .toEqual(["-1,0", "-1,1", "-1,0"]);
  });

  it("places the Ealing Common markers left and right", () => {
    const layout = new CorridorLayout(networkData);
    const district = layout.getStationLinePoint("ealing-common", "district");
    const piccadilly = layout.getStationLinePoint("ealing-common", "piccadilly");

    expect(district.x).toBe(piccadilly.x - GRID_CELL_SIZE);
    expect(district.y).toBe(piccadilly.y);
  });

  it("preserves requested branch directions from displaced conjoined markers", () => {
    const layout = new CorridorLayout(networkData);

    expect(renderedDirectionRuns(layout, "jubilee", "wembley-park", "kingsbury"))
      .toEqual(["-1,-1", "0,-1"]);
    expect(renderedDirectionRuns(layout, "district", "ealing-common", "ealing-broadway"))
      .toEqual(["0,-1", "-1,-1"]);
    expect(renderedDirectionRuns(layout, "district", "earl-s-court", "west-brompton"))
      .toEqual(["-1,1", "0,1"]);
    expect(renderedDirectionRuns(layout, "district", "earl-s-court", "kensington-olympia"))
      .toEqual(["-1,-1", "0,-1"]);
    expect(renderedDirectionRuns(layout, "district", "earl-s-court", "high-street-kensington"))
      .toEqual(["1,-1", "0,-1"]);
  });

  it("keeps a single explored High Street Kensington branch centred", () => {
    const layout = new CorridorLayout(networkData);
    const circle = findConnection("circle", "high-street-kensington", "gloucester-road");
    const district = findConnection("district", "high-street-kensington", "earl-s-court");
    const highStreetKensington = gridPointToSvgPoint({ x: 18, y: 4 });
    const verticalEndY = gridPointToSvgPoint({ x: 18, y: 11 }).y;

    for (const connection of [circle, district]) {
      const points = layout.getConnectionRenderPoints(connection, new Set([connection.id]));
      expect(points[0]).toEqual(highStreetKensington);
      expect(points[1]).toEqual({ x: highStreetKensington.x, y: verticalEndY });
    }
  });

  it("separates the District and Circle vertical approaches once both are explored", () => {
    const layout = new CorridorLayout(networkData);
    const circleConnection = findConnection("circle", "high-street-kensington", "gloucester-road");
    const districtConnection = findConnection("district", "high-street-kensington", "earl-s-court");
    const visibleConnectionIds = new Set([circleConnection.id, districtConnection.id]);
    const circle = layout.getConnectionRenderPoints(circleConnection, visibleConnectionIds);
    const district = layout.getConnectionRenderPoints(districtConnection, visibleConnectionIds);
    const highStreetKensington = gridPointToSvgPoint({ x: 18, y: 4 });
    const verticalEndY = gridPointToSvgPoint({ x: 18, y: 11 }).y;

    expect(circle[0].x).toBeCloseTo(highStreetKensington.x + LINE_STROKE_WIDTH / 2);
    expect(circle[0].y).toBe(highStreetKensington.y);
    expect(circle[1].x).toBeCloseTo(circle[0].x);
    expect(circle[1].y).toBe(verticalEndY);

    expect(district[0].x).toBeCloseTo(highStreetKensington.x - LINE_STROKE_WIDTH / 2);
    expect(district[0].y).toBe(highStreetKensington.y);
    expect(district[1].x).toBeCloseTo(district[0].x);
    expect(district[1].y).toBe(verticalEndY);

    expect(circle[0].x - district[0].x).toBeCloseTo(LINE_STROKE_WIDTH);
  });

  it("keeps the High Street Kensington reveal camera on the centreline", () => {
    const layout = new CorridorLayout(networkData);
    const circle = findConnection("circle", "high-street-kensington", "gloucester-road");
    const district = findConnection("district", "high-street-kensington", "earl-s-court");
    const highStreetKensington = gridPointToSvgPoint({ x: 18, y: 4 });
    const verticalEndY = gridPointToSvgPoint({ x: 18, y: 11 }).y;

    for (const connection of [circle, district]) {
      const points = layout.getConnectionCameraPoints(connection);
      expect(points[0]).toEqual(highStreetKensington);
      expect(points[1]).toEqual({ x: highStreetKensington.x, y: verticalEndY });
    }
  });

  it("keeps a single explored Green Park branch centred", () => {
    const layout = new CorridorLayout(networkData);
    const greenPark = gridPointToSvgPoint({ x: 44, y: 0 });
    const connectionIds = [
      "jubilee:bond-street:green-park",
      "jubilee:green-park:westminster",
      "victoria:green-park:oxford-circus",
      "victoria:green-park:victoria",
    ];

    for (const connectionId of connectionIds) {
      const connection = findConnectionById(connectionId);
      const points = layout.getConnectionRenderPoints(connection, new Set([connection.id]));
      expect(points.some((point) => point.x === greenPark.x && point.y === greenPark.y), connectionId)
        .toBe(true);
    }
  });

  it("separates Victoria left and Jubilee right below Green Park once both are explored", () => {
    const layout = new CorridorLayout(networkData);
    const jubilee = findConnection("jubilee", "green-park", "westminster");
    const victoria = findConnection("victoria", "green-park", "victoria");
    const visibleConnectionIds = new Set([jubilee.id, victoria.id]);
    const jubileePoints = layout.getConnectionRenderPoints(jubilee, visibleConnectionIds);
    const victoriaPoints = layout.getConnectionRenderPoints(victoria, visibleConnectionIds);
    const greenPark = gridPointToSvgPoint({ x: 44, y: 0 });
    const jubileeVerticalEndY = gridPointToSvgPoint({ x: 44, y: 3 }).y;
    const victoriaVerticalEndY = gridPointToSvgPoint({ x: 44, y: 8 }).y;
    const victoriaTransitionStartY = gridPointToSvgPoint({ x: 44, y: 9 }).y;

    expect(jubileePoints[0]).toEqual({ x: greenPark.x + LINE_STROKE_WIDTH / 2, y: greenPark.y });
    expect(jubileePoints[1]).toEqual({ x: greenPark.x + LINE_STROKE_WIDTH / 2, y: jubileeVerticalEndY });
    expect(jubileePoints).not.toContainEqual({ x: greenPark.x, y: gridPointToSvgPoint({ x: 44, y: 4 }).y });
    expect(victoriaPoints.at(-1)).toEqual({ x: greenPark.x - LINE_STROKE_WIDTH / 2, y: greenPark.y });
    expect(victoriaPoints.at(-2)).toEqual({ x: greenPark.x - LINE_STROKE_WIDTH / 2, y: victoriaVerticalEndY });
    expect(victoriaPoints.at(-3)).toEqual({ x: greenPark.x, y: victoriaTransitionStartY });
  });

  it("separates Jubilee left and Victoria right above Green Park once both are explored", () => {
    const layout = new CorridorLayout(networkData);
    const jubilee = findConnection("jubilee", "green-park", "bond-street");
    const victoria = findConnection("victoria", "green-park", "oxford-circus");
    const visibleConnectionIds = new Set([jubilee.id, victoria.id]);
    const jubileePoints = layout.getConnectionRenderPoints(jubilee, visibleConnectionIds);
    const victoriaPoints = layout.getConnectionRenderPoints(victoria, visibleConnectionIds);
    const greenPark = gridPointToSvgPoint({ x: 44, y: 0 });
    const jubileeVerticalEndY = gridPointToSvgPoint({ x: 44, y: -5 }).y;
    const jubileeTransitionEndY = gridPointToSvgPoint({ x: 44, y: -6 }).y;
    const victoriaVerticalEndY = gridPointToSvgPoint({ x: 44, y: -2 }).y;

    expect(jubileePoints[0]).toEqual({ x: greenPark.x - LINE_STROKE_WIDTH / 2, y: greenPark.y });
    expect(jubileePoints[1]).toEqual({ x: greenPark.x - LINE_STROKE_WIDTH / 2, y: jubileeVerticalEndY });
    expect(jubileePoints[2]).toEqual({ x: greenPark.x, y: jubileeTransitionEndY });
    expect(victoriaPoints[0]).toEqual({ x: greenPark.x + LINE_STROKE_WIDTH / 2, y: greenPark.y });
    expect(victoriaPoints[1]).toEqual({ x: greenPark.x + LINE_STROKE_WIDTH / 2, y: victoriaVerticalEndY });
    expect(victoriaPoints).not.toContainEqual({ x: greenPark.x, y: gridPointToSvgPoint({ x: 44, y: -3 }).y });
  });

  it("keeps a single explored Ealing Broadway east branch centred", () => {
    const layout = new CorridorLayout(networkData);
    const ealingBroadway = gridPointToSvgPoint({ x: -42, y: 0 });
    const sharedBranch = gridPointToSvgPoint({ x: -34, y: 0 });
    const central = findConnection("central", "ealing-broadway", "west-acton");
    const elizabeth = findConnection("elizabeth", "ealing-broadway", "acton-main-line");

    const centralPoints = layout.getConnectionRenderPoints(central, new Set([central.id]));
    expect(centralPoints).toContainEqual(ealingBroadway);
    expect(centralPoints.every((point) => point.y === ealingBroadway.y)).toBe(true);

    const elizabethPoints = layout.getConnectionRenderPoints(elizabeth, new Set([elizabeth.id]));
    expect(elizabethPoints).toContainEqual(ealingBroadway);
    expect(elizabethPoints).toContainEqual(sharedBranch);
  });

  it("separates Elizabeth above and Central below east of Ealing Broadway once both are explored", () => {
    const layout = new CorridorLayout(networkData);
    const central = findConnection("central", "ealing-broadway", "west-acton");
    const elizabeth = findConnection("elizabeth", "ealing-broadway", "acton-main-line");
    const visibleConnectionIds = new Set([central.id, elizabeth.id]);
    const centralPoints = layout.getConnectionRenderPoints(central, visibleConnectionIds);
    const elizabethPoints = layout.getConnectionRenderPoints(elizabeth, visibleConnectionIds);
    const ealingBroadway = gridPointToSvgPoint({ x: -42, y: 0 });
    const sharedBranch = gridPointToSvgPoint({ x: -34, y: 0 });
    const centralReturn = gridPointToSvgPoint({ x: -30, y: 0 });

    expect(elizabethPoints.at(-1)).toEqual({ x: ealingBroadway.x, y: ealingBroadway.y - LINE_STROKE_WIDTH / 2 });
    expect(elizabethPoints.at(-2)).toEqual({ x: sharedBranch.x, y: sharedBranch.y - LINE_STROKE_WIDTH / 2 });

    expect(centralPoints.at(-1)).toEqual({ x: ealingBroadway.x, y: ealingBroadway.y + LINE_STROKE_WIDTH / 2 });
    expect(centralPoints.at(-2)).toEqual({ x: sharedBranch.x, y: sharedBranch.y + LINE_STROKE_WIDTH / 2 });
    expect(centralPoints.at(-3)).toEqual(centralReturn);
  });

  it("keeps the Acton branches on the requested geometry", () => {
    const layout = new CorridorLayout(networkData);

    expect(renderedDirectionRuns(layout, "piccadilly", "acton-town", "ealing-common"))
      .toEqual(["-1,-1", "0,-1"]);
    expect(renderedDirectionRuns(layout, "district", "acton-town", "ealing-common"))
      .toEqual(["-1,-1", "0,-1"]);
    expect(renderedDirectionRuns(layout, "piccadilly", "acton-town", "south-ealing"))
      .toEqual(["-1,0", "-1,1"]);
  });

  it("renders the moved Sloane Square corridor straight from South Kensington", () => {
    const layout = new CorridorLayout(networkData);
    for (const line of ["circle", "district"] as const) {
      const connection = networkData.connections.find(
        (candidate) =>
          candidate.line === line &&
          candidate.from === "south-kensington" &&
          candidate.to === "sloane-square",
      );
      if (!connection) throw new Error(`Missing ${line} South Kensington connection`);
      const points = layout.getConnectionPoints(connection);
      const gridPoints = points.map((point) => ({
        x: (point.x - GRID_CELL_SIZE / 2) / GRID_CELL_SIZE,
        y: (point.y - GRID_CELL_SIZE / 2) / GRID_CELL_SIZE,
      }));

      expect(gridPoints).toEqual([
        { x: 28, y: 15 },
        { x: 38, y: 15 },
      ]);
    }
  });

  it("places every station marker on a grid-cell centre", () => {
    const layout = new CorridorLayout(networkData);

    for (const station of networkData.stations) {
      expect(
        layout.getStationMarkerGroups(station.id).every((group) => isCellCentre(group.point)),
        station.name,
      ).toBe(true);
    }
  });

  it("identifies both the anchored and displaced lines as corridor connections", () => {
    const layout = new CorridorLayout(networkData);
    const connections = networkData.connections.filter((connection) =>
      ["district", "piccadilly"].includes(connection.line) &&
      [connection.from, connection.to].includes("barons-court") &&
      [connection.from, connection.to].includes("hammersmith-district-and-piccadilly"),
    );

    expect(connections).toHaveLength(2);
    expect(connections.every((connection) => layout.isCorridorConnection(connection))).toBe(true);
  });

  it("keeps every separated shared track one cell from its neighbours", () => {
    const layout = new CorridorLayout(networkData);
    const offsetsByEdge = new Map<string, Map<string, number>>();
    for (const connection of networkData.connections.filter((candidate) => candidate.line !== "walk")) {
      const offsets = layout.getConnectionSegmentOffsets(connection);
      for (let index = 0; index < connection.path.length - 1; index += 1) {
        const from = connection.path[index];
        const to = connection.path[index + 1];
        if (!layout.getCorridorLines(from, to).includes(connection.line)) {
          continue;
        }
        const points = [from, to]
          .map((point) => `${point.x},${point.y}`)
          .sort();
        const key = points.join(";");
        const lineOffsets = offsetsByEdge.get(key) ?? new Map<string, number>();
        const canonicalOffset = from.x < to.x || (from.x === to.x && from.y <= to.y)
          ? offsets[index]
          : -offsets[index];
        lineOffsets.set(connection.line, canonicalOffset);
        offsetsByEdge.set(key, lineOffsets);
      }
    }

    for (const [edge, offsetsByLine] of offsetsByEdge) {
      const offsets = [...new Set(offsetsByLine.values())].sort((a, b) => a - b);
      if (offsets.length < 2 || offsets.every((offset) => offset === 0)) continue;
      for (let index = 1; index < offsets.length; index += 1) {
        const [firstPoint, secondPoint] = edge.split(";").map((point) => point.split(",").map(Number));
        const isDiagonal = firstPoint[0] !== secondPoint[0] && firstPoint[1] !== secondPoint[1];
        expect(
          offsets[index] - offsets[index - 1],
          `${edge}: ${JSON.stringify(Object.fromEntries(offsetsByLine))}`,
        ).toBe(isDiagonal ? GRID_CELL_SIZE * Math.SQRT2 : GRID_CELL_SIZE);
      }
    }
  });
});

function horizontalPath(fromX: number, toX: number): GridPoint[] {
  return Array.from({ length: toX - fromX + 1 }, (_, index) => ({ x: fromX + index, y: 0 }));
}

function isCellCentre(point: { x: number; y: number }): boolean {
  return (
    (point.x - GRID_CELL_SIZE / 2) % GRID_CELL_SIZE === 0 &&
    (point.y - GRID_CELL_SIZE / 2) % GRID_CELL_SIZE === 0
  );
}

function markerLines(layout: CorridorLayout, stationId: string): string[][] {
  return layout.getStationMarkerGroups(stationId)
    .sort((first, second) => first.point.y - second.point.y || first.point.x - second.point.x)
    .map((group) => [...group.lines].sort());
}

function renderedDirectionRuns(
  layout: CorridorLayout,
  line: string,
  from: string,
  to: string,
): string[] {
  const connection = networkData.connections.find(
    (candidate) =>
      candidate.line === line &&
      ((candidate.from === from && candidate.to === to) ||
        (candidate.from === to && candidate.to === from)),
  );
  if (!connection) throw new Error(`Missing ${line} connection ${from} -> ${to}`);
  const points = connection.from === from
    ? layout.getConnectionPoints(connection)
    : [...layout.getConnectionPoints(connection)].reverse();
  return points.slice(1)
    .map((point, index) => `${Math.sign(point.x - points[index].x)},${Math.sign(point.y - points[index].y)}`)
    .filter((direction, index, all) => index === 0 || direction !== all[index - 1]);
}

function renderedGridPoints(
  layout: CorridorLayout,
  line: string,
  from: string,
  to: string,
): GridPoint[] {
  const connection = networkData.connections.find(
    (candidate) =>
      candidate.line === line &&
      ((candidate.from === from && candidate.to === to) ||
        (candidate.from === to && candidate.to === from)),
  );
  if (!connection) throw new Error(`Missing ${line} connection ${from} -> ${to}`);
  const points = connection.from === from
    ? layout.getConnectionPoints(connection)
    : [...layout.getConnectionPoints(connection)].reverse();
  return points.map((point) => ({
    x: (point.x - GRID_CELL_SIZE / 2) / GRID_CELL_SIZE,
    y: (point.y - GRID_CELL_SIZE / 2) / GRID_CELL_SIZE,
  }));
}

function findConnection(
  line: string,
  from: string,
  to: string,
) {
  const connection = networkData.connections.find(
    (candidate) =>
      candidate.line === line &&
      ((candidate.from === from && candidate.to === to) ||
        (candidate.from === to && candidate.to === from)),
  );
  if (!connection) throw new Error(`Missing ${line} connection ${from} -> ${to}`);
  return connection;
}

function findConnectionById(connectionId: string) {
  const connection = networkData.connections.find((candidate) => candidate.id === connectionId);
  if (!connection) throw new Error(`Missing connection ${connectionId}`);
  return connection;
}

function gridPointFromSvgPoint(point: { x: number; y: number }): GridPoint {
  return {
    x: (point.x - GRID_CELL_SIZE / 2) / GRID_CELL_SIZE,
    y: (point.y - GRID_CELL_SIZE / 2) / GRID_CELL_SIZE,
  };
}
