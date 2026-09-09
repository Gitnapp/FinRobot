// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { LoadingState } from "./loading";
import { curvePath } from "./math-curve-loader";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.innerHTML = "";
});
it("keeps a random curve for one loading episode and delays long-load guidance", () => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValueOnce(0.05).mockReturnValueOnce(0.95);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<LoadingState inline message="历史研报加载需要一些时间" />));
  const curve = host.querySelector("[data-curve]")?.getAttribute("data-curve");
  expect(host.textContent).not.toContain("历史研报");
  act(() => vi.advanceTimersByTime(2100));
  expect(host.textContent).toContain("历史研报加载需要一些时间");
  expect(host.querySelector("[data-curve]")?.getAttribute("data-curve")).toBe(curve);
  act(() => root.render(<LoadingState key="refresh" inline mode="refresh" message="不应显示" />));
  act(() => vi.advanceTimersByTime(5000));
  expect(host.textContent).not.toContain("不应显示");
  expect(host.querySelector("[data-curve]")?.getAttribute("data-curve")).not.toBe(curve);
  act(() => root.unmount());
  host.remove();
});
it("generates bounded finite mathematical paths", () => {
  for (const type of [
    "thinking-7",
    "rose-5",
    "lissajous",
    "lemniscate",
    "hypotrochoid",
    "butterfly",
    "cardioid",
    "heart",
    "spiral",
    "fourier",
  ]) {
    const values = (curvePath(type).match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    expect(values.every((value) => Number.isFinite(value) && value >= 11.9 && value <= 88.1)).toBe(
      true,
    );
  }
});
