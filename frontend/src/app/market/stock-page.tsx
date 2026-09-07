import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  BookmarkPlus,
  Check,
  ExternalLink,
  FileText,
  MoreHorizontal,
  Pause,
  Play,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@gitnapp/ui/components/ui/dropdown-menu";
import { toast } from "sonner";
import { api, write } from "../../api/client";
import { useDetail, useRefresh, useReport } from "../../hooks/queries";
import { PriceChart } from "../../components/price-chart";
import { ModelTable } from "../../components/model-table";
import { ResearchAction } from "../../components/research-action";
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

function LatestResearch({ id }: { id: string }) {
  const { data } = useReport(id);
  const payload = data?.payload;
  return payload ? (
    <>
      <div className="research-summary-title">
        <span className="source">{payload.verdict}</span>
        <span className="muted">
          v{payload.version} · {dateText(payload.created_at)}
        </span>
      </div>
      <h3>
        {payload.symbol} · {payload.has_mock_data ? "情景研究" : "基本面研究"}
      </h3>
      <p>{payload.sections[0]?.content}</p>
      <div className="research-meta">
        <span>{payload.engine}</span>
        {payload.has_mock_data && (
          <Source
            mock
            source="Demo"
            note="报告包含模拟输入，请先核实财务基期。"
          />
        )}
      </div>
      <Button className="w-full" variant="outline" asChild>
        <Link to={`/reports/${id}`}>
          <FileText size={15} />
          阅读全文
          <ArrowRight size={15} />
        </Link>
      </Button>
    </>
  ) : (
    <Loading />
  );
}

export default function StockPage() {
  const { symbol = "NVDA" } = useParams();
  const { data, error, isLoading, refetch } = useDetail(symbol);
  const refresh = useRefresh();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [busy, setBusy] = useState(false);
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} retry={() => void refetch()} />;
  if (!data) return null;
  const { quote, coverage, reports } = data;
  const active = reports.find(
    (r) => r.status === "queued" || r.status === "running",
  );
  const latest = reports.find((r) => r.status === "completed");
  async function updateCoverage(
    activeFlag: boolean,
    cadence = coverage?.cadence || "weekly",
  ) {
    setBusy(true);
    try {
      await write(
        `/coverage/${symbol}`,
        { active: activeFlag, cadence },
        "PUT",
      );
      await refresh();
      toast.success(activeFlag ? "已更新跟踪计划" : "已暂停自动研究");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(kind: "coverage" | "assets") {
    try {
      await api(`/${kind}/${symbol}`, { method: "DELETE" });
      if (kind === "assets") navigate("/");
      void refresh();
      toast.success(
        kind === "assets" ? "已移出自选，报告仍保留" : "已移出 Coverage",
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <div className="page stock-page">
      <Link to={coverage ? "/coverage" : "/"} className="back-link">
        <ArrowLeft size={14} />
        {coverage ? "Coverage" : "自选标的"}
      </Link>
      <PageHeader
        eyebrow={`${quote.sector} / US EQUITY`}
        title={
          <>
            {symbol}
            <span className="company-name">{quote.name}</span>
          </>
        }
      >
        <ResearchAction symbol={symbol} active={active} />
        {coverage ? (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void updateCoverage(!coverage.active)}
          >
            {coverage.active ? <Pause size={15} /> : <Play size={15} />}{" "}
            {coverage.active ? "暂停跟踪" : "恢复跟踪"}
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void updateCoverage(true)}
          >
            <BookmarkPlus size={15} />
            加入 Coverage
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" aria-label="更多标的操作">
              <MoreHorizontal size={17} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {coverage && (
              <DropdownMenuItem onSelect={() => void remove("coverage")}>
                移出 Coverage
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => void remove("assets")}>
              移出自选
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>
      <div className="stock-quote-bar">
        <div className="stock-price">
          {money(quote.price)}
          <Change value={quote.change_percent} />
        </div>
        <div className="stock-source">
          <Source source={quote.source} mock={quote.mock} note={quote.note} />
          <span>{dateText(quote.as_of)} · USD</span>
        </div>
        {coverage && (
          <div className="tracking-settings">
            <span className={coverage.active ? "up" : "muted"}>
              <Check size={13} />
              {coverage.active ? "持续跟踪" : "已暂停"}
            </span>
            <select
              aria-label="自动研究频率"
              value={coverage.cadence}
              disabled={busy}
              onChange={(e) =>
                void updateCoverage(
                  Boolean(coverage.active),
                  e.target.value as "daily" | "weekly",
                )
              }
            >
              <option value="daily">每日研究</option>
              <option value="weekly">每周研究</option>
            </select>
            <Hint>
              下次：{dateText(coverage.next_run)}
              。服务运行时自动生成，暂停不会终止正在运行的任务。
            </Hint>
          </div>
        )}
      </div>
      <div className="detail-tabs" role="tablist" aria-label="标的详情">
        {[
          ["overview", "研究概览"],
          ["model", "预测模型"],
          [
            "history",
            `报告历史 (${reports.filter((r) => r.status === "completed").length})`,
          ],
        ].map(([key, name]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
          >
            {name}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <>
          <div className="stock-grid">
            <div className="stock-market">
              <PriceChart history={data.history} />
              <div className="stock-facts">
                <div>
                  <span>市值</span>
                  <b>{compact(quote.market_cap)}</b>
                </div>
                <div>
                  <span>
                    基期收入{" "}
                    <Source source="FMP" mock={data.fundamentals.mock} />
                  </span>
                  <b>{compact(data.fundamentals.revenue * 1e6)}</b>
                </div>
                <div>
                  <span>财务年度</span>
                  <b>{data.fundamentals.year}A</b>
                </div>
              </div>
            </div>
            <section className="research-summary">
              <div className="section-toolbar">
                <h2>AI Research</h2>
                <FileText size={17} />
              </div>
              {latest ? (
                <LatestResearch id={latest.id} />
              ) : (
                <Empty
                  icon={<FileText size={26} />}
                  action={
                    active ? (
                      <Button variant="outline" asChild>
                        <Link to={`/reports/${active.id}`}>查看进度</Link>
                      </Button>
                    ) : null
                  }
                >
                  <strong>{active ? active.stage : "尚无研究报告"}</strong>
                  <span>生成 Research，建立第一份研究快照。</span>
                </Empty>
              )}
            </section>
          </div>
          <ModelTable symbol={symbol} />
          <section className="news-section">
            <div className="section-toolbar">
              <h2>新闻与催化</h2>
              <Hint>{data.news.note}</Hint>
            </div>
            {data.news.items.length ? (
              data.news.items.map((item, i) => (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  key={i}
                  className="news-row"
                >
                  <span>
                    <small>
                      {item.source} · {dateText(item.date)}
                    </small>
                    <strong>{item.title}</strong>
                  </span>
                  <ExternalLink size={14} />
                </a>
              ))
            ) : (
              <div className="quiet-empty">暂无可验证的近期新闻</div>
            )}
          </section>
        </>
      )}
      {tab === "model" && <ModelTable symbol={symbol} />}
      {tab === "history" && (
        <section className="history-list">
          {reports.map((r) => (
            <Link key={r.id} to={`/reports/${r.id}`} className="history-row">
              <span className="version-box">v{r.version}</span>
              <span>
                <strong>
                  {symbol} ·{" "}
                  {r.trigger === "scheduled" ? "Coverage 定期研究" : "主动研究"}
                </strong>
                <small>
                  {dateText(r.created_at)} · {r.stage}
                </small>
                {r.error && <small className="down">{r.error}</small>}
              </span>
              <ArrowRight size={16} />
            </Link>
          ))}
          {!reports.length && (
            <Empty>
              <span>尚无报告历史</span>
            </Empty>
          )}
        </section>
      )}
    </div>
  );
}
