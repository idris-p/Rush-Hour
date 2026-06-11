export type LineCycleHandler = (direction: -1 | 1) => void;

export function bindKeyboardControls(onCycleLine: LineCycleHandler): () => void {
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "a") {
      event.preventDefault();
      onCycleLine(-1);
    }

    if (key === "d") {
      event.preventDefault();
      onCycleLine(1);
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}

