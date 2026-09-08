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
  Hint,
} from "../../components/ui";

export default function ReportsPage() {
  const { data = [], error, isLoading, refetch } = useReports();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} retry={() => void refetch()} />;
  const latest = data.filter(
    (r, i, a) =>
      a.findIndex((x) => x.symbol === r.symbol && x.status === r.status) === i,
  );
  const shown = latest.filter(
    (r) =>
      r.symbol.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "all"
        ? r.status !== "failed"
        : filter === "completed"
          ? r.status === "completed"
          : r.status === "failed"),
  );
  return (
    <div className="page">
      <PageHeader title="报告库">
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
            ["all", "全部研报"],
            ["completed", "已完成"],
            ["failed", "需要重试"],
          ].map(([k, n]) => (
            <button
              key={k}
              className={k === filter ? "selected" : ""}
              onClick={() => setFilter(k)}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="search-field">
          <Search size={15} />
          <Input
            aria-label="搜索研报"
            placeholder="搜索标的"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <Table className="reports-table">
        <TableHeader>
          <TableRow>
            <TableHead>研究报告</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>研究日期</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <Link to={"/reports/" + r.id} className="report-title">
                  <span className="file-icon">
                    <FileText size={20} />
                  </span>
                  <span>
                    <strong>{r.symbol} · 股票研究</strong>
                    <small>{r.focus || "业务 · 财务 · 估值 · 风险"}</small>
                  </span>
                </Link>
              </TableCell>
              <TableCell>
                <span className={"job-status " + r.status}>
                  <i />
                  {r.status === "completed"
                    ? "已完成"
                    : r.status === "failed"
                      ? "需要重试"
                      : "正在研究"}
                </span>
              </TableCell>
              <TableCell>{dateText(r.completed_at || r.created_at)}</TableCell>
              <TableCell>
                {r.status === "completed" ? (
                  <Button size="icon" variant="ghost" asChild>
                    <a
                      href={"/api/reports/" + r.id + "/download/pdf"}
                      download
                      aria-label={"下载 " + r.symbol + " 研报"}
                    >
                      <Download size={16} />
                    </a>
                  </Button>
                ) : (
                  <Button variant="ghost" size="icon" asChild>
                    <Link
                      to={"/reports/" + r.id}
                      aria-label={"查看 " + r.symbol + " 研究"}
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
        <Empty icon={<FileText size={25} />}>
          <strong>这里还没有研报</strong>
          <Button variant="outline" asChild>
            <Link to="/">选择研究标的</Link>
          </Button>
        </Empty>
      )}
    </div>
  );
}
