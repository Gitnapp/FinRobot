import {
Sheet,
SheetClose,
SheetContent,
SheetHeader,
SheetTitle,
} from "@gitnapp/ui/components/ui/sheet";
import {
RailBrand,
RailCollapseButton,
RailNavLink,
RailShell,
RailSidebar,
ShellLinkProvider,
} from "@gitnapp/web-shell";
import { Activity,PanelLeft,PanelLeftClose } from "lucide-react";
import { useLayoutEffect,useRef,useState } from "react";
import { Link,Outlet,useLocation } from "react-router";
import { AppBreadcrumb } from "../components/app-breadcrumb";
import { Button } from "../components/ui";
import { activeNavigation,navigation } from "./navigation";
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
  useLayoutEffect(() => {
    scroll.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);
  const active = activeNavigation(location.pathname);
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
