import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Check,
  Download,
  ExternalLink,
  FileText,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@gitnapp/ui/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useRefresh, useReport } from "../../hooks/queries";
import { write } from "../../api/client";
import type { Report } from "../../types";
import {
  Button,
  dateText,
  ErrorState,
  Loading,
  PageHeader,
  Source,
} from "../../components/ui";
import { ModelTable } from "../../components/model-table";

export default function ReportPage() {
  const { id = "" } = useParams();
  const { data, error, isLoading, refetch } = useReport(id);
  const navigate = useNavigate();
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} retry={() => void refetch()} />;
  if (!data) return null;
  async function retry() {
    setBusy(true);
    try {
      const result = await write<Report>("/research", {
        symbol: data!.symbol,
        focus: data!.focus,
      });
      await refresh();
      navigate(`/reports/${result.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const payload = data.payload;
  return (
    <div className="page report-page">
      <Link className="back-link" to="/reports">
        <ArrowLeft size={14} />
        报告库
      </Link>
      <PageHeader
        eyebrow={`FINROBOT / RESEARCH v${data.version}`}
        title={`${data.symbol} · 研究报告`}
      >
        {payload && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Download size={15} />
                下载报告
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {[
                ["pdf", "PDF 文档"],
                ["html", "HTML 网页"],
                ["md", "Markdown"],
                ["csv", "预测模型 CSV"],
                ["json", "完整数据 JSON"],
              ].map(([ext, name]) => (
                <DropdownMenuItem key={ext} asChild>
                  <a href={`/api/reports/${id}/download/${ext}`} download>
                    {name}
                  </a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button variant="outline" asChild>
          <Link to={`/stocks/${data.symbol}`}>标的详情</Link>
        </Button>
      </PageHeader>
      {!payload ? (
        <div className="research-job">
          <div className="job-symbol">
            {data.status === "failed" ? (
              <RotateCcw size={27} />
            ) : (
              <LoaderCircle size={28} className="spin" />
            )}
          </div>
          <h2>
            {data.status === "failed"
              ? "研究未完成"
              : `${data.symbol} · ${data.stage}`}
          </h2>
          <p>{data.error || "任务已保存在本地，完成后将自动显示报告。"}</p>
          <div className="job-stages">
            {[
              "排队中",
              "收集行情与财务",
              "计算预测模型",
              "撰写研究报告",
              "生成报告文件",
            ].map((stage, index) => (
              <div
                key={stage}
                className={data.stage === stage ? "current-stage" : ""}
              >
                <span>{index + 1}</span>
                {stage}
              </div>
            ))}
          </div>
          {data.status === "failed" && (
            <Button onClick={() => void retry()} disabled={busy}>
              <RotateCcw size={15} />
              重新研究
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="report-metadata">
            <span>
              <Check size={14} />
              已归档
            </span>
            <span>{dateText(data.completed_at)}</span>
            <span>{payload.engine}</span>
            <Source
              source={payload.demo_narrative ? "演示研究" : "AI Research"}
              mock={payload.has_mock_data}
              note={
                payload.has_mock_data
                  ? "本报告含模拟数据，结论仅用于验证流程。"
                  : "AI 叙述依据所附来源，仍需人工核实。"
              }
            />
          </div>
          {payload.has_mock_data && (
            <div className="data-notice">
              <span className="status-dot" />
              含模拟输入 · 研究结论待核实
            </div>
          )}
          <div className="report-layout">
            <nav className="report-toc" aria-label="报告目录">
              <div className="eyebrow">CONTENTS</div>
              {payload.sections.map((s, i) => (
                <a href={`#section-${i}`} key={s.title}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </a>
              ))}
              <a href="#forecast-table">
                <span>09</span>预测模型
              </a>
              <a href="#report-sources">
                <span>10</span>来源索引
              </a>
            </nav>
            <article className="report-body">
              {payload.sections.map((section, i) => (
                <section id={`section-${i}`} key={section.title}>
                  <div className="report-section-number">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h2>{section.title}</h2>
                  <div className="report-prose">
                    {section.content.split("\n").map((p, index) => (
                      <p key={index}>{p}</p>
                    ))}
                  </div>
                </section>
              ))}
              <section id="forecast-table">
                <ModelTable symbol={data.symbol} snapshot={payload.model} />
              </section>
              <section id="report-sources">
                <h2>来源索引</h2>
                {payload.sources.map((s, i) => (
                  <div key={i} className="source-row">
                    <span>[{i + 1}]</span>
                    <div>
                      {s.mock ? (
                        <strong>{s.label}</strong>
                      ) : (
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {s.label}
                          <ExternalLink size={12} />
                        </a>
                      )}
                      <small>
                        {s.mock ? "模拟数据，无事实引用" : "来源数据时间"} ·{" "}
                        {s.as_of || "未提供"}
                      </small>
                    </div>
                  </div>
                ))}
              </section>
              <footer className="report-end">
                <FileText size={16} />
                Garage Research · 数据与假设随此版本冻结
              </footer>
            </article>
          </div>
        </>
      )}
    </div>
  );
}
