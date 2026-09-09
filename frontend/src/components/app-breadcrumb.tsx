import { useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
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
  // Observe the page's existing query. Navigation metadata must never trigger another request.
  const detail = useQuery<Detail>({
    queryKey: ["detail", symbol || "", section === "coverage"],
    enabled: false,
  });
  const report = useQuery<FullReport>({
    queryKey: ["report", section === "reports" ? identifier || "" : ""],
    enabled: false,
  });
  const current = !identifier
    ? undefined
    : symbol
      ? detail.data?.quote.name || "公司详情"
      : section === "macro"
        ? macroLabels[identifier] || "指标详情"
        : section === "reports"
          ? report.data?.payload?.quote.name || "研究报告"
          : "详情";
  if (!parent) return null;
  return (
    <RailBreadcrumb
      className="app-breadcrumb"
      items={
        current
          ? [{ label: parent.label, href: parent.href }, { label: current }]
          : [{ label: parent.label }]
      }
    />
  );
}
