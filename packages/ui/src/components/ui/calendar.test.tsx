import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Calendar } from "./calendar";

// formatIsoDate 的存在理由是 SSR/CSR hydration:locale 相关 API 在 Node 与浏览器
// 解析结果不同。这里固定月份渲染,断言 data-day 是确定性的 ISO 格式。
describe("calendar deterministic data-day", () => {
  const markup = renderToStaticMarkup(<Calendar month={new Date(2026, 7, 15)} />);

  it("renders ISO YYYY-MM-DD data-day attributes", () => {
    expect(markup).toContain('data-day="2026-08-01"');
    expect(markup).toContain('data-day="2026-08-15"');
    expect(markup).toContain('data-day="2026-08-31"');
  });

  it("never leaks locale-dependent date strings into data-day", () => {
    const dataDays = markup.match(/data-day="[^"]*"/g) ?? [];
    expect(dataDays.length).toBeGreaterThan(0);
    for (const attr of dataDays) {
      expect(attr).toMatch(/^data-day="\d{4}-\d{2}-\d{2}"$/);
    }
  });
});
