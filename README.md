# Rush Hour

A speedrunning game where you traverse the London Underground (and Elizabeth line) network as quickly as possible, from a random start to a destination station.

## Screenshots

## Gameplay

- Start a run with a random seed or enter a set seed
- Complete 5 rounds
- Reach each target station as quickly as possible, exploring the tube map along the way
- Complete each round in the shortest time, whilst minimising moves and line changes

## Controls

- `A`/`D`: cycle to the previous and next available line at the current station
- Move the mouse pointer around the current station to choose a direction
- Left click to move in a given direction

## Project Structure

```txt
src/
  data/        Network data, line definitions, validation, generated map data
  game/        Game state, seeded round generation, movement, line selection
  input/       Keyboard and pointer intent handling
  rendering/   SVG map, line, station, path, and river rendering
  ui/          HUD, menus, completion screens, results
  main.ts      Application entry point
```

## Tech Stack

This game was developed using TypeScript and the HTML Canvas.