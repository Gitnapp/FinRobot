import { AddButton } from "@gitnapp/ui/components/ui/actions";
import { TechnicalPanel } from "../../components/coverage-insights";
import { InfoLabel } from "@gitnapp/ui/components/ui/tooltip";
import { usePriceHistory } from "../../hooks/queries";
import { LoadingBoundary } from "@gitnapp/ui/components/ui/loading";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@gitnapp/ui/components/ui/select";
import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router";
import { Search, ArrowRight, Glasses, X } from "lucide-react";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@gitnapp/ui/components/ui/table";
import { useAssets, useDetail, useWatchlists } from "../../hooks/queries";
import {
  Button,
  Input,
  Change,
  compact,
  money,
  ErrorState,
  Loading,
  PageHeader,
  Empty,
} from "../../components/ui";
import { PriceChart } from "../../components/price-chart";
import { AddAsset } from "../../components/add-asset";
import { WatchlistEditor } from "../../components/watchlist-editor";

export default function MarketPage() {
  const navigate = useNavigate();
  function selectAsset(symbol: string) {
    if (matchMedia("(max-width: 767px)").matches) navigate("/stocks/" + symbol);
    else if (selected === symbol && !closing) closePreview();
    else { setClosing(false); setSelected(symbol); }
  }
  const lists = useWatchlists();
  const [params, setParams] = useSearchParams();
  const list = lists.data?.find((l) => l.id === params.get("list"));
  const { data = [], error, isLoading, refetch } = useAssets(list?.id);
  const [selected, setSelected] = useState("");
  const [closing, setClosing] = useState(false);
  function closePreview() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) setSelected("");
    else setClosing(true);
  }
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const shown = data.filter((a) =>
    (a.symbol + a.name).toLowerCase().includes(search.toLowerCase()),
  );
  const symbol = data.some((a) => a.symbol === selected)
    ? selected
    : "";
  const detail = useDetail(symbol);
  const history = usePriceHistory(symbol);
  const companyName = detail.data?.quote.name.trim() || "";
  const lastSpace = companyName.lastIndexOf(" ");
  const titlePrefix = lastSpace >= 0 ? companyName.slice(0, lastSpace + 1) : Array.from(companyName).slice(0, -1).join("");
  const titleEnding = lastSpace >= 0 ? companyName.slice(lastSpace + 1) : Array.from(companyName).at(-1) || "";
  if (lists.isLoading || isLoading) return <Loading />;
  if (error || lists.error)
    return (
      <ErrorState
        error={(error || lists.error)!}
        retry={() => void refetch()}
      />
    );
  return (
    <div className="page market-page">
      <PageHeader title="市场数据" />
      <div className="watchlist-toolbar">
        <div className="actions">
          <Select
            value={list?.id || "all"}
            onValueChange={(id) => setParams(id === "all" ? {} : { list: id })}
          >
            <SelectTrigger aria-label="自选列表" className="w-[132px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              <SelectItem value="all">全部</SelectItem>
              {lists.data?.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AddButton attention="quiet" iconOnly label="添加标的" onClick={() => setAdding(true)} />
          <WatchlistEditor
            list={list}
            onSelect={(id) => setParams(id ? { list: id } : {})}
          />
          <span className="muted">{data.length} 个标的</span>
        </div>
          <div className="search-field market-search">
            <Search size={15} />
            <Input
              aria-label="筛选标的"
              placeholder="搜索代码或公司"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

      </div>
      <div className={`market-grid${symbol && !closing ? " has-preview" : ""}`} onTransitionEnd={event => {
        if (event.target === event.currentTarget && event.propertyName === "grid-template-columns" && closing) { setSelected(""); setClosing(false); }
      }}>
        <section className="watchlist-panel">
          <Table className="watchlist-table">
            <TableHeader>
              <TableRow>
                <TableHead>标的</TableHead>
                <TableHead>最新价</TableHead>
                <TableHead>涨跌幅</TableHead>
                <TableHead>市值</TableHead>
                <TableHead>标的跟踪</TableHead>
                <TableHead>研报</TableHead>
                <TableHead>研究更新</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((a) => (
                <TableRow
                  key={a.symbol}
                  tabIndex={0}
                  aria-label={`预览 ${a.symbol} 走势`}
                  aria-selected={symbol === a.symbol}
                  aria-expanded={symbol === a.symbol}
                  aria-controls="market-preview"
                  onClick={(e) => {
                    if (!(e.target as HTMLElement).closest("a,button"))
                      selectAsset(a.symbol);
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.target === e.currentTarget &&
                      (e.key === "Enter" || e.key === " ")
                    ) {
                      e.preventDefault();
                      selectAsset(a.symbol);
                    }
                  }}
                  className={symbol === a.symbol ? "selected-row" : ""}
                >
                  <TableCell>
                    <div className="symbol-cell">
                      <Link
                        to={"/stocks/" + a.symbol}
                        onClick={(e) => {
                          if (
                            !e.metaKey &&
                            !e.ctrlKey &&
                            !e.shiftKey &&
                            !e.altKey
                          ) {
                            e.preventDefault();
                            selectAsset(a.symbol);
                          }
                        }}
                      >
                        <strong>{a.name}</strong>
                        <small>{a.symbol}</small>
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="numeric">
                    <InfoLabel label={money(a.price, a.currency)}>
                      {a.mock ? "此报价为示例，尚未取得实际行情。" : null}
                    </InfoLabel>
                  </TableCell>
                  <TableCell>
                    <Change value={a.change_percent} />
                  </TableCell>
                  <TableCell className="numeric">
                    {compact(a.market_cap)}
                  </TableCell>
                  <TableCell>
                    {a.coverage ? (
                      <Link to={"/coverage/" + a.symbol}>
                        {a.coverage.active ? "跟踪中" : "已暂停"}
                        <small className="market-cell-meta">{a.coverage.cadence === "daily" ? "每日" : "每周"}</small>
                      </Link>
                    ) : <span className="muted">未跟踪</span>}
                  </TableCell>
                  <TableCell>
                    {a.active_job ? (
                      <Link to={"/reports/" + a.active_job.id}>研究中</Link>
                    ) : a.latest_report ? (
                      <Link
                        to={"/reports/" + a.latest_report.id}
                        aria-label={"阅读 " + a.symbol + " 研报"}
                        className="report-count"
                      >
                        <Glasses
                          size={17}
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                        <span>{a.report_count}</span>
                      </Link>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </TableCell>
                  <TableCell className="market-research-date">
                    {a.latest_report ? (
                      <Link to={"/reports/" + a.latest_report.id}>
                        {(a.latest_report.completed_at || a.latest_report.created_at).slice(0, 10)}
                      </Link>
                    ) : <span className="muted">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!shown.length && (
            <Empty icon={<Search size={24} />}>
              <strong>
                {search ? "没有找到匹配标的" : "这个列表还没有标的"}
              </strong>
              {!search && (
                <AddButton attention="primary" label="添加标的" onClick={() => setAdding(true)} />
              )}
            </Empty>
          )}
        </section>
        <div className="market-preview-slot" inert={!symbol || closing} aria-hidden={!symbol || closing}>
        {symbol && <aside className="market-side" id="market-preview" aria-label="标的预览">
          <Button className="preview-close" variant="ghost" size="icon" aria-label="关闭预览" onClick={closePreview}><X size={16}/></Button>
          <LoadingBoundary
            pending={Boolean(symbol) && (detail.isPending || history.isPending)}
          >
            {detail.data ? (
              <>
                <div className="preview-heading">
                  <div>
                    <Link to={"/stocks/" + symbol} className="symbol-title" data-page-link>
                      {titlePrefix}<span className="title-ending">{titleEnding}<ArrowRight size={18} aria-hidden="true" /></span>
                    </Link>
                    <span className="muted">{detail.data.quote.symbol}</span>
                  </div>
                </div>
                <div className="preview-quote-row">
                  <div className="preview-price">
                    <strong>{money(detail.data.quote.price, detail.data.quote.currency)}</strong>
                    <Change value={detail.data.quote.change_percent} />
                  </div>
                  <dl className="preview-quote-facts">
                    <div><dt>市值</dt><dd>{compact(detail.data.quote.market_cap)}</dd></div>
                    <div><dt>市盈率</dt><dd>{detail.data.metrics.pe?.toFixed(1) || "—"}</dd></div>
                  </dl>
                </div>
                <PriceChart key={symbol} symbol={symbol} small />
                <div className="preview-data">
                  <TechnicalPanel data={detail.data} />
                </div>
              </>
            ) : symbol ? (
              <ErrorState
                error={detail.error || new Error("暂时无法获取标的")}
                retry={() => void detail.refetch()}
              />
            ) : (
              <Empty>
                <span>选择标的查看走势</span>
              </Empty>
            )}
          </LoadingBoundary>
        </aside>}
        </div>
      </div>
      <AddAsset open={adding} onOpenChange={setAdding} listId={list?.id} />
    </div>
  );
}
