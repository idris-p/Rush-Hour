export type ExistingLineId =
  | "bakerloo"
  | "central"
  | "circle"
  | "district"
  | "hammersmith-city"
  | "jubilee"
  | "metropolitan"
  | "northern"
  | "piccadilly"
  | "victoria"
  | "waterloo-city"
  | "elizabeth";

export type LineId = ExistingLineId | "walk";

export type ModeId = "tube" | "elizabeth" | "walk";

export type LineDefinition = {
  id: LineId;
  name: string;
  color: string;
  textColor: string;
  mode: ModeId;
};

export type Station = {
  id: string;
  name: string;
  x: number;
  y: number;
  lines: LineId[];
};

export type StationSeed = Omit<Station, "lines">;

export type GridPoint = {
  x: number;
  y: number;
};

export type Connection = {
  id: string;
  from: string;
  to: string;
  line: LineId;
  path: GridPoint[];
  oneWay?: boolean;
  directionOverrides?: {
    from?: GridPoint;
    to?: GridPoint;
  };
};

export type ConnectionSeed = Omit<Connection, "id" | "path" | "directionOverrides"> & {
  path?: GridPoint[];
};

export type NetworkData = {
  stations: Station[];
  connections: Connection[];
  temporary: boolean;
  notes: string[];
};

export type Point = {
  x: number;
  y: number;
};
