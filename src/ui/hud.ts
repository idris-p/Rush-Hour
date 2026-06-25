import { LINE_BY_ID } from "../data/lines";
import type { NetworkData } from "../data/types";
import type { GameState } from "../game/GameState";
import { getElapsedMilliseconds } from "../game/GameState";
import { getLineCyclePreview } from "../game/lineSelection";
import { getStation } from "../game/movement";

export type HudCallbacks = {
  onPlaySeed: (seed: string) => void;
  onRandomSeed: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

export class Hud {
  readonly mapHost: HTMLDivElement;

  private readonly timerValue: HTMLSpanElement;
  private readonly moveValue: HTMLSpanElement;
  private readonly stationValue: HTMLSpanElement;
  private readonly destinationValue: HTMLSpanElement;
  private readonly lineIndicator: HTMLDivElement;
  private readonly seedInput: HTMLInputElement;
  private readonly overlayButton: HTMLButtonElement;
  private readonly completionOverlay: HTMLDivElement;
  private readonly completionTitle: HTMLHeadingElement;
  private readonly completionMeta: HTMLParagraphElement;
  private readonly completionTime: HTMLSpanElement;
  private readonly completionMoves: HTMLSpanElement;
  private readonly completionStats: HTMLDivElement;
  private readonly completionCloseButton: HTMLButtonElement;
  private readonly temporaryBanner: HTMLDivElement;
  private readonly network: NetworkData;
  private completionDismissed = false;

  constructor(root: HTMLElement, network: NetworkData, callbacks: HudCallbacks) {
    this.network = network;
    root.replaceChildren();
    root.className = "app-shell";

    const topLeft = document.createElement("div");
    topLeft.className = "hud-panel hud-left";

    this.timerValue = document.createElement("span");
    this.moveValue = document.createElement("span");
    this.stationValue = document.createElement("span");
    this.destinationValue = document.createElement("span");
    topLeft.append(
      metric("Time", this.timerValue),
      metric("Moves", this.moveValue),
      metric("Station", this.stationValue),
      metric("Target", this.destinationValue),
    );

    this.lineIndicator = document.createElement("div");
    this.lineIndicator.className = "line-indicator";

    this.mapHost = document.createElement("div");
    this.mapHost.className = "map-host";

    const seedControls = document.createElement("form");
    seedControls.className = "seed-controls";
    seedControls.addEventListener("submit", (event) => {
      event.preventDefault();
      callbacks.onPlaySeed(this.seedInput.value);
    });

    this.seedInput = document.createElement("input");
    this.seedInput.type = "text";
    this.seedInput.name = "seed";
    this.seedInput.autocomplete = "off";
    this.seedInput.spellcheck = false;
    this.seedInput.ariaLabel = "Seed";

    const startButton = document.createElement("button");
    startButton.type = "submit";
    startButton.textContent = "Play";

    const randomButton = document.createElement("button");
    randomButton.type = "button";
    randomButton.textContent = "Random";
    randomButton.addEventListener("click", callbacks.onRandomSeed);

    seedControls.append(this.seedInput, startButton, randomButton);

    const zoomControls = document.createElement("div");
    zoomControls.className = "zoom-controls";
    const zoomInButton = zoomButton("+", "Zoom in", callbacks.onZoomIn);
    const zoomOutButton = zoomButton("-", "Zoom out", callbacks.onZoomOut);
    zoomControls.append(zoomInButton, zoomOutButton);

    this.temporaryBanner = document.createElement("div");
    this.temporaryBanner.className = "temporary-banner";
    this.temporaryBanner.textContent = "Temporary playable subset";
    this.temporaryBanner.hidden = !network.temporary;

    this.completionOverlay = document.createElement("div");
    this.completionOverlay.className = "completion-overlay";
    this.completionOverlay.hidden = true;
    this.completionTitle = document.createElement("h1");
    this.completionMeta = document.createElement("p");
    this.completionMeta.className = "completion-meta";
    this.completionTime = document.createElement("span");
    this.completionMoves = document.createElement("span");
    this.completionStats = document.createElement("div");
    this.completionStats.className = "completion-stats";
    this.completionStats.append(
      completionStat("Time", this.completionTime),
      completionStat("Moves", this.completionMoves),
    );
    this.completionCloseButton = document.createElement("button");
    this.completionCloseButton.type = "button";
    this.completionCloseButton.className = "completion-close";
    this.completionCloseButton.textContent = "x";
    this.completionCloseButton.ariaLabel = "Close results";
    this.completionCloseButton.addEventListener("click", () => {
      this.completionDismissed = true;
      this.completionOverlay.hidden = true;
    });
    this.overlayButton = document.createElement("button");
    this.overlayButton.type = "button";
    this.overlayButton.className = "completion-action";
    this.overlayButton.textContent = "Play";
    this.overlayButton.addEventListener("click", () => callbacks.onPlaySeed(this.seedInput.value));
    this.completionOverlay.append(
      this.completionCloseButton,
      this.completionTitle,
      this.completionStats,
      this.completionMeta,
      this.overlayButton,
    );

    root.append(
      topLeft,
      this.lineIndicator,
      this.mapHost,
      seedControls,
      zoomControls,
      this.temporaryBanner,
      this.completionOverlay,
    );
  }

  setSeed(seed: string): void {
    this.seedInput.value = seed;
  }

  update(state: GameState | null, now: number): void {
    if (!state) {
      this.completionDismissed = false;
      this.timerValue.textContent = formatMilliseconds(0);
      this.moveValue.textContent = "0";
      this.stationValue.textContent = "Ready";
      this.destinationValue.textContent = "Ready";
      this.lineIndicator.textContent = "Ready";
      this.lineIndicator.style.setProperty("--line-color", "#ffffff");
      this.lineIndicator.style.setProperty("--line-text-color", "#111111");
      this.completionOverlay.hidden = false;
      this.completionTitle.textContent = "Rush Hour";
      this.completionMeta.textContent = `Seed ${this.seedInput.value}`;
      this.completionStats.hidden = true;
      this.completionCloseButton.hidden = true;
      this.overlayButton.textContent = "Play";
      return;
    }

    const currentStation = getStation(this.network, state.currentStationId);
    const destination = getStation(this.network, state.destinationStationId);
    const elapsed = getElapsedMilliseconds(state, now);

    this.timerValue.textContent = formatMilliseconds(elapsed);
    this.moveValue.textContent = String(state.moveCount);
    this.stationValue.textContent = currentStation.name;
    this.destinationValue.textContent = destination.name;
    this.seedInput.value = state.seed;

    this.renderLineIndicator(state);

    if (!state.completed) {
      this.completionDismissed = false;
    }
    this.completionOverlay.hidden = !state.completed || this.completionDismissed;
    if (state.completed) {
      this.completionTitle.textContent = "Run complete";
      this.completionTime.textContent = formatMilliseconds(elapsed);
      this.completionMoves.textContent = String(state.moveCount);
      this.completionMeta.textContent = `Seed ${state.seed}`;
      this.completionStats.hidden = false;
      this.completionCloseButton.hidden = false;
      this.overlayButton.textContent = "Play again";
    }
  }

  private renderLineIndicator(state: GameState): void {
    const preview = getLineCyclePreview(state, this.network);
    this.lineIndicator.replaceChildren();
    this.lineIndicator.style.removeProperty("--line-color");
    this.lineIndicator.style.removeProperty("--line-text-color");

    if (!preview) {
      this.lineIndicator.textContent = "Ready";
      return;
    }

    const canSwitch = preview.lineCount > 1;
    this.lineIndicator.append(
      lineChip("A", preview.previous, canSwitch ? "preview" : "disabled"),
      lineChip("Now", preview.current, "current"),
      lineChip("D", preview.next, canSwitch ? "preview" : "disabled"),
    );
  }
}

function zoomButton(label: string, ariaLabel: string, callback: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.ariaLabel = ariaLabel;
  button.title = ariaLabel;
  button.addEventListener("click", callback);
  return button;
}

function lineChip(label: string, lineId: keyof typeof LINE_BY_ID, variant: "preview" | "current" | "disabled"): HTMLDivElement {
  const line = LINE_BY_ID[lineId];
  const chip = document.createElement("div");
  chip.className = `line-chip line-chip-${variant}`;
  chip.style.setProperty("--chip-line-color", line.color);
  chip.style.setProperty("--chip-line-text-color", line.textColor);

  const key = document.createElement("span");
  key.className = "line-chip-key";
  key.textContent = label;

  const name = document.createElement("span");
  name.className = "line-chip-name";
  name.textContent = line.name;

  chip.append(key, name);
  return chip;
}

function metric(label: string, valueElement: HTMLSpanElement): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.className = "metric";

  const labelElement = document.createElement("span");
  labelElement.className = "metric-label";
  labelElement.textContent = label;

  valueElement.className = "metric-value";
  wrapper.append(labelElement, valueElement);
  return wrapper;
}

function completionStat(label: string, valueElement: HTMLSpanElement): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.className = "completion-stat";

  const labelElement = document.createElement("span");
  labelElement.className = "completion-stat-label";
  labelElement.textContent = label;

  valueElement.className = "completion-stat-value";
  wrapper.append(labelElement, valueElement);
  return wrapper;
}

export function formatMilliseconds(milliseconds: number): string {
  const totalCentiseconds = Math.floor(milliseconds / 10);
  const minutes = Math.floor(totalCentiseconds / 6000);
  const seconds = Math.floor((totalCentiseconds % 6000) / 100);
  const centiseconds = totalCentiseconds % 100;

  return `${minutes}:${seconds.toString().padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}`;
}
