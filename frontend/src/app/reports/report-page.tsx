import { InfoLabel } from "@gitnapp/ui/components/ui/tooltip";
import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router";
import {
  ArrowLeft,
  Download,
  RotateCcw,
  FileText,
  ExternalLink,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@gitnapp/ui/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useReport, useRefresh } from "../../hooks/queries";
import { write } from "../../api/client";
import type { Report } from "../../types";
import {
  Button,
  dateText,
  ErrorState,
  Loading,
  PageHeader,
} from "../../components/ui";
const FIGURE_INDEX: Record<number, number> = {
  0: 0,
  2: 5,
  3: 1,
  4: 2,
  5: 3,
  6: 4,
};
function ReportFigure({
  chart,
}: {
  chart: { url: string; title: string; caption: string };
}) {
  return (
    <figure className="research-figure">
      <img src={chart.url} alt={chart.title} />
      <figcaption>{chart.caption}</figcaption>
    </figure>
  );
}
export default function ReportPage() {
  const { id = "" } = useParams();
  const { data, error, isLoading, refetch } = useReport(id);
  const navigate = useNavigate();
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} retry={() => void refetch()} />;
  if (!data) return null;
  const p = data.payload;
  async function retry() {
    setBusy(true);
    try {
      const r = await write<Report>("/research", {
        symbol: data!.symbol,
        focus: data!.focus,
      });
      void refresh();
      navigate("/reports/" + r.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page report-page">
      <Link to="/reports" className="back-link">
        <ArrowLeft size={14} />
        报告库
      </Link>
      <PageHeader title={data.symbol + " · 股票研究"}>
        {p && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Download size={15} />
                下载研报
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {[
                ["pdf", "PDF 文档"],
                ["html", "HTML 网页"],
                ["md", "Markdown 文稿"],
                ["csv", "财务预测表"],
                ["json", "完整研究数据"],
              ].map(([ext, n]) => (
                <DropdownMenuItem key={ext} asChild>
                  <a href={"/api/reports/" + id + "/download/" + ext} download>
                    {n}
                  </a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button variant="outline" asChild>
          <Link to={"/stocks/" + data.symbol}>标的详情</Link>
        </Button>
      </PageHeader>
      {!p ? (
        <div className="research-job">
          <div className="job-symbol">
            {data.status === "failed" ? <RotateCcw size={28} /> : <Loading />}
          </div>
          {data.status === "failed" && (
            <>
              <h2>研究暂未完成</h2>
              <p>请重新尝试生成研报。</p>
            </>
          )}
          {data.status === "failed" && (
            <Button onClick={() => void retry()} disabled={busy}>
              重新研究
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="report-metadata">
            <span>研究日期 {dateText(data.completed_at)}</span>
            {p.has_mock_data && (
              <InfoLabel label="假设测算">
                财务预测使用示例输入；价格、新闻和财务数据的口径分别列在附录。
              </InfoLabel>
            )}
          </div>
          <div className="report-layout">
            <nav className="report-toc" aria-label="研报目录">
              {p.sections.map((s, i) => (
                <a href={"#section-" + i} key={s.title}>
                  {s.title}
                </a>
              ))}
              <a href="#report-sources">来源索引</a>
            </nav>
            <article className="report-body">
              {p.sections.map((s, i) => (
                <section id={"section-" + i} key={s.title}>
                  <h2>{s.title}</h2>
                  <div className="report-prose">
                    {s.content
                      .split("\n")
                      .filter(Boolean)
                      .map((t, j) => (
                        <p key={j}>{t}</p>
                      ))}
                  </div>
                  {p.charts?.[FIGURE_INDEX[i]] && (
                    <ReportFigure chart={p.charts[FIGURE_INDEX[i]]} />
                  )}
                </section>
              ))}
              <section id="report-sources">
                <h2>来源索引</h2>
                {p.sources.map((s, i) => (
                  <div className="source-row" key={i}>
                    <span>[{i + 1}]</span>
                    <div>
                      {s.mock ? (
                        <strong>{s.label} · 示例输入</strong>
                      ) : (
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {s.label}
                          <ExternalLink size={12} />
                        </a>
                      )}
                      <small>{s.as_of?.slice(0, 10)}</small>
                    </div>
                  </div>
                ))}
              </section>
              <footer className="report-end">Garage Research</footer>
            </article>
          </div>
        </>
      )}
    </div>
  );
}
