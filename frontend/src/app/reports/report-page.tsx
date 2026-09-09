import { TaskProgress } from "@gitnapp/ui/components/ui/task-progress";
import { useTask, type Task } from "../../hooks/tasks";
import { useTaskReceipt } from "../../components/task-center";
import { BackLink } from "@gitnapp/ui/components/ui/back-link";
import { ReadingLayout } from "@gitnapp/ui/components/ui/data-layout";
import { ReportContents } from "../../components/report-contents";
import { useActiveSection } from "../../hooks/use-active-section";
import { InfoLabel } from "@gitnapp/ui/components/ui/tooltip";
import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { Download, FileText, ExternalLink } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@gitnapp/ui/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useReport } from "../../hooks/queries";
import { write } from "../../api/client";
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
  const task = useTask(id);
  const receive = useTaskReceipt();
  const { data, error, isLoading, refetch } = useReport(
    id,
    undefined,
    task.data?.status === "completed",
  );
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const activeSection = useActiveSection(Boolean(data?.payload), id);
  async function retry() {
    setBusy(true);
    try {
      const next = await write<Task>(`/tasks/${id}/retry`, {});
      receive(next);
      navigate(`/reports/${next.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (task.isPending) return <Loading />;
  if (task.error)
    return <ErrorState error={task.error} retry={() => void task.refetch()} />;
  if (task.data && task.data.status !== "completed")
    return (
      <div className="page report-page">
        <BackLink asChild>
          <Link to="/reports">返回</Link>
        </BackLink>
        <PageHeader title={task.data.subject.name} />
        <div className="report-task">
          <TaskProgress
            title="生成研报"
            status={task.data.status}
            steps={task.data.steps}
            completedSteps={task.data.completed_steps}
            queuePosition={task.data.queue_position}
            error={task.data.error}
            actions={
              <>
                {task.data.status === "failed" && (
                  <Button disabled={busy} onClick={() => void retry()}>
                    重试
                  </Button>
                )}
                <Button variant="outline" asChild>
                  <Link to={`/stocks/${task.data.subject.symbol}`}>
                    继续浏览
                  </Link>
                </Button>
              </>
            }
          />
        </div>
      </div>
    );
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} retry={() => void refetch()} />;
  if (!data) return null;
  const p = data.payload;
  return (
    <div className="page report-page">
      <BackLink asChild>
        <Link to="/reports" aria-label="返回报告">
          返回
        </Link>
      </BackLink>
      <PageHeader title={p?.quote.name || "股票研究"}>
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
          <p>报告内容暂不可用</p>
          <Button variant="outline" onClick={() => void refetch()}>
            重新获取
          </Button>
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
          <ReadingLayout
            navigation={
              <ReportContents sections={p.sections} active={activeSection} />
            }
          >
            <article className="report-body">
              {p.sections.map((s, i) => (
                <section id={"section-" + i} key={s.title} tabIndex={-1}>
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
              <section id="report-sources" tabIndex={-1}>
                <h2>来源索引</h2>
                {p.sources.map((s, i) => (
                  <div className="source-row" key={i}>
                    <span>[{i + 1}]</span>
                    <div>
                      {s.mock ? (
                        <strong>{s.label}（示例输入）</strong>
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
          </ReadingLayout>
        </>
      )}
    </div>
  );
}
