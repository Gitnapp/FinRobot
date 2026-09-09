// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { LoadingScope, LoadingState } from "./loading";

afterEach(() => vi.unstubAllGlobals());

it("merges nested pending states into one indicator and removes it when ready", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <LoadingScope active>
        <LoadingState />
        <LoadingScope active>
          <LoadingState />
        </LoadingScope>
      </LoadingScope>,
    );
  });
  expect(host.querySelectorAll('[role="status"]')).toHaveLength(1);
  expect(host.textContent).toBe("");
  await act(async () =>
    root.render(
      <LoadingScope>
        <span>Ready</span>
      </LoadingScope>,
    ),
  );
  expect(host.querySelectorAll('[role="status"]')).toHaveLength(0);
  await act(async () => root.unmount());
});
