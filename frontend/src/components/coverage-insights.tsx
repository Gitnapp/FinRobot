import { InfoLabel } from "@gitnapp/ui/components/ui/tooltip";
import { ExternalLink } from "lucide-react";
import type { Detail,History } from "../types";
import { useEvidence } from "./intelligence";
import { CardPagination,useCardPage } from "./layout/card-pagination";
import { compact,money } from "./ui";

export function Sparkline({ history }: { history: History }) {
  const values = history.points.slice(-90).map((p) => p.close);
  const low = Math.min(...values),
    high = Math.max(...values);
  const points = values
    .map(
      (v, i) =>
        (i / (values.length - 1)) * 300 +
        "," +
        (54 - ((v - low) / (high - low || 1)) * 48),
    )
    .join(" ");
  return (
    <svg
      viewBox="0 0 300 60"
      preserveAspectRatio="none"
      role="img"
      aria-label={history.mock ? "示例价格趋势" : "最近价格趋势"}
      className="sparkline"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function TechnicalPanel({ data }: { data: Detail }) {
  const t = data.technical;
  return (
    <section className="dense-panel">
      <h2>
        <InfoLabel label="价格趋势">
          {t.mock ? "本区根据示例历史价格计算。" : "根据历史收盘价计算。"}
          均线是对应期间的平均价格；波动率与最大回撤用于观察价格风险。
        </InfoLabel>
      </h2>
      <dl className="metric-grid">
        {[
          ["20 日均线", money(t.sma20, data.quote.currency)],
          ["50 日均线", money(t.sma50, data.quote.currency)],
          ["200 日均线", money(t.sma200, data.quote.currency)],
          ["一年涨跌", (t.return_year * 100).toFixed(1) + "%"],
          ["年化波动", (t.volatility * 100).toFixed(1) + "%"],
          ["最大回撤", (t.drawdown * 100).toFixed(1) + "%"],
        ].map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="price-range">
        <div>
          <span>52 周低点 {money(t.low, data.quote.currency)}</span>
          <span>高点 {money(t.high, data.quote.currency)}</span>
        </div>
        <div className="range-track">
          <i style={{ left: t.range_position * 100 + "%" }} />
        </div>
      </div>
    </section>
  );
}

export function FinancialPanel({ data }: { data: Detail }) {
  const evidence = useEvidence(data.quote.symbol).data?.data;
  const fields = [
    ["revenue", "营业收入"],
    ["ebitda", "EBITDA"],
    ["net_income", "净利润"],
    ["gross_margin", "毛利率"],
    ["free_cash_flow", "自由现金流"],
    ["capex", "资本开支"],
  ];
  return (
    <section className="dense-panel">
      <h2>
        <InfoLabel label="财务概览">
          {evidence?.source || "公开财务报表"}；
          {evidence?.period || "报告期未取得"}；
          {evidence?.currency || (data.model ? "USD" : data.quote.currency)}
          。缺失数据不以行情指标替代。
        </InfoLabel>
      </h2>
      <dl className="metric-grid">
        {fields.map(([key, label]) => {
          const value = evidence?.metrics[key];
          return (
            <div key={key}>
              <dt>{label}</dt>
              <dd>
                {value == null
                  ? "—"
                  : key === "gross_margin"
                    ? `${(value * 100).toFixed(1)}%`
                    : compact(value)}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

export function FinancialPricePanel({ data }: { data: Detail }) {
  return <section className="dense-panel financial-price-panel" aria-label="财务与价格概览">
    <FinancialPanel data={data}/>
    <TechnicalPanel data={data}/>
  </section>;
}

export function ValuationPanel({ data }: { data: Detail }) {
  const v = data.valuation;
  return (
    <section className="dense-panel valuation-panel">
      <h2>
        <InfoLabel label="情景估值">
          {v?.mock ? "本区基于示例财务数据，仅表示假设测算。" : ""}
          {v?.note || "暂未取得可用于估值的完整财务输入。"}
        </InfoLabel>
      </h2>
      <div className="valuation-summary">
        <div>
          <span>企业价值现值</span>
          <strong>{compact(v ? v.enterprise_value * 1e6 : null)}</strong>
          {v && <small className="muted">{v.unit.split(" ")[0]}</small>}
        </div>
        <div>
          <span>折现率</span>
          <b>{v ? `${(v.wacc * 100).toFixed(0)}%` : "—"}</b>
        </div>
        <div>
          <span>永续增长</span>
          <b>{v ? `${(v.terminal_growth * 100).toFixed(0)}%` : "—"}</b>
        </div>
      </div>
      <table className="sensitivity-table">
        <caption>
          估值敏感性{v ? `（十亿 ${v.unit.split(" ")[0]}）` : ""}
        </caption>
        <thead>
          <tr>
            <th>折现率 / 增长</th>
            {v?.growth_axis.map((g) => (
              <th key={g}>{(g * 100).toFixed(0)}%</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!v && (
            <tr>
              <th>—</th>
              <td>—</td>
              <td>—</td>
              <td>—</td>
            </tr>
          )}
          {v?.sensitivity.map((row, i) => (
            <tr key={i}>
              <th>{(v!.wacc_axis[i] * 100).toFixed(0)}%</th>
              {row.map((n, j) => (
                <td key={j} className={i === 2 && j === 1 ? "base-case" : ""}>
                  {(n / 1000).toLocaleString("en-US", {
                    maximumFractionDigits: 1,
                  })}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
export function CatalystPanel({ data }: { data: Detail }) {
  const items = data.news.items.filter((n) => n.url && n.title);
  const page = useCardPage(items, 4, data.quote.symbol);
  if (!items.length) return null;
  return (
    <section className="dense-panel">
      <h2>近期催化</h2>
      {page.items.map((n) => (
        <a
          className="catalyst-row"
          key={n.url}
          href={n.url}
          target="_blank"
          rel="noreferrer"
        >
          <span>{n.title}</span>
          <ExternalLink size={13} />
        </a>
      ))}
      <CardPagination {...page} onChange={page.setPage} label="近期催化分页"/>
    </section>
  );
}
