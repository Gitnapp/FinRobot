import { PeersPanel } from "../../components/peers-panel";
import { BackLink } from "@gitnapp/ui/components/ui/back-link";
import { TrackingControls } from "../../components/tracking-controls";
import {
  EvidenceCard,
  useEvidence,
  ResearchLeads,
  useResearchLeads,
} from "../../components/intelligence";
import {
  CatalystCalendar,
  RetailSentiment,
  useSignal,
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
import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import {
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
import {
  useDetail,
  useRefresh,
  useReport,
  usePriceHistory,
} from "../../hooks/queries";
import { PriceChart } from "../../components/price-chart";
import { ModelTable } from "../../components/model-table";
import { ResearchAction } from "../../components/research-action";
import {
  TechnicalPanel,
  FinancialPanel,
  ValuationPanel,
  CatalystPanel,
} from "../../components/coverage-insights";
import {
  Button,
  Change,
  compact,
  Empty,
  ErrorState,
  Loading,
  money,
  PageHeader,
  Updated,
  researchBrief,
} from "../../components/ui";

function ResearchSummary({ id, symbol }: { id: string; symbol: string }) {
  const { data, error, refetch } = useReport(id, symbol);
  const p = data?.payload;
  if (!p)
    return error ? (
      <ErrorState error={error} retry={() => void refetch()} />
    ) : (
      <Loading />
    );
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
          基本面与估值
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
  const history = usePriceHistory(symbol);
  const leads = useResearchLeads(symbol);
  const evidence = useEvidence(symbol);
  const catalysts = useSignal(symbol, "catalysts");
  const sentiment = useSignal(symbol, "sentiment");
  const latestId =
    data?.reports.find((r) => r.status === "completed")?.id || "";
  const report = useReport(latestId, symbol);
  const [readySymbol, setReadySymbol] = useState("");
  const initialPending =
    isLoading ||
    history.isPending ||
    leads.isPending ||
    leads.data?.state === "pending" ||
    catalysts.isPending ||
    sentiment.isPending ||
    evidence.isPending ||
    evidence.data?.state === "pending" ||
    (Boolean(latestId) && report.isPending);
  useEffect(() => {
    if (!initialPending) setReadySymbol(symbol);
  }, [initialPending, symbol]);
  const refresh = useRefresh();
  const [tab, setTab] = useState("overview");
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} retry={() => void refetch()} />;
  if (!data) return null;
  if (readySymbol !== symbol && initialPending) return <Loading />;
  const { quote, coverage, reports } = data;
  const active = reports.find(
    (r) => r.status === "queued" || r.status === "running",
  );
  const latest = reports.find((r) => r.status === "completed");
  return (
    <div className="page stock-page">
      <BackLink asChild>
        <Link to={coverageMode ? "/coverage" : "/"} aria-label={coverageMode ? "返回持续跟踪" : "返回市场看板"}>返回</Link>
      </BackLink>
      <PageHeader
        title={
          <>
            {quote.name}
            <span className="security-code">{quote.symbol}</span>
          </>
        }
      >
        {!data.market_only && (
          <ResearchAction symbol={symbol} active={active} />
        )}
        <TrackingControls symbol={symbol} coverage={coverage} />
      </PageHeader>
      <div className="stock-quote-bar">
        <div className="stock-price">
          <InfoLabel label={money(quote.price, quote.currency)}>
            {quote.mock ? "此报价为示例。" : null}
          </InfoLabel>
          <Change value={quote.change_percent} />
        </div>
        <span className="stock-sector">{quote.sector}</span>
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
              <FinancialPanel data={data} />
              <PeersPanel symbol={symbol} />
              <EvidenceCard symbol={symbol} />
              <ResearchLeads symbol={symbol} />
            </div>
            <div className="insights-column">
              <CatalystCalendar key={`calendar-${symbol}`} symbol={symbol} />
              <RetailSentiment key={`sentiment-${symbol}`} symbol={symbol} />
              <Card>
                {latest ? (
                  <ResearchSummary id={latest.id} symbol={symbol} />
                ) : (
                  <>
                    <CardHeader>
                      <CardTitle>研究观点</CardTitle>
                    </CardHeader>
                    <Empty>
                      <strong>{active ? "正在研究" : "尚无研报"}</strong>
                      {active && (
                        <Button variant="outline" asChild>
                          <Link to={"/reports/" + active.id}>查看进度</Link>
                        </Button>
                      )}
                    </Empty>
                  </>
                )}
              </Card>
              <ValuationPanel data={data} />
              <CatalystPanel data={data} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
