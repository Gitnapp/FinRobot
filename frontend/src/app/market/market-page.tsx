import { useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  BookmarkPlus,
  Check,
  FileText,
  Plus,
  RefreshCw,
  Search,
  Star,
  Telescope,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@gitnapp/ui/components/ui/table";
import { toast } from "sonner";
import { write } from "../../api/client";
import {
  useAssets,
  useDetail,
  useRefresh,
  useReports,
} from "../../hooks/queries";
import {
  Button,
  Input,
  Change,
  compact,
  money,
  dateText,
  ErrorState,
  Loading,
  PageHeader,
  Source,
  Empty,
  Hint,
} from "../../components/ui";
import { PriceChart } from "../../components/price-chart";
import { AddAsset } from "../../components/add-asset";

export default function MarketPage() {
  const { data: assets, error, isLoading, refetch } = useAssets();
  const reports = useReports();
  const refresh = useRefresh();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState("NVDA");
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busySymbol, setBusySymbol] = useState<string | null>(null);
  const previewSymbol = assets?.some((a) => a.symbol === selected)
    ? selected
    : assets?.[0]?.symbol || "";
  const detail = useDetail(previewSymbol);
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} retry={() => void refetch()} />;
  const list = assets || [];
  const shown = list.filter(
    (a) =>
      (filter === "all" ||
        (filter === "coverage"
          ? a.coverage
          : filter === "semis"
            ? a.sector === "半导体"
            : !a.latest_report)) &&
      (a.symbol + a.name).toLowerCase().includes(search.toLowerCase()),
  );
  const completed = (reports.data || []).filter(
    (r) => r.status === "completed",
  );
  async function cover(symbol: string) {
    setBusySymbol(symbol);
    try {
      await write(
        `/coverage/${symbol}`,
        { cadence: "weekly", active: true },
        "PUT",
      );
      await refresh();
      toast.success(`${symbol} 已加入 Coverage，首次报告已排期`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusySymbol(null);
    }
  }
  async function reload() {
    setRefreshing(true);
    try {
      await write("/market/refresh", {});
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }
  return (
    <div className="page">
      <PageHeader eyebrow="WORKSPACE / MARKETS" title="市场看板">
        <Button
          variant="ghost"
          size="icon"
          aria-label="刷新行情"
          disabled={refreshing}
          onClick={() => void reload()}
        >
          <RefreshCw size={16} className={refreshing ? "spin" : ""} />
        </Button>
        <Button onClick={() => setAdding(true)}>
          <Plus size={16} />
          添加标的
        </Button>
      </PageHeader>
      <div className="stats-strip">
        <div>
          <span>自选标的</span>
          <strong>{list.length.toString().padStart(2, "0")}</strong>
          <Star size={16} />
        </div>
        <div>
          <span>持续跟踪</span>
          <strong>
            {list
              .filter((a) => a.coverage?.active)
              .length.toString()
              .padStart(2, "0")}
          </strong>
          <Telescope size={16} />
        </div>
        <div>
          <span>研究报告</span>
          <strong>{completed.length.toString().padStart(2, "0")}</strong>
          <FileText size={16} />
        </div>
        <div>
          <span>
            当日上涨{" "}
            <Hint>按各标的最近可用报价统计；不同来源的数据时点可能不同。</Hint>
          </span>
          <strong>
            {list.filter((a) => a.change_percent > 0).length}
            <small> / {list.length}</small>
          </strong>
          <span className="up muted-stat">自选范围</span>
        </div>
      </div>
      <div className="market-grid">
        <section className="watchlist-panel">
          <div className="section-toolbar">
            <div className="segmented">
              {[
                ["all", "全部"],
                ["coverage", "Coverage"],
                ["semis", "半导体"],
                ["unresearched", "待研究"],
              ].map(([key, title]) => (
                <button
                  key={key}
                  className={filter === key ? "selected" : ""}
                  onClick={() => setFilter(key)}
                >
                  {title}
                </button>
              ))}
            </div>
          </div>
          <div className="search-field table-search">
            <Search size={15} />
            <Input
              placeholder="筛选代码或公司"
              aria-label="筛选自选标的"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span>{shown.length} 个标的</span>
          </div>
          <Table className="watchlist-table">
            <TableHeader>
              <TableRow>
                <TableHead>标的</TableHead>
                <TableHead>最新价</TableHead>
                <TableHead>涨跌幅</TableHead>
                <TableHead>研究</TableHead>
                <TableHead className="text-right">跟踪</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((a) => (
                <TableRow
                  key={a.symbol}
                  className={previewSymbol === a.symbol ? "selected-row" : ""}
                >
                  <TableCell>
                    <div className="symbol-cell">
                      <button
                        className="symbol-avatar"
                        aria-label={`预览 ${a.symbol} 走势`}
                        onClick={() => setSelected(a.symbol)}
                      >
                        {a.symbol.slice(0, 2)}
                      </button>
                      <Link to={`/stocks/${a.symbol}`}>
                        <strong>{a.symbol}</strong>
                        <small>{a.name}</small>
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="numeric">
                    <span>{money(a.price)}</span>
                    <small className="quote-source">
                      {a.mock ? "模拟" : a.source}
                    </small>
                  </TableCell>
                  <TableCell>
                    <Change value={a.change_percent} />
                  </TableCell>
                  <TableCell>
                    {a.active_job ? (
                      <Link
                        className="status-label"
                        to={`/reports/${a.active_job.id}`}
                      >
                        研究中
                      </Link>
                    ) : a.latest_report ? (
                      <Link
                        to={`/reports/${a.latest_report.id}`}
                        className="report-count"
                      >
                        v{a.latest_report.version}
                        <ArrowRight size={12} />
                      </Link>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={
                        a.coverage
                          ? `查看 ${a.symbol} Coverage`
                          : `跟踪 ${a.symbol}`
                      }
                      disabled={busySymbol === a.symbol}
                      asChild={Boolean(a.coverage)}
                      onClick={
                        a.coverage ? undefined : () => void cover(a.symbol)
                      }
                    >
                      {a.coverage ? (
                        <Link to={`/stocks/${a.symbol}`}>
                          <Check size={16} />
                        </Link>
                      ) : (
                        <BookmarkPlus size={16} />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {shown.length === 0 && (
            <Empty icon={<Search size={24} />}>
              <span>
                {list.length ? "没有匹配的标的" : "添加第一个自选标的"}
              </span>
            </Empty>
          )}
          <div className="table-footer">
            {list.some((a) => a.mock)
              ? "部分行情为模拟数据"
              : "报价来自 Finnhub / FMP"}
            <Hint>
              每行标注数据源，点击标的查看报价时点。真实报价与模拟历史走势会分别标注。
            </Hint>
            <span>{list.length} 个自选</span>
          </div>
        </section>
        <aside className="market-side">
          {!previewSymbol ? (
            <Empty>
              <span>添加标的查看走势</span>
            </Empty>
          ) : detail.data ? (
            <section className="market-preview">
              <div className="preview-heading">
                <div>
                  <Link
                    to={`/stocks/${previewSymbol}`}
                    className="symbol-title"
                  >
                    {previewSymbol}
                    <ArrowRight size={15} />
                  </Link>
                  <span className="muted">{detail.data.quote.name}</span>
                </div>
                <Source
                  source={detail.data.quote.source}
                  mock={detail.data.quote.mock}
                  note={detail.data.quote.note}
                />
              </div>
              <div className="preview-price">
                {money(detail.data.quote.price)}
                <Change value={detail.data.quote.change_percent} />
              </div>
              <PriceChart history={detail.data.history} small />
              <div className="preview-facts">
                <div>
                  <span>行情时间</span>
                  <b>{dateText(detail.data.quote.as_of)}</b>
                </div>
                <div>
                  <span>市值</span>
                  <b>{compact(detail.data.quote.market_cap)}</b>
                </div>
              </div>
              <Link to={`/stocks/${previewSymbol}`} className="preview-link">
                打开研究详情
                <ArrowRight size={15} />
              </Link>
            </section>
          ) : detail.error ? (
            <ErrorState error={detail.error} />
          ) : (
            <Loading />
          )}
          <section className="recent-section">
            <div className="section-toolbar">
              <h2>最近研究</h2>
              <Link to="/reports" className="muted">
                全部 <ArrowRight size={13} />
              </Link>
            </div>
            {(reports.data || []).slice(0, 3).map((r) => (
              <Link key={r.id} to={`/reports/${r.id}`} className="recent-row">
                <FileText size={17} />
                <span>
                  <strong>
                    {r.symbol}
                    <small> v{r.version}</small>
                  </strong>
                  <small>
                    {r.status === "completed"
                      ? dateText(r.completed_at)
                      : r.stage}
                  </small>
                </span>
                <span className={`status-dot ${r.status}`} />
              </Link>
            ))}
            {!reports.data?.length && (
              <div className="quiet-empty">研究报告会归档在这里</div>
            )}
          </section>
        </aside>
      </div>
      <AddAsset open={adding} onOpenChange={setAdding} />
    </div>
  );
}
