import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  CasdoorLoginPrompt,
  type RailApp,
  RailAppSwitcher,
  RailBrand,
  RailBreadcrumb,
  RailCollapseButton,
  RailMobileDrawer,
  RailMobileHeader,
  RailNavLink,
  RailSidebar,
  RailTabs,
  RailUserBlock,
} from "./index";

describe("shared rail shell accessibility", () => {
  it("renders the mobile drawer as a labelled modal with one keyboard close control", () => {
    const markup = renderToStaticMarkup(
      <RailMobileDrawer closeIcon={<span>×</span>} onClose={() => undefined} open>
        <a href="/users">用户</a>
      </RailMobileDrawer>,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-label="导航菜单"');
    expect(markup).toContain('aria-label="关闭侧边栏"');
    expect(markup).toContain('aria-label="关闭菜单遮罩"');
    expect(markup).toContain('tabindex="-1"');
  });

  it("labels both navigation levels and preserves the mobile touch target", () => {
    const sidebar = renderToStaticMarkup(
      <RailSidebar
        brand={<span>Garage</span>}
        collapsed={false}
        nav={
          <RailNavLink active collapsed={false} href="/users" icon={<span>U</span>} label="用户" />
        }
      />,
    );
    const tabs = renderToStaticMarkup(
      <RailTabs tabs={[{ active: true, href: "/users", label: "用户" }]} />,
    );

    expect(sidebar).toContain('aria-label="功能区"');
    expect(sidebar).toContain("min-h-9");
    expect(sidebar).toContain('aria-current="page"');
    expect(tabs).toContain('aria-label="当前功能区标签"');
  });

  // 单 tab 功能区（userportal）没有可切换目标，当前位置必须是不可点的 pill，
  // 否则渲染出一个指向自己的链接。三端只保留这一份顶栏实现。
  it("renders a single-tab area as a static current-position pill instead of a link", () => {
    const markup = renderToStaticMarkup(
      <RailTabs tabs={[{ active: true, href: "/users", label: "用户", static: true }]} />,
    );

    expect(markup).toContain('aria-label="当前功能区标签"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain("bg-rail-foreground/10");
    expect(markup).not.toContain("<a ");
    expect(markup).not.toContain('href="/users"');
  });

  // 抽屉入口的可访问名称各 app 语义不同（侧边栏 / 导航菜单），由 prop 注入而非各自造 header。
  it("labels the mobile drawer trigger from the app-provided menu label and hosts trailing actions", () => {
    const markup = renderToStaticMarkup(
      <RailMobileHeader
        currentLabel="工作台"
        menuIcon={<span>≡</span>}
        menuLabel="打开导航菜单"
        onOpen={() => undefined}
        tabs={[
          { active: true, href: "/admin", label: "总览" },
          { active: false, href: "/admin/models", label: "聊天模型" },
        ]}
        title="内容工厂"
        trailing={<button type="button">任务历史</button>}
      />,
    );

    expect(markup).toContain('aria-label="打开导航菜单"');
    expect(markup).not.toContain('aria-label="打开侧边栏"');
    expect(markup).toContain("任务历史");
    expect(markup).toContain('data-testid="rail-mobile-tabs"');
    expect(markup).toContain("聊天模型");
  });

  it("defaults the mobile drawer trigger label and keeps the title centred without a trailing action", () => {
    const markup = renderToStaticMarkup(
      <RailMobileHeader
        currentLabel="概览"
        menuIcon={<span>≡</span>}
        onOpen={() => undefined}
        title="User Portal"
      />,
    );

    expect(markup).toContain('aria-label="打开侧边栏"');
    // 单 tab（或无 tab）不渲染移动端 tab 行：没有可切换目标。
    expect(markup).not.toContain('data-testid="rail-mobile-tabs"');
    expect(markup).toContain('class="size-11 shrink-0"');
    expect(markup).toContain('class="min-w-0 flex-1 text-center"');
  });

  it("does not expose a closed drawer in server output", () => {
    expect(
      renderToStaticMarkup(
        <RailMobileDrawer closeIcon={<span>×</span>} onClose={() => undefined} open={false}>
          <span>隐藏内容</span>
        </RailMobileDrawer>,
      ),
    ).toBe("");
  });

  it("derives rail interaction surfaces from the theme-aware foreground token", () => {
    const link = renderToStaticMarkup(
      <RailNavLink active collapsed={false} href="/users" icon={<span>U</span>} label="用户" />,
    );
    const toggle = renderToStaticMarkup(
      <RailCollapseButton collapsed={false} icon={<span>⇤</span>} onToggle={() => undefined} />,
    );

    expect(link).toContain("bg-rail-foreground/10");
    expect(toggle).toContain("hover:bg-rail-foreground/10");
    expect(`${link}${toggle}`).not.toContain("bg-white/");
  });

  // design.md「高亮几何」：折叠后图标轨里的高亮只剩图标，必须是正方形着色面。
  it("renders the collapsed rail highlight as a square colour surface", () => {
    const collapsed = renderToStaticMarkup(
      <RailNavLink active collapsed href="/users" icon={<span>U</span>} label="用户" />,
    );

    expect(collapsed).toContain("size-8");
    // 44px 命中区高度只属于展开态；带进折叠态会让高亮退化成 32×44 长方形。
    expect(collapsed).not.toContain("min-h-9");
    // 本包 cn() 没有 tailwind-merge，冲突的 padding 会同时留在 class 里。
    expect(collapsed).not.toContain("py-2.5");
    expect(collapsed).not.toContain("px-3");
  });

  it("keeps the expanded rail entry a full-width row with a compact visual target with transparent hit padding", () => {
    const expanded = renderToStaticMarkup(
      <RailNavLink active collapsed={false} href="/users" icon={<span>U</span>} label="用户" />,
    );

    expect(expanded).toContain("min-h-9");
    expect(expanded).toContain("px-2");
    expect(expanded).not.toContain("size-8");
  });

  // design.md「应用外壳」：「图标位置在展开/折叠间不横向跳动」。
  //
  // 图标的水平位置 = nav 容器 padding + 链接 padding。折叠态图标居中于 size-8
  // 方块，等效 padding = (32 - 16) / 2 = 8px，所以展开态也必须是 8px（px-2），
  // 且 nav 两态 padding 必须一致——否则切换瞬间图标横跳。
  //
  // 同时禁止 mx-auto：auto margin 按「正在 300ms 动画中的」轨宽实时计算，折叠
  // 瞬间会把图标甩到宽轨中点再一路滑回来。实测单帧位移 98px，是最刺眼的闪动源。
  it("pins the rail icon to the same horizontal offset in both states", () => {
    const collapsed = renderToStaticMarkup(
      <RailNavLink active collapsed href="/users" icon={<span>U</span>} label="用户" />,
    );
    const expanded = renderToStaticMarkup(
      <RailNavLink active collapsed={false} href="/users" icon={<span>U</span>} label="用户" />,
    );

    // auto margin 依赖动画中的容器宽度，任何一态都不得使用。
    expect(collapsed).not.toContain("mx-auto");
    expect(expanded).not.toContain("mx-auto");

    // 折叠态：32px 方块 + 居中图标 ⇒ 等效水平内边距 8px。
    expect(collapsed).toContain("size-8");
    expect(collapsed).toContain("justify-center");
    // 展开态：显式 8px 内边距，与折叠态等效值对齐。
    expect(expanded).toContain("px-2");
    expect(expanded).not.toContain("px-3");
  });

  it("keeps the rail nav container padding identical across collapse states", () => {
    const render = (collapsed: boolean) =>
      renderToStaticMarkup(
        <RailSidebar
          brand={<span>Garage</span>}
          collapsed={collapsed}
          nav={
            <RailNavLink
              active
              collapsed={collapsed}
              href="/users"
              icon={<span>U</span>}
              label="用户"
            />
          }
        />,
      );

    const navClass = (markup: string) => /<nav[^>]*class="([^"]*)"/.exec(markup)?.[1] ?? "";

    const collapsedNav = navClass(render(true));
    const expandedNav = navClass(render(false));

    expect(collapsedNav).not.toBe("");
    // nav 的水平 padding 是图标位置的一部分，两态不一致就会造成横向跳动。
    expect(collapsedNav).toBe(expandedNav);
  });

  it("renders the rail user avatar as a square, not a circle", () => {
    const markup = renderToStaticMarkup(
      <RailUserBlock
        collapsed={false}
        logoutHref="/api/auth/logout"
        logoutIcon={<span>退出</span>}
        name="张三"
      />,
    );

    expect(markup).toContain("size-8");
    expect(markup).toContain("text-micro");
    expect(markup).toContain("ring-1");
    expect(markup).not.toContain("rounded-full");
  });
});

describe("shared rail app switcher", () => {
  const apps: readonly RailApp[] = [
    {
      id: "cf",
      name: "Content Factory",
      href: "/cf",
      icon: <span>C</span>,
      description: "内容生产",
    },
    { id: "nav", name: "Navigator", href: "/nav", icon: <span>N</span> },
  ];
  const baseProps = { apps, chevronIcon: <span>⌄</span>, currentAppId: "cf" };

  it("reuses the RailBrand badge geometry so the two brand forms stay pixel-identical", () => {
    const brand = renderToStaticMarkup(
      <RailBrand collapsed={false} icon={<span>C</span>} title="Content Factory" />,
    );
    const switcher = renderToStaticMarkup(<RailAppSwitcher {...baseProps} collapsed={false} />);

    // design.md「品牌区」：切换器内部复用 RailBrand，徽章/标题规格不得分叉。
    expect(switcher).toContain("size-7");
    expect(switcher).toContain("bg-card");
    expect(switcher).toContain("text-rail-foreground/85");
    expect(brand).toContain("size-7");
    // 两者渲染同一段品牌标记。
    expect(switcher).toContain("Content Factory");
  });

  it("shows the current app and hides the chevron when collapsed", () => {
    const expanded = renderToStaticMarkup(<RailAppSwitcher {...baseProps} collapsed={false} />);
    const collapsed = renderToStaticMarkup(<RailAppSwitcher {...baseProps} collapsed />);

    expect(expanded).toContain("Content Factory");
    expect(expanded).toContain("⌄");
    // 折叠态只剩徽章：标题与指示图标都不渲染，着色面才能保持正方形。
    expect(collapsed).not.toContain("⌄");
    expect(collapsed).toContain('title="Content Factory"');
    expect(collapsed).toContain('aria-label="Content Factory：切换应用"');
  });

  // design.md「品牌区」：徽章水平中心固定 24px，折叠切换时不得横向位移。
  // 容器内边距 10px + 触发器 -mx-1/px-1 ⇒ 徽章仍落在 x=10，且着色面 36×36 为正方形。
  it("keeps the trigger colour surface square and the badge horizontally pinned", () => {
    const collapsed = renderToStaticMarkup(<RailAppSwitcher {...baseProps} collapsed />);

    expect(collapsed).toContain("-mx-1");
    expect(collapsed).toContain("px-1");
    expect(collapsed).toContain("py-1");
    // 折叠态不得出现只作用于展开态的宽度类，否则着色面退化成长方形。
    expect(collapsed).not.toContain("w-full");
  });

  it("falls back to the first app when currentAppId does not match", () => {
    const markup = renderToStaticMarkup(
      <RailAppSwitcher {...baseProps} collapsed={false} currentAppId="does-not-exist" />,
    );

    expect(markup).toContain("Content Factory");
  });

  it("renders nothing rather than crashing on an empty app list", () => {
    expect(
      renderToStaticMarkup(<RailAppSwitcher {...baseProps} apps={[]} collapsed={false} />),
    ).toBe("");
  });
});

describe("shared rail account block", () => {
  const baseProps = {
    logoutHref: "/api/auth/logout",
    logoutIcon: <span>⎋</span>,
    name: "林晨",
  };

  it("renders name, caption and an accessible logout action when expanded", () => {
    const markup = renderToStaticMarkup(
      <RailUserBlock {...baseProps} caption="管理员" collapsed={false} />,
    );

    expect(markup).toContain("林晨");
    expect(markup).toContain("管理员");
    expect(markup).toContain('aria-label="退出登录"');
    expect(markup).toContain('title="退出登录"');
    expect(markup).toContain('href="/api/auth/logout"');
  });

  it("keeps the avatar initial and a keyboard-reachable logout when collapsed", () => {
    const markup = renderToStaticMarkup(
      <RailUserBlock {...baseProps} caption="管理员" collapsed />,
    );

    // 折叠态只留头像首字母 + 退出动作，名称走容器 title tooltip。
    expect(markup).toContain(">林<");
    expect(markup).toContain('title="林晨"');
    expect(markup).not.toContain("管理员");
    expect(markup).toContain('aria-label="退出登录"');
    expect(markup).toContain("focus-visible:ring-2");
  });

  it("expresses the GET/POST logout difference through an explicit prop", () => {
    const get = renderToStaticMarkup(<RailUserBlock {...baseProps} collapsed={false} />);
    const post = renderToStaticMarkup(
      <RailUserBlock {...baseProps} collapsed={false} logoutMethod="post" />,
    );

    expect(get).toContain('<a aria-label="退出登录"');
    expect(get).not.toContain("<form");
    expect(post).toContain('action="/api/auth/logout"');
    expect(post).toContain('method="post"');
    expect(post).toContain('type="submit"');
    expect(post).not.toContain("<a ");
    // 两种 method 共享同一退出视觉规格（design.md「主题轨底部 = 用户区」）。
    expect(post).toContain("hover:text-destructive");
    expect(get).toContain("hover:text-destructive");
  });

  it("links the primary name to the optional account page only when provided", () => {
    const withAccount = renderToStaticMarkup(
      <RailUserBlock {...baseProps} collapsed={false} nameHref="/account" />,
    );
    const withoutAccount = renderToStaticMarkup(<RailUserBlock {...baseProps} collapsed={false} />);

    expect(withAccount).toContain('href="/account"');
    expect(withoutAccount).not.toContain('href="/account"');
  });

  it("falls back to a deterministic avatar initial for an empty display name", () => {
    expect(renderToStaticMarkup(<RailUserBlock {...baseProps} collapsed name="   " />)).toContain(
      ">U<",
    );
  });
});

describe("shared Casdoor login prompt", () => {
  const baseProps = {
    appName: "User Portal",
    icon: <span>🔒</span>,
    infoLabel: "登录、密码与多因素认证仍由 Casdoor 负责。",
    loginHref: "/api/auth/login?returnTo=%2F",
  };

  it("reproduces the User Portal card skeleton and links only to the app's own login route", () => {
    const markup = renderToStaticMarkup(<CasdoorLoginPrompt {...baseProps} />);

    // 视觉基准骨架（apps/userportal/app/login/page.tsx）逐类复刻。
    expect(markup).toContain(
      '<main class="grid min-h-dvh place-items-center bg-muted/30 p-6 text-foreground">',
    );
    expect(markup).toContain(
      '<section class="w-full max-w-md rounded-lg bg-card p-8 text-card-foreground">',
    );
    expect(markup).toContain('<h1 class="text-2xl font-semibold">User Portal</h1>');
    expect(markup).toContain('href="/api/auth/login?returnTo=%2F"');
    expect(markup).toContain("mt-7 w-full");
    expect(markup).toContain("使用 Casdoor 登录");
  });

  it("exposes the info hint to assistive tech and keyboard focus", () => {
    const markup = renderToStaticMarkup(<CasdoorLoginPrompt {...baseProps} />);

    expect(markup).toContain(`aria-label="说明：${baseProps.infoLabel}"`);
    expect(markup).toContain('role="tooltip"');
    expect(markup).toContain("group-focus-within:block");
    expect(markup).toContain("focus-visible:ring-ring");
  });

  it("keeps the login action inert and announced when Casdoor is unconfigured", () => {
    const markup = renderToStaticMarkup(
      <CasdoorLoginPrompt {...baseProps} disabled notice="当前环境缺少 Casdoor 配置。" />,
    );

    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain("pointer-events-none");
    expect(markup).toContain("当前环境缺少 Casdoor 配置。");
    // fail-closed：禁用时不得渲染可点击的 Casdoor 入口。
    expect(markup).not.toContain('href="/api/auth/login?returnTo=%2F"');
  });

  it("renders OAuth errors as an alert above the primary action", () => {
    const markup = renderToStaticMarkup(
      <CasdoorLoginPrompt {...baseProps} error="Casdoor 登录失败，请重新登录。" />,
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("text-destructive");
    expect(markup.indexOf("Casdoor 登录失败")).toBeLessThan(markup.indexOf("使用 Casdoor 登录"));
  });

  it("hosts an already-signed-in continuation inside the same card and drops the login button", () => {
    const markup = renderToStaticMarkup(
      <CasdoorLoginPrompt {...baseProps}>
        <a href="/artifacts">继续</a>
      </CasdoorLoginPrompt>,
    );

    expect(markup).toContain(
      '<section class="w-full max-w-md rounded-lg bg-card p-8 text-card-foreground">',
    );
    expect(markup).toContain("继续");
    expect(markup).not.toContain("使用 Casdoor 登录");
  });

  it("avoids a nested main landmark when the app shell already provides one", () => {
    const markup = renderToStaticMarkup(<CasdoorLoginPrompt {...baseProps} as="div" />);

    expect(markup).not.toContain("<main");
    expect(markup).toContain(
      '<div class="grid min-h-dvh place-items-center bg-muted/30 p-6 text-foreground">',
    );
  });
});

it("renders clickable ancestors and a non-interactive current breadcrumb", () => {
  const html = renderToStaticMarkup(
    <RailBreadcrumb items={[{ label: "目录", href: "/library" }, { label: "详情" }]} />,
  );
  expect(html).toContain('href="/library"');
  expect(html).toContain('aria-current="page"');
  expect(html.match(/<a /g)).toHaveLength(1);
});

it("uses the standard compact path surface and shared navigation metrics", () => {
  const html = renderToStaticMarkup(
    <RailBreadcrumb
      compact
      items={[
        { label: "标的列表", href: "/stocks" },
        { label: "公司", href: "/stocks/AMD" },
        { label: "报告", href: "/stocks/AMD/reports" },
      ]}
    />,
  );
  expect(html).toContain("rui-rail-breadcrumb");
  expect(html).toContain("rui-compact-path");
  expect(html.match(/rui-nav-item-metrics/g)).toHaveLength(3);
  expect(html.match(/rui-path-ancestor/g)).toHaveLength(2);
});
