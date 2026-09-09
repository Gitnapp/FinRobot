import { RailBreadcrumb } from "@gitnapp/web-shell";
import { useQuery,useQueryClient } from "@tanstack/react-query";
import { Link,useLocation } from "react-router";
import { macroLabels } from "../app/context/metrics";
import { navigation } from "../app/navigation";
import type { Detail,FullReport } from "../types";

export function AppBreadcrumb({
  parent,
}: {
  parent?: { href: string; label: string };
}) {
  const { pathname } = useLocation();
  const [section, identifier, childSection, reportId] = pathname
    .split("/")
    .filter(Boolean);
  const symbol =
    section === "coverage" || section === "stocks" ? identifier : undefined;
  const market = useQuery<
    Record<string, { data?: { quote?: { name?: string } } }>
  >({ queryKey: ["coverage-market"], enabled: false });
  const directory = useQuery<{ symbol: string; name: string }[]>({
    queryKey: ["coverage-directory"],
    enabled: false,
  });
  const client = useQueryClient();
  const listedName = symbol
    ? client
        .getQueriesData<{ symbol: string; name: string }[]>({
          queryKey: ["assets"],
        })
        .flatMap(([, rows]) => rows || [])
        .find((r) => r.symbol === symbol)?.name
    : undefined;
  // Observe the page's existing query. Navigation metadata must never trigger another request.
  const detail = useQuery<Detail>({
    queryKey: ["detail", symbol || "", false],
    enabled: false,
  });
  const report = useQuery<FullReport>({
    queryKey: [
      "report",
      section === "reports"
        ? identifier || ""
        : childSection === "reports"
          ? reportId
          : "",
    ],
    enabled: false,
  });
  const current = !identifier
    ? undefined
    : symbol
      ? detail.data?.quote.name ||
        (symbol && market.data?.[symbol]?.data?.quote?.name) ||
        listedName ||
        directory.data?.find((r) => r.symbol === symbol)?.name ||
        report.data?.payload?.quote.name ||
        symbol
      : section === "settings" && identifier === "debug"
        ? "调试"
        : section === "macro"
          ? macroLabels[identifier] || "指标详情"
          : section === "reports"
            ? report.data?.payload?.quote.name || "研究报告"
            : "详情";
  if (!parent) return null;
  const subpage =
    navigation.find((item) => item.href === parent.href)?.subpage ||
    parent.label;
  if (section === "settings") {
    return (
      <nav className="settings-top-nav" aria-label="设置子页面">
        {[
          ["/settings", "配置"],
          ["/settings/debug", "调试"],
        ].map(([href, label]) => (
          <Link
            key={href}
            to={href}
            aria-current={pathname === href ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <RailBreadcrumb
      key={`${pathname}:${current || ""}`}
      className={`app-breadcrumb${identifier && !current ? " path-pending" : ""}`}
      compact={Boolean(identifier)}
      items={
        childSection === "reports" && symbol
          ? [
              { label: subpage, href: parent.href },
              { label: current || symbol, href: `/${section}/${symbol}` },
              { label: "报告", href: `/${section}/${symbol}?tab=reports` },
              { label: "研究报告", href: pathname },
            ]
          : identifier
            ? [
                { label: subpage, href: parent.href },
                { label: current || "\u00a0", href: pathname },
              ]
            : [{ label: subpage, href: parent.href }]
      }
    />
  );
}
