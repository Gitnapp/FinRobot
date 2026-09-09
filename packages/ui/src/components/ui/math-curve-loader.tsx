"use client";
import { useLayoutEffect, useState } from "react";

// Parametric curve families shown at https://paidax01.github.io/math-curve-loaders/.
// Rendering is an independent SVG implementation; no gallery runtime is embedded.
const variants = [
  "thinking-7",
  "thinking-5",
  "thinking-9",
  "rose-orbit",
  "rose:5",
  "rose:2",
  "rose:3",
  "rose:4",
  "lissajous",
  "lemniscate",
  "hypotrochoid",
  "spiral-3",
  "spiral-4",
  "spiral-5",
  "spiral-6",
  "butterfly",
  "cardioid",
  "heart-cardioid",
  "heart",
  "spiral",
  "fourier",
] as const;
function point(type: string, t: number): [number, number] {
  const c = Math.cos,
    s = Math.sin;
  if (type.startsWith("thinking")) {
    const n = Number(type.split(/[:-]/)[1]);
    return [7 * c(t) - 3 * c(n * t), 7 * s(t) - 3 * s(n * t)];
  }
  if (type.startsWith("rose")) {
    const n = Number(type.split(/[:-]/)[1]) || 5,
      r = type === "rose-orbit" ? 1 + 0.45 * c(5 * t) : c(n * t);
    return [r * c(t), r * s(t)];
  }
  if (type.startsWith("spiral-")) {
    const n = Number(type.split(/[:-]/)[1]),
      r = 1 + 0.45 * c(n * t);
    return [r * c(t), r * s(t)];
  }
  switch (type) {
    case "lissajous":
      return [s(3 * t + 0.7), s(2 * t)];
    case "lemniscate":
      return [c(t) / (1 + s(t) ** 2), (s(t) * c(t)) / (1 + s(t) ** 2)];
    case "hypotrochoid":
      return [3 * c(t) + 2 * c(3 * t), 3 * s(t) - 2 * s(3 * t)];
    case "butterfly": {
      const r = Math.exp(c(t)) - 2 * c(4 * t) - s(t / 12) ** 5;
      return [s(t) * r, c(t) * r];
    }
    case "cardioid":
    case "heart-cardioid": {
      const r = 1 - c(t);
      return [r * s(t), r * c(t)];
    }
    case "heart":
      return [16 * s(t) ** 3, -(13 * c(t) - 5 * c(2 * t) - 2 * c(3 * t) - c(4 * t))];
    case "spiral":
      return [(1 + 0.4 * c(6 * t)) * c(2 * t), (1 + 0.4 * c(6 * t)) * s(2 * t)];
    default:
      return [c(t) + 0.4 * c(3 * t) + 0.2 * s(5 * t), s(t) - 0.4 * s(3 * t) + 0.2 * c(5 * t)];
  }
}
export function curvePath(type: string) {
  const points = Array.from({ length: 241 }, (_, i) => point(type, (i / 240) * Math.PI * 2));
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const scale = 76 / Math.max(maxX - minX, maxY - minY, 1e-6),
    cx = (minX + maxX) / 2,
    cy = (minY + maxY) / 2;
  return `${points
    .map(
      ([x, y], i) =>
        `${i ? "L" : "M"}${(50 + (x - cx) * scale).toFixed(2)},${(50 + (y - cy) * scale).toFixed(2)}`,
    )
    .join(" ")} Z`;
}
const paths = variants.map((type) => ({ type, path: curvePath(type) }));
export function MathCurveLoader({
  size = 44,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const [curve, setCurve] = useState(paths[0]);
  useLayoutEffect(() => {
    setCurve(paths[Math.floor(Math.random() * paths.length)]);
  }, []);
  return (
    <svg
      data-slot="math-curve-loader"
      data-curve={curve.type}
      className={`rui-math-loader ${className}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <g className="rui-math-loader-curve">
        <path d={curve.path} fill="none" stroke="currentColor" strokeWidth="2" opacity=".12" />
        {[
          { length: 30, width: 2, opacity: 0.2 },
          { length: 18, width: 3, opacity: 0.45 },
          { length: 7, width: 4, opacity: 1 },
        ].map(({ length, width, opacity }) => (
          <path
            key={length}
            className="rui-math-loader-trail"
            d={curve.path}
            pathLength={100}
            fill="none"
            stroke="currentColor"
            strokeWidth={width}
            strokeLinecap="round"
            strokeDasharray={`${length} ${100 - length}`}
            opacity={opacity}
          />
        ))}
      </g>
    </svg>
  );
}
