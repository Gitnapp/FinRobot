import { AppBreadcrumb } from "../components/app-breadcrumb";
import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import {
  Activity,
  Globe,
  CalendarDays,
  ChartNoAxesCombined,
  FileText,
  PanelLeft,
  PanelLeftClose,
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
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@gitnapp/ui/components/ui/sheet";
import { Button } from "../components/ui";
const navigation = [
  { href: "/", label: "市场看板", icon: ChartNoAxesCombined },
  { href: "/coverage", label: "持续跟踪", icon: Telescope },
  { href: "/macro", label: "宏观环境", icon: Globe },
  { href: "/calendar", label: "事件日历", icon: CalendarDays },
  { href: "/reports", label: "报告", icon: FileText },
  { href: "/settings", label: "设置", icon: Settings2 },
];
const AppLink = ({
  href,
  ...p
}: React.ComponentProps<Parameters<typeof ShellLinkProvider>[0]["link"]>) => (
  <Link to={href} {...p} />
);
export default function Shell() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("desk-collapsed") === "true",
  );
  const [mobile, setMobile] = useState(false);
  const location = useLocation();
  const scroll = useRef<HTMLElement>(null);
  useEffect(() => {
    scroll.current?.scrollTo({ top: 0 });
  }, [location.pathname]);
  const active = navigation.find((n) =>
    n.href === "/"
      ? location.pathname === "/" || location.pathname.startsWith("/stocks/")
      : location.pathname.startsWith(n.href),
  );
  function nav(compact = false) {
    return (
      <>
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
      </>
    );
  }
  return (
    <ShellLinkProvider link={AppLink}>
      <div className="mobile-header">
        <Button
          variant="ghost"
          size="icon"
          aria-label="展开边栏"
          onClick={() => setMobile(true)}
        >
          <PanelLeft size={18} />
        </Button>
        <AppBreadcrumb parent={active} />
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
              !collapsed ? (
                <div className="sidebar-footer">
                  <span className="workspace-avatar">G</span>
                  <span>个人空间</span>
                </div>
              ) : null
            }
          />
        }
        topbar={
          <>
            <RailCollapseButton
              collapsed={collapsed}
              icon={
                collapsed ? (
                  <PanelLeft size={18} />
                ) : (
                  <PanelLeftClose size={18} />
                )
              }
              onToggle={() => {
                setCollapsed(!collapsed);
                localStorage.setItem("desk-collapsed", String(!collapsed));
              }}
            />
            <AppBreadcrumb parent={active} />
          </>
        }
      >
        <main ref={scroll} className="main-scroll" id="main-content">
          <Outlet />
        </main>
      </RailShell>
      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-[280px] p-5"
          aria-describedby={undefined}
        >
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2"
              aria-label="收起边栏"
            >
              <PanelLeftClose size={18} />
            </Button>
          </SheetClose>
          <SheetHeader>
            <SheetTitle>Garage Research</SheetTitle>
          </SheetHeader>
          <nav aria-label="功能区" className="flex flex-col gap-1">
            {nav()}
          </nav>
        </SheetContent>
      </Sheet>
    </ShellLinkProvider>
  );
}
