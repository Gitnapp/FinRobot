import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// 跨组件不变量(docs/engineering/roadmap.md §2.2):design.md 禁彩色铁律要求
// 组件只能引用语义 token,不得出现硬编码色值或 Tailwind 品牌色阶。
// 几行断言守住全部组件,价值高于逐组件快照。

const COMPONENTS_DIR = new URL("./components/ui/", import.meta.url);

// 语义 token 之外的色值:hex、色彩函数、Tailwind 品牌色阶(blue-500 等)。
// text-white / text-black 是 shadcn 语义的一部分(destructive 等),不在禁止之列。
const FORBIDDEN =
  /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|hsl|oklch|oklab)\(|\b(?:blue|red|green|yellow|purple|pink|indigo|violet|cyan|teal|emerald|lime|amber|orange|rose|fuchsia|sky|slate|gray|zinc|neutral|stone)-\d/;

// 图标库/API 名里可能合法出现上述词根(如 lucide 的 CircleCheckIcon 不会命中,
// 但 class 字符串会)——逐行检查,注释与 import 行除外。
function violations(file: string): string[] {
  const source = readFileSync(new URL(file, COMPONENTS_DIR), "utf8");
  return source
    .split("\n")
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(
      ({ line }) => !line.startsWith("//") && !line.startsWith("import ") && FORBIDDEN.test(line),
    )
    .map(({ line, number }) => `${file}:${number} ${line}`);
}

describe("design.md 禁彩色铁律", () => {
  it("no component source contains hardcoded color values or brand palette classes", () => {
    const files = readdirSync(COMPONENTS_DIR).filter(
      (name) => name.endsWith(".tsx") && !name.includes(".test."),
    );
    expect(files.length).toBeGreaterThan(0);

    const found = files.flatMap(violations);
    expect(found).toEqual([]);
  });
});
