---
version: 1
name: Garage Web Design System
description: >
  Garage Web 应用共享设计系统，以内容工厂（content-factory）为主要参考实现。
  ChatGPT 式黑白（monochrome）：纯中性 token、
  无品牌彩色 accent（对比本身即层级），语义色仅用于状态。Light-first，含系统暗色。
  技术栈 shadcn + Tailwind v4，内容工厂另用 assistant-ui。本文件是设计真相源；token 的 CSS 面
  已抽为共享包 packages/design-tokens（navigator/userportal 同用），改语义先改这里，
  再同 PR 改共享包与 app/globals.css。
principles:
  - 单色克制：不引入品牌彩色 accent，靠近黑主色 / 白面 / 中性灰的对比拉层级。
  - 语义色仅限状态：success / warning / destructive 只表达状态，绝不作装饰。
  - 排版承载性格：刻意的字号字重与紧致字距，而非默认标度。
  - 文案即设计：UI self-explanatory，如实命名，无营销填充词。
  - 动效只为澄清变化：可预测 tween，尊重 reduced-motion，绝不弹跳。
colors:
  light:
    background: "oklch(0.971 0 0)"      # 页面底（软中性）
    foreground: "oklch(0.16 0 0)"       # 主文本（近黑）
    card: "oklch(1 0 0)"                # 抬升面（纯白，卡片/主区）
    card-foreground: "oklch(0.16 0 0)"
    popover: "oklch(1 0 0)"
    popover-foreground: "oklch(0.16 0 0)"
    primary: "oklch(0.19 0 0)"          # 主操作填充（近黑）
    primary-foreground: "oklch(0.985 0 0)"
    rail: "oklch(0.971 0 0)"             # 浅色外壳轨（左栏 + 顶栏 tab 区）
    rail-foreground: "oklch(0.16 0 0)"
    secondary: "oklch(0.94 0 0)"        # 次级面 / 选中态底
    secondary-foreground: "oklch(0.19 0 0)"
    muted: "oklch(0.94 0 0)"            # 静默面 / 用户气泡 / hover 底
    muted-foreground: "oklch(0.556 0 0)" # 次要文本
    accent: "oklch(0.94 0 0)"           # 交互 hover 底（中性，非品牌色）
    accent-foreground: "oklch(0.19 0 0)"
    border: "oklch(0.916 0 0)"
    input: "oklch(0.916 0 0)"
    ring: "oklch(0.708 0 0)"            # 焦点环（中性，非蓝）
  dark:
    background: "oklch(0.145 0 0)"
    foreground: "oklch(0.985 0 0)"
    card: "oklch(0.205 0 0)"
    card-foreground: "oklch(0.985 0 0)"
    popover: "oklch(0.205 0 0)"
    popover-foreground: "oklch(0.985 0 0)"
    primary: "oklch(0.922 0 0)"
    primary-foreground: "oklch(0.205 0 0)"
    rail: "oklch(0.1 0 0)"               # 深色轨不反转，保持全站最深面
    rail-foreground: "oklch(0.985 0 0)"
    secondary: "oklch(0.269 0 0)"
    secondary-foreground: "oklch(0.985 0 0)"
    muted: "oklch(0.269 0 0)"
    muted-foreground: "oklch(0.708 0 0)"
    accent: "oklch(0.269 0 0)"
    accent-foreground: "oklch(0.985 0 0)"
    border: "oklch(1 0 0 / 10%)"
    input: "oklch(1 0 0 / 15%)"
    ring: "oklch(0.556 0 0)"
  status:
    # 唯一允许的 chroma。只表状态，成对 class 定义在 app/_components/resource-ui.tsx。
    destructive-light: "oklch(0.577 0.245 27.325)"
    destructive-dark: "oklch(0.704 0.191 22.216)"
    success: "emerald-500 家族（border/bg 低透明 + text-emerald-700 / dark:text-emerald-300）"
    warning: "amber-500 家族（border/bg 低透明 + text-amber-700 / dark:text-amber-300）"
typography:
  fontFamily:
    sans: '"Geist", "Geist Fallback", ui-sans-serif, system-ui, sans-serif'
    mono: '"Geist Mono", "Geist Mono Fallback", ui-monospace, monospace'
  weights: [400, 500, 600]   # 单视图 ≤3 档；不使用 700
  scale:
    display-2xl: { size: 24px, weight: 600, lineHeight: 1.25, tracking: -0.019em }   # 欢迎大标题
    heading-xl:  { size: 20px, weight: 600, lineHeight: 1.4,  tracking: -0.017em }
    heading-lg:  { size: 18px, weight: 600, lineHeight: 1.5,  tracking: -0.014em }
    body-base:   { size: 16px, weight: 400, lineHeight: 1.6,  tracking: -0.006em }   # 正文 / composer 输入
    reading:     { size: 15px, weight: 400, lineHeight: 2rem, tracking: -0.003em }   # 长文预览 / 提词器
    ui-sm:       { size: 14px, weight: "400/500", lineHeight: 1.45, tracking: -0.003em } # 默认 UI 文本
    label-xs:    { size: 12px, weight: "400/500", lineHeight: 1.4, tracking: 0 }        # 标签 / 元信息
    micro:       { size: 11px, weight: 500, lineHeight: 1.35, tracking: 0.01em }        # 最小元信息（替代 text-[10/11px]）
    eyebrow:     { size: 12px, weight: 500, transform: uppercase, tracking: 0.06em }    # 分区小标题
  opticalSizing: "body 开启 font-optical-sizing: auto；大字号收紧字距，小字号略放。"
  numerals: "数字用 tabular-nums（统计/时间/计数），必要时配 Geist Mono 对齐。"
spacing:
  base: 4px
  scale: [4, 8, 12, 16, 24, 32, 40, 64]
  rhythm: "组内 8px，组间 16px，区块间 24–32px。"
layout:
  shellInset: 8px
  headerHeight: 48px
  sidebar:
    expanded: 260px
    collapsed: 48px        # 图标轨（w-12）
    surface: "主题 token --rail（light 跟随页面底；dark 比 background 更深）"
    toggle: "PanelLeft ghost icon button（size-8 / 16px icon），tooltip 收起侧栏/展开侧栏"
  content:
    standard: 1024px
    wide: 1180px
    narrow: 672px
  gutter:
    mobile: 20px
    tablet: 24px
    desktop: 32px
controls:
  compactHeight: 32px
  comfortableHeight: 36px
  touchTarget: 44px
icons:
  family: "业务/导航图标 Phosphor（Navigator / User Portal）；组件内部结构性图标随 @gitnapp/ui 走 Lucide；Content Factory 保留现有 Lucide primitive"
  weight: regular
  sizes: [16px, 20px]
  rule: "同一 surface 的业务图标只用一个图标家族；优先圆润轮廓，禁止手绘 SVG 与 emoji 图标。"
rounded:
  base: 0.5rem     # --radius（与 app/globals.css 同步；2026-07-09 resource UI polish 收紧）
  sm: calc(radius - 4px)
  md: calc(radius - 2px)
  lg: radius
  xl: calc(radius + 4px)
  full: 9999px      # 文字 pill chip / badge / 进度条与状态点；不用于 rail 图标位高亮
  composer: 1.5rem  # composer 外壳
motion:
  durations: { instant: 0ms, fast: 100ms, base: 200ms, sheet: 250ms, slow: 300ms }
  easing:
    standard: "cubic-bezier(0.22, 1, 0.36, 1)"   # 平滑收尾，无过冲
    nav-indicator: "standard / tween 360ms"
  reducedMotion: "全局归零位移/缩放；dialog/sheet 仅保留 140–160ms opacity crossfade；motion 组件用 MotionConfig reducedMotion=user。"
accessibility:
  touchTargets: "coarse pointer 下所有 button 至少 44×44px；桌面密度不变。检测必须用 (hover: none) and (pointer: coarse)（主输入为触摸），禁止单独用 any-pointer/hover: none——触屏 Windows 桌面会误命中。"
  reducedTransparency: "prefers-reduced-transparency 下浮层改为实色且关闭 backdrop blur。"
  increasedContrast: "prefers-contrast: more 下强化 border、ring 与浮层边界。"
---

# Garage Web 设计系统

## 概述

内容工厂是共享视觉语言的主要参考实现：聊天/agent 主区 + 折叠会话侧栏 + 资产库/看板 tab。
Navigator 与 User Portal 复用同一套视觉语法，但保留各自的信息架构与任务密度。
三者都定位为「精密仪表」而非营销落地页：**黑白单色、克制、信息密度高**。视觉记忆点不靠颜色，
靠排版的精确、层级的干净、以及近黑/纯白的高对比。参照物是 ChatGPT 的黑白质感。

本文件与 `packages/design-tokens/tokens.css`（共享底座）+ `app/globals.css`（app 特有层）
是同一套 token 的两个面：改语义先改这里，再改 CSS。

### 模式与设计强度

三个应用都属于 **Operate** 模式：用户进入页面是为了完成任务，不是浏览品牌故事。

- `DESIGN_VARIANCE = 4`：保留既有产品心智，只在层级、比例与细节上形成辨识度。
- `MOTION_INTENSITY = 3`：动效只表达导航、展开、保存与状态切换。
- `VISUAL_DENSITY = 8`：桌面紧凑、移动端可触达，信息不因“高级感”被稀释。

### 共享几何

- 应用外壳统一为 `8px` inset，主 surface 使用 `rounded-lg`；移动端也保留外壳边界。
- 顶部 chrome 高度统一 `48px`。紧凑控件统一 `32px`，重要或表单主控件可用 `36px`；
  触屏只扩大命中区到 `44px`，不改变视觉图标尺寸。
- 标准内容宽度 `1024px`，数据密集型宽内容 `1180px`，账号/表单窄内容 `672px`。
  gutter 依次为移动端 `20px`、平板 `24px`、桌面 `32px`。
- 禁止用孤立的大块灰色 hero、装饰圆形、卡片套卡片制造层级。优先留白、分组间距、细边与 tonal surface。

### 高亮几何

**高亮部分必须是正方形。** 「高亮」= 表达选中 / 激活 / hover 的**独立着色面**（导航 active
indicator、图标轨入口、icon-only 控件的 hover 面、主题轨用户区头像等图标位）。当着色面里
只有图标、两侧没有文字撑宽度时，宽高必须相等——用 `size-*`（如 `size-8` = 32×32）钉死，
禁止靠 `px-*`/`py-*` 拼出 32×40 这类近似方形的长方形。

- 折叠态图标轨（`48px`）的入口高亮固定 `size-8` 并水平居中。触屏命中区只在展开态用
  `min-h-11` 撑到 44px，**不得把 44px 高度带进折叠态**，否则高亮退化成长方形。
- 主题轨用户区头像是 `size-9` 正方形着色面，走 `rounded-md`，不用 `rounded-full`。
  正方形指外形轮廓，圆角仍沿用同一半径家族（见 圆角与层级）。
- 带文字的高亮（顶栏功能 tab、列表行、下拉项、pill chip / badge）宽度由文字决定，
  不受本条约束；进度条、状态点等纯装饰轨也不受约束。
- 本条约束**共享外壳** `packages/web-shell` 与三端 shell 的 rail 表面；各 app 页面内的
  头像组件（如 CF `components/ui/avatar.tsx`）按各自 shadcn variant 演进，不由本条强制迁移。

### 应用外壳：左栏功能区 + 顶栏功能 tab

- **两级导航分工**：左栏是**功能区**（一级导航，承载功能入口与全局动作）；顶栏是**当前
  功能区内的 tab**（二级导航）。tab 属于功能区、不跨区复用；切左栏功能区才换顶栏 tab 组。
- **主题面连续延伸**：左栏使用专用 token `--rail` / `bg-rail`，light 跟随软中性页面底，
  dark 保持比 `background` 更深；同一主题面向上延伸覆盖顶栏，把功能 tab 包裹在连续面内。
  左栏与顶栏之间不留白缝、不用 border 切断。主内容区保持 `card` 抬升面 +
  `rounded-lg` + 8px inset，靠同主题内的 tonal 对比表达外壳层级。
- **主题面上的 tab**：未选中 = `--rail-foreground` 60% 文本，hover =
  `bg-rail-foreground/5`；选中 = `bg-rail-foreground/10` + `--rail-foreground` 文本；
  active indicator 沿用 layout tween ~360ms。两种主题都不用固定 white/black 透明色，
  不用彩色或阴影分层，焦点环保持可见。
- **侧栏收起按钮统一样式**（以 content-factory 为准）：顶栏最左侧 `PanelLeft` ghost icon
  button（`size-8`、icon 16px），aria-label/tooltip「收起侧栏 / 展开侧栏」；折叠后左栏收成
  `48px` 图标轨，品牌与入口只留图标，图标位置在展开/折叠间不横向跳动。禁止各 app 自造收起
  按钮形态（如 navigator 的侧栏底部整行按钮）。
- **品牌区（logo + 标题）**：样式真相源是 content-factory 的 `ContentFactoryBrand`——
  `size-7` 圆角细边 `bg-card` 徽章（icon 16px）+ `text-sm font-normal` 85% 标题。
  主题轨上徽章保持 `bg-card`，标题色用 `--rail-foreground/85`。三端（content-factory /
  navigator / userportal）统一引用此规格，不各自改造字号、字重或徽章几何。
  品牌区有且只有两种形态，都由 `packages/web-shell` 渲染，不得各自另造：
  - `RailBrand`——**不可点击**的纯标识，用于不提供跨产品跳转的场景。
  - `RailAppSwitcher`——**应用切换器**：品牌区的唯一合法可交互形态，用于在共用本外壳的
    产品之间跳转。徽章与标题规格与 `RailBrand` 完全一致（内部即复用它），只在展开态标题右侧
    多一个指示图标，hover/展开态着色面取 `bg-rail-foreground/5` 与 `/10`。
    折叠态只剩徽章，着色面必须是正方形（见 高亮几何）且左右内缩对称；徽章水平中心固定
    `24px`，与下方 nav 图标列对齐——切换折叠状态时品牌徽章不得横向位移。
    下拉浮层位于 popover 面而非主题轨，配色改用 `popover` / `muted` token；当前项以
    `aria-current="page"` 标记。
- **主题轨底部 = 用户区**：头像（首字母 `size-9` 正方形着色面，`bg-rail-foreground`）+ 名称
  （可带说明文字或链接）+ 退出动作；折叠态只留头像。整块由 `RailUserBlock` 统一渲染：
  退出的图标按钮几何、
  hover 语义色、focus ring 与可访问名称都钉在包里，app 只传身份数据、说明、可选账号链接与
  自己的 logout endpoint；GET/POST 差异由显式 `logoutMethod` 表达（post 渲染表单提交），
  不由 app 各自拼 form/link。**主名称必须是用户可读名称**，按
  `displayName?.trim() || name?.trim() || subject` 兜底，`subject` 只在缺少 profile
  （PAT、local-dev 等）时兜底；展示名只用于展示，鉴权/归属/审计仍只用 immutable `subject`。
- **共享实现**：外壳组件统一来自 `packages/web-shell`（`@gitnapp/web-shell`：`RailShell` /
  `RailSidebar` / `RailBrand` / `RailNavLink` / `RailTabs` / `RailCollapseButton` /
  `RailUserBlock` / 移动端顶栏与抽屉），三端只组装、不另造外壳。`Button` 收敛在
  `packages/ui`（`@gitnapp/ui` 的 `Button` / `buttonVariants`，真相源
  `packages/ui/src/components/ui/button.tsx`；`@gitnapp/web-shell` 的 `button.tsx` 只做转出）：
  size 与 variant 表只有一份，各 app 的 `components/ui/button` 只做转出，禁止分叉尺寸或复刻 class 字面量。
  移动端顶栏（`RailMobileHeader`）必须能切换当前功能区的子页 tab——桌面顶栏在移动端不渲染，
  缺这一行等于移动端无法进入同功能区的其它子页。折叠切换时的 hover/focus
  交互护栏钉在包里：鼠标点击后 blur，侧栏 transition 期间不得对 header/aside 使用全局
  `pointer-events:none`，确保鼠标、触屏和键盘的每次 toggle 都生效。content-factory 的会话
  列表不注入外壳：它是工作台页（`/` 与 `/chat/[id]`）主内容面内的页面元素（移动端经外壳
  顶栏按钮唤起 Sheet），离开工作台组即不渲染。移动端抽屉必须使用 modal dialog 语义，打开后把焦点移入、
  Tab/Shift+Tab 限制在抽屉内、Escape 关闭，并在关闭后把焦点还给触发按钮。
- 折叠/展开动效沿用「单一 width tween 300ms」（见 动效）；顶栏 tab 区不随折叠位移。

### 标题层级

- 页面只有一个 `h1`：`20–24px / 600`，承担当前任务名称。
- 页面区块使用 `h2`：`16–18px / 500–600`；列表项/卡片标题使用 `h3`：`14px / 500–600`。
- 标题上方不重复放 eyebrow；同级标题不得只靠颜色区分。
- Info icon 只解释非显然的边界、规则或风险。明显标题（如“用户”“工作场景”）不加；
  不可忽略的错误、警告、权限状态与结果必须常驻可见，不能藏进 tooltip。

### 图标

- 业务与导航图标：Navigator 与 User Portal 统一使用 Phosphor `regular` 圆润轮廓；同一 surface 不混 Lucide、emoji 或手绘 SVG。
- 组件内部结构性图标（下拉箭头、关闭 X、勾选对号等）随 `@gitnapp/ui` 组件走 Lucide——它们是组件实现的一部分而非业务语义，不计入 surface 的家族混用。
- Content Factory 已有 Lucide/assistant-ui primitive 时保持原家族，避免无价值的大规模替换。
- 默认 UI 图标 `16px`，导航/工作台图标 `20px`；icon-only 控件必须有本地化可访问名称。
- 图标只帮助识别动作或对象，不作为标题旁装饰。退出等危险动作只在 hover/focus 显示语义色。

## 颜色

**纯中性，chroma = 0。** 页面用 `background`（软中性）打底，卡片/主区用 `card`（纯白 / 暗色抬升）
浮起；层级只由 `foreground → muted-foreground` 的灰阶与 `border` 表达。

- 主操作 = `primary`（近黑填充 + 近白字），一屏只给最重要的一个动作。
- hover / 选中 = `muted` / `secondary` / `accent`（都是中性灰底），**不是**品牌色。
- 焦点环 `ring` 为中性灰，不用蓝。每个可交互元素 `:focus-visible` 必须可见。

**禁止品牌彩色 accent。** 历史上散落的 `blue-*`（directive chip、dot-matrix、badge、tool）
一律归中性 token。唯一允许的 chroma 是**语义状态色**：`destructive`（错误/删除）、
`success`（emerald）、`warning`（amber）——只用于状态，配对 class 见 `resource-ui.tsx`，
禁止在页面里复制色值字面量。

## 排版（字号字重）

Geist Sans 承载 UI 与正文，Geist Mono 承载代码/数据/需对齐的数字。**单视图最多 3 档字重
（400/500/600），不使用 700。** 大字号收紧字距，小字号略放，见 frontmatter `typography.scale`。

- 标题用 `heading-*` / `display-2xl`：600 + 负字距；欢迎语是全站唯一的大标题（24px）。
- 分区小标题用 `eyebrow`：12px / 500 / uppercase / +0.06em，中性灰。
- 默认 UI 文本 `ui-sm`（14px），元信息 `label-xs`（12px），最小元信息 `micro`（11px）——
  **不要再用任意值 `text-[10px]/[11px]/[13px]`**，统一到标度。
- 数字一律 `tabular-nums`（统计、计时、计数），避免跳动。
- body 开启抗锯齿（`-webkit-font-smoothing: antialiased`）与 optical sizing。

## 间距与布局

4px 标度（见 frontmatter）。布局语言（`AgentChatShell` / `ContentPageShell` 共用）：
主题轨外底（左栏 + 顶栏功能 tab 区连续延伸，见「应用外壳」）+ `p-2` 内缩 +
圆角 `bg-card` 主区，header 高 `h-12`。资源页主区
`mx-auto` 居中、`p-4 sm:p-6`。聊天线宽 `--thread-max-width: 44rem`。

资源 tab 内容宽度统一 `max-w-5xl`（真相源 `content-resource-shell.tsx` 的 `STANDARD_CONTENT`），
切 tab 时内容左右边界不跳；**禁止**再按 tab 各给不同 `max-w`。唯一例外是 `/kb` 满宽聊天式
布局（`max-w-none` + 主区 `p-0`）。route-level `loading.tsx` 的 skeleton 不自带 `max-w`，
用 `w-full` 服从共享容器，避免加载→内容的宽度跳变。

资源页标题行只放**标题 + hover info**；说明文字不常驻。视频/录音/研报/博主/知识库的库选择
与管理控件必须另起一行，页面动作也不得挤进标题行。route skeleton 使用同一结构。

避免 card-in-card 同色套嵌：卡片浮于 `card` 面时用 `border` 或 `muted` 底做 tonal 区分，
而不是再叠一层同色卡片。

版本轨、筛选状态、计数等短标签统一用 pill chip：`rounded-full` + 细 `border` + 中性 `secondary`
选中底，数字用 `tabular-nums`；语义色只用于定稿/未解决等状态文本或 badge。

## 圆角与层级

层级优先用**色调面 + 细边**，阴影克制。半径见 frontmatter；一屏保持同一半径家族，
不混圆角与直角。composer 用 1.5rem 大圆角，带文字的 pill chip / badge 用 full；
rail 图标位高亮与主题轨头像是正方形 + `rounded-md`（见 高亮几何）。

**浮层高度只有一档**：popover / dropdown / select / 选择器菜单 / 悬浮工具条 / toast
统一用 `shadow-overlay`（token `--overlay-shadow`），大扩散、低不透明，靠柔和衰减表达
抬升，不用 Tailwind 默认的 `shadow-md`/`shadow-lg`（短模糊 + 高不透明，在单色浅底上
显重）。浅色 `0 6px 24px -8px / 12%`；深色因 `popover` 与 `card` 同亮度、没有色调差可
依赖，改用 `0 8px 28px -8px / 55%` 由阴影独立承担分离。带遮罩的 dialog / sheet 不属于
本档——遮罩已经完成分离，沿用各自的模态阴影。

## 动效

**动效只为澄清状态变化，绝不装饰。** 统一 tween，禁止 spring/bounce，尊重 reduced-motion
（全局 media reset + `MotionConfig reducedMotion="user"`）。

- **切换顶部 tab 不做 entrance 渐入**：`ContentPageShell` 主区不得 `initial/animate` 淡入位移
  （路由切换时闪一下 = glitchy，已移除）。
- **侧栏折叠/展开 = 单一 width tween**，`duration ≈ 300ms`（比 200ms 稍慢更稳）+ standard easing；
  内部 label/列表只用 opacity 与容器同步淡入淡出，**不要**各自 animate `max-width`/`padding`/`transform`
  或加不对称 `delay`（多速度叠加 = 卡顿）。
- 导航 active indicator 用 layout tween ~360ms（`nav.tsx`），让背景铺满变化可感知但不拖沓。
- dialog / sheet 进出使用对称的 250ms standard tween，不用 spring；reduced-motion 下只 crossfade。
- 已经存在的聊天历史消息不做 entrance animation；流式状态只在当前状态控件上表达。
- spinner 用 linear 循环；hover/press 用 fast（~100ms）。所有共享按钮按下立即缩放至 0.98，
  reduced-motion 下关闭缩放。

## 无障碍与系统偏好

- 桌面保持紧凑密度；`(hover: none) and (pointer: coarse)` 下共享按钮点击区域至少 44×44px。
- 所有 icon-only 控件使用页面语言的可访问名称，中文界面不暴露英文 `Close` 等标签。
- `prefers-reduced-transparency` 下浮层使用实色并关闭 backdrop blur；`prefers-contrast: more`
  下强化边框与焦点环，不依赖阴影区分层级。
- 用户触发的归档应立即完成，并在同一页面提供短时「撤销」；不可逆或会连带删除数据的操作使用
  产品内确认对话框，说明影响范围。

## 文案（UX Writing）

**UI 是 self-explanatory 的；文字只为帮助理解，不做营销。**

- **如实命名**：是什么就叫什么。模型 label 直接用模型 id，不加「旗舰/尊享/顶配」等营销或多余修饰。
- 动作用「动词 + 名词」（`新建会话`、`删除会话`），不要孤立的「确认/提交/OK」。
- 去占位/填充词；能被界面自明的说明就删。句子式大小写，不堆感叹与「请」。
- 错误 = 发生了什么 + 怎么办；空态 = 指向下一步动作；进行时用「…中」（连接中…、保存中…）。
- 一个元素只做一件事：label 只标注，说明只解释，不重复。

## assistant-ui 约定

聊天 UI 已地道地基于 primitives（Thread / Message / Composer / ActionBar / BranchPicker /
Suggestion / Error / AuiIf），**不为凑数重写**。新增交互优先复用现有 primitive 与
`components/assistant-ui/*`、`components/ui/*`。composer 外壳用 `--composer-bg`（`muted` 与 `card`
混色）+ `--composer-radius`。directive chip 用中性底（`muted`/`secondary`），不用蓝。

会话侧栏（`SidebarThreadList`）是自定义 REST 驱动（bootstrap + cursor 无限滚动 + provisional），
不迁移到 runtime 的 ThreadListPrimitive——数据流不匹配，迁移=纯风险。

## Contract #8 约束（不可违背）

- 控制台/资源页/导航复用共享 shell（`AgentChatShell`、`ContentPageShell`、`Nav`、`resource-ui`）；
  禁止新增根级全屏 `loading.tsx` 或替换已渲染 shell 的 fallback。资源 tab 的 route-level
  `loading.tsx` 必须渲染同一 `ContentPageShell` + skeleton。
- **route skeleton 必须与页面首屏几何一致**：`loading.tsx` 渲染真实标题文字 + 与客户端首帧
  同结构/同高度的 toolbar 与列表骨架（body 骨架直接复用各 `*-client.tsx` 导出的同一组件，
  避免漂移），使 route skeleton → 客户端挂载 → 内容三阶段零布局跳变、pulse 不重启。
- `sessionStorage`/`localStorage` 缓存不得参与 SSR hydration 首帧，须客户端挂载后注入。
- 导航/侧栏过渡用可预测 tween 且尊重 reduced-motion，禁止弹簧回弹与导致布局闪烁的动画。

## Do / Don't

- ✅ 用灰阶排层级：`foreground` 主、`muted-foreground` 次、`border` 分隔。
- ✅ 左栏主题面向上延伸包裹顶栏功能 tab；左栏 = 功能区、顶栏 = 区内 tab。
- ✅ 外壳统一组装 `@gitnapp/web-shell` 共享组件；侧栏底部放用户区（头像 + 名称 + 退出）。
- ✅ 侧栏收起统一用顶栏左侧 PanelLeft ghost icon（CF 样式），折叠成 48px 图标轨。
- ✅ 图标位高亮用 `size-*` 钉成正方形（折叠态入口 `size-8`）；主题轨头像走 `rounded-md`。
- ✅ 主操作只给一个 `primary`（近黑）按钮；其余用 ghost/outline。
- ✅ 数字 tabular-nums；标题负字距；焦点环始终可见。
- ✅ 颜色只用于状态（error/success/warning），且成对 class 单一真相源。
- ❌ 不引入蓝色或任何品牌彩色 accent。
- ❌ 不在左栏与顶栏之间留白缝/切边；不自造侧栏收起按钮形态。
- ❌ 不用任意值字号；不混超过 3 档字重。
- ❌ 不用 `px/py` 拼出近似方形的 rail 图标位高亮；不给主题轨头像用 `rounded-full`。
- ❌ 不做 tab 切换 entrance 渐入；不做 spring/bounce；不让侧栏多动画抢速度。
- ❌ 不写营销/填充词；不给按钮起「确认/OK」这类无信息名。
