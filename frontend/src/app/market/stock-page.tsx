import { AnimatedSwitcher } from "../../components/animated-switcher";
import { PeersPanel } from "../../components/peers-panel";
import { BackLink } from "@gitnapp/ui/components/ui/back-link";
import { TrackingControls } from "../../components/tracking-controls";
import {
  EvidenceCard,
  ResearchLeads,
} from "../../components/intelligence";
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
} from "@gitnapp/ui/components/ui/card";
import { useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
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
  useReport,
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
        <h3 className="text-xl leading-7 font-semibold">基本面与估值</h3>
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

    </>
  );
}

export default function StockPage() {
  const { symbol = "NVDA" } = useParams();
  const coverageMode = useLocation().pathname.startsWith("/coverage/");
  const { data, error, isLoading, refetch } = useDetail(symbol);
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "overview";
  const setTab = (value: string) => setParams(value === "overview" ? {} : {tab: value}, {replace: true});
  const [researchOpened, setResearchOpened] = useState(tab === "research");
  const assetPath = `/${coverageMode ? "coverage" : "stocks"}/${symbol}`;
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} retry={() => void refetch()} />;
  if (!data) return null;
  const { quote, coverage, reports } = data;
  const active = reports.find(
    (r) => r.status === "queued" || r.status === "running",
  );
  const latest = reports.find((r) => r.status === "completed");
  return (
    <div className="page stock-page">
      <BackLink asChild>
        <Link
          to={coverageMode ? "/coverage" : "/"}
          aria-label={coverageMode ? "返回标的跟踪" : "返回市场数据"}
        >
          返回
        </Link>
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
      <AnimatedSwitcher className="detail-tabs" data-active={tab} role="tablist" aria-label="标的详情">
        <button
          role="tab"
          aria-selected={tab === "overview"}
          onClick={() => setTab("overview")}
        >
          概览
        </button>
        <button
          role="tab"
          aria-selected={tab === "research"}
          onClick={() => {
            setResearchOpened(true);
            setTab("research");
          }}
        >
          研究
        </button>
        <button role="tab" aria-selected={tab === "reports"} onClick={() => setTab("reports")}>报告</button>
      </AnimatedSwitcher>
      {tab === "reports" && <div className="detail-tab-panel">
            <Card className="research-reports">
              <CardHeader><CardTitle>报告</CardTitle></CardHeader>
              <CardContent>
                {reports.length ? <div className="research-report-list">
                  {reports.map(report => (
                    <Link key={report.id} to={assetPath + "/reports/" + report.id} className="research-report-link" data-page-link>
                      <div><strong>{`${quote.name}研究报告`}</strong><small>{(report.completed_at || report.created_at).slice(0, 10)} · 第 {report.version} 版</small></div>
                      <span className="muted">{{completed:"已完成", running:"研究中", queued:"排队中", failed:"未完成"}[report.status]}</span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  ))}
                </div> : <span className="muted">尚无报告</span>}
              </CardContent>
            </Card>
      </div>}
      {researchOpened && (
        <div className="detail-tab-panel" hidden={tab !== "research"}>
          <div className="research-content">
            <div className="research-top-grid">
            <ValuationPanel data={data} />
            <div className="research-sidebar">
            <Card className="research-opinion">
              {latest ? (
                <ResearchSummary id={latest.id} symbol={symbol} />
              ) : (
                <>
                  <CardHeader>
                    <CardTitle>研究观点</CardTitle>
                  </CardHeader>
                  <CardContent className="research-empty">
                    <span className="muted">
                      {active ? "正在研究" : "尚无研报"}
                    </span>
                    {active && (
                      <Button variant="outline" asChild>
                        <Link to={assetPath + "/reports/" + active.id}>查看进度</Link>
                      </Button>
                    )}
                  </CardContent>
                </>
              )}
            </Card>

            </div>
            </div>
            {coverage ? (
              <ModelTable symbol={symbol} />
            ) : (
              <div className="research-enroll">
                <span className="muted">加入标的跟踪后建立模型</span>
                <TrackingControls symbol={symbol} coverage={coverage} />
              </div>
            )}
          </div>
        </div>
      )}
      <div className="detail-tab-panel" hidden={tab !== "overview"}>
        <div className="coverage-detail-grid">
          <div className="detail-column">
            <PriceChart key={symbol} symbol={symbol} />
            <FinancialPanel data={data} />
            <TechnicalPanel data={data} />
            <EvidenceCard symbol={symbol} />
          </div>
          <div className="detail-column">
            <CatalystCalendar key={`calendar-${symbol}`} symbol={symbol} />
            <PeersPanel symbol={symbol} />
            <RetailSentiment key={`sentiment-${symbol}`} symbol={symbol} />
            <ResearchLeads symbol={symbol} />
            <CatalystPanel data={data} />
          </div>
        </div>
      </div>
    </div>
  );
}
