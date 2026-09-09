// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { MetricGrid } from "./data-layout";
import { EditableValue } from "./editable-value";
import { TooltipProvider } from "./tooltip";
import { ValueOrigin } from "./value-origin";

it("keeps missing metric fields and a real zero distinct", () => {
  const html = renderToStaticMarkup(
    <MetricGrid
      items={[
        { id: "a", label: "空值", value: null },
        { id: "b", label: "零值", value: 0 },
      ]}
    />,
  );
  expect(html).toContain("—");
  expect(html).toContain(">0</dd>");
});
it("opens an input only on demand and Escape does not commit", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const commit = vi.fn();
  await act(async () => root.render(<EditableValue label="数值" value={12} onCommit={commit} />));
  expect(host.querySelector("input")).toBeNull();
  await act(async () => host.querySelector("button")?.click());
  expect(host.querySelector("input")?.value).toBe("12");
  await act(async () =>
    host
      .querySelector("input")
      ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
  );
  expect(commit).not.toHaveBeenCalled();
  expect(host.querySelector("input")).toBeNull();
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
it("only manual sources expose the reset action", () => {
  const reset = vi.fn();
  expect(
    renderToStaticMarkup(
      <TooltipProvider>
        <ValueOrigin manual onReset={reset} />
      </TooltipProvider>,
    ),
  ).toContain("恢复 AI 推荐");
  expect(
    renderToStaticMarkup(
      <TooltipProvider>
        <ValueOrigin manual={false} onReset={reset} />
      </TooltipProvider>,
    ),
  ).not.toContain("rui-value-origin-undo");
});
