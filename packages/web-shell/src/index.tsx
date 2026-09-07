"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@gitnapp/ui/components/ui/dropdown-menu";
// 跨 app 应用外壳：左栏功能区（bg-rail 主题轨）+ 顶栏功能 tab（同一面连续延伸）。
// 语义真相源：根 design.md「应用外壳：左栏功能区 + 顶栏功能 tab」。三端
// （content-factory / navigator / userportal）统一引用本包，不在 app 内另造外壳。
import {
  createContext,
  type MouseEvent,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
} from "react";

import { buttonVariants } from "./button";

export { Button, buttonVariants } from "./button";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// 本包不绑定路由框架：Next Link / React Router / 原生 <a> 是宿主的事，本包只声明
// 「链接长什么样」的契约。默认渲染原生 <a>（整页跳转，行为始终正确）；Next 消费方
// 在自己的根布局包一层 ShellLinkProvider 注入 next/link 换回客户端路由。
export interface ShellLinkProps {
  readonly href: string;
  readonly className?: string;
  readonly title?: string;
  readonly "aria-current"?: "page";
  readonly onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  readonly children?: ReactNode;
}
export type ShellLink = (props: ShellLinkProps) => ReactNode;

const DefaultShellLink: ShellLink = (props) => <a {...props} />;
const ShellLinkContext = createContext<ShellLink>(DefaultShellLink);

export function ShellLinkProvider({
  link,
  children,
}: {
  readonly link: ShellLink;
  readonly children: ReactNode;
}) {
  return <ShellLinkContext.Provider value={link}>{children}</ShellLinkContext.Provider>;
}

const RAIL_EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";

// 统一 Casdoor 登录提示页骨架（issue #515）。视觉基准 = User Portal `/login`：
// 居中低噪音背景 + 卡片 + 图标 + 应用名旁 Info tooltip + 全宽主按钮。
// 本组件不含任何认证逻辑或客户端 token，只渲染提示并指向各 app 自己的
// `/api/auth/login`；主按钮直接取共享 Button 的 `default/lg` class，
// 三端像素一致由同一真相源保证（见 ./button.tsx）。
const LOGIN_BUTTON_CLASS = buttonVariants({ size: "lg" });

export function CasdoorLoginPrompt({
  appName,
  icon,
  infoLabel,
  loginHref,
  loginLabel = "使用 Casdoor 登录",
  as = "main",
  disabled = false,
  error,
  notice,
  children,
}: {
  readonly appName: string;
  /** 外层 app shell 已提供 `<main>` landmark 时传 "div"，避免嵌套 landmark。 */
  readonly as?: "main" | "div";
  /** 卡片首行图标（锁 / 统一账号），由 app 注入自己的 icon set。 */
  readonly icon: ReactNode;
  /** Info tooltip 正文：登录、密码与 MFA 由 Casdoor 负责。 */
  readonly infoLabel: string;
  readonly loginHref: string;
  readonly loginLabel?: string;
  /** Casdoor 未配置等 fail-closed 状态：主按钮禁用但视觉层级不变。 */
  readonly disabled?: boolean;
  /** OAuth callback 等错误提示，显示在标题与主按钮之间。 */
  readonly error?: ReactNode;
  /** 主按钮下方的次要说明（如未配置原因）。 */
  readonly notice?: ReactNode;
  /** 已登录 continuation 等分支，替换主按钮留在同一卡片骨架内。 */
  readonly children?: ReactNode;
}) {
  const Root = as;
  return (
    <Root className="grid min-h-dvh place-items-center bg-muted/30 p-6 text-foreground">
      <section className="w-full max-w-md rounded-lg bg-card p-8 text-card-foreground">
        <span className="grid size-10 place-items-center rounded-lg border shadow-xs">{icon}</span>
        <div className="mt-6 flex items-center gap-1">
          <h1 className="text-2xl font-semibold">{appName}</h1>
          <LoginInfoHint label={infoLabel} />
        </div>
        {error ? (
          <p
            className="mt-5 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {children ?? (
          <a
            aria-disabled={disabled || undefined}
            className={cn(
              LOGIN_BUTTON_CLASS,
              "mt-7 w-full",
              disabled && "pointer-events-none bg-muted text-muted-foreground hover:bg-muted",
            )}
            data-slot="button"
            href={disabled ? undefined : loginHref}
          >
            {loginLabel}
          </a>
        )}
        {notice ? <p className="mt-3 text-xs text-muted-foreground">{notice}</p> : null}
      </section>
    </Root>
  );
}

// 与 userportal `components/info-hint.tsx` 同构：hover/focus-within 展开的
// 纯 CSS tooltip，键盘可达（button + focus ring），无客户端状态。
function LoginInfoHint({ label }: { readonly label: string }) {
  return (
    <span className="group relative inline-flex shrink-0 align-middle">
      <button
        aria-label={`说明：${label}`}
        className="grid size-6 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        type="button"
      >
        <svg
          aria-hidden
          className="size-3.5"
          fill="currentColor"
          height="1em"
          viewBox="0 0 256 256"
          width="1em"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z" />
        </svg>
      </button>
      <span
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 hidden w-72 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-md border bg-popover px-3 py-2 text-xs leading-5 text-popover-foreground shadow-overlay group-hover:block group-focus-within:block"
        role="tooltip"
      >
        {label}
      </span>
    </span>
  );
}

export function RailShell({
  sidebar,
  topbar,
  children,
}: {
  readonly sidebar: ReactNode;
  readonly topbar: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-rail text-rail-foreground">
      <div className="hidden h-full md:block">{sidebar}</div>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 顶栏：左栏主题面向上延伸的连续部分，包裹当前功能区的 tab */}
        <header className="hidden h-12 shrink-0 items-center gap-2 px-3 md:flex">{topbar}</header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 md:pl-0 md:pt-0">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-card text-card-foreground">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RailSidebar({
  brand,
  nav,
  footer,
  collapsed,
  testId,
}: {
  readonly brand: ReactNode;
  readonly nav: ReactNode;
  readonly footer?: ReactNode;
  readonly collapsed: boolean;
  readonly testId?: string;
}) {
  return (
    <aside
      data-testid={testId}
      className={cn(
        "relative flex h-full shrink-0 flex-col overflow-hidden transition-[width] duration-300",
        RAIL_EASE,
        collapsed ? "w-12" : "w-[260px]",
      )}
    >
      {/* 水平内边距在两态之间保持不变（design.md「图标位置在展开/折叠间不横向跳动」）：
          宽度是唯一被动画的量，任何跟着 collapsed 切换的水平 padding 都会让图标
          在切换瞬间横跳。品牌徽章 size-7 配 px-2.5 ⇒ 中心 24px，与 nav 图标列对齐。 */}
      <div className="flex h-12 shrink-0 items-center px-2.5">{brand}</div>
      <nav aria-label="功能区" className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
        {nav}
      </nav>
      {footer ? <div className={cn("pb-3", collapsed ? "px-1.5" : "px-3")}>{footer}</div> : null}
    </aside>
  );
}

// 品牌区（logo + 标题）：不可点击，几何/字号与 content-factory 的 ContentFactoryBrand 一致。
// 品牌徽章几何的唯一真相源（design.md「品牌区」：size-7 圆角细边 bg-card 徽章）。
// RailBrand 与 RailAppSwitcher 的下拉项共用，避免两处各写一份 class 字面量。
const BRAND_BADGE_CLASS =
  "grid size-7 shrink-0 place-items-center rounded-md border bg-card text-foreground/80 shadow-xs";

export function RailBrand({
  icon,
  title,
  collapsed = false,
  tone = "rail",
}: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly collapsed?: boolean;
  /** rail = 主题轨（标题 --rail-foreground/85）；card = 主内容面（移动端）。 */
  readonly tone?: "rail" | "card";
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className={BRAND_BADGE_CLASS}>{icon}</span>
      {!collapsed && (
        <span
          className={cn(
            "truncate text-sm font-normal",
            tone === "rail" ? "text-rail-foreground/85" : "text-foreground/85",
          )}
        >
          {title}
        </span>
      )}
    </span>
  );
}

export type RailApp = {
  readonly id: string;
  readonly name: string;
  readonly href: string;
  /** 由消费方注入自己的 icon family（design.md「图标」），本包不绑定图标库。 */
  readonly icon: ReactNode;
  readonly description?: string;
};

// 应用切换器：品牌区的可交互变体，用于在共用本外壳的产品之间跳转。
// 视觉完全复用 RailBrand（同一 size-7 徽章 + text-sm 标题），只多一个 chevron
// 与 hover/open 着色面，因此与不可点击的 RailBrand 在同一位置像素一致。
//
// 几何：品牌容器内边距 10px，触发器用 -mx-1 px-1 把着色面向外扩 4px——
// 徽章仍落在 x=10（中心 24px，与下方 nav 图标列对齐），折叠态着色面 36×36
// 是正方形且左右内缩对称（design.md「高亮几何」）。
export function RailAppSwitcher({
  apps,
  currentAppId,
  collapsed,
  chevronIcon,
  label = "切换应用",
}: {
  readonly apps: readonly RailApp[];
  readonly currentAppId: string;
  readonly collapsed: boolean;
  /** 展开态标题右侧的指示图标，由 app 注入。 */
  readonly chevronIcon: ReactNode;
  readonly label?: string;
}) {
  const Link = useContext(ShellLinkContext);
  const current = apps.find((app) => app.id === currentAppId) ?? apps[0];
  if (!current) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={collapsed ? `${current.name}：${label}` : undefined}
          title={collapsed ? current.name : undefined}
          className={cn(
            "-mx-1 flex items-center rounded-md px-1 py-1 outline-none transition-colors",
            "hover:bg-rail-foreground/5 focus-visible:ring-2 focus-visible:ring-rail-foreground/70",
            "data-[state=open]:bg-rail-foreground/10",
            collapsed ? "justify-center" : "w-full gap-2",
          )}
        >
          <span className="min-w-0 flex-1 text-left">
            <RailBrand collapsed={collapsed} icon={current.icon} title={current.name} />
          </span>
          {!collapsed && <span className="shrink-0 text-rail-foreground/50">{chevronIcon}</span>}
        </button>
      </DropdownMenuTrigger>
      {/* 下拉浮层在 popover 面而非主题轨上，配色改用 popover/muted token。 */}
      <DropdownMenuContent align="start" className="w-64" sideOffset={8}>
        <DropdownMenuLabel className="text-micro font-normal text-muted-foreground">
          {label}
        </DropdownMenuLabel>
        {apps.map((app) => {
          const isCurrent = app.id === current.id;
          return (
            <DropdownMenuItem asChild key={app.id}>
              <Link
                aria-current={isCurrent ? "page" : undefined}
                className="flex items-center gap-2"
                href={app.href}
              >
                <span className={BRAND_BADGE_CLASS}>{app.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{app.name}</span>
                  {app.description ? (
                    <span className="block truncate text-micro text-muted-foreground">
                      {app.description}
                    </span>
                  ) : null}
                </span>
                {/* 当前项用文字而非勾选图标标记：本包不绑定图标库。 */}
                {isCurrent ? (
                  <span className="shrink-0 text-micro text-muted-foreground">当前</span>
                ) : null}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RailNavLink({
  href,
  icon,
  label,
  active,
  collapsed,
  onClick,
}: {
  readonly href: string;
  readonly icon: ReactNode;
  readonly label: string;
  readonly active: boolean;
  readonly collapsed: boolean;
  readonly onClick?: () => void;
}) {
  const Link = useContext(ShellLinkContext);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-3 rounded-md text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rail-foreground/70",
        active
          ? "bg-rail-foreground/10 text-rail-foreground"
          : "text-rail-foreground/60 hover:bg-rail-foreground/5 hover:text-rail-foreground",
        // 高亮几何（design.md「高亮几何」）：折叠后只剩图标，着色面必须是正方形，
        // 用 size-8 钉成 32×32（正好填满 48px 图标轨的 px-2 内宽）并水平居中。
        // 展开态是整行长条，桌面高度与折叠态一致（32px = design.md 紧凑控件），
        // 触屏命中区仍靠 min-h-11 撑到 44px。
        // 注意：本包 cn() 是纯拼接、没有 tailwind-merge，两侧不得输出冲突的同族 class。
        //
        // 两态水平内边距必须等效（design.md「图标位置在展开/折叠间不横向跳动」）：
        // 折叠态图标居中于 32px 方块 ⇒ 等效 8px，展开态即 px-2。
        // 绝不能用 mx-auto：auto margin 按「正在 300ms 动画中的」轨宽实时求值，
        // 折叠瞬间会把图标甩到宽轨中点再滑回来（实测单帧 98px 的可见闪动）。
        // size-8 已等于折叠态 nav 的内宽，本就贴合左缘，无需 auto margin 居中。
        collapsed ? "size-8 justify-center" : "min-h-11 px-2 py-2.5 md:min-h-8 md:py-1.5",
      )}
    >
      {icon}
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

export type RailTab = {
  readonly label: string;
  readonly href: string;
  readonly active: boolean;
  readonly onClick?: () => void;
  /** 单 tab 功能区：渲染为不可点的当前位置 pill，而非导航链接（如 userportal）。 */
  readonly static?: boolean;
};

// 顶栏功能 tab：主题面 pill，选中/hover 都从 rail foreground 派生。
export function RailTabs({ tabs }: { readonly tabs: readonly RailTab[] }) {
  const Link = useContext(ShellLinkContext);
  return (
    <nav aria-label="当前功能区标签" className="flex items-center gap-1">
      {tabs.map((tab) =>
        tab.static ? (
          <span
            key={tab.label}
            aria-current={tab.active ? "page" : undefined}
            className="rounded-md bg-rail-foreground/10 px-2.5 py-1 text-sm text-rail-foreground"
          >
            {tab.label}
          </span>
        ) : (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            onClick={tab.onClick}
            className={cn(
              "rounded-md px-2.5 py-1 text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rail-foreground/70",
              tab.active
                ? "bg-rail-foreground/10 text-rail-foreground"
                : "text-rail-foreground/60 hover:bg-rail-foreground/5 hover:text-rail-foreground",
            )}
          >
            {tab.label}
          </Link>
        ),
      )}
    </nav>
  );
}

// 侧栏收起按钮：统一样式（design.md「应用外壳」）。鼠标点击后立即 blur，
// 避免焦点残留触发 tooltip/焦点环幻影；键盘切换（detail=0）保留焦点。
export function RailCollapseButton({
  collapsed,
  onToggle,
  icon,
}: {
  readonly collapsed: boolean;
  readonly onToggle: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly icon: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={collapsed ? "展开侧栏" : "收起侧栏"}
      title={collapsed ? "展开侧栏" : "收起侧栏"}
      onClick={(event) => {
        if (event.detail > 0) event.currentTarget.blur();
        onToggle(event);
      }}
      className="flex size-8 shrink-0 items-center justify-center rounded-md text-rail-foreground/60 transition-colors hover:bg-rail-foreground/10 hover:text-rail-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rail-foreground/70"
    >
      {icon}
    </button>
  );
}

// 主题轨底部用户区：头像 + 名称（可选链接）+ 说明 + 统一退出动作。
// 退出交互（图标按钮样式、hover 语义色、focus ring、可访问名称、GET/POST 差异）
// 全部收敛在这里，三端只提供身份数据、说明、账号链接与 logout endpoint/method。
const RAIL_LOGOUT_LABEL = "退出登录";
const RAIL_LOGOUT_CLASS =
  "flex size-8 shrink-0 items-center justify-center rounded-md text-rail-foreground/60 transition-colors hover:bg-rail-foreground/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function RailUserBlock({
  name,
  caption,
  collapsed,
  nameHref,
  logoutHref,
  logoutIcon,
  logoutMethod = "get",
  logoutLabel = RAIL_LOGOUT_LABEL,
}: {
  readonly name: string;
  readonly caption?: ReactNode;
  readonly collapsed: boolean;
  readonly nameHref?: string;
  /** 各 app 自己的 logout endpoint（如 `/api/auth/logout`）。 */
  readonly logoutHref: string;
  /** 退出图标，由 app 注入自己的 icon family（design.md「图标」）。 */
  readonly logoutIcon: ReactNode;
  /** GET = 普通链接导航；post = 显式表单提交。默认 get，无隐藏副作用。 */
  readonly logoutMethod?: "get" | "post";
  readonly logoutLabel?: string;
}) {
  const Link = useContext(ShellLinkContext);
  const avatarLabel = Array.from(name.trim())[0]?.toUpperCase() || "U";
  const identity = (
    <>
      <span className="block truncate text-sm font-medium leading-5 text-rail-foreground">
        {name}
      </span>
      {caption ? <span className="block text-micro text-rail-foreground/50">{caption}</span> : null}
    </>
  );

  return (
    <div
      className={cn(
        "border-t border-rail-foreground/10",
        collapsed
          ? "flex flex-col items-center gap-1.5 px-1 pt-3"
          : "flex items-center gap-2.5 pt-3",
      )}
      title={collapsed ? name : undefined}
    >
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-md bg-rail-foreground text-micro font-semibold text-rail ring-1 ring-rail-foreground/10"
      >
        {avatarLabel}
      </span>
      {!collapsed &&
        (nameHref ? (
          <Link
            href={nameHref}
            className="min-w-0 flex-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {identity}
          </Link>
        ) : (
          <span className="min-w-0 flex-1">{identity}</span>
        ))}
      {logoutMethod === "post" ? (
        <form action={logoutHref} className="shrink-0" method="post">
          <button
            aria-label={logoutLabel}
            className={RAIL_LOGOUT_CLASS}
            title={logoutLabel}
            type="submit"
          >
            {logoutIcon}
          </button>
        </form>
      ) : (
        <a
          aria-label={logoutLabel}
          className={RAIL_LOGOUT_CLASS}
          href={logoutHref}
          title={logoutLabel}
        >
          {logoutIcon}
        </a>
      )}
    </div>
  );
}

// 移动端顶栏（白色主区内）：菜单按钮 + 应用名 + 当前位置 + 当前功能区的子页 tab。
// 桌面顶栏（RailShell 的 `hidden md:flex` header）在移动端不渲染，因此二级 tab 必须
// 在这里给出等价入口，否则移动端只能切功能区、无法切当前功能区内的子页。
export function RailMobileHeader({
  title,
  currentLabel,
  onOpen,
  menuIcon,
  menuLabel = "打开侧边栏",
  tabs,
  trailing,
}: {
  readonly title: string;
  readonly currentLabel?: string;
  readonly onOpen: () => void;
  readonly menuIcon: ReactNode;
  /** 抽屉入口的可访问名称；各 app 的抽屉语义不同（侧边栏 / 导航菜单）。 */
  readonly menuLabel?: string;
  /** 当前功能区的子页 tab；<=1 个时不渲染 tab 行（无可切换目标）。 */
  readonly tabs?: readonly RailTab[];
  /** 右侧可选动作（如 content-factory 的任务历史入口），占位保持标题居中。 */
  readonly trailing?: ReactNode;
}) {
  return (
    <header className="bg-card px-4 py-2 md:hidden" data-slot="rail-mobile-header">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label={menuLabel}
          onClick={onOpen}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border text-foreground transition-colors hover:border-foreground/20 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {menuIcon}
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{currentLabel ?? title}</p>
        </div>
        {trailing ? (
          <span className="flex size-11 shrink-0 items-center justify-center">{trailing}</span>
        ) : (
          <span aria-hidden className="size-11 shrink-0" />
        )}
      </div>
      {tabs && tabs.length > 1 ? <RailMobileTabs tabs={tabs} /> : null}
    </header>
  );
}

// 移动端子页 tab 行：位于白色主区顶栏内，因此配色取 card 面而非主题轨。
// 横向可滚动以容纳较多 tab；命中区按 design.md「无障碍」在 coarse pointer 下 ≥44px。
function RailMobileTabs({ tabs }: { readonly tabs: readonly RailTab[] }) {
  const Link = useContext(ShellLinkContext);
  return (
    <nav
      aria-label="当前功能区标签"
      data-testid="rail-mobile-tabs"
      className="no-scrollbar -mx-1 mt-2 flex items-center gap-1 overflow-x-auto px-1"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          onClick={tab.onClick}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            tab.active
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

// 移动端抽屉：主题轨侧栏的滑入容器。
export function RailMobileDrawer({
  open,
  onClose,
  closeIcon,
  children,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly closeIcon: ReactNode;
  readonly children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusableElements = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);

    const frame = window.requestAnimationFrame(() => {
      (focusableElements()[0] ?? panel)?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = focusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        panel?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        aria-label="关闭菜单遮罩"
        aria-hidden
        tabIndex={-1}
        className="absolute inset-0 bg-black/50"
        onClick={() => onCloseRef.current()}
      />
      <div
        ref={panelRef}
        aria-label="导航菜单"
        aria-modal="true"
        data-testid="rail-mobile-drawer"
        role="dialog"
        tabIndex={-1}
        className="relative h-full w-72 max-w-[82vw] bg-rail text-rail-foreground shadow-lg"
      >
        <button
          type="button"
          aria-label="关闭侧边栏"
          onClick={() => onCloseRef.current()}
          className="absolute right-3 top-3 z-10 inline-flex size-8 items-center justify-center rounded-md border border-rail-foreground/15 text-rail-foreground/60 transition-colors hover:bg-rail-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rail-foreground/70"
        >
          {closeIcon}
        </button>
        {children}
      </div>
    </div>
  );
}
