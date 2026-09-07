import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Download, FileText, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@gitnapp/ui/components/ui/table";
import { useReports } from "../../hooks/queries";
import {
  Button,
  dateText,
  Empty,
  ErrorState,
  Input,
  Loading,
  PageHeader,
} from "../../components/ui";

export default function ReportsPage() {
  const { data = [], error, isLoading, refetch } = useReports();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} retry={() => void refetch()} />;
  const shown = data.filter(
    (r) =>
      r.symbol.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "all" ||
        (filter === "scheduled"
          ? r.trigger === "scheduled"
          : r.status === filter)),
  );
  return (
    <div className="page">
      <PageHeader eyebrow="LIBRARY / RESEARCH" title="报告库">
        <span className="library-count">
          {data.filter((r) => r.status === "completed").length} 份已归档
        </span>
        <Button variant="outline" asChild>
          <Link to="/">
            新建研究
            <ArrowRight size={15} />
          </Link>
        </Button>
      </PageHeader>
      <div className="library-toolbar">
        <div className="segmented">
          {[
            ["all", "全部"],
            ["completed", "已完成"],
            ["scheduled", "自动研究"],
            ["failed", "失败任务"],
          ].map(([key, name]) => (
            <button
              className={key === filter ? "selected" : ""}
              key={key}
              onClick={() => setFilter(key)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="search-field">
          <Search size={15} />
          <Input
            placeholder="搜索标的"
            aria-label="搜索报告"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <Table className="reports-table">
        <TableHeader>
          <TableRow>
            <TableHead>研究报告</TableHead>
            <TableHead>版本</TableHead>
            <TableHead>来源</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>创建时间</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <Link to={`/reports/${r.id}`} className="report-title">
                  <span className="file-icon">
                    <FileText size={19} />
                  </span>
                  <span>
                    <strong>{r.symbol} · 股票研究</strong>
                    <small>{r.focus || "基本面 · 估值 · 风险"}</small>
                  </span>
                </Link>
              </TableCell>
              <TableCell>
                <span className="version-label">v{r.version}</span>
              </TableCell>
              <TableCell>
                {r.trigger === "scheduled" ? "Coverage" : "手动研究"}
              </TableCell>
              <TableCell>
                <span className={`job-status ${r.status}`}>
                  <i />
                  {r.stage}
                </span>
              </TableCell>
              <TableCell className="muted numeric">
                {dateText(r.created_at)}
              </TableCell>
              <TableCell>
                {r.status === "completed" ? (
                  <Button size="icon" variant="ghost" asChild>
                    <a
                      href={`/api/reports/${r.id}/download/pdf`}
                      download
                      aria-label={`下载 ${r.symbol} v${r.version} PDF`}
                    >
                      <Download size={16} />
                    </a>
                  </Button>
                ) : (
                  <Button variant="ghost" size="icon" asChild>
                    <Link
                      to={`/reports/${r.id}`}
                      aria-label={`查看 ${r.symbol} 任务`}
                    >
                      <ArrowRight size={16} />
                    </Link>
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!shown.length && (
        <Empty icon={<FileText size={27} />}>
          <strong>
            {data.length ? "没有匹配的报告" : "你的研究将归档在这里"}
          </strong>
          <span>报告保留数据快照、预测假设和可下载文件。</span>
        </Empty>
      )}
    </div>
  );
}
