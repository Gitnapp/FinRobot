import { InfoLabel } from "@gitnapp/ui/components/ui/tooltip";
import { Link } from "react-router";
import { ExternalLink } from "lucide-react";
import type { Detail, History } from "../types";
import { Hint, Source, compact, money } from "./ui";

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
        <InfoLabel label="价格与风险">
          {t.mock ? "本区根据示例历史价格计算。" : "根据历史收盘价计算。"}
          均线是对应期间的平均价格；波动率与最大回撤用于观察价格风险。
        </InfoLabel>
      </h2>
      <dl className="metric-grid">
        {[
          ["20 日均线", money(t.sma20)],
          ["50 日均线", money(t.sma50)],
          ["200 日均线", money(t.sma200)],
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
          <span>52 周低点 {money(t.low)}</span>
          <span>高点 {money(t.high)}</span>
        </div>
        <div className="range-track">
          <i style={{ left: t.range_position * 100 + "%" }} />
        </div>
      </div>
    </section>
  );
}

export function FinancialPanel({ data }: { data: Detail }) {
  const m = data.model;
  if (!m) return null;
  const rows = m.rows.filter((r) =>
    [
      "revenue",
      "ebitda",
      "net_income",
      "gross_margin",
      "fcf",
      "capex",
    ].includes(r.key),
  );
  return (
    <section className="dense-panel">
      <h2>
        财务概览
        <Source
          mock={m.mock}
          source=""
          note="本区采用示例财务基期；所有预测是研究假设。"
        />
      </h2>
      <dl className="metric-grid">
        {rows.map((r) => (
          <div key={r.key}>
            <dt>{r.label}</dt>
            <dd>
              {r.format === "percent"
                ? ((r.values[0] || 0) * 100).toFixed(1) + "%"
                : compact((r.values[0] || 0) * 1e6)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function ValuationPanel({ data }: { data: Detail }) {
  const v = data.valuation;
  return (
    <section className="dense-panel valuation-panel">
      <h2>
        <InfoLabel label="情景估值">
          {v.mock ? "本区基于示例财务数据，仅表示假设测算。" : ""}
          {v.note}
        </InfoLabel>
      </h2>
      <div className="valuation-summary">
        <div>
          <span>企业价值现值</span>
          <strong>{compact(v.enterprise_value * 1e6)}</strong>
        </div>
        <div>
          <span>折现率</span>
          <b>{(v.wacc * 100).toFixed(0)}%</b>
        </div>
        <div>
          <span>永续增长</span>
          <b>{(v.terminal_growth * 100).toFixed(0)}%</b>
        </div>
      </div>
      <table className="sensitivity-table">
        <caption>估值敏感性 · 十亿美元</caption>
        <thead>
          <tr>
            <th>折现率 / 增长</th>
            {v.growth_axis.map((g) => (
              <th key={g}>{(g * 100).toFixed(0)}%</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {v.sensitivity.map((row, i) => (
            <tr key={i}>
              <th>{(v.wacc_axis[i] * 100).toFixed(0)}%</th>
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
export function PeersPanel({ data }: { data: Detail }) {
  return (
    <section className="dense-panel">
      <h2>
        <InfoLabel label="同业比较">
          同业估值口径可能不同，应结合业务结构与增长质量判断。缺失资料时使用明确标记的示例指标。
        </InfoLabel>
      </h2>
      <table className="peers-table">
        <thead>
          <tr>
            <th>标的</th>
            <th>股价</th>
            <th>市盈率</th>
            <th>Beta</th>
          </tr>
        </thead>
        <tbody>
          {data.peers.map((p) => (
            <tr key={p.symbol}>
              <td>
                <InfoLabel label={p.symbol}>
                  {p.mock ? "本行部分指标为示例。" : null}
                </InfoLabel>
              </td>
              <td>{money(p.price)}</td>
              <td>{p.pe?.toFixed(1) || "—"}</td>
              <td>{p.beta?.toFixed(2) || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
export function CatalystPanel({ data }: { data: Detail }) {
  return (
    <section className="dense-panel">
      <h2>近期催化</h2>
      {data.news.items.length ? (
        data.news.items.slice(0, 4).map((n, i) => (
          <a
            className="catalyst-row"
            key={i}
            href={n.url}
            target="_blank"
            rel="noreferrer"
          >
            <span>{n.title}</span>
            <ExternalLink size={13} />
          </a>
        ))
      ) : (
        <ul className="tracking-checklist">
          <li>核验最新收入与经营指引</li>
          <li>跟踪毛利率和费用投入</li>
          <li>观察资本开支与现金回收</li>
          <li>
            <InfoLabel label="核验财报日历和公司公告">
              尚未取得近期新闻与可靠日历，不生成虚构事件或日期。
            </InfoLabel>
          </li>
        </ul>
      )}
    </section>
  );
}
