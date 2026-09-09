import { DateRange, withinDates, type DateWindow } from "./date-range";
import type { Snapshot } from "./intelligence";
import { LoadingState } from "@gitnapp/ui/components/ui/loading";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
} from "@gitnapp/ui/components/ui/card";
import { InfoHint, InfoLabel } from "@gitnapp/ui/components/ui/tooltip";
import { Button } from "./ui";
import { api } from "../api/client";

type Result<T> = {
  status: "ready" | "empty" | "stale" | "unavailable";
  as_of: string;
  data: T | null;
  reason: string | null;
};
type Events = {
  events: {
    date: string;
    title: string;
    timing: string;
    upcoming: boolean;
    eps_estimate: number | null;
    eps_actual: number | null;
    revenue_estimate: number | null;
  }[];
  source: string;
};
type Sentiment = {
  from: string;
  to: string;
  source: string;
  score: number | null;
  buzz: number | null;
  mentions: number | null;
  bullish: number | null;
  bearish: number | null;
  trend: "rising" | "falling" | "stable" | null;
  daily: { date: string; mentions: number | null; score: number | null }[];
};
export function useSignal<T>(symbol: string, kind: string, enabled = true) {
  return useQuery({
    queryKey: ["signals", symbol, kind],
    enabled,
    queryFn: ({ signal }) =>
      api<Result<T>>(`/data/${symbol}/${kind}`, { signal }),
    staleTime: 15 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
function State({ loading, retry }: { loading: boolean; retry: () => void }) {
  return (
    <div className="signal-empty" role="status">
      {loading ? (
        <LoadingState className="w-full min-h-14" />
      ) : (
        <>
          暂时无法获取
          <Button variant="ghost" size="sm" onClick={retry}>
            重试
          </Button>
        </>
      )}
    </div>
  );
}
function Freshness({ value }: { value: Result<unknown> | undefined }) {
  return value?.status === "stale" ? (
    <InfoLabel label="待更新">
      显示最近一次成功获取的数据，时间：
      {new Date(value.as_of).toLocaleString("zh-CN")}
    </InfoLabel>
  ) : null;
}
const fmt = (v: number | null, suffix = "") =>
  v === null
    ? "—"
    : `${v.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}${suffix}`;
type Disclosures = {
  filings: { form: string; date: string; url: string }[];
  complete: boolean;
  source: string;
};
export function CatalystCalendar({ symbol }: { symbol: string }) {
  const query = useSignal<Events>(symbol, "catalysts");
  const [period, setPeriod] = useState("upcoming");
  const [page, setPage] = useState(0);
  const [range, setRange] = useState<DateWindow>({ from: "", to: "" });
  const history = useQuery({
    queryKey: ["disclosures", symbol],
    enabled: period === "recent",
    queryFn: () => api<Snapshot<Disclosures>>(`/data/${symbol}/disclosures`),
    refetchInterval: (q) => (q.state.data?.state === "pending" ? 1500 : false),
    retry: false,
  });
  const upcoming = query.data?.data?.events.filter((e) => e.upcoming);
  const past = query.data?.data?.events.filter((e) => !e.upcoming) || [];
  const disclosureEvents = (history.data?.data?.filings || []).map((f) => ({
    date: f.date,
    title:
      ({
        "10-K": "年度报告",
        "10-Q": "季度报告",
        "8-K": "临时公告",
        "20-F": "年度报告",
        "6-K": "发行人公告",
      }[f.form.split("/")[0]] || "披露文件"),
    timing: "披露日期",
    url: f.url,
    eps_estimate: null,
    revenue_estimate: null,
    eps_actual: null,
    upcoming: false,
  }));
  const events:
    | (NonNullable<typeof upcoming>[number] & { url?: string })[]
    | undefined =
    period === "upcoming"
      ? upcoming?.filter((e) => withinDates(e.date.slice(0, 10), range))
      : [...past, ...disclosureEvents]
          .filter((e) => withinDates(e.date.slice(0, 10), range))
          .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Card>
      <CardHeader>
        <CardTitle>催化日历</CardTitle>
        <CardAction>
          <InfoHint>
            未来财报日程与历史公告按市场接入；美股历史包含 EDGAR
            的年报、季报、临时公告和修订文件。披露日期不等于财报发布或事件发生日期。历史记录可打开原文。A股公告来自巨潮资讯，当前查询最近一年；其他市场未接入时保留栏目。
          </InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="signal-period" role="group" aria-label="事件时间范围">
          {[
            ["upcoming", "即将到来"],
            ["recent", "历史记录"],
          ].map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={period === id ? "secondary" : "ghost"}
              aria-pressed={period === id}
              onClick={() => {
                setPeriod(id);
                setPage(0);
              }}
            >
              {label}
            </Button>
          ))}
          <Freshness value={query.data} />
        </div>
        <DateRange
          value={range}
          onChange={(v) => {
            setRange(v);
            setPage(0);
          }}
        />
        {period === "recent" &&
          (history.isPending || history.data?.state === "pending") && (
            <LoadingState />
          )}
        {!events ? (
          <State loading={query.isPending} retry={() => void query.refetch()} />
        ) : events.length === 0 ? (
          period === "recent" &&
          (history.isPending || history.data?.state === "pending") ? null : (
            <p className="signal-empty">
              {period === "upcoming"
                ? "暂无已公布日程"
                : "暂无已取得的历史记录"}
            </p>
          )
        ) : (
          events.slice(page * 5, (page + 1) * 5).map((e) => (
            <article className="signal-event" key={e.url || e.date + e.title}>
              <time dateTime={e.date}>
                <strong>{e.date.slice(5)}</strong>
                <small>{e.date.slice(0, 4)}</small>
              </time>
              <div>
                <strong>
                  {e.url ? (
                    <a href={e.url} target="_blank" rel="noreferrer">
                      {e.title} ↗
                    </a>
                  ) : (
                    e.title
                  )}
                </strong>
                <div className="signal-meta">
                  {e.timing}
                  {e.eps_estimate !== null && (
                    <span>预期 EPS ${fmt(e.eps_estimate)}</span>
                  )}
                  {e.revenue_estimate !== null && (
                    <span>
                      预期收入 ${(e.revenue_estimate / 1e9).toFixed(2)}B
                    </span>
                  )}
                  {e.eps_actual !== null && (
                    <span>实际 EPS ${fmt(e.eps_actual)}</span>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
        {events && events.length > 5 && (
          <div className="calendar-pagination">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              上一页
            </Button>
            <span>
              {page + 1} / {Math.ceil(events.length / 5)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={(page + 1) * 5 >= events.length}
              onClick={() => setPage(page + 1)}
            >
              下一页
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
export function RetailSentiment({ symbol }: { symbol: string }) {
  const query = useSignal<Sentiment>(symbol, "sentiment");
  const data = query.data?.data;
  const high = Math.max(1, ...(data?.daily.map((d) => d.mentions ?? 0) || []));
  return (
    <Card>
      <CardHeader>
        <CardTitle>散户情绪</CardTitle>
        <CardAction>
          <InfoHint>
            {query.data?.reason === "asset_not_supported" ? "供应商尚未匹配到当前上市证券，不用其他上市地的证券替代。" : query.data?.status === "empty" ? "当前证券已接入，但本期没有有效讨论样本。" : ""}
            最近 7 个 UTC 自然日的 Reddit 讨论，来源：Adanos。样本较少时分数波动较大。情绪分 -1 至
            +1，热度 0 至
            100；热度变化不等于股价方向，空值表示信号不足。看多、看空比例采用供应商原始口径。
          </InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Freshness value={query.data} />
        {!data ? (
          <dl className="evidence-metrics" aria-label="散户情绪指标">
            {["情绪分", "热度", "讨论量", "看多占比", "看空占比"].map(
              (label) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>—</dd>
                </div>
              ),
            )}
          </dl>
        ) : (
          <>
            <div className="sentiment-heading">
              <strong>
                {data.score === null
                  ? "信号不足"
                  : data.score > 0.15
                    ? "偏多"
                    : data.score < -0.15
                      ? "偏空"
                      : "中性"}
              </strong>
              <span>
                {data.from.slice(5)} — {data.to.slice(5)}
              </span>
            </div>
            <dl className="signal-metrics">
              <div>
                <dt>情绪分</dt>
                <dd>{fmt(data.score)}</dd>
              </div>
              <div>
                <dt>讨论量</dt>
                <dd>{fmt(data.mentions)}</dd>
              </div>
              <div>
                <dt>热度</dt>
                <dd>{fmt(data.buzz)}</dd>
              </div>
            </dl>
            <div className="sentiment-split">
              <span>看多 {fmt(data.bullish, "%")}</span>
              <span>看空 {fmt(data.bearish, "%")}</span>
            </div>
            <div className="sentiment-track" aria-hidden="true">
              <i style={{ width: `${data.bullish ?? 0}%` }} />
              <i style={{ width: `${data.bearish ?? 0}%` }} />
            </div>
            {data.daily.length > 0 && (
              <div>
                <div className="signal-meta">
                  每日讨论量
                  <span>
                    {data.trend === "rising"
                      ? "关注升温"
                      : data.trend === "falling"
                        ? "关注降温"
                        : data.trend === "stable"
                          ? "关注平稳"
                          : ""}
                  </span>
                </div>
                <div
                  className="sentiment-bars"
                  role="img"
                  aria-label={data.daily
                    .map((d) => `${d.date}：${fmt(d.mentions)} 次讨论`)
                    .join("；")}
                >
                  {data.daily.map((d) => (
                    <div key={d.date}>
                      <div className="sentiment-bar-space">
                        <i
                          style={{
                            height: `${((d.mentions ?? 0) / high) * 100}%`,
                          }}
                        />
                      </div>
                      <small>{d.date.slice(5)}</small>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
