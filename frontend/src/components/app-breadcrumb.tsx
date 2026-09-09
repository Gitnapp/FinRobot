import { useLocation } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RailBreadcrumb } from "@gitnapp/web-shell";
import type { Detail, FullReport } from "../types";
import { macroLabels } from "../app/context/metrics";

export function AppBreadcrumb({
  parent,
}: {
  parent?: { href: string; label: string };
}) {
  const { pathname } = useLocation();
  const [section, identifier] = pathname.split("/").filter(Boolean);
  const symbol =
    section === "coverage" || section === "stocks" ? identifier : undefined;
  const market = useQuery<Record<string, { data?: { quote?: { name?: string } } }>>({ queryKey: ["coverage-market"], enabled: false });
  const directory = useQuery<{ symbol: string; name: string }[]>({ queryKey: ["coverage-directory"], enabled: false });
  const client = useQueryClient();
  const listedName = symbol ? client.getQueriesData<{symbol:string;name:string}[]>({queryKey:["assets"]}).flatMap(([,rows])=>rows || []).find(r=>r.symbol === symbol)?.name : undefined;
  // Observe the page's existing query. Navigation metadata must never trigger another request.
  const detail = useQuery<Detail>({
    queryKey: ["detail", symbol || "", false],
    enabled: false,
  });
  const report = useQuery<FullReport>({
    queryKey: ["report", section === "reports" ? identifier || "" : ""],
    enabled: false,
  });
  const current = !identifier
    ? undefined
    : symbol
      ? detail.data?.quote.name || (symbol && market.data?.[symbol]?.data?.quote?.name) || listedName || directory.data?.find(r=>r.symbol === symbol)?.name
      : section === "macro"
        ? macroLabels[identifier] || "指标详情"
        : section === "reports"
          ? report.data?.payload?.quote.name || "研究报告"
          : "详情";
  if (!parent) return null;
  return (
    <RailBreadcrumb
      key={`${pathname}:${current || ""}`}
      className={`app-breadcrumb path-enter${identifier && !current ? " path-pending" : ""}`}
      compact={Boolean(identifier)}
      items={
        identifier
          ? [{ label: parent.label, href: parent.href }, { label: current || "\u00a0", href: pathname }]
          : [{ label: ({ "/": "标的列表", "/coverage": "标的列表", "/reports": "研报列表", "/macro": "宏观指标", "/calendar": "财经日历", "/settings": "配置" } as Record<string,string>)[parent.href] || parent.label, href: parent.href }]
      }
    />
  );
}
