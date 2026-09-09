import { AddButton } from "@gitnapp/ui/components/ui/actions";
import { FinancialPanel, TechnicalPanel } from "../../components/coverage-insights";
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
import { Plus, Search, ArrowRight, Glasses, X } from "lucide-react";
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
    else setSelected(current => current === symbol ? "" : symbol);
  }
  const lists = useWatchlists();
  const [params, setParams] = useSearchParams();
  const list = lists.data?.find((l) => l.id === params.get("list"));
  const { data = [], error, isLoading, refetch } = useAssets(list?.id);
  const [selected, setSelected] = useState("");
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
      <PageHeader title="市场看板" />
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
          <span className="muted">{data.length} 个标的</span>
        </div>
        <div className="actions">
          <AddButton attention="quiet" iconOnly label="添加标的" onClick={() => setAdding(true)} />
          <WatchlistEditor
            list={list}
            onSelect={(id) => setParams(id ? { list: id } : {})}
          />
        </div>
      </div>
      <div className={`market-grid${symbol ? " has-preview" : ""}`}>
        <section className="watchlist-panel">
          <div className="search-field table-search">
            <Search size={15} />
            <Input
              aria-label="筛选标的"
              placeholder="搜索代码或公司"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Table className="watchlist-table">
            <TableHeader>
              <TableRow>
                <TableHead>标的</TableHead>
                <TableHead>最新价</TableHead>
                <TableHead>涨跌幅</TableHead>
                <TableHead>市值</TableHead>
                <TableHead>研报</TableHead>
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
                      </Link>
                    ) : (
                      <span className="muted">—</span>
                    )}
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
        {symbol && <aside className="market-side" id="market-preview" aria-label="标的预览">
          <Button className="preview-close" variant="ghost" size="icon" aria-label="关闭预览" onClick={() => setSelected("")}><X size={16}/></Button>
          <LoadingBoundary
            pending={Boolean(symbol) && (detail.isPending || history.isPending)}
          >
            {detail.data ? (
              <>
                <div className="preview-heading">
                  <div>
                    <Link to={"/stocks/" + symbol} className="symbol-title">
                      {detail.data.quote.name}
                      <ArrowRight size={15} />
                    </Link>
                    <span className="muted">{detail.data.quote.symbol}</span>
                  </div>
                </div>
                <div className="preview-price">
                  {money(detail.data.quote.price, detail.data.quote.currency)}
                  <Change value={detail.data.quote.change_percent} />
                </div>
                <PriceChart key={symbol} symbol={symbol} small />
                <div className="preview-facts">
                  <div>
                    <span>市值</span>
                    <b>{compact(detail.data.quote.market_cap)}</b>
                  </div>
                  <div>
                    <span>市盈率</span>
                    <InfoLabel
                      label={<b>{detail.data.metrics.pe?.toFixed(1) || "—"}</b>}
                    >
                      {detail.data.metrics.mock ? "此市盈率为示例。" : null}
                    </InfoLabel>
                  </div>
                </div>
                <div className="preview-data">
                  <FinancialPanel data={detail.data} />
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
      <AddAsset open={adding} onOpenChange={setAdding} listId={list?.id} />
    </div>
  );
}
