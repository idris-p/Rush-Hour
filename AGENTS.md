# AGENTS.md

## Project Overview

This project is a TypeScript-based game called **London Underground and TfL Network Speedrun Game**.

The game generates a random seed that determines a start station and destination station. The player begins at the start station and must navigate the London Underground and wider TfL rail network as quickly as possible.

The game should be based on the real TfL network and should accurately represent:

* London Underground
* Elizabeth line

Do **not** include London Trams.

## Core Gameplay

At the start of a run:

* A random seed is generated.
* The seed determines:

  * The start station
  * The destination station
* The player is placed at the start station.
* The screen shows a zoomed-in tube-map-style view.
* All lines are initially hidden.
* Only the current station marker is visible.

The player’s goal is to reach the destination station as quickly as possible.

## Controls

### Line Selection

The player can cycle through available lines at their current station using:

* `A` — previous available line
* `D` — next available line

The currently selected line should be shown using an icon or label in the top-right corner of the screen.

Only lines that actually serve the current station should be selectable.

### Movement Direction

The mouse cursor acts as a directional arrow.

* The arrow points away from the current station marker.
* Moving the mouse radially around the station changes the intended movement direction.
* Clicking attempts to move the player in that direction.

When the player clicks:

1. Check the currently selected line.
2. Find all neighbouring stations reachable from the current station on that line.
3. Compare their map directions against the player’s chosen direction.
4. If one valid neighbouring station matches the intended direction, move the player there.
5. If no valid station exists in that direction, do nothing or give subtle feedback.

Movement must follow the real network topology.

## Map Reveal System

The player should not initially see the full network.

When the player successfully moves:

* The current station marker updates to the new station.
* The travelled segment of the selected line becomes visible.
* Previously revealed line segments remain visible.
* The map gradually reveals itself based on the player’s path.
* The camera should maintain the same zoom and does not need to zoom out.

The visual style should resemble the London Underground map rather than a geographic map.

## UI Requirements

The game screen should include:

* Timer in the top-left corner
* Move counter in the top-left corner
* Current selected line indicator in the top-right corner
* Current station marker
* Destination station name or indicator
* Revealed line segments
* Hidden unrevealed network data

When the player reaches the destination:

* Stop the timer.
* Record the final time.
* Record the number of moves.
* Display a completion screen.

## Data Requirements

The network data should be represented in TypeScript.

Use structured data for:

* Stations
* Lines
* Station coordinates
* Line colours
* Line membership
* Connections between stations
* Interchange stations
* Branches
* Directional adjacency

Example structure:

```ts
type LineId =
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

type Station = {
  id: string;
  name: string;
  x: number;
  y: number;
  lines: LineId[];
};

type Connection = {
  from: string;
  to: string;
  line: LineId;
};

type NetworkData = {
  stations: Station[];
  connections: Connection[];
};
```

Coordinates should use schematic tube-map-style positions, not necessarily real geographic coordinates.

## Accuracy Requirements

The game should be accurate to the real TfL rail network.

Pay special attention to:

* Correct station ordering
* Branches
* Interchanges
* Shared stations
* Line-specific routes
* Elizabeth line branches

Avoid inventing stations or connections.

If simplifying the network for development, clearly mark simplified data as temporary.

## Technical Requirements

The project should be written in **TypeScript**.

Recommended stack:

* TypeScript
* Vite
* HTML Canvas or SVG for rendering
* No heavy game engine unless necessary

Prefer a clean separation between:

* Game state
* Network data
* Rendering
* Input handling
* Seed generation
* Movement validation

Suggested folders:

```txt
src/
  data/
    network.ts
    lines.ts
    stations.ts
  game/
    GameState.ts
    movement.ts
    seed.ts
    timer.ts
  rendering/
    mapRenderer.ts
    stationRenderer.ts
    lineRenderer.ts
  input/
    keyboard.ts
    mouse.ts
  ui/
    hud.ts
  main.ts
```

## Game State

The game state should track:

```ts
type GameState = {
  seed: string;
  startStationId: string;
  destinationStationId: string;
  currentStationId: string;
  selectedLineId: LineId;
  revealedConnections: Set<string>;
  moveCount: number;
  startTime: number;
  endTime: number | null;
  completed: boolean;
};
```

## Movement Logic

Movement should be deterministic.

Given:

* Current station
* Selected line
* Mouse direction
* Network connections

The game should determine whether the player can move to a neighbouring station.

A suggested approach:

1. Convert mouse position into an angle from the current station.
2. Find neighbouring stations on the selected line.
3. Calculate the angle from the current station to each neighbour.
4. Choose the neighbour with the closest angle.
5. Only allow movement if the angle difference is below a reasonable threshold.
6. Otherwise reject the move.

## Seed Logic

The same seed should always generate the same start and destination station.

Requirements:

* Seeded random generation
* Start and destination must be different
* Optional: allow for a manual seed to be entered
* Optional: avoid trivial routes where the destination is too close
* Optional: difficulty modes based on network distance

## Code Quality Guidelines

* Use strong TypeScript types.
* Avoid `any` unless absolutely necessary.
* Keep game logic independent from rendering.
* Keep network data declarative.
* Write small, testable functions.
* Prefer pure functions for movement and seed logic.
* Avoid hard-coding gameplay logic inside rendering code.

## Testing Priorities

Prioritise tests for:

* Seed determinism
* Valid station selection
* Valid line selection
* Movement between connected stations
* Preventing movement where no connection exists
* Revealed path updates
* Destination completion detection

## Important Constraints

* Do not include London Trams.
* Do not use real-time TfL API data for core gameplay unless explicitly required.
* The network should be playable offline using local TypeScript data.
* Do not reveal the full network at the start.
* Do not allow movement that is not valid on the real TfL network.
* Do not treat interchanges as automatic movement between lines; line switching should happen through the `A` and `D` controls.

## Development Priority

Build in this order:

1. Static network data model
2. Seeded start/destination generation
3. Basic rendering of current station
4. Line selection controls
5. Mouse-direction movement
6. Revealed line segments
7. Timer and move counter
8. Completion screen
9. Full TfL network data
10. Polish, animations, and UI improvements

## Definition of Done

The project is complete when:

* A player can start a seeded run.
* The start and destination stations are generated deterministically.
* The player can only move along valid TfL network connections.
* The selected line can be changed at interchange stations.
* The map reveals only travelled line segments.
* The timer and move counter work.
* Reaching the destination ends the run and records the result.
* The included network data accurately represents the London Underground and Elizabeth line.
