import { BackLink } from "@gitnapp/ui/components/ui/back-link";
import { macroLabels as labels } from "./metrics";
import { useState, useMemo } from "react";
import { Link, useParams } from "react-router";
import {
  DateRange,
  withinDates,
  seriesWindow,
  type DateWindow,
} from "../../components/date-range";
import { MacroChart } from "../../components/macro-chart";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
} from "@gitnapp/ui/components/ui/card";
import { InfoHint, InfoLabel } from "@gitnapp/ui/components/ui/tooltip";
import { api } from "../../api/client";
import { Button, PageHeader, Loading } from "../../components/ui";
import type { Snapshot, MacroSeries } from "../../components/intelligence";
function useMacro() {
  return useQuery({
    queryKey: ["macro-context"],
    queryFn: () =>
      api<Record<string, Snapshot<MacroSeries>>>("/data/global/macro"),
    refetchInterval: (q) =>
      Object.values(q.state.data || {}).some((v) => v.state === "pending")
        ? 1500
        : 60000,
    retry: false,
  });
}
export function MacroPage() {
  const q = useMacro();
  return (
    <div className="page">
      <PageHeader title="宏观环境" />
      {q.isPending && <Loading />}
      <div className="context-grid">
        {Object.entries(labels).map(([key, label]) => {
          const d = q.data?.[key]?.data;
          const last = d?.points.at(-1);
          return (
            <Card key={key}>
              <CardHeader>
                <CardTitle>
                  <Link to={`/macro/${key}`}>{label} →</Link>
                </CardTitle>
                <CardAction>
                  <InfoHint>
                    {d
                      ? `${d.source}；${key === "cn_cpi" ? "主图为同比；点击查看环比及月度明细。" : "点击查看历史观测值。"}`
                      : "暂未取得数据。"}
                  </InfoHint>
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="context-value">
                  {last?.value.toFixed(2) ?? "—"}
                  <small>{d?.unit}</small>
                </div>
                {d ? (
                  <MacroChart points={d.points} unit={d.unit} range={seriesWindow(last?.date)} compact />
                ) : q.data?.[key]?.state === "pending" ? (
                  <Loading />
                ) : (
                  <span className="muted">暂无数据</span>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
export function MacroDetailPage() {
  const { metric = "" } = useParams();
  const q = useMacro();
  const [selection, setSelection] = useState<{ metric: string; range: DateWindow } | null>(null);
  const [measure, setMeasure] = useState<"value" | "mom">("value");
  const snapshot = q.data?.[metric];
  const d = snapshot?.data;
  const latest = d?.points.at(-1);
  const range = selection?.metric === metric ? selection.range : seriesWindow(latest?.date);
  const points = useMemo(
    () =>
      (d?.points || [])
        .filter((p) => measure === "value" || p.mom != null)
        .map((p) => ({ ...p, value: measure === "mom" ? p.mom! : p.value })),
    [d, measure],
  );
  const prior = (months: number) => {
    if (!latest || !d) return undefined;
    const date = new Date(latest.date + "T00:00:00Z");
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - months);
    return d.points
      .filter((p) => p.date.startsWith(date.toISOString().slice(0, 7)))
      .at(-1);
  };
  const difference = (months: number) => {
    const p = prior(months);
    return latest && p ? (latest.value - p.value).toFixed(2) : "—";
  };
  return (
    <div className="page">
      <BackLink asChild>
        <Link to="/macro" aria-label="返回宏观环境">
          返回
        </Link>
      </BackLink>
      <PageHeader title={labels[metric] || "指标不存在"} />
      {q.isPending || snapshot?.state === "pending" ? <Loading /> : null}
      {d && latest ? (
        <>
          <div className="macro-detail-values">
            <div>
              <small>{metric === "cn_cpi" ? "同比" : "最新值"}</small>
              <strong>
                {latest.value.toFixed(2)} {d.unit}
              </strong>
            </div>
            <div>
              <small>{metric === "cn_cpi" ? "环比" : "较上月"}</small>
              <strong>
                {metric === "cn_cpi"
                  ? `${latest.mom?.toFixed(2) ?? "—"} %`
                  : `${difference(1)} ${d.unit === "%" ? "个百分点" : "点"}`}
              </strong>
            </div>
            {metric !== "cn_cpi" && (
              <div>
                <small>较上年</small>
                <strong>
                  {difference(12)} {d.unit === "%" ? "个百分点" : "点"}
                </strong>
              </div>
            )}
          </div>
          <DateRange
            value={range}
            onChange={(range) => setSelection({ metric, range })}
            kind="series"
            anchor={latest.date}
          />
          {metric === "cn_cpi" && (
            <div className="signal-period">
              <button
                aria-pressed={measure === "value"}
                onClick={() => setMeasure("value")}
              >
                同比
              </button>
              <button
                aria-pressed={measure === "mom"}
                onClick={() => setMeasure("mom")}
              >
                环比
              </button>
            </div>
          )}
          <MacroChart points={points} unit={d.unit} range={range} />
          <details className="macro-observations">
            <summary>历史数据</summary>
            <div className="macro-history-table">
              <table>
                <thead>
                  <tr>
                    <th>观测期</th>
                    <th>{metric === "cn_cpi" ? "同比 %" : d.unit}</th>
                    {metric === "cn_cpi" && <th>环比 %</th>}
                  </tr>
                </thead>
                <tbody>
                  {d.points
                    .filter((p) => withinDates(p.date, range))
                    .slice()
                    .reverse()
                    .map((p) => (
                      <tr key={p.date}>
                        <td>{p.date}</td>
                        <td>{p.value.toFixed(2)}</td>
                        {metric === "cn_cpi" && (
                          <td>{p.mom?.toFixed(2) ?? "—"}</td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </details>
          <p className="muted text-xs">
            观测期 {latest.date}{" "}
            <a href={d.source_url} target="_blank" rel="noreferrer">
              {d.source}
            </a>
          </p>
        </>
      ) : (
        !q.isPending &&
        snapshot?.state !== "pending" && <p>暂未取得该指标数据</p>
      )}
    </div>
  );
}
type Calendar = {
  events: {
    title: string;
    at: string;
    currency: string;
    impact: string;
    actual: unknown;
    actual_status?: "reported" | "scheduled" | "unverified" | "unavailable";
    forecast: unknown;
    previous: unknown;
  }[];
  source: string;
};
export function CalendarPage() {
  const [range, setRange] = useState<DateWindow>({ from: "", to: "" });
  const q = useQuery({
    queryKey: ["macro-calendar", range.from, range.to],
    queryFn: () =>
      api<Snapshot<Calendar>>(
        `/data/global/calendar?start=${range.from}&end=${range.to}`,
      ),
    refetchInterval: (q) => (q.state.data?.state === "pending" ? 1500 : 60000),
    retry: false,
  });
  return (
    <div className="page">
      <PageHeader title="事件日历" />
      {(q.isPending || q.data?.state === "pending") && <Loading />}
      <Card>
        <CardHeader>
          <CardTitle>经济数据与政策事件</CardTitle>
          <CardAction>
            <InfoHint>
              日期范围可查询历史与未来日程，单次不超过一年；数据源缺失或未公布时不补造数值，时间统一转换为本地时间。
              {q.data?.state === "stale" ? "当前为最近一次有效快照。" : ""}
            </InfoHint>
          </CardAction>
        </CardHeader>
        <CardContent>
          <DateRange value={range} onChange={setRange} />
          {q.data?.data?.events.filter((e) =>
            withinDates(new Date(e.at).toLocaleDateString("sv-SE"), range),
          ).length ? (
            q.data.data.events
              .filter((e) =>
                withinDates(new Date(e.at).toLocaleDateString("sv-SE"), range),
              )
              .map((e, i) => (
                <div className="macro-event" key={e.at + e.title + i}>
                  <time>
                    {new Date(e.at).toLocaleString("zh-CN", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                  <div>
                    <strong>{e.title}</strong>
                    <small>
                      {e.currency}　{e.impact}　前值{" "}
                      {String(e.previous ?? "—")}
                      　预期 {String(e.forecast ?? "—")}　实际{" "}
                      {e.actual_status === "unverified" ? (
                        <InfoLabel label="待核实">
                          数据源返回零值，但未提供有效的公布状态，暂不作为实际值展示。
                        </InfoLabel>
                      ) : e.actual_status === "scheduled" ? (
                        "待公布"
                      ) : (
                        String(e.actual ?? "—")
                      )}
                    </small>
                  </div>
                </div>
              ))
          ) : (
            <p className="muted">此日期范围内暂无已取得的事件</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
