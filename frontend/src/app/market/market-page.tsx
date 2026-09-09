import { AddButton } from "@gitnapp/ui/components/ui/actions";
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@gitnapp/ui/components/ui/select";
import {
Table,
TableBody,
TableCell,
TableHead,
TableHeader,
TableRow,
} from "@gitnapp/ui/components/ui/table";
import { InfoLabel } from "@gitnapp/ui/components/ui/tooltip";
import { Glasses,Search } from "lucide-react";
import { useState } from "react";
import { Link,useNavigate,useSearchParams } from "react-router";
import { AddAsset } from "../../components/add-asset";
import { AssetPreparation } from "../../components/asset-preparation";
import { RefreshNotice } from "../../components/layout/async-content";
import { FilterToolbar } from "@gitnapp/ui/components/ui/filter-toolbar";
import {
SplitView,
usePreviewSelection,
} from "@gitnapp/ui/components/ui/split-view";
import { MarketPreview } from "../../components/market-preview";
import {
Change,
compact,
Empty,
ErrorState,
Loading,
money,
PageHeader,
} from "../../components/ui";
import { WatchlistEditor } from "../../components/watchlist-editor";
import { useAssets,useWatchlists } from "../../hooks/queries";

export default function MarketPage() {
  const navigate = useNavigate();
  function selectAsset(symbol: string) {
    if (matchMedia("(max-width: 767px)").matches) navigate("/stocks/" + symbol);
    else preview.toggle(symbol);
  }
  const lists = useWatchlists();
  const [params, setParams] = useSearchParams();
  const list = lists.data?.find((l) => l.id === params.get("list"));
  const assets = useAssets(list?.id);
  const { data = [], error, isLoading, refetch } = assets;
  const preview = usePreviewSelection();
  const { selected, closing, close: closePreview } = preview;
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const shown = data.filter((a) =>
    (a.symbol + a.name).toLowerCase().includes(search.toLowerCase()),
  );
  const symbol = data.some((a) => a.symbol === selected) ? selected : "";
  if (lists.isLoading || isLoading) return <Loading />;
  if ((error && !assets.data) || (lists.error && !lists.data))
    return (
      <ErrorState
        error={(error || lists.error)!}
        retry={() => void refetch()}
      />
    );
  return (
    <div className="page market-page">
      <PageHeader title="市场数据" />
      <RefreshNotice
        error={error || lists.error}
        retry={() => void refetch()}
      />
      <FilterToolbar
        leading={
          <>
            <Select
              value={list?.id || "all"}
              onValueChange={(id) =>
                setParams(id === "all" ? {} : { list: id })
              }
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
            <AddButton
              attention="quiet"
              iconOnly
              label="添加标的"
              onClick={() => setAdding(true)}
            />
            <WatchlistEditor
              list={list}
              onSelect={(id) => setParams(id ? { list: id } : {})}
            />
            <span className="muted">{data.length} 个标的</span>
          </>
        }
        search={{ value: search, onChange: setSearch,
          placeholder: "搜索代码或公司", label: "筛选标的" }}
      />
      <SplitView
        open={Boolean(symbol) && !closing}
        closing={closing}
        onClosed={preview.finishClose}
        preview={
          symbol ? (
            <MarketPreview symbol={symbol} onClose={closePreview} />
          ) : null
        }
      >
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
                    <AssetPreparation symbol={a.symbol}/>
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
                      <small className="market-cell-meta">
                        {a.coverage.cadence === "daily" ? "每日" : "每周"}
                      </small>
                    </Link>
                  ) : (
                    <span className="muted">未跟踪</span>
                  )}
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
                      <Glasses size={17} strokeWidth={1.5} aria-hidden="true" />
                      <span>{a.report_count}</span>
                    </Link>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </TableCell>
                <TableCell className="market-research-date">
                  {a.latest_report ? (
                    <Link to={"/reports/" + a.latest_report.id}>
                      {(
                        a.latest_report.completed_at ||
                        a.latest_report.created_at
                      ).slice(0, 10)}
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
              <AddButton
                attention="primary"
                label="添加标的"
                onClick={() => setAdding(true)}
              />
            )}
          </Empty>
        )}
      </SplitView>
      <AddAsset open={adding} onOpenChange={setAdding} listId={list?.id} />
    </div>
  );
}
