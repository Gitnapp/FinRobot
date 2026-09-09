import { TrackingControls } from "./tracking-controls";
import type { Coverage } from "../types";
import { OverflowText } from "@gitnapp/ui/components/ui/overflow-text";
import { MetricGrid } from "@gitnapp/ui/components/ui/data-layout";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { InfoLabel, InfoHint } from "@gitnapp/ui/components/ui/tooltip";
import { Change, compact, Empty, money } from "./ui";
import { Sparkline } from "./coverage-insights";
import type { Quote, History } from "../types";
import type { Snapshot } from "./intelligence";
export type CoveredCompany = {
  id: string;
  name: string;
  symbol: string | null;
  scene: string;
  reason?: string;
  listing?: {
    status: string;
    exchange?: string | null;
    ticker?: string | null;
    security_type?: string | null;
    source_url?: string;
  };
  coverage: Coverage | null;
  report: { id: string } | null;
};
export type CoverageQuote = {
  quote: Quote;
  history: History;
  financials: {
    revenue: number | null;
    ebitda: number | null;
    gross_margin: number | null;
    currency?: string;
    as_of: string;
  } | null;
  range: {
    change: number;
    high: number;
    low: number;
    start: string;
    end: string;
  };
};
export function CoverageAssetCard({
  company: c,
  snapshot,
  editing = false,
}: {
  company: CoveredCompany;
  snapshot?: Snapshot<CoverageQuote>;
  editing?: boolean;
}) {
  const data = snapshot?.data;
  const q = data?.quote;
  const to = c.symbol
    ? `/${c.coverage ? "coverage" : "stocks"}/${c.symbol}`
    : null;
  return (
    <article className="coverage-card navigation-card">
      <div className="coverage-card-head">
        <div>
          {to ? (
            <Link to={to} className="navigation-card-link">
              <OverflowText text={q?.name || c.name}><strong>{q?.name || c.name}</strong></OverflowText>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ) : (
            <OverflowText text={c.name}><strong>{c.name}</strong></OverflowText>
          )}
          <small className="muted">
            {c.symbol ? q?.symbol || c.symbol : c.scene}
            {c.listing?.security_type === "美国存托凭证" && (
              <InfoHint>
                美国存托凭证，以美元交易；与韩国本地股票价格不同。
              </InfoHint>
            )}
          </small>
        </div>
        {editing && c.symbol && <TrackingControls compact symbol={c.symbol} coverage={c.coverage} />}
        {snapshot?.state === "stale" &&
          (!snapshot.refreshing || snapshot.refresh_failed) && (
            <InfoLabel label="待更新">
              显示最近一次有效行情，截至 {q?.as_of}。
            </InfoLabel>
          )}
      </div>
      {q && data ? (
        <>
          <div className="coverage-price">
            <strong>{money(q.price, q.currency)}</strong>
            <Change value={q.change_percent} />
          </div>
          <div className="coverage-chart">
            <Sparkline history={data.history} />
            <div>
              <span>
                {q.price_kind === "realtime" ? "行情" : "收盘"}（{q.currency}）
              </span>
              <span>{data.range.end}</span>
            </div>
          </div>
          <dl className="coverage-metrics">
            <div>
              <dt>市值</dt>
              <dd>{compact(q.market_cap)}</dd>
            </div>
            <div>
              <dt>区间涨跌</dt>
              <dd>
                <Change value={data.range.change} />
              </dd>
            </div>
            <div>
              <dt>区间高点</dt>
              <dd>{money(data.range.high, q.currency)}</dd>
            </div>
          </dl>
        </>
      ) : (
        <Empty>
          <span>
            {!c.symbol
              ? "尚未匹配上市证券"
              : snapshot?.state === "pending"
                ? "—"
                : "暂未取得有效行情"}
          </span>
        </Empty>
      )}
      <MetricGrid
        label="财务摘要"
        items={[
          {
            id: "revenue",
            label: "营业收入",
            value: compact(
              data?.financials?.revenue != null
                ? data.financials.revenue * 1e6
                : null,
            ),
          },
          {
            id: "ebitda",
            label: "EBITDA",
            value: compact(
              data?.financials?.ebitda != null
                ? data.financials.ebitda * 1e6
                : null,
            ),
          },
          {
            id: "gross_margin",
            label: "毛利率",
            value:
              data?.financials?.gross_margin != null
                ? `${(data.financials.gross_margin * 100).toFixed(1)}%`
                : null,
          },
        ]}
      />
    </article>
  );
}

export function UnmatchedSecurities({
  companies,
}: {
  companies: CoveredCompany[];
}) {
  if (!companies.length) return null;
  const statuses: Record<string, string> = {
    market_uncovered: "交易所待接入",
    private: "未上市",
    subsidiary: "非独立上市主体",
    ipo_pending: "上市进程中",
    unverified: "上市状态待核实",
  };
  return (
    <div className="unmatched-securities">
      {Object.entries(statuses).map(([status, label]) => {
        const group = companies.filter(
          (c) => (c.listing?.status || "unverified") === status,
        );
        if (!group.length) return null;
        return (
          <details key={status}>
            <summary>
              {label}（{group.length} 家）
            </summary>
            <div className="unmatched-company-list">
              {group.map((c) => (
                <div key={c.id}>
                  <InfoLabel label={c.name}>
                    {c.reason}
                    {c.listing?.source_url && (
                      <>
                        {" "}
                        <a
                          href={c.listing.source_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          核验来源
                        </a>
                      </>
                    )}
                  </InfoLabel>
                  <small>
                    {[c.listing?.exchange, c.listing?.ticker]
                      .filter(Boolean)
                      .join(" ") || c.scene}
                  </small>
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
