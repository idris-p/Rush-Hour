import { describe, expect, it } from "vitest";
import { LINE_BY_ID } from "./lines";
import { riverThamesPath, validateRiverThamesPath } from "./mapDecorations";
import { networkData } from "./network";
import { getRiverRenderPoints } from "../rendering/riverRenderer";

describe("map decorations", () => {
  it("has valid generated River Thames geometry", () => {
    expect(riverThamesPath.length).toBeGreaterThan(200);
    expect(validateRiverThamesPath(riverThamesPath)).toEqual([]);
  });

  it("allows a 90 degree river turn", () => {
    expect(validateRiverThamesPath([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }])).toEqual([]);
  });

  it("rejects river turns sharper than 90 degrees", () => {
    expect(
      validateRiverThamesPath([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]),
    ).toContain("River Thames has illegal turn at path point 1");
  });

  it("keeps the river outside all playable network data", () => {
    expect("river" in LINE_BY_ID).toBe(false);
    expect(networkData.connections.some((connection) => String(connection.line) === "river")).toBe(false);
    expect(networkData.stations.some((station) => station.lines.some((line) => String(line) === "river"))).toBe(false);
  });

  it("extends the river beyond both horizontal viewport edges", () => {
    const viewBox = { x: -4_000, y: -500, width: 8_000, height: 1_000 };
    const points = getRiverRenderPoints(viewBox);

    expect(points[0].x).toBeLessThan(viewBox.x);
    expect(points.at(-1)?.x).toBeGreaterThan(viewBox.x + viewBox.width);
  });
});
