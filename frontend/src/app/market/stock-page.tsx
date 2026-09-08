import {
  CatalystCalendar,
  RetailSentiment,
} from "../../components/tracking-signals";
import { InfoLabel } from "@gitnapp/ui/components/ui/tooltip";
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
  CardFooter,
} from "@gitnapp/ui/components/ui/card";
import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  BookmarkPlus,
  Pause,
  Play,
  MoreHorizontal,
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
  TechnicalPanel,
  FinancialPanel,
  ValuationPanel,
  PeersPanel,
  CatalystPanel,
} from "../../components/coverage-insights";
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

function ResearchSummary({ id }: { id: string }) {
  const { data } = useReport(id);
  const p = data?.payload;
  if (!p) return <Loading />;
  return (
    <>
      <CardHeader>
        <CardTitle>
          <h2>研究观点</h2>
        </CardTitle>
        <CardAction>
          <Updated report={data} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <h3 className="text-xl leading-7 font-semibold">
          {p.symbol} · 基本面与估值
        </h3>
        <p className="text-sm leading-7 text-muted-foreground line-clamp-5">
          {researchBrief(p.sections[0]?.content)}
        </p>
        <div className="text-xs text-muted-foreground">
          {p.has_mock_data && (
            <InfoLabel label="假设测算">
              本报告基于示例财务输入。完整口径和来源见报告附录。
            </InfoLabel>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full" variant="outline" asChild>
          <Link to={"/reports/" + id}>
            阅读
            <ArrowRight size={15} />
          </Link>
        </Button>
      </CardFooter>
    </>
  );
}

export default function StockPage() {
  const { symbol = "NVDA" } = useParams();
  const coverageMode = useLocation().pathname.startsWith("/coverage/");
  const { data, error, isLoading, refetch } = useDetail(symbol, coverageMode);
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
  async function track(
    activeFlag = true,
    cadence = coverage?.cadence || "weekly",
  ) {
    setBusy(true);
    try {
      await write(
        "/coverage/" + symbol,
        { active: activeFlag, cadence },
        "PUT",
      );
      void refresh();
      if (!coverageMode) navigate("/coverage/" + symbol);
      toast.success(activeFlag ? "已开启持续跟踪" : "已暂停跟踪");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    try {
      await api("/coverage/" + symbol, { method: "DELETE" });
      void refresh();
      navigate("/coverage");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <div className="page stock-page">
      <Link to={coverageMode ? "/coverage" : "/"} className="back-link">
        <ArrowLeft size={14} />
        {coverageMode ? "持续跟踪" : "市场看板"}
      </Link>
      <PageHeader
        title={
          <>
            {symbol}
            <span className="company-name">{quote.name}</span>
          </>
        }
      >
        <ResearchAction symbol={symbol} active={active} />
        {coverageMode ? (
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void track(!coverage?.active)}
            >
              {coverage?.active ? <Pause size={15} /> : <Play size={15} />}{" "}
              {coverage?.active ? "暂停跟踪" : "恢复跟踪"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="更多跟踪操作">
                  <MoreHorizontal size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => void remove()}>
                  移出持续跟踪
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : coverage ? (
          <Button variant="outline" asChild>
            <Link to={"/coverage/" + symbol}>
              查看持续跟踪
              <ArrowRight size={14} />
            </Link>
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void track()}
          >
            <BookmarkPlus size={15} />
            持续跟踪
          </Button>
        )}
      </PageHeader>
      <div className="stock-quote-bar">
        <div className="stock-price">
          {money(quote.price)}
          <Change value={quote.change_percent} />
          {quote.mock && <Hint>此报价为示例。</Hint>}
        </div>
        <span className="stock-sector">{quote.sector}</span>
        {coverageMode && (
          <div className="tracking-settings">
            <select
              aria-label="跟踪频率"
              value={coverage?.cadence}
              onChange={(e) =>
                void track(
                  Boolean(coverage?.active),
                  e.target.value as "daily" | "weekly",
                )
              }
              disabled={busy}
            >
              <option value="daily">每日跟踪</option>
              <option value="weekly">每周跟踪</option>
            </select>
          </div>
        )}
      </div>
      {coverageMode && (
        <div className="detail-tabs" role="tablist" aria-label="持续跟踪详情">
          <button
            role="tab"
            aria-selected={tab === "overview"}
            onClick={() => setTab("overview")}
          >
            研究概览
          </button>
          <button
            role="tab"
            aria-selected={tab === "model"}
            onClick={() => setTab("model")}
          >
            简单模型
          </button>
        </div>
      )}
      {coverageMode && tab === "model" ? (
        <ModelTable symbol={symbol} />
      ) : (
        <>
          <div className="coverage-detail-grid">
            <div className="insights-column">
              <PriceChart key={symbol} symbol={symbol} />
              <TechnicalPanel data={data} />
              {coverageMode && <FinancialPanel data={data} />}
              <PeersPanel data={data} />
            </div>
            <div className="insights-column">
              <CatalystCalendar key={`calendar-${symbol}`} symbol={symbol} />
              <RetailSentiment key={`sentiment-${symbol}`} symbol={symbol} />
              <Card>
                {latest ? (
                  <ResearchSummary id={latest.id} />
                ) : (
                  <Empty>
                    <strong>{active ? "正在研究" : "尚无研报"}</strong>
                    {active && (
                      <Button variant="outline" asChild>
                        <Link to={"/reports/" + active.id}>查看进度</Link>
                      </Button>
                    )}
                  </Empty>
                )}
              </Card>
              {coverageMode ? (
                <ValuationPanel data={data} />
              ) : (
                <section className="dense-panel">
                  <h2>公司概览</h2>
                  <dl className="metric-grid">
                    <div>
                      <dt>市值</dt>
                      <dd>{compact(quote.market_cap)}</dd>
                    </div>
                    <div>
                      <dt>
                        市盈率{data.metrics.mock && <Hint>此指标为示例。</Hint>}
                      </dt>
                      <dd>{data.metrics.pe?.toFixed(1) || "—"}</dd>
                    </div>
                    <div>
                      <dt>
                        Beta{data.metrics.mock && <Hint>此指标为示例。</Hint>}
                      </dt>
                      <dd>{data.metrics.beta?.toFixed(2) || "—"}</dd>
                    </div>
                  </dl>
                </section>
              )}
              <CatalystPanel data={data} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
