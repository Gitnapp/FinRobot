import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@gitnapp/ui/components/ui/select";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Plus, Search, ArrowRight, FileText } from "lucide-react";
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
  Hint,
} from "../../components/ui";
import { PriceChart } from "../../components/price-chart";
import { AddAsset } from "../../components/add-asset";
import { WatchlistEditor } from "../../components/watchlist-editor";

export default function MarketPage() {
  const lists = useWatchlists();
  const [params, setParams] = useSearchParams();
  const list =
    lists.data?.find((l) => l.id === params.get("list")) || lists.data?.[0];
  const { data = [], error, isLoading, refetch } = useAssets(list?.id);
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const shown = data.filter((a) =>
    (a.symbol + a.name).toLowerCase().includes(search.toLowerCase()),
  );
  const symbol = data.some((a) => a.symbol === selected)
    ? selected
    : data[0]?.symbol || "";
  const detail = useDetail(symbol);
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
            value={list?.id || ""}
            onValueChange={(id) => setParams({ list: id })}
          >
            <SelectTrigger aria-label="自选列表" className="w-[132px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
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
          <Button
            variant="ghost"
            size="icon"
            aria-label="添加标的"
            onClick={() => setAdding(true)}
          >
            <Plus size={18} />
          </Button>
          {list && (
            <WatchlistEditor
              list={list}
              onSelect={(id) => setParams(id ? { list: id } : {})}
            />
          )}
        </div>
      </div>
      <div className="market-grid">
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
                  className={symbol === a.symbol ? "selected-row" : ""}
                >
                  <TableCell>
                    <div className="symbol-cell">
                      <button
                        className="symbol-avatar"
                        aria-label={"预览 " + a.symbol + " 走势"}
                        onClick={() => setSelected(a.symbol)}
                      >
                        {a.symbol.slice(0, 2)}
                      </button>
                      <Link to={"/stocks/" + a.symbol}>
                        <strong>{a.symbol}</strong>
                        <small>{a.name}</small>
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="numeric">
                    {money(a.price)}
                    {a.mock && <Hint>此报价为示例，尚未取得实际行情。</Hint>}
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
                        <FileText size={15} />
                        阅读
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
                <Button variant="outline" onClick={() => setAdding(true)}>
                  添加标的
                </Button>
              )}
            </Empty>
          )}
        </section>
        <aside className="market-side">
          {detail.data ? (
            <>
              <div className="preview-heading">
                <div>
                  <Link to={"/stocks/" + symbol} className="symbol-title">
                    {symbol}
                    <ArrowRight size={15} />
                  </Link>
                  <span className="muted">{detail.data.quote.name}</span>
                </div>
              </div>
              <div className="preview-price">
                {money(detail.data.quote.price)}
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
                  <b>{detail.data.metrics.pe?.toFixed(1) || "—"}</b>
                  {detail.data.metrics.mock && <Hint>此市盈率为示例。</Hint>}
                </div>
              </div>
              <Link className="preview-link" to={"/stocks/" + symbol}>
                查看标的
                <ArrowRight size={15} />
              </Link>
            </>
          ) : symbol ? (
            <Loading />
          ) : (
            <Empty>
              <span>选择标的查看走势</span>
            </Empty>
          )}
        </aside>
      </div>
      <AddAsset open={adding} onOpenChange={setAdding} listId={list?.id} />
    </div>
  );
}
