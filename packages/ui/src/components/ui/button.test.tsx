import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button, buttonVariants } from "./button";

// 只测本地定制部分(design.md「间距与尺寸」+ 按压反馈 + 44px 命中区),
// 不重复测 Radix/cva 的行为。见 docs/engineering/roadmap.md §2.2。
describe("button design.md customizations", () => {
  it("uses the compact 32px default height and 36px form-primary height, not shadcn defaults", () => {
    expect(buttonVariants({ size: "default" })).toContain("h-8");
    expect(buttonVariants({ size: "lg" })).toContain("h-9");
  });

  it("keeps press feedback with a reduced-motion escape hatch", () => {
    const classes = buttonVariants();
    expect(classes).toContain("active:scale-[0.98]");
    expect(classes).toContain("motion-reduce:transform-none");
  });

  it("does not enlarge the visible mobile button with utility min sizes", () => {
    expect(buttonVariants()).not.toContain("max-md:min-h-11");
    for (const size of ["icon", "icon-xs", "icon-sm", "icon-lg"] as const) {
      expect(buttonVariants({ size })).not.toContain("max-md:min-w-11");
    }
  });

  it("renders data-variant/data-size hooks for inspection", () => {
    const markup = renderToStaticMarkup(<Button size="icon">×</Button>);
    expect(markup).toContain('data-variant="default"');
    expect(markup).toContain('data-size="icon"');
    expect(markup).toContain("size-8");
  });
});
