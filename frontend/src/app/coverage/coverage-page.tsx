import { useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Clock3,
  FileText,
  Pause,
  Play,
  Telescope,
} from "lucide-react";
import { toast } from "sonner";
import { write } from "../../api/client";
import { useAssets, useRefresh } from "../../hooks/queries";
import {
  Button,
  Change,
  compact,
  dateText,
  Empty,
  ErrorState,
  Hint,
  Loading,
  money,
  PageHeader,
  Source,
} from "../../components/ui";
import type { Asset } from "../../types";

export default function CoveragePage() {
  const { data = [], error, isLoading, refetch } = useAssets();
  const refresh = useRefresh();
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} retry={() => void refetch()} />;
  const coverage = data.filter((a) => a.coverage);
  const shown = coverage.filter(
    (a) =>
      filter === "all" ||
      (filter === "active" ? a.coverage?.active : !a.coverage?.active),
  );
  async function toggle(a: Asset) {
    setBusy(a.symbol);
    try {
      await write(
        `/coverage/${a.symbol}`,
        { cadence: a.coverage!.cadence, active: !a.coverage!.active },
        "PUT",
      );
      await refresh();
      toast.success(a.coverage!.active ? "已暂停自动研究" : "已恢复自动研究");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="page">
      <PageHeader
        eyebrow="RESEARCH / COVERAGE"
        title={
          <>
            持续跟踪{" "}
            <Hint>
              首次加入立即排期，随后按每日或每周生成版本化报告。暂停仅影响未来自动任务，已开始的任务会继续完成。服务运行期间调度生效，重启后补跑到期任务。
            </Hint>
          </>
        }
      >
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
          ].map(([key, name]) => (
            <button
              key={key}
              className={filter === key ? "selected" : ""}
              onClick={() => setFilter(key)}
            >
              {name}
              <span>
                {key === "all"
                  ? coverage.length
                  : coverage.filter((a) =>
                      key === "active"
                        ? a.coverage?.active
                        : !a.coverage?.active,
                    ).length}
              </span>
            </button>
          ))}
        </div>
        <span className="muted">
          <Clock3 size={14} />
          自动研究 · 本地调度
        </span>
      </div>
      <div className="coverage-grid">
        {shown.map((a) => (
          <article key={a.symbol} className="coverage-card">
            <div className="coverage-card-head">
              <Link to={`/stocks/${a.symbol}`}>
                <span className="symbol-avatar">{a.symbol.slice(0, 2)}</span>
                <span>
                  <strong>{a.symbol}</strong>
                  <small>{a.name}</small>
                </span>
              </Link>
              <span
                className={`coverage-state ${a.coverage?.active ? "active" : ""}`}
              >
                {a.coverage?.active ? "跟踪中" : "已暂停"}
              </span>
            </div>
            <div className="coverage-price">
              <strong>{money(a.price)}</strong>
              <Change value={a.change_percent} />
            </div>
            <div className="coverage-quote-time">
              <Source source={a.source} mock={a.mock} note={a.note} />
              <span>{dateText(a.as_of)}</span>
            </div>
            <div className="coverage-facts">
              <div>
                <span>市值</span>
                <b>{compact(a.market_cap)}</b>
              </div>
              <div>
                <span>报告版本</span>
                <b>{a.report_count.toString().padStart(2, "0")}</b>
              </div>
            </div>
            <div className="coverage-progress">
              <FileText size={15} />
              <span>
                {a.active_job
                  ? a.active_job.stage
                  : a.last_job?.status === "failed"
                    ? "上次研究失败"
                    : a.latest_report
                      ? `最新 v${a.latest_report.version} · ${dateText(a.latest_report.completed_at)}`
                      : "等待首次研究"}
              </span>
              {a.last_job?.status === "failed" && (
                <Hint>{a.last_job.error}</Hint>
              )}
            </div>
            <div className="coverage-schedule">
              <span>
                {a.coverage?.cadence === "daily" ? "每日" : "每周"}
                <small>
                  {a.coverage?.active
                    ? `下次 ${dateText(a.coverage.next_run)}`
                    : "已暂停自动排期"}
                </small>
              </span>
              <div className="actions">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${a.coverage?.active ? "暂停" : "恢复"} ${a.symbol} 跟踪`}
                  disabled={busy === a.symbol}
                  onClick={() => void toggle(a)}
                >
                  {a.coverage?.active ? (
                    <Pause size={15} />
                  ) : (
                    <Play size={15} />
                  )}
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/stocks/${a.symbol}`}>
                    详情
                    <ArrowRight size={14} />
                  </Link>
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!shown.length && (
        <Empty
          icon={<Telescope size={28} />}
          action={
            <Button variant="outline" asChild>
              <Link to="/">选择标的</Link>
            </Button>
          }
        >
          <strong>
            {coverage.length ? "没有匹配的跟踪标的" : "建立你的 Coverage"}
          </strong>
          <span>将自选标的加入持续跟踪，定期归档新的研究报告。</span>
        </Empty>
      )}
    </div>
  );
}
