import { LoadingState } from "@gitnapp/ui/components/ui/loading";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { BackLink } from "@gitnapp/ui/components/ui/back-link";
import { macroLabels as labels } from "./metrics";
import { useState, useMemo, useEffect, useLayoutEffect, useRef } from "react";
import { Link, useParams } from "react-router";
import {
  DateRange,
  withinDates,
  seriesWindow,
  type DateWindow,
} from "../../components/date-range";
import { MacroChart } from "../../components/macro-chart";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
} from "@gitnapp/ui/components/ui/card";
import { InfoHint, InfoLabel } from "@gitnapp/ui/components/ui/tooltip";
import { api } from "../../api/client";
import { Button, Input, PageHeader, Loading } from "../../components/ui";
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
    <div className="page macro-page">
      <PageHeader title="宏观指标" />
      {q.isPending && <Loading />}
      <div className="context-grid">
        {Object.entries(labels).map(([key, label]) => {
          const d = q.data?.[key]?.data;
          const last = d?.points.at(-1);
          return (
            <Card key={key} className="navigation-card">
              <CardHeader>
                <CardTitle>
                  <Link to={`/macro/${key}`} className="navigation-card-link">{label}<ArrowRight size={16} aria-hidden="true" /></Link>
                </CardTitle>
                <CardAction>
                  <InfoHint>
                    {d
                      ? `${d.source}；${key === "cn_cpi" ? "主图为同比；点击查看环比及月度明细。" : "点击查看历史观测值。"}`
                      : "暂未取得数据。"}
                  </InfoHint>
                </CardAction>
              </CardHeader>
              <CardContent className="macro-card-body">
                {d ? (
                  <MacroChart points={d.points} unit={d.unit} range={seriesWindow(last?.date)} compact />
                ) : q.isPending || q.data?.[key]?.state === "pending" ? (
                  <LoadingState inline className="macro-card-placeholder" />
                ) : (
                  <div className="macro-card-placeholder muted">暂无数据</div>
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
  return (
    <div className="page">
      <BackLink asChild>
        <Link to="/macro" aria-label="返回宏观指标">
          返回
        </Link>
      </BackLink>
      <PageHeader title={labels[metric] || "指标不存在"} />
      {q.isPending || snapshot?.state === "pending" ? <Loading /> : null}
      {d && latest ? (
        <>
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
          <MacroChart points={points} comparisonPoints={d.points} unit={d.unit} range={range} />
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
function shiftMonth(month: string, offset: number) {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value - 1 + offset, 1)).toISOString().slice(0, 7);
}
function monthRange(month: string) {
  const [year, value] = month.split("-").map(Number);
  return { from: new Date(Date.UTC(year, value - 1, 0)).toISOString().slice(0, 10), to: new Date(Date.UTC(year, value, 1)).toISOString().slice(0, 10) };
}
export function CalendarPage() {
  const [month, setMonth] = useState(() => new Date().toLocaleDateString("sv-SE").slice(0, 7));
  const [jump, setJump] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  const start = useRef<HTMLDivElement>(null);
  const timeline = useRef<HTMLDivElement>(null);
  const positioned = useRef<string | null>(null);
  const anchor = useRef<{element: Element; top: number} | null>(null);
  const q = useInfiniteQuery({
    queryKey: ["calendar-months", month],
    initialPageParam: month,
    queryFn: async ({pageParam, signal}) => {
      const range = monthRange(pageParam);
      const snapshot = await api<Snapshot<Calendar>>(`/data/global/calendar?start=${range.from}&end=${range.to}`, {signal});
      return {month: pageParam, snapshot};
    },
    getPreviousPageParam: first => first.month > "1900-01" ? shiftMonth(first.month, -1) : undefined,
    getNextPageParam: last => last.month < "9999-12" ? shiftMonth(last.month, 1) : undefined,
    refetchInterval: query => query.state.data?.pages.some(p => p.snapshot.state === "pending" || p.snapshot.refreshing) ? 1500 : false,
    retry: false,
  });
  const futureAt = q.data?.pages.flatMap(p => p.snapshot.data?.events || [])
    .filter(e => new Date(e.at).getTime() >= Date.now()).sort((a,b) => a.at.localeCompare(b.at))[0]?.at;
  useLayoutEffect(() => {
    const root = timeline.current;
    if (!root) return;
    const scroller = root.closest<HTMLElement>(".calendar-viewport");
    if (anchor.current && !q.isFetchingPreviousPage) {
      const {element, top} = anchor.current;
      const delta = element.getBoundingClientRect().top - top;
      if (scroller) scroller.scrollTop += delta;
      else window.scrollBy(0, delta);
      anchor.current = null;
    }
    const initial = q.data?.pages.find(p => p.month === month)?.snapshot;
    if (positioned.current === month || !initial?.data?.events.length || initial.state === "pending") return;
    const frame = requestAnimationFrame(() => {
      const rows = Array.from(root.querySelectorAll('.macro-event'));
      const boundary = rows.findIndex(row => row.classList.contains('future-start'));
      const target = rows[Math.max(0, boundary - 2)] || root;
      const top = target.getBoundingClientRect().top;
      if (scroller) scroller.scrollTop += top - scroller.getBoundingClientRect().top - scroller.clientTop;
      else window.scrollBy(0, top);
      positioned.current = month;
    });
    return () => cancelAnimationFrame(frame);
  }, [q.data, q.isFetchingPreviousPage, month, jump]);
  useEffect(() => {
    if (!start.current || positioned.current !== month || q.isFetching || !q.hasPreviousPage || !q.data?.pages[0]?.snapshot.data?.events.length) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return;
      const element = timeline.current?.querySelector('.calendar-month-section');
      if (element) anchor.current = {element, top: element.getBoundingClientRect().top};
      void q.fetchPreviousPage();
    }, {root: start.current.closest(".calendar-viewport")});
    observer.observe(start.current);
    return () => observer.disconnect();
  }, [month, q.data, q.isFetching, q.hasPreviousPage, q.fetchPreviousPage]);
  const tail = q.data?.pages.at(-1);
  const canAutoLoad = Boolean(tail?.snapshot.data?.events.length) && !q.isFetching;
  useEffect(() => {
    if (!end.current || !canAutoLoad) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && q.hasNextPage) void q.fetchNextPage();
    }, {root: end.current.closest(".calendar-viewport"), rootMargin: "160px"});
    observer.observe(end.current);
    return () => observer.disconnect();
  }, [canAutoLoad, q.hasNextPage, q.fetchNextPage, tail?.month]);
  return <div className="page calendar-page">
    <PageHeader title="财经日历" />
    <div className="calendar-month-picker">
      <Button variant="ghost" size="icon" aria-label="上一月" onClick={() => setMonth(shiftMonth(month,-1))}><ChevronLeft size={16} /></Button>
      <Input type="month" aria-label="选择月份" value={month} onChange={e => {if (/^\d{4}-\d{2}$/.test(e.target.value)) setMonth(e.target.value);}} />
      <Button variant="ghost" size="icon" aria-label="下一月" onClick={() => setMonth(shiftMonth(month,1))}><ChevronRight size={16} /></Button>
      <Button variant="ghost" onClick={() => { positioned.current = null; setMonth(new Date().toLocaleDateString("sv-SE").slice(0, 7)); setJump(value => value + 1); }}>回到现在</Button>
      <InfoHint>浅底色表示过去的事件，分界线后为即将到来的事件。选择月份快速跳转，上下滚动连续查看相邻月份。未公布事件或数据暂不可用时保留真实空状态，不补造事件。</InfoHint>
    </div>
    <div className="calendar-viewport" tabIndex={0} role="region" aria-label="财经事件时间线">
    {(q.isPending || tail?.snapshot.state === "pending") && <Loading />}
    <div ref={start} className="calendar-scroll-sentinel" />
    <div ref={timeline} className="calendar-months">
      {q.data?.pages.map(({month: period, snapshot}) => {
        const events = (snapshot.data?.events || []).filter(e => new Date(e.at).toLocaleDateString("sv-SE").startsWith(period)).sort((a,b) => a.at.localeCompare(b.at));
        return <section key={period} className="calendar-month-section">
          <h2>{period.replace("-", " 年 ")} 月</h2>
          {events.map((e,i) => <div className={`macro-event${new Date(e.at).getTime() < Date.now() ? " is-past" : e.at === futureAt ? " future-start" : ""}`} key={e.at+e.title+i}>
            <time>{new Date(e.at).toLocaleString("zh-CN", {month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}</time>
            <div><strong>{e.title}</strong><small>
              {e.currency}　{e.impact}　前值 {String(e.previous ?? "—")}　预期 {String(e.forecast ?? "—")}　实际 {e.actual_status === "unverified" ? <InfoLabel label="待核实">零值未经有效公布状态确认，暂不作为实际值。</InfoLabel> : e.actual_status === "scheduled" ? "待公布" : String(e.actual ?? "—")}
            </small></div>
          </div>)}
          {!events.length && snapshot.state !== "pending" && <p className="muted">暂无数据</p>}
        </section>;
      })}
    </div>
    <div ref={end} className="calendar-more">
      {q.isFetchingNextPage && <Loading />}
      {q.isError ? <Button variant="ghost" onClick={() => void q.refetch()}>重新获取</Button> : null}
    </div>
    </div>
  </div>;
}
