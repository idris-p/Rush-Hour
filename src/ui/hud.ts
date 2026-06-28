import { LINE_BY_ID } from "../data/lines";
import type { NetworkData } from "../data/types";
import type { GameState } from "../game/GameState";
import { getElapsedMilliseconds } from "../game/GameState";
import { getLineCyclePreview } from "../game/lineSelection";
import { getStation } from "../game/movement";

export type HudCallbacks = {
  onStartRandomSeed: () => void;
  onStartSeed: (seed: string) => void;
  onReturnToMenu: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

type MenuMode = "home" | "seed-choice" | "seed-entry";

export class Hud {
  readonly mapHost: HTMLDivElement;

  private readonly shell: HTMLElement;
  private readonly statsPanel: HTMLDivElement;
  private readonly timerPanel: HTMLDivElement;
  private readonly timerValue: HTMLSpanElement;
  private readonly moveValue: HTMLSpanElement;
  private readonly changeValue: HTMLSpanElement;
  private readonly stationValue: HTMLSpanElement;
  private readonly destinationValue: HTMLSpanElement;
  private readonly lineIndicator: HTMLDivElement;
  private zoomControls: HTMLDivElement | null = null;
  private readonly overlayButton: HTMLButtonElement;
  private readonly completionOverlay: HTMLDivElement;
  private readonly completionTitle: HTMLHeadingElement;
  private readonly completionMeta: HTMLParagraphElement;
  private readonly completionSeedText: HTMLSpanElement;
  private readonly completionSeedCopyButton: HTMLButtonElement;
  private readonly completionTime: HTMLSpanElement;
  private readonly completionMoves: HTMLSpanElement;
  private readonly completionChanges: HTMLSpanElement;
  private readonly completionStats: HTMLDivElement;
  private readonly completionCloseButton: HTMLButtonElement;
  private readonly gameplayExitButton: HTMLButtonElement;
  private readonly exitConfirmOverlay: HTMLDivElement;
  private readonly countdownOverlay: HTMLDivElement;
  private readonly countdownValue: HTMLDivElement;
  private readonly temporaryBanner: HTMLDivElement;
  private readonly menuOverlay: HTMLDivElement;
  private readonly menuBackButton: HTMLButtonElement;
  private readonly menuActions: HTMLDivElement;
  private readonly menuSeedInput: HTMLInputElement;
  private readonly network: NetworkData;
  private readonly callbacks: HudCallbacks;
  private menuMode: MenuMode = "home";
  private completionDismissed = false;

  constructor(root: HTMLElement, network: NetworkData, callbacks: HudCallbacks) {
    this.network = network;
    this.callbacks = callbacks;
    root.replaceChildren();
    root.className = "app-shell";
    this.shell = root;

    this.statsPanel = document.createElement("div");
    this.statsPanel.className = "hud-panel hud-left";

    this.timerPanel = document.createElement("div");
    this.timerPanel.className = "hud-panel hud-timer";

    this.timerValue = document.createElement("span");
    this.moveValue = document.createElement("span");
    this.changeValue = document.createElement("span");
    this.stationValue = document.createElement("span");
    this.destinationValue = document.createElement("span");
    this.timerPanel.append(
      metric("Time", this.timerValue),
    );
    this.statsPanel.append(
      metric("Start", this.stationValue),
      metric("Target", this.destinationValue),
      metric("Changes", this.changeValue),
      metric("Moves", this.moveValue),
    );

    this.lineIndicator = document.createElement("div");
    this.lineIndicator.className = "line-indicator";

    this.mapHost = document.createElement("div");
    this.mapHost.className = "map-host";

    this.temporaryBanner = document.createElement("div");
    this.temporaryBanner.className = "temporary-banner";
    this.temporaryBanner.textContent = "Temporary playable subset";
    this.temporaryBanner.hidden = !network.temporary;

    this.menuOverlay = document.createElement("div");
    this.menuOverlay.className = "main-menu";
    this.menuBackButton = document.createElement("button");
    this.menuBackButton.type = "button";
    this.menuBackButton.className = "menu-back";
    this.menuBackButton.textContent = "\u2190 Back";
    this.menuBackButton.addEventListener("click", () => this.setMenuMode(getPreviousMenuMode(this.menuMode)));

    const menuContent = document.createElement("div");
    menuContent.className = "main-menu-content";
    const menuTitle = document.createElement("h1");
    menuTitle.textContent = "Rush Hour";
    this.menuActions = document.createElement("div");
    this.menuActions.className = "main-menu-actions";

    this.menuSeedInput = document.createElement("input");
    this.menuSeedInput.type = "text";
    this.menuSeedInput.name = "seed";
    this.menuSeedInput.autocomplete = "off";
    this.menuSeedInput.spellcheck = false;
    this.menuSeedInput.required = true;
    this.menuSeedInput.placeholder = "Enter seed";
    this.menuSeedInput.ariaLabel = "Seed";

    menuContent.append(menuTitle, this.menuActions);
    this.menuOverlay.append(this.menuBackButton, menuContent);
    this.setMenuMode("home");

    this.countdownOverlay = document.createElement("div");
    this.countdownOverlay.className = "countdown-overlay";
    this.countdownOverlay.hidden = true;
    this.countdownValue = document.createElement("div");
    this.countdownValue.className = "countdown-value";
    this.countdownOverlay.append(this.countdownValue);

    this.completionOverlay = document.createElement("div");
    this.completionOverlay.className = "completion-overlay";
    this.completionOverlay.hidden = true;
    this.completionTitle = document.createElement("h1");
    this.completionMeta = document.createElement("p");
    this.completionMeta.className = "completion-meta";
    this.completionSeedText = document.createElement("span");
    this.completionSeedCopyButton = document.createElement("button");
    this.completionSeedCopyButton.type = "button";
    this.completionSeedCopyButton.className = "completion-copy-seed";
    this.completionSeedCopyButton.textContent = "Copy";
    this.completionSeedCopyButton.addEventListener("click", () => {
      void copyTextToClipboard(this.completionSeedText.textContent ?? "").then((copied) => {
        const originalText = this.completionSeedCopyButton.textContent;
        this.completionSeedCopyButton.textContent = copied ? "Copied" : "Copy failed";
        window.setTimeout(() => {
          this.completionSeedCopyButton.textContent = originalText;
        }, 1200);
      });
    });
    this.completionMeta.append("Seed ", this.completionSeedText, this.completionSeedCopyButton);
    this.completionTime = document.createElement("span");
    this.completionMoves = document.createElement("span");
    this.completionChanges = document.createElement("span");
    this.completionStats = document.createElement("div");
    this.completionStats.className = "completion-stats";
    this.completionStats.append(
      completionStat("Time", this.completionTime),
      completionStat("Changes", this.completionChanges),
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
    this.gameplayExitButton = document.createElement("button");
    this.gameplayExitButton.type = "button";
    this.gameplayExitButton.className = "gameplay-exit-button";
    this.gameplayExitButton.ariaLabel = "Exit to menu";
    this.gameplayExitButton.title = "Exit to menu";
    this.gameplayExitButton.hidden = true;
    this.gameplayExitButton.append(exitIcon());
    this.gameplayExitButton.addEventListener("click", () => {
      this.exitConfirmOverlay.hidden = false;
    });
    this.exitConfirmOverlay = document.createElement("div");
    this.exitConfirmOverlay.className = "exit-confirm-overlay";
    this.exitConfirmOverlay.hidden = true;
    const exitConfirmDialog = document.createElement("div");
    exitConfirmDialog.className = "exit-confirm-dialog";
    const exitConfirmMessage = document.createElement("p");
    exitConfirmMessage.textContent = "Are you sure you want to exit?";
    const exitConfirmActions = document.createElement("div");
    exitConfirmActions.className = "exit-confirm-actions";
    const exitConfirmYes = document.createElement("button");
    exitConfirmYes.type = "button";
    exitConfirmYes.className = "exit-confirm-button exit-confirm-button-primary";
    exitConfirmYes.textContent = "Yes";
    exitConfirmYes.addEventListener("click", callbacks.onReturnToMenu);
    const exitConfirmNo = document.createElement("button");
    exitConfirmNo.type = "button";
    exitConfirmNo.className = "exit-confirm-button exit-confirm-button-secondary";
    exitConfirmNo.textContent = "No";
    exitConfirmNo.addEventListener("click", () => {
      this.exitConfirmOverlay.hidden = true;
    });
    exitConfirmActions.append(exitConfirmYes, exitConfirmNo);
    exitConfirmDialog.append(exitConfirmMessage, exitConfirmActions);
    this.exitConfirmOverlay.append(exitConfirmDialog);
    this.overlayButton = document.createElement("button");
    this.overlayButton.type = "button";
    this.overlayButton.className = "completion-action";
    this.overlayButton.textContent = "Menu";
    this.overlayButton.addEventListener("click", callbacks.onReturnToMenu);
    this.completionOverlay.append(
      this.completionCloseButton,
      this.completionTitle,
      this.completionStats,
      this.completionMeta,
      this.overlayButton,
    );

    root.append(
      this.mapHost,
      this.statsPanel,
      this.timerPanel,
      this.lineIndicator,
      this.temporaryBanner,
      this.menuOverlay,
      this.countdownOverlay,
      this.completionOverlay,
      this.exitConfirmOverlay,
      this.gameplayExitButton,
    );
  }

  showMenu(): void {
    this.completionDismissed = false;
    this.exitConfirmOverlay.hidden = true;
    this.setMenuMode("home");
  }

  showCountdown(value: number): void {
    this.shell.classList.remove("menu-active");
    this.shell.classList.add("countdown-active");
    this.statsPanel.hidden = true;
    this.timerPanel.hidden = true;
    this.lineIndicator.hidden = true;
    this.temporaryBanner.hidden = true;
    this.menuOverlay.hidden = true;
    this.completionOverlay.hidden = true;
    this.gameplayExitButton.hidden = true;
    this.countdownOverlay.hidden = false;
    this.countdownValue.textContent = String(value);
    this.exitConfirmOverlay.hidden = true;
    this.removeZoomControls();
  }

  update(state: GameState | null, now: number): void {
    if (!state) {
      this.shell.classList.remove("countdown-active");
      this.shell.classList.add("menu-active");
      this.statsPanel.hidden = true;
      this.timerPanel.hidden = true;
      this.lineIndicator.hidden = true;
      this.temporaryBanner.hidden = true;
      this.menuOverlay.hidden = false;
      this.completionOverlay.hidden = true;
      this.gameplayExitButton.hidden = true;
      this.countdownOverlay.hidden = true;
      this.exitConfirmOverlay.hidden = true;
      this.removeZoomControls();
      return;
    }

    this.shell.classList.remove("countdown-active");
    this.shell.classList.remove("menu-active");
    this.statsPanel.hidden = false;
    this.timerPanel.hidden = false;
    this.lineIndicator.hidden = false;
    this.temporaryBanner.hidden = !this.network.temporary;
    this.menuOverlay.hidden = true;
    this.countdownOverlay.hidden = true;
    this.gameplayExitButton.hidden = false;

    const startStation = getStation(this.network, state.startStationId);
    const destination = getStation(this.network, state.destinationStationId);
    const elapsed = getElapsedMilliseconds(state, now);

    renderMilliseconds(this.timerValue, elapsed);
    this.moveValue.textContent = String(state.moveCount);
    this.changeValue.textContent = String(state.changeCount);
    this.stationValue.textContent = startStation.name;
    this.destinationValue.textContent = destination.name;

    this.renderLineIndicator(state);

    if (!state.completed) {
      this.completionDismissed = false;
      this.removeZoomControls();
    }
    this.completionOverlay.hidden = !state.completed || this.completionDismissed;
    if (state.completed) {
      this.completionTitle.textContent = "Run complete";
      this.completionTime.classList.remove("time-value");
      this.completionTime.textContent = formatMilliseconds(elapsed);
      this.completionMoves.textContent = String(state.moveCount);
      this.completionChanges.textContent = String(state.changeCount);
      this.completionSeedText.textContent = state.seed;
      this.completionStats.hidden = false;
      this.completionCloseButton.hidden = false;
      this.overlayButton.textContent = "Menu";
      this.ensureZoomControls();
    }
  }

  private setMenuMode(mode: MenuMode): void {
    this.menuMode = mode;
    this.menuOverlay.dataset.menuMode = mode;
    this.menuBackButton.hidden = mode === "home";
    this.menuActions.replaceChildren();

    if (mode === "home") {
      this.menuActions.append(menuButton("Play", "primary", () => this.setMenuMode("seed-choice")));
      return;
    }

    if (mode === "seed-choice") {
      this.menuActions.append(
        menuButton("Random Seed", "primary", this.callbacks.onStartRandomSeed),
        menuButton("Set Seed", "secondary", () => this.setMenuMode("seed-entry")),
      );
      return;
    }

    const form = document.createElement("form");
    form.className = "main-menu-seed-form";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const seed = this.menuSeedInput.value.trim();
      if (seed === "") {
        this.menuSeedInput.focus();
        return;
      }
      this.callbacks.onStartSeed(seed);
    });

    this.menuSeedInput.value = "";
    form.append(
      this.menuSeedInput,
      menuButton("Start", "primary"),
    );
    this.menuActions.append(form);
    window.setTimeout(() => this.menuSeedInput.focus(), 0);
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

  private ensureZoomControls(): void {
    if (this.zoomControls) {
      return;
    }

    this.zoomControls = document.createElement("div");
    this.zoomControls.className = "zoom-controls";
    this.zoomControls.append(
      zoomButton("+", "Zoom in", this.callbacks.onZoomIn),
      zoomButton("-", "Zoom out", this.callbacks.onZoomOut),
    );
    this.completionOverlay.before(this.zoomControls);
  }

  private removeZoomControls(): void {
    this.zoomControls?.remove();
    this.zoomControls = null;
  }
}

function menuButton(
  label: string,
  variant: "primary" | "secondary",
  callback?: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = callback ? "button" : "submit";
  button.className = `main-menu-button main-menu-button-${variant}`;
  button.textContent = label;
  if (callback) {
    button.addEventListener("click", callback);
  }
  return button;
}

function getPreviousMenuMode(mode: MenuMode): MenuMode {
  if (mode === "seed-entry") {
    return "seed-choice";
  }
  return "home";
}

function exitIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "button-icon");

  const door = document.createElementNS("http://www.w3.org/2000/svg", "path");
  door.setAttribute("d", "M 5 4 H 12 V 7 H 8 V 17 H 12 V 20 H 5 Z");

  const arrow = document.createElementNS("http://www.w3.org/2000/svg", "path");
  arrow.setAttribute("d", "M 13 8 L 17 12 L 13 16 V 13 H 9 V 11 H 13 Z");

  svg.append(door, arrow);
  return svg;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (text === "") {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const input = document.createElement("input");
    input.value = text;
    input.setAttribute("readonly", "true");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    const copied = document.execCommand("copy");
    input.remove();
    return copied;
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
  chip.style.setProperty("--chip-line-color", lineId === "walk" ? "#ffffff" : line.color);
  chip.style.setProperty("--chip-line-text-color", lineId === "walk" ? "#111111" : line.textColor);

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
  const { minutes, seconds, centiseconds } = getTimeParts(milliseconds);
  return `${minutes}:${seconds}.${centiseconds}`;
}

function renderMilliseconds(element: HTMLElement, milliseconds: number): void {
  const { minutes, seconds, centiseconds } = getTimeParts(milliseconds);
  element.classList.add("time-value");
  element.replaceChildren(
    timePart(minutes, "time-minutes"),
    timePart(":", "time-separator"),
    timePart(seconds, "time-seconds"),
    timePart(".", "time-separator"),
    timePart(centiseconds, "time-centiseconds"),
  );
}

function timePart(text: string, className: string): HTMLSpanElement {
  const element = document.createElement("span");
  element.className = className;
  element.textContent = text;
  return element;
}

function getTimeParts(milliseconds: number): { minutes: string; seconds: string; centiseconds: string } {
  const totalCentiseconds = Math.floor(milliseconds / 10);
  const minutes = Math.floor(totalCentiseconds / 6000);
  const seconds = Math.floor((totalCentiseconds % 6000) / 100);
  const centiseconds = totalCentiseconds % 100;

  return {
    minutes: String(minutes),
    seconds: seconds.toString().padStart(2, "0"),
    centiseconds: centiseconds.toString().padStart(2, "0"),
  };
}
