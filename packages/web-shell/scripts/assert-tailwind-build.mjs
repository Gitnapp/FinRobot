import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const REQUIRED_WEB_SHELL_UTILITIES = Object.freeze([
  String.raw`.md\:block`,
  String.raw`.border-rail-foreground\/10`,
  String.raw`.hover\:bg-rail-foreground\/10`,
  // Token-backed utility from @gitnapp/design-tokens. If a consumer stops
  // importing the token package, this resolves to nothing and the shell's
  // floating layers silently lose their elevation instead of failing.
  ".shadow-overlay",
]);

async function collectCssFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectCssFiles(path)));
    else if (entry.isFile() && entry.name.endsWith(".css")) files.push(path);
  }
  return files;
}

export async function assertBuiltWebShellCss(buildDirectory) {
  const staticDirectory = resolve(buildDirectory, "static");
  const files = await collectCssFiles(staticDirectory);
  if (files.length === 0) {
    throw new Error(`WEB_SHELL_CSS_GUARD: no CSS files found under ${staticDirectory}`);
  }

  const css = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
  const missing = REQUIRED_WEB_SHELL_UTILITIES.filter((utility) => !css.includes(utility));
  if (missing.length > 0) {
    throw new Error(
      `WEB_SHELL_CSS_GUARD: Tailwind did not scan @gitnapp/web-shell; missing ${missing.join(", ")}`,
    );
  }

  return { files: files.length, utilities: REQUIRED_WEB_SHELL_UTILITIES.length };
}

if (process.argv[1]?.endsWith("/assert-tailwind-build.mjs")) {
  const buildDirectory = resolve(process.argv[2] || ".next");
  const result = await assertBuiltWebShellCss(buildDirectory);
  console.log(`WEB_SHELL_CSS_GUARD: PASS files=${result.files} utilities=${result.utilities}`);
}
