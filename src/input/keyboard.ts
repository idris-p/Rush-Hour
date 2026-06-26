export type LineCycleHandler = (direction: -1 | 1) => void;

const LINE_CYCLE_REPEAT_MS = 240;

export function bindKeyboardControls(onCycleLine: LineCycleHandler): () => void {
  let heldKey: "a" | "d" | null = null;
  let repeatTimer: number | null = null;

  const clearRepeatTimer = (): void => {
    if (repeatTimer === null) {
      return;
    }

    window.clearInterval(repeatTimer);
    repeatTimer = null;
  };

  const stopCycling = (): void => {
    heldKey = null;
    clearRepeatTimer();
  };

  const startCycling = (key: "a" | "d"): void => {
    const direction = key === "a" ? -1 : 1;
    heldKey = key;
    clearRepeatTimer();
    onCycleLine(direction);
    repeatTimer = window.setInterval(() => onCycleLine(direction), LINE_CYCLE_REPEAT_MS);
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (key !== "a" && key !== "d") {
      return;
    }

    event.preventDefault();
    if (event.repeat || heldKey === key) {
      return;
    }

    startCycling(key);
  };

  const handleKeyUp = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (key === heldKey) {
      event.preventDefault();
      stopCycling();
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", stopCycling);
  return () => {
    stopCycling();
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    window.removeEventListener("blur", stopCycling);
  };
}
