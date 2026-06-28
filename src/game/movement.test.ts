import { describe, expect, it } from "vitest";
import { createGameState } from "./GameState";
import {
  angleBetweenPoints,
  attemptMove,
  directionFromVelocity,
  findDirectionalNeighbour,
  getStation,
  snapAngleToDirection,
} from "./movement";
import { cycleSelectedLine, getLineCyclePreview } from "./lineSelection";
import type { NetworkData } from "../data/types";
import { networkData } from "../data/network";

const testLabelOffset = { x: 28, y: -24 };

const testNetwork: NetworkData = {
  temporary: true,
  notes: [],
  stations: [
    { id: "a", name: "A", x: 0, y: 0, labelOffset: testLabelOffset, lines: ["central", "victoria"] },
    { id: "b", name: "B", x: 2, y: -1, labelOffset: testLabelOffset, lines: ["central"] },
    { id: "c", name: "C", x: 0, y: 1, labelOffset: testLabelOffset, lines: ["victoria"] },
    { id: "d", name: "D", x: 3, y: -1, labelOffset: testLabelOffset, lines: ["central"] },
  ],
  connections: [
    { id: "central:a:b", from: "a", to: "b", line: "central", path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: -1 }] },
    { id: "central:b:d", from: "b", to: "d", line: "central", path: [{ x: 2, y: -1 }, { x: 3, y: -1 }] },
    { id: "victoria:a:c", from: "a", to: "c", line: "victoria", path: [{ x: 0, y: 0 }, { x: 0, y: 1 }] },
  ],
};

describe("movement", () => {
  it("snaps pointer angles to the eight tube-map directions", () => {
    expect(snapAngleToDirection(0)).toBe("east");
    expect(snapAngleToDirection(45)).toBe("southeast");
    expect(snapAngleToDirection(90)).toBe("south");
    expect(snapAngleToDirection(135)).toBe("southwest");
    expect(snapAngleToDirection(180)).toBe("west");
    expect(snapAngleToDirection(225)).toBe("northwest");
    expect(snapAngleToDirection(270)).toBe("north");
    expect(snapAngleToDirection(315)).toBe("northeast");
  });

  it("snaps mouse velocity to direction and preserves latest direction when velocity is zero", () => {
    expect(directionFromVelocity(12, 0, "north")).toBe("east");
    expect(directionFromVelocity(8, -8, "south")).toBe("northeast");
    expect(directionFromVelocity(0, 0, "southwest")).toBe("southwest");
  });

  it("finds the line neighbour closest to the intended direction", () => {
    const target = findDirectionalNeighbour(testNetwork, "a", "central", "east");

    expect(target?.id).toBe("b");
  });

  it("rejects movement outside the selected grid direction", () => {
    const state = {
      ...createGameState("movement-reject", testNetwork, 0),
      startStationId: "a",
      destinationStationId: "d",
      currentStationId: "a",
      selectedLineId: "central" as const,
    };

    const result = attemptMove(state, testNetwork, 90, 100);

    expect(result.moved).toBe(false);
    expect(result.state.currentStationId).toBe("a");
    expect(result.state.moveCount).toBe(0);
  });

  it("rejects neighbours that are outside the selected compass direction", () => {
    const state = {
      ...createGameState("movement-snapped-reject", testNetwork, 0),
      startStationId: "a",
      destinationStationId: "d",
      currentStationId: "a",
      selectedLineId: "central" as const,
    };

    const result = attemptMove(state, testNetwork, 24, 100);

    expect(snapAngleToDirection(24)).toBe("southeast");
    expect(result.moved).toBe(false);
    expect(result.reason).toBe("direction-mismatch");
  });

  it("uses the first grid step rather than the overall station direction", () => {
    const state = {
      ...createGameState("movement-first-step", testNetwork, 0),
      startStationId: "a",
      destinationStationId: "d",
      currentStationId: "a",
      selectedLineId: "central" as const,
    };

    const current = getStation(testNetwork, "a");
    const target = getStation(testNetwork, "b");
    const overallDirection = angleBetweenPoints(current, target);

    expect(snapAngleToDirection(overallDirection)).toBe("northeast");
    expect(attemptMove(state, testNetwork, overallDirection, 100).moved).toBe(false);
    expect(attemptMove(state, testNetwork, 0, 100).targetStationId).toBe("b");
  });

  it("requires north to travel from Baker Street to St John's Wood", () => {
    expect(findDirectionalNeighbour(networkData, "baker-street", "jubilee", "north")?.id)
      .toBe("st-john-s-wood");
    expect(findDirectionalNeighbour(networkData, "baker-street", "jubilee", "west"))
      .toBeNull();
  });

  it("requires northwest from Baker Street to Finchley Road on the Metropolitan line", () => {
    expect(findDirectionalNeighbour(networkData, "baker-street", "metropolitan", "northwest")?.id)
      .toBe("finchley-road");
    expect(findDirectionalNeighbour(networkData, "baker-street", "metropolitan", "west"))
      .toBeNull();
  });

  it("matches clicks to the Jubilee branch from Wembley Park to Stanmore", () => {
    expect(findDirectionalNeighbour(networkData, "wembley-park", "jubilee", "northwest")?.id)
      .toBe("kingsbury");
    expect(findDirectionalNeighbour(networkData, "kingsbury", "jubilee", "south")?.id)
      .toBe("wembley-park");
    expect(findDirectionalNeighbour(networkData, "kingsbury", "jubilee", "north")?.id)
      .toBe("queensbury");
    expect(findDirectionalNeighbour(networkData, "queensbury", "jubilee", "north")?.id)
      .toBe("canons-park");
    expect(findDirectionalNeighbour(networkData, "canons-park", "jubilee", "north")?.id)
      .toBe("stanmore");
  });

  it("requires northwest from Canary Wharf to Whitechapel on the Elizabeth line", () => {
    expect(findDirectionalNeighbour(
      networkData,
      "canary-wharf-elizabeth-line",
      "elizabeth",
      "northwest",
    )?.id).toBe("whitechapel");
    expect(findDirectionalNeighbour(
      networkData,
      "canary-wharf-elizabeth-line",
      "elizabeth",
      "west",
    )).toBeNull();
  });

  it("matches Tottenham Court Road clicks to the displayed line exits", () => {
    expect(findDirectionalNeighbour(networkData, "tottenham-court-road", "central", "west")?.id)
      .toBe("oxford-circus");
    expect(findDirectionalNeighbour(networkData, "tottenham-court-road", "central", "east")?.id)
      .toBe("holborn");
    expect(findDirectionalNeighbour(networkData, "tottenham-court-road", "northern", "south")?.id)
      .toBe("leicester-square");
    expect(findDirectionalNeighbour(networkData, "tottenham-court-road", "northern", "north")?.id)
      .toBe("goodge-street");
    expect(findDirectionalNeighbour(networkData, "tottenham-court-road", "elizabeth", "west")?.id)
      .toBe("bond-street");
    expect(findDirectionalNeighbour(networkData, "tottenham-court-road", "elizabeth", "east")?.id)
      .toBe("farringdon");
    expect(findDirectionalNeighbour(networkData, "bond-street", "elizabeth", "west")?.id)
      .toBe("paddington");
  });

  it("matches clicks to the Elizabeth line branch from Maryland to Shenfield", () => {
    expect(findDirectionalNeighbour(networkData, "maryland", "elizabeth", "northeast")?.id)
      .toBe("forest-gate");
    expect(findDirectionalNeighbour(networkData, "forest-gate", "elizabeth", "east")?.id)
      .toBe("manor-park");
    expect(findDirectionalNeighbour(networkData, "manor-park", "elizabeth", "east")?.id)
      .toBe("ilford");
    expect(findDirectionalNeighbour(networkData, "ilford", "elizabeth", "east")?.id)
      .toBe("seven-kings");
    expect(findDirectionalNeighbour(networkData, "seven-kings", "elizabeth", "east")?.id)
      .toBe("goodmayes");
    expect(findDirectionalNeighbour(networkData, "goodmayes", "elizabeth", "northeast")?.id)
      .toBe("chadwell-heath");
    expect(findDirectionalNeighbour(networkData, "chadwell-heath", "elizabeth", "northeast")?.id)
      .toBe("romford");
    expect(findDirectionalNeighbour(networkData, "brentwood", "elizabeth", "northeast")?.id)
      .toBe("shenfield");
  });

  it("uses northwest from Camden Town toward the Edgware branch", () => {
    expect(findDirectionalNeighbour(networkData, "camden-town", "northern", "northwest")?.id)
      .toBe("chalk-farm");
    expect(findDirectionalNeighbour(networkData, "camden-town", "northern", "north"))
      .toBeNull();
  });

  it("matches clicks to the updated Bakerloo geometry", () => {
    expect(findDirectionalNeighbour(networkData, "baker-street", "bakerloo", "southeast")?.id)
      .toBe("regent-s-park");
    expect(findDirectionalNeighbour(networkData, "regent-s-park", "bakerloo", "northwest")?.id)
      .toBe("baker-street");
    expect(findDirectionalNeighbour(networkData, "regent-s-park", "bakerloo", "southeast")?.id)
      .toBe("oxford-circus");
    expect(findDirectionalNeighbour(networkData, "lambeth-north", "bakerloo", "northwest")?.id)
      .toBe("waterloo");
    expect(findDirectionalNeighbour(networkData, "edgware-road-bakerloo", "bakerloo", "west")?.id)
      .toBe("paddington");
    expect(findDirectionalNeighbour(networkData, "paddington", "bakerloo", "east")?.id)
      .toBe("edgware-road-bakerloo");
    expect(findDirectionalNeighbour(networkData, "paddington", "bakerloo", "west")?.id)
      .toBe("warwick-avenue");
    expect(findDirectionalNeighbour(networkData, "warwick-avenue", "bakerloo", "east")?.id)
      .toBe("paddington");
    expect(findDirectionalNeighbour(networkData, "warwick-avenue", "bakerloo", "west")?.id)
      .toBe("maida-vale");
  });

  it("matches clicks to the updated Russell Square and Westminster routes", () => {
    expect(findDirectionalNeighbour(networkData, "russell-square", "piccadilly", "south")?.id)
      .toBe("holborn");
    expect(findDirectionalNeighbour(networkData, "russell-square", "piccadilly", "north")?.id)
      .toBe("king-s-cross-st-pancras");
    expect(findDirectionalNeighbour(networkData, "westminster", "jubilee", "north")?.id)
      .toBe("green-park");
    expect(findDirectionalNeighbour(networkData, "westminster", "jubilee", "northwest"))
      .toBeNull();
  });

  it("matches clicks to the conjoined Central marker at Stratford", () => {
    expect(findDirectionalNeighbour(networkData, "stratford", "central", "northeast")?.id)
      .toBe("leyton");
    expect(findDirectionalNeighbour(networkData, "stratford", "central", "southwest")?.id)
      .toBe("mile-end");
  });

  it("enforces the one-way Piccadilly Heathrow Terminal 4 loop", () => {
    expect(findDirectionalNeighbour(networkData, "hatton-cross", "piccadilly", "south")?.id)
      .toBe("heathrow-terminal-4");
    expect(findDirectionalNeighbour(networkData, "heathrow-terminal-4", "piccadilly", "west")?.id)
      .toBe("heathrow-terminal-2-and-3");
    expect(findDirectionalNeighbour(networkData, "heathrow-terminal-2-and-3", "piccadilly", "south"))
      .toBeNull();
    expect(findDirectionalNeighbour(networkData, "heathrow-terminal-4", "piccadilly", "west"))
      .not.toMatchObject({ id: "hatton-cross" });
    expect(findDirectionalNeighbour(networkData, "hatton-cross", "piccadilly", "southwest")?.id)
      .toBe("heathrow-terminal-2-and-3");
    expect(findDirectionalNeighbour(networkData, "heathrow-terminal-2-and-3", "piccadilly", "southwest")?.id)
      .toBe("heathrow-terminal-5");
  });

  it("uses one shared lower Waterloo marker for every line", () => {
    expect(findDirectionalNeighbour(networkData, "waterloo", "jubilee", "northwest")?.id)
      .toBe("westminster");
    expect(findDirectionalNeighbour(networkData, "waterloo", "bakerloo", "north")?.id)
      .toBe("embankment");
    expect(findDirectionalNeighbour(networkData, "waterloo", "northern", "north")?.id)
      .toBe("embankment");
    expect(findDirectionalNeighbour(networkData, "waterloo", "waterloo-city", "east")?.id)
      .toBe("bank");
  });

  it("matches clicks to the conjoined Bank markers", () => {
    expect(findDirectionalNeighbour(networkData, "bank", "central", "west")?.id)
      .toBe("st-paul-s");
    expect(findDirectionalNeighbour(networkData, "bank", "waterloo-city", "south")?.id)
      .toBe("waterloo");
    expect(findDirectionalNeighbour(networkData, "bank", "northern", "north")?.id)
      .toBe("moorgate");
    expect(findDirectionalNeighbour(networkData, "moorgate", "northern", "south")?.id)
      .toBe("bank");
    expect(findDirectionalNeighbour(networkData, "bank", "northern", "south")?.id)
      .toBe("london-bridge");
    expect(findDirectionalNeighbour(networkData, "bank", "walk", "southeast")?.id)
      .toBe("monument");
  });

  it("requires west from Sloane Square to South Kensington", () => {
    for (const line of ["circle", "district"] as const) {
      expect(findDirectionalNeighbour(networkData, "sloane-square", line, "west")?.id)
        .toBe("south-kensington");
      expect(findDirectionalNeighbour(networkData, "sloane-square", line, "northwest"))
        .toBeNull();
    }
  });

  it("matches clicks to the Royal Oak and Paddington shared Circle and Hammersmith & City route", () => {
    for (const line of ["circle", "hammersmith-city"] as const) {
      expect(findDirectionalNeighbour(networkData, "royal-oak", line, "northeast")?.id)
        .toBe("paddington");
      expect(findDirectionalNeighbour(networkData, "paddington", line, "southwest")?.id)
        .toBe("royal-oak");
    }
  });

  it("uses northeast from Warren Street into the Euston Victoria marker", () => {
    expect(findDirectionalNeighbour(networkData, "warren-street", "victoria", "northeast")?.id)
      .toBe("euston");
    expect(findDirectionalNeighbour(networkData, "euston", "victoria", "southwest")?.id)
      .toBe("warren-street");
  });

  it("uses east from Euston into the King's Cross St Pancras Victoria marker", () => {
    expect(findDirectionalNeighbour(networkData, "euston", "victoria", "east")?.id)
      .toBe("king-s-cross-st-pancras");
    expect(findDirectionalNeighbour(networkData, "king-s-cross-st-pancras", "victoria", "west")?.id)
      .toBe("euston");
  });

  it("matches clicks to the Northern route through Angel, King's Cross, and Euston", () => {
    expect(findDirectionalNeighbour(networkData, "angel", "northern", "west")?.id)
      .toBe("king-s-cross-st-pancras");
    expect(findDirectionalNeighbour(networkData, "king-s-cross-st-pancras", "northern", "southeast")?.id)
      .toBe("angel");
    expect(findDirectionalNeighbour(networkData, "king-s-cross-st-pancras", "northern", "northwest")?.id)
      .toBe("euston");
    expect(findDirectionalNeighbour(networkData, "euston", "northern", "east")?.id)
      .toBe("king-s-cross-st-pancras");
  });

  it("matches clicks to the Piccadilly and Victoria Finsbury Park corridor", () => {
    expect(findDirectionalNeighbour(networkData, "king-s-cross-st-pancras", "piccadilly", "north")?.id)
      .toBe("caledonian-road");
    expect(findDirectionalNeighbour(networkData, "king-s-cross-st-pancras", "victoria", "east")?.id)
      .toBe("highbury-and-islington");
    expect(findDirectionalNeighbour(networkData, "highbury-and-islington", "victoria", "south")?.id)
      .toBe("king-s-cross-st-pancras");
    expect(findDirectionalNeighbour(networkData, "highbury-and-islington", "victoria", "north")?.id)
      .toBe("finsbury-park");
    expect(findDirectionalNeighbour(networkData, "finsbury-park", "piccadilly", "northeast")?.id)
      .toBe("manor-house");
    expect(findDirectionalNeighbour(networkData, "finsbury-park", "victoria", "northeast")?.id)
      .toBe("seven-sisters");
    expect(findDirectionalNeighbour(networkData, "seven-sisters", "victoria", "west")?.id)
      .toBe("finsbury-park");
    expect(findDirectionalNeighbour(networkData, "seven-sisters", "victoria", "east")?.id)
      .toBe("tottenham-hale");
    expect(findDirectionalNeighbour(networkData, "tottenham-hale", "victoria", "east")?.id)
      .toBe("blackhorse-road");
    expect(findDirectionalNeighbour(networkData, "blackhorse-road", "victoria", "east")?.id)
      .toBe("walthamstow-central");
    expect(findDirectionalNeighbour(networkData, "finsbury-park", "victoria", "southwest")?.id)
      .toBe("highbury-and-islington");
    expect(findDirectionalNeighbour(networkData, "finsbury-park", "victoria", "south"))
      .toBeNull();
  });

  it("uses southwest from Turnham Green onto the aligned Richmond branch", () => {
    expect(findDirectionalNeighbour(networkData, "turnham-green", "district", "southwest")?.id)
      .toBe("gunnersbury");
  });

  it("moves along connected stations and reveals the travelled connection", () => {
    const state = {
      ...createGameState("movement-accept", testNetwork, 0),
      startStationId: "a",
      destinationStationId: "d",
      currentStationId: "a",
      selectedLineId: "central" as const,
    };

    const result = attemptMove(state, testNetwork, 0, 100);

    expect(result.moved).toBe(true);
    expect(result.state.currentStationId).toBe("b");
    expect(result.state.moveCount).toBe(1);
    expect(result.state.revealedConnections.has("central:a:b")).toBe(true);
  });

  it("counts line changes only when leaving an entered station on a different line", () => {
    const transferNetwork: NetworkData = {
      temporary: true,
      notes: [],
      stations: [
        { id: "a", name: "A", x: 0, y: 0, labelOffset: testLabelOffset, lines: ["central", "victoria"] },
        { id: "b", name: "B", x: 2, y: 0, labelOffset: testLabelOffset, lines: ["central", "victoria"] },
        { id: "c", name: "C", x: 2, y: 2, labelOffset: testLabelOffset, lines: ["victoria"] },
      ],
      connections: [
        { id: "central:a:b", from: "a", to: "b", line: "central", path: [{ x: 0, y: 0 }, { x: 2, y: 0 }] },
        { id: "victoria:b:c", from: "b", to: "c", line: "victoria", path: [{ x: 2, y: 0 }, { x: 2, y: 2 }] },
      ],
    };
    const start = {
      ...createGameState("change-count", transferNetwork, 0),
      startStationId: "a",
      destinationStationId: "c",
      currentStationId: "a",
      selectedLineId: "central" as const,
    };

    const enteredInterchange = attemptMove(start, transferNetwork, 0, 100).state;
    const switchedLine = cycleSelectedLine(enteredInterchange, transferNetwork, 1);
    const result = attemptMove(switchedLine, transferNetwork, 90, 200);

    expect(enteredInterchange.changeCount).toBe(0);
    expect(result.state.changeCount).toBe(1);
  });

  it("does not count a line change when leaving the start station", () => {
    const state = {
      ...createGameState("start-change", testNetwork, 0),
      startStationId: "a",
      destinationStationId: "c",
      currentStationId: "a",
      selectedLineId: "victoria" as const,
    };

    const result = attemptMove(state, testNetwork, 90, 100);

    expect(result.moved).toBe(true);
    expect(result.state.changeCount).toBe(0);
  });

  it("does not count changing from a tube line to walking", () => {
    const transferNetwork: NetworkData = {
      temporary: true,
      notes: [],
      stations: [
        { id: "a", name: "A", x: 0, y: -2, labelOffset: testLabelOffset, lines: ["central"] },
        { id: "bank", name: "Bank", x: 0, y: 0, labelOffset: testLabelOffset, lines: ["central", "walk"] },
        { id: "monument", name: "Monument", x: 2, y: 0, labelOffset: testLabelOffset, lines: ["walk"] },
      ],
      connections: [
        { id: "central:a:bank", from: "a", to: "bank", line: "central", path: [{ x: 0, y: -2 }, { x: 0, y: 0 }] },
        { id: "walk:bank:monument", from: "bank", to: "monument", line: "walk", path: [{ x: 0, y: 0 }, { x: 2, y: 0 }] },
      ],
    };
    const start = {
      ...createGameState("tube-to-walk", transferNetwork, 0),
      startStationId: "a",
      destinationStationId: "monument",
      currentStationId: "a",
      selectedLineId: "central" as const,
    };

    const enteredByTube = attemptMove(start, transferNetwork, 90, 100).state;
    const walking = { ...enteredByTube, selectedLineId: "walk" as const };
    const result = attemptMove(walking, transferNetwork, 0, 200);

    expect(result.moved).toBe(true);
    expect(result.state.changeCount).toBe(0);
  });

  it("counts changing from walking to a tube line", () => {
    const transferNetwork: NetworkData = {
      temporary: true,
      notes: [],
      stations: [
        { id: "a", name: "A", x: 0, y: -2, labelOffset: testLabelOffset, lines: ["central"] },
        { id: "bank", name: "Bank", x: 0, y: 0, labelOffset: testLabelOffset, lines: ["central", "walk"] },
        { id: "monument", name: "Monument", x: 2, y: 0, labelOffset: testLabelOffset, lines: ["walk"] },
      ],
      connections: [
        { id: "central:a:bank", from: "a", to: "bank", line: "central", path: [{ x: 0, y: -2 }, { x: 0, y: 0 }] },
        { id: "walk:bank:monument", from: "bank", to: "monument", line: "walk", path: [{ x: 0, y: 0 }, { x: 2, y: 0 }] },
      ],
    };
    const start = {
      ...createGameState("walk-to-tube", transferNetwork, 0),
      startStationId: "monument",
      destinationStationId: "a",
      currentStationId: "monument",
      selectedLineId: "walk" as const,
    };

    const enteredByWalking = attemptMove(start, transferNetwork, 180, 100).state;
    const tube = { ...enteredByWalking, selectedLineId: "central" as const };
    const result = attemptMove(tube, transferNetwork, 270, 200);

    expect(result.moved).toBe(true);
    expect(result.state.changeCount).toBe(1);
  });

  it("marks the run complete when reaching the destination", () => {
    const state = {
      ...createGameState("movement-complete", testNetwork, 0),
      startStationId: "a",
      destinationStationId: "b",
      currentStationId: "a",
      selectedLineId: "central" as const,
    };

    const result = attemptMove(state, testNetwork, 0, 250);

    expect(result.state.completed).toBe(true);
    expect(result.state.endTime).toBe(250);
  });
});

describe("line selection", () => {
  it("cycles only through lines served by the current station", () => {
    const state = {
      ...createGameState("line-cycle", testNetwork, 0),
      currentStationId: "a",
      selectedLineId: "central" as const,
    };

    const next = cycleSelectedLine(state, testNetwork, 1);

    expect(next.selectedLineId).toBe("victoria");
  });

  it("previews the previous and next lines for A and D", () => {
    const state = {
      ...createGameState("line-preview", testNetwork, 0),
      currentStationId: "a",
      selectedLineId: "central" as const,
    };

    expect(getLineCyclePreview(state, testNetwork)).toEqual({
      previous: "victoria",
      current: "central",
      next: "victoria",
      lineCount: 2,
    });
  });

  it("selects and traverses a walk connection", () => {
    const walkNetwork: NetworkData = {
      temporary: true,
      notes: [],
      stations: [
        { id: "bank", name: "Bank", x: 0, y: 0, labelOffset: testLabelOffset, lines: ["central", "walk"] },
        { id: "monument", name: "Monument", x: 2, y: 0, labelOffset: testLabelOffset, lines: ["district", "walk"] },
      ],
      connections: [
        { id: "walk:bank:monument", from: "bank", to: "monument", line: "walk", path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] },
      ],
    };
    const initial = {
      ...createGameState("walk", walkNetwork, 0),
      startStationId: "bank",
      destinationStationId: "monument",
      currentStationId: "bank",
      selectedLineId: "central" as const,
    };
    const walking = cycleSelectedLine(initial, walkNetwork, 1);
    const result = attemptMove(walking, walkNetwork, 0, 100);

    expect(walking.selectedLineId).toBe("walk");
    expect(result.moved).toBe(true);
    expect(result.targetStationId).toBe("monument");
  });
});
