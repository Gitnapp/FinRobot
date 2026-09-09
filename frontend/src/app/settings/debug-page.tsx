import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../api/client";
import { AnimatedSwitcher } from "../../components/animated-switcher";
import { FilterToolbar } from "../../components/layout/filter-toolbar";
import {
Button,
ErrorState,
Loading,
PageHeader
} from "../../components/ui";

type Plan = {
  id: string;
  symbol: string;
  dataset: string;
  next_run: string | number;
  last_success: number | null;
  status: string;
  error: string | null;
};
type Log = {
  id: number;
  dataset: string;
  status: string;
  started: number;
  finished: number | null;
  error: string | null;
};
const statusText: Record<string, string> = {
  scheduled: "已计划",
  due: "待执行",
  running: "进行中",
  queued: "等待执行",
  retry: "等待重试",
  completed: "成功",
  failed: "失败",
  interrupted: "已中断",
};
const stamp = (value: string | number | null) =>
  value
    ? new Date(typeof value === "number" ? value * 1000 : value).toLocaleString(
        "zh-CN",
        { hour12: false },
      )
    : "—";
export default function DebugPage() {
  const [tab, setTab] = useState("plans");
  const [search, setSearch] = useState("");
  const [before, setBefore] = useState<number | undefined>();
  const plans = useQuery({
    queryKey: ["debug-plans"],
    enabled: tab === "plans",
    queryFn: ({ signal }) =>
      api<{ items: Plan[] }>("/debug/updates", { signal }),
  });
  const logs = useQuery({
    queryKey: ["debug-logs", before],
    queryFn: ({ signal }) =>
      api<{ items: Log[]; next_cursor: number | null }>(
        `/debug/logs${before ? `?before=${before}` : ""}`,
        { signal },
      ),
    enabled: tab === "logs",
  });
  const current = tab === "plans" ? plans : logs;
  return (
    <div className="page">
      <PageHeader title="调试" />
      <FilterToolbar leading={        <AnimatedSwitcher className="segmented">
          {[
            ["plans", "更新计划"],
            ["logs", "执行日志"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? "selected" : ""}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </AnimatedSwitcher>} search={{value:search,onChange:setSearch,label:"筛选任务或标的",placeholder:"筛选任务或标的"}} />
      {current.isPending && <Loading />}
      {current.error && (
        <ErrorState
          error={current.error}
          retry={() => void current.refetch()}
        />
      )}
      <div className="debug-table-wrap">
        <table className="debug-table">
          <thead>
            <tr>
              {(tab === "plans"
                ? ["标的", "更新内容", "状态", "下次检查", "最近成功", "错误"]
                : ["数据集", "状态", "开始时间", "结束时间", "耗时", "错误"]
              ).map((t) => (
                <th key={t}>{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tab === "plans"
              ? plans.data?.items
                  .filter((r) =>
                    (r.symbol + r.dataset)
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((r) => (
                    <tr key={r.id}>
                      <td>{r.symbol}</td>
                      <td>{r.dataset}</td>
                      <td>{statusText[r.status] || r.status}</td>
                      <td>{stamp(r.next_run)}</td>
                      <td>{stamp(r.last_success)}</td>
                      <td>{r.error || "—"}</td>
                    </tr>
                  ))
              : logs.data?.items
                  .filter((r) =>
                    r.dataset.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((r) => (
                    <tr key={r.id}>
                      <td>{r.dataset}</td>
                      <td>{statusText[r.status] || r.status}</td>
                      <td>{stamp(r.started)}</td>
                      <td>{stamp(r.finished)}</td>
                      <td>
                        {r.finished
                          ? `${(r.finished - r.started).toFixed(1)}s`
                          : "—"}
                      </td>
                      <td>{r.error || "—"}</td>
                    </tr>
                  ))}
          </tbody>
        </table>
      </div>
      {tab === "logs" && logs.data?.items.length === 0 && (
        <p className="muted">尚无执行日志</p>
      )}
      {tab === "logs" && (
        <div className="debug-pagination">
          <Button
            variant="ghost"
            disabled={!before}
            onClick={() => setBefore(undefined)}
          >
            最新日志
          </Button>
          <Button
            variant="ghost"
            disabled={!logs.data?.next_cursor}
            onClick={() => setBefore(logs.data?.next_cursor || undefined)}
          >
            更早日志
          </Button>
        </div>
      )}
    </div>
  );
}
