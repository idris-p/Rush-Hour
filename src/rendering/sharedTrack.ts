import { getCenteredOffset } from "./pathOffset";

export type SharedTrackStripe = {
  offset: number;
  strokeWidth: number;
};

export function getSharedTrackStripe(
  index: number,
  count: number,
  totalStrokeWidth: number,
): SharedTrackStripe {
  if (count <= 1) {
    return { offset: 0, strokeWidth: totalStrokeWidth };
  }

  const strokeWidth = totalStrokeWidth / count;
  return {
    offset: getCenteredOffset(index, count, strokeWidth),
    strokeWidth,
  };
}
