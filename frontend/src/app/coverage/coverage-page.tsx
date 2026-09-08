import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Pause, Play, Telescope, FileText } from "lucide-react";
import { toast } from "sonner";
import { write } from "../../api/client";
import { useCoverage, useRefresh } from "../../hooks/queries";
import {
  Button,
  Change,
  compact,
  Empty,
  ErrorState,
  Hint,
  Loading,
  money,
  PageHeader,
  Updated,
  researchBrief,
} from "../../components/ui";
import { Sparkline } from "../../components/coverage-insights";
import type { Detail } from "../../types";

export default function CoveragePage() {
  const { data = [], error, isLoading, refetch } = useCoverage();
  const refresh = useRefresh();
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState("");
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} retry={() => void refetch()} />;
  const shown = data.filter(
    (d) =>
      filter === "all" ||
      (filter === "active" ? d.coverage?.active : !d.coverage?.active),
  );
  async function toggle(d: Detail) {
    setBusy(d.quote.symbol);
    try {
      await write(
        "/coverage/" + d.quote.symbol,
        { cadence: d.coverage!.cadence, active: !d.coverage!.active },
        "PUT",
      );
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="page">
      <PageHeader title="持续跟踪">
        <Button variant="outline" asChild>
          <Link to="/">
            添加跟踪标的
            <ArrowRight size={15} />
          </Link>
        </Button>
      </PageHeader>
      <div className="coverage-toolbar">
        <div className="segmented">
          {[
            ["all", "全部"],
            ["active", "跟踪中"],
            ["paused", "已暂停"],
          ].map(([k, n]) => (
            <button
              key={k}
              className={k === filter ? "selected" : ""}
              onClick={() => setFilter(k)}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="muted">{data.length} 个标的</span>
      </div>
      <div className="coverage-grid">
        {shown.map((d) => {
          const q = d.quote;
          const m = d.model;
          const rows = Object.fromEntries(
            m?.rows.map((r) => [r.key, r.values[0]]) || [],
          );
          const report = d.reports.find((r) => r.status === "completed");
          const pending = d.reports.find(
            (r) => r.status === "running" || r.status === "queued",
          );
          return (
            <article className="coverage-card" key={q.symbol}>
              <div className="coverage-card-head">
                <Link to={"/coverage/" + q.symbol}>
                  <span>
                    <strong>{q.symbol}</strong>
                    <small>{q.name}</small>
                  </span>
                </Link>
                <span className="coverage-state">
                  {d.coverage?.active ? "跟踪中" : "已暂停"}
                </span>
              </div>
              <div className="coverage-price">
                <strong>{money(q.price)}</strong>
                <Change value={q.change_percent} />
                {q.mock && <Hint>此报价为示例。</Hint>}
              </div>
              <div className="coverage-chart">
                <Sparkline history={d.history} />
                <div>
                  <span>{d.history.mock ? "示例走势" : "价格走势"}</span>
                  <span>
                    {d.technical.trend}
                    <Hint>
                      近一年收益 {(d.technical.return_year * 100).toFixed(1)}
                      %，年化波动 {(d.technical.volatility * 100).toFixed(1)}%。
                      {d.history.mock ? "根据示例历史数据计算。" : ""}
                    </Hint>
                  </span>
                </div>
              </div>
              <dl className="coverage-metrics">
                <div>
                  <dt>市值</dt>
                  <dd>{compact(q.market_cap)}</dd>
                </div>
                <div>
                  <dt>市盈率{d.metrics.mock && <Hint>此指标为示例。</Hint>}</dt>
                  <dd>{d.metrics.pe?.toFixed(1) || "—"}</dd>
                </div>
                <div>
                  <dt>Beta{d.metrics.mock && <Hint>此指标为示例。</Hint>}</dt>
                  <dd>{d.metrics.beta?.toFixed(2) || "—"}</dd>
                </div>
              </dl>
              <div className="financial-caption">
                {m?.mock ? "假设财务" : "财务摘要"}
                {m?.mock && (
                  <Hint>
                    下方财务数据为示例基期；完整计算与假设可在详情中查看。
                  </Hint>
                )}
              </div>
              <dl className="coverage-metrics">
                <div>
                  <dt>营业收入</dt>
                  <dd>{compact((rows.revenue || 0) * 1e6)}</dd>
                </div>
                <div>
                  <dt>EBITDA</dt>
                  <dd>{compact((rows.ebitda || 0) * 1e6)}</dd>
                </div>
                <div>
                  <dt>毛利率</dt>
                  <dd>{((rows.gross_margin || 0) * 100).toFixed(1)}%</dd>
                </div>
              </dl>
              <div className="coverage-thesis">
                <span>研究观点</span>
                <b>{m?.mock ? "待核实" : "持续观察"}</b>
                <Hint>
                  {researchBrief(
                    d.summary || "加入跟踪后会自动整理资料并生成研报。",
                  )}
                  {m?.mock ? "财务输入为示例，不能形成真实买卖评级。" : ""}
                </Hint>
              </div>
              <div className="coverage-card-footer">
                <span>
                  {pending ? (
                    "正在研究"
                  ) : d.reports[0]?.status === "failed" ? (
                    "更新未完成"
                  ) : (
                    <Updated report={report} />
                  )}
                </span>
                <div className="actions">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={busy === q.symbol}
                    aria-label={
                      (d.coverage?.active ? "暂停 " : "恢复 ") + q.symbol
                    }
                    onClick={() => void toggle(d)}
                  >
                    {d.coverage?.active ? (
                      <Pause size={14} />
                    ) : (
                      <Play size={14} />
                    )}
                  </Button>
                  {report && (
                    <Button variant="ghost" size="icon" asChild>
                      <Link
                        to={"/reports/" + report.id}
                        aria-label={"阅读 " + q.symbol + " 研报"}
                      >
                        <FileText size={15} />
                      </Link>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" asChild>
                    <Link to={"/coverage/" + q.symbol}>
                      详情
                      <ArrowRight size={14} />
                    </Link>
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!shown.length && (
        <Empty icon={<Telescope size={25} />}>
          <strong>选择需要持续跟踪的标的</strong>
          <Button variant="outline" asChild>
            <Link to="/">浏览自选</Link>
          </Button>
        </Empty>
      )}
    </div>
  );
}
