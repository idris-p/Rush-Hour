import type { LineDefinition, LineId } from "./types";

export const LINES: LineDefinition[] = [
  { id: "bakerloo", name: "Bakerloo", color: "#B36305", textColor: "#ffffff", mode: "tube" },
  { id: "central", name: "Central", color: "#E32017", textColor: "#ffffff", mode: "tube" },
  { id: "circle", name: "Circle", color: "#FFD300", textColor: "#111111", mode: "tube" },
  { id: "district", name: "District", color: "#00782A", textColor: "#ffffff", mode: "tube" },
  {
    id: "hammersmith-city",
    name: "Hammersmith & City",
    color: "#F3A9BB",
    textColor: "#111111",
    mode: "tube",
  },
  { id: "jubilee", name: "Jubilee", color: "#A0A5A9", textColor: "#111111", mode: "tube" },
  { id: "metropolitan", name: "Metropolitan", color: "#9B0056", textColor: "#ffffff", mode: "tube" },
  { id: "northern", name: "Northern", color: "#000000", textColor: "#ffffff", mode: "tube" },
  { id: "piccadilly", name: "Piccadilly", color: "#003688", textColor: "#ffffff", mode: "tube" },
  { id: "victoria", name: "Victoria", color: "#0098D4", textColor: "#111111", mode: "tube" },
  { id: "waterloo-city", name: "Waterloo & City", color: "#95CDBA", textColor: "#111111", mode: "tube" },
  { id: "elizabeth", name: "Elizabeth line", color: "#6950A1", textColor: "#ffffff", mode: "elizabeth" },
];

export const LINE_ORDER: LineId[] = LINES.map((line) => line.id);

export const LINE_BY_ID: Record<LineId, LineDefinition> = Object.fromEntries(
  LINES.map((line) => [line.id, line]),
) as Record<LineId, LineDefinition>;

export function compareLineIds(a: LineId, b: LineId): number {
  return LINE_ORDER.indexOf(a) - LINE_ORDER.indexOf(b);
}
