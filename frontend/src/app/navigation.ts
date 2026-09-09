import {
  CalendarDays,
  ChartNoAxesCombined,
  FileText,
  Globe,
  Settings2,
  Telescope,
} from "lucide-react";

export const navigation = [
  {
    href: "/",
    label: "市场数据",
    subpage: "标的列表",
    icon: ChartNoAxesCombined,
  },
  {
    href: "/coverage",
    label: "标的跟踪",
    subpage: "标的列表",
    icon: Telescope,
  },
  { href: "/macro", label: "宏观指标", subpage: "概览", icon: Globe },
  {
    href: "/calendar",
    label: "财经日历",
    subpage: "时间线",
    icon: CalendarDays,
  },
  { href: "/reports", label: "报告", subpage: "研报列表", icon: FileText },
  { href: "/settings", label: "设置", subpage: "配置", icon: Settings2 },
];
export const activeNavigation = (pathname: string) =>
  navigation.find((item) =>
    item.href === "/"
      ? pathname === "/" || pathname.startsWith("/stocks/")
      : pathname === item.href || pathname.startsWith(item.href + "/"),
  );
