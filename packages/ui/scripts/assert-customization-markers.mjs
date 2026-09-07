// 断言所有相对 shadcn CLI 产物做过本地定制的组件仍带有 `@gitnapp-customized` 标记。
// 若有人用 `shadcn add <name> -y -o` 直接覆盖,标记会随定制一起被冲掉——
// 本脚本让这件事在 CI 上显式失败,而不是静默回退成上游默认值。
// 新增本地定制时:在文件头部加同样格式的标记注释,并把文件加进下面列表。
import { readFileSync } from "node:fs";

const MARKER = "@gitnapp-customized";
const CUSTOMIZED_FILES = [
  "src/components/ui/button.tsx",
  "src/components/ui/calendar.tsx",
  "src/components/ui/sonner.tsx",
];

const invalid = CUSTOMIZED_FILES.filter((file) => {
  const head = readFileSync(new URL(`../${file}`, import.meta.url), "utf8")
    .split("\n")
    .slice(0, 6)
    .join("\n");
  return !head.includes(MARKER);
});

if (invalid.length > 0) {
  console.error(`以下定制文件的头部缺少 ${MARKER} 标记:`);
  for (const file of invalid) console.error(`  ${file}`);
  console.error(
    "\n若刚用 shadcn CLI 覆盖过这些文件,请先从 git 历史恢复本地定制并重新加回标记。详见 docs/engineering/roadmap.md §1.2。",
  );
  process.exit(1);
}

console.log(`ok: ${CUSTOMIZED_FILES.length} 个定制文件均带有 ${MARKER} 标记`);
