import type { Point } from "../data/types";

export function getSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): Point {
  const point = new DOMPoint(clientX, clientY);
  const matrix = svg.getScreenCTM();

  if (!matrix) {
    return { x: 0, y: 0 };
  }

  const transformed = point.matrixTransform(matrix.inverse());
  return { x: transformed.x, y: transformed.y };
}

