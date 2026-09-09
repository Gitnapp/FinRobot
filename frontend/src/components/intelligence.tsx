import {
Card,
CardAction,
CardContent,
CardHeader,
CardTitle,
} from "@gitnapp/ui/components/ui/card";
import { OverflowText } from "@gitnapp/ui/components/ui/overflow-text";
import { InfoHint } from "@gitnapp/ui/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { CardPagination,useCardPage } from "@gitnapp/ui/components/ui/card-pagination";
import { compact } from "./ui";
export type Snapshot<T> = {
  refreshing?: boolean;
  refresh_failed?: boolean;
  state: "ready" | "stale" | "pending" | "unavailable";
  data: T | null;
  updated_at: string | null;
};
export type MacroSeries = {
  label: string;
  unit: string;
  source: string;
  source_url: string;
  points: {
    date: string;
    value: number;
    yoy?: number | null;
    mom?: number | null;
    index?: number | null;
  }[];
};
type Evidence = {
  currency?: string;
  period: string | null;
  filed?: string;
  source: string;
  source_url?: string;
  metrics: Record<string, number | null>;
  filings: { form: string; date: string; url: string }[];
};
export function useEvidence(symbol: string, enabled = true) {
  return useQuery({
    queryKey: ["evidence", symbol],
    enabled,
    queryFn: ({ signal }) =>
      api<Snapshot<Evidence>>(`/data/${symbol}/company`, { signal }),
  });
}
export function EvidenceCard({ symbol }: { symbol: string }) {
  const q = useEvidence(symbol);
  const d = q.data?.data;
  const filingsPage = useCardPage(d?.filings || [], 2, symbol);
  const rows: [string, string, boolean][] = [
    ["revenue_growth", "营收增长", true],
    ["gross_margin", "毛利率", true],
    ["operating_cash_flow", "经营现金流", false],
    ["free_cash_flow", "自由现金流", false],
    ["net_income", "净利润", false],
    ["cash_conversion", "经营现金流 / 净利润", false],
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>财务数据</CardTitle>
        <CardAction>
          <InfoHint>
            对应课程第三册的商业闭环核验。自由现金流按经营现金流减固定资产购建支出计算，与简单模型的估算口径不同。财报数字不能直接证明用户留存与产品竞争力，留存、续费及AI业务收入仍需单独证据。
            {d?.source} {d?.period}{" "}
            {q.data?.state === "stale" ? "，显示最近一次有效快照" : ""}
          </InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent>
        {d?.period && (
          <div className="muted text-xs">
            年度 {d.period}（{d.currency || "USD"}）
          </div>
        )}
        <dl className="evidence-metrics">
          {rows.map(([key, label, percent]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>
                {d?.metrics[key] == null
                  ? "—"
                  : percent
                    ? `${(d.metrics[key]! * 100).toFixed(1)}%`
                    : key === "cash_conversion"
                      ? `${d.metrics[key]!.toFixed(2)}x`
                      : compact(d.metrics[key]!)}
              </dd>
            </div>
          ))}
        </dl>
        <div className="evidence-filings">
          {d?.filings.length ? (
            filingsPage.items.map((f) => (
              <a key={f.url} href={f.url} target="_blank" rel="noreferrer">
                {f.form}
                <time>{f.date}</time>
              </a>
            ))
          ) : d?.source_url ? (
            <a href={d.source_url} target="_blank" rel="noreferrer">
              查看报表来源
            </a>
          ) : (
            <span>财报原文 —</span>
          )}
        </div>
        <CardPagination {...filingsPage} onChange={filingsPage.setPage} label="财务来源分页"/>
      </CardContent>
    </Card>
  );
}

type Leads = {
  items: { title: string; url: string; snippet: string }[];
  source: string;
  verified: boolean;
};
export function useResearchLeads(symbol: string) {
  return useQuery({
    queryKey: ["research-leads", symbol],
    queryFn: ({ signal }) =>
      api<Snapshot<Leads>>(`/data/${symbol}/research`, { signal }),
  });
}
export function ResearchLeads({ symbol }: { symbol: string }) {
  const q = useResearchLeads(symbol);
  const page = useCardPage(q.data?.data?.items || [], 6, symbol);
  return (
    <Card>
      <CardHeader>
        <CardTitle>资料线索</CardTitle>
        <CardAction>
          <InfoHint>
            用于核验商业模式、客户与财务披露的原文线索。搜索摘要未经独立核验，不能直接视为公司已披露的事实。
          </InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent>
        {q.data?.data?.items.length ? (
          page.items.map((r, i) => (
            <a
              className="research-lead"
              key={r.url}
              href={r.url}
              target="_blank"
              rel="noreferrer"
            >
              <span>[{page.offset + i + 1}]</span>
              <OverflowText text={r.title} />
            </a>
          ))
        ) : (
          <span className="muted text-xs">暂无已取得的资料线索</span>
        )}
        <CardPagination {...page} onChange={page.setPage} label="资料线索分页"/>
      </CardContent>
    </Card>
  );
}
