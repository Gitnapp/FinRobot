// @vitest-environment jsdom
//
// a11y 自动化验证的降级方案:docs/engineering/roadmap.md §3 原本建议把 axe-core
// 挂在 gallery 上,但那需要浏览器(Playwright 暂缓引入,§2.3)。jsdom 里跑
// axe-core 覆盖不了依赖布局/真色计算的规则(如 color-contrast 只会报
// incomplete),但能守住语义类违规——命名、角色、aria 引用等。
import { run } from "axe-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { Switch } from "./switch";

async function axeViolations(markup: string) {
  // axe 的 region 规则要求内容落在 landmark 内;测试片段包一层 main,
  // 与真实页面(gallery / 三端外壳均有 landmark)一致。
  document.body.innerHTML = `<main>${markup}</main>`;
  const results = await run(document.body, {
    // jsdom 无布局与真色计算,该规则无法可靠求值;交给未来的浏览器几何断言层。
    rules: { "color-contrast": { enabled: false } },
  });
  return results.violations.map(
    (violation) => `${violation.id}: ${violation.nodes.length} node(s)`,
  );
}

describe("axe-core a11y (jsdom)", () => {
  it("button variants have no violations", async () => {
    const markup = renderToStaticMarkup(
      <div>
        <Button>保存</Button>
        <Button variant="destructive">删除</Button>
        <Button variant="outline">取消</Button>
        <Button aria-label="关闭" size="icon">
          ×
        </Button>
      </div>,
    );
    expect(await axeViolations(markup)).toEqual([]);
  });

  it("labelled form controls have no violations", async () => {
    const markup = renderToStaticMarkup(
      <div>
        <Label htmlFor="name">名称</Label>
        <Input id="name" />
        <Switch aria-label="启用通知" />
      </div>,
    );
    expect(await axeViolations(markup)).toEqual([]);
  });
});
