import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ChartNoAxesCombined,
  FileText,
  Menu,
  PanelLeft,
  Plus,
  Settings2,
  Telescope,
} from "lucide-react";
import {
  RailShell,
  RailSidebar,
  RailBrand,
  RailNavLink,
  RailCollapseButton,
  ShellLinkProvider,
} from "@gitnapp/web-shell";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@gitnapp/ui/components/ui/sheet";
import { api } from "../api/client";
import { useAssets } from "../hooks/queries";
import { Button } from "../components/ui";
import { AddAsset } from "../components/add-asset";

const navigation = [
  { href: "/", label: "市场看板", icon: ChartNoAxesCombined },
  { href: "/coverage", label: "持续跟踪", icon: Telescope },
  { href: "/reports", label: "报告库", icon: FileText },
  { href: "/settings", label: "模型与数据", icon: Settings2 },
];
const AppLink = ({
  href,
  ...props
}: React.ComponentProps<Parameters<typeof ShellLinkProvider>[0]["link"]>) => (
  <Link to={href} {...props} />
);

export default function Shell() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("desk-collapsed") === "true",
  );
  const [adding, setAdding] = useState(false);
  const [mobile, setMobile] = useState(false);
  const location = useLocation();
  const scrollContainer = useRef<HTMLElement>(null);
  useEffect(() => {
    scrollContainer.current?.scrollTo({ top: 0 });
  }, [location.pathname]);
  const assets = useAssets();
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => api<{ ok: boolean; scheduler: string }>("/health"),
    refetchInterval: 15000,
  });
  const active = navigation.find((n) =>
    n.href === "/"
      ? location.pathname === "/" || location.pathname.startsWith("/stocks/")
      : location.pathname.startsWith(n.href),
  );
  const nav = (compact = false) => (
    <>
      <div className={compact ? "sr-only" : "nav-heading"}>WORKSPACE</div>
      {navigation.map((n) => (
        <RailNavLink
          key={n.href}
          href={n.href}
          icon={<n.icon size={17} />}
          label={n.label}
          active={active?.href === n.href}
          collapsed={compact}
          onClick={() => setMobile(false)}
        />
      ))}
      {!compact && (
        <>
          <div className="nav-watchlist-heading">
            <span>自选标的</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="添加自选"
              onClick={() => setAdding(true)}
            >
              <Plus size={15} />
            </Button>
          </div>
          {assets.data?.slice(0, 8).map((a) => (
            <Link
              key={a.symbol}
              to={`/stocks/${a.symbol}`}
              className={`sidebar-stock ${location.pathname === `/stocks/${a.symbol}` ? "selected" : ""}`}
              onClick={() => setMobile(false)}
            >
              <span>{a.symbol}</span>
              <small className={a.change_percent >= 0 ? "up" : "down"}>
                {a.change_percent > 0 ? "+" : ""}
                {a.change_percent.toFixed(2)}%
              </small>
            </Link>
          ))}
        </>
      )}
    </>
  );
  return (
    <ShellLinkProvider link={AppLink}>
      <div className="mobile-header">
        <Button
          variant="ghost"
          size="icon"
          aria-label="打开导航"
          onClick={() => setMobile(true)}
        >
          <Menu size={18} />
        </Button>
        <span>Garage Research</span>
        <span className="source">FinRobot</span>
      </div>
      <RailShell
        sidebar={
          <RailSidebar
            collapsed={collapsed}
            brand={
              <RailBrand
                icon={<Activity size={16} />}
                title="Garage Research"
                collapsed={collapsed}
              />
            }
            nav={nav(collapsed)}
            footer={
              <div className="sidebar-footer">
                {!collapsed && (
                  <>
                    <span className="workspace-avatar">G</span>
                    <span>
                      个人工作空间<small>FinRobot Research Desk</small>
                    </span>
                  </>
                )}
              </div>
            }
          />
        }
        topbar={
          <>
            <RailCollapseButton
              collapsed={collapsed}
              icon={<PanelLeft size={16} />}
              onToggle={() => {
                setCollapsed(!collapsed);
                localStorage.setItem("desk-collapsed", String(!collapsed));
              }}
            />
            <div className="breadcrumb">
              Research Desk <span>/</span>
              <strong>{active?.label || "标的详情"}</strong>
            </div>
            <div className="topbar-status">
              <span
                className={`status-dot ${health.data?.ok ? "completed" : "failed"}`}
              />
              {health.data?.ok ? "研究服务在线" : "服务连接中"}
            </div>
          </>
        }
      >
        <main ref={scrollContainer} className="main-scroll" id="main-content">
          <Outlet />
        </main>
      </RailShell>
      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent
          side="left"
          className="w-[280px] p-5"
          aria-describedby={undefined}
        >
          <SheetHeader>
            <SheetTitle>Garage Research</SheetTitle>
          </SheetHeader>
          <nav>{nav()}</nav>
        </SheetContent>
      </Sheet>
      <AddAsset open={adding} onOpenChange={setAdding} />
    </ShellLinkProvider>
  );
}
