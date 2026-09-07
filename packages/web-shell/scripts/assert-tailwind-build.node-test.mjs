import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { assertBuiltWebShellCss, REQUIRED_WEB_SHELL_UTILITIES } from "./assert-tailwind-build.mjs";

async function withFixture(css, run) {
  const directory = await mkdtemp(join(tmpdir(), "web-shell-css-"));
  try {
    const chunks = join(directory, "static", "chunks");
    await mkdir(chunks, { recursive: true });
    await writeFile(join(chunks, "app.css"), css);
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("accepts a build containing shared rail utilities", async () => {
  await withFixture(REQUIRED_WEB_SHELL_UTILITIES.join("{}"), async (directory) => {
    await assert.doesNotReject(assertBuiltWebShellCss(directory));
  });
});

test("rejects a build that omitted the shared responsive rail", async () => {
  await withFixture(".hidden{display:none}", async (directory) => {
    await assert.rejects(
      assertBuiltWebShellCss(directory),
      /Tailwind did not scan @gitnapp\/web-shell/u,
    );
  });
});
