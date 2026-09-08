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
function useSignal<T>(symbol: string, kind: string) {
  return useQuery({
    queryKey: ["signals", symbol, kind],
    queryFn: ({ signal }) =>
      api<Result<T>>(`/assets/${symbol}/signals/${kind}`, { signal }),
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
export function CatalystCalendar({ symbol }: { symbol: string }) {
  const query = useSignal<Events>(symbol, "catalysts");
  const [period, setPeriod] = useState("upcoming");
  const events = query.data?.data?.events.filter(
    (e) => e.upcoming === (period === "upcoming"),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>催化日历</CardTitle>
        <CardAction>
          <InfoHint>
            未来 90 天及过去 30
            天的财报日程。日期可能调整，盘前盘后按美股交易时段；每股收益和收入为供应商调整后口径。日程来源：Finnhub。
          </InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="signal-period" role="group" aria-label="事件时间范围">
          {[
            ["upcoming", "即将到来"],
            ["recent", "近期发布"],
          ].map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={period === id ? "secondary" : "ghost"}
              aria-pressed={period === id}
              onClick={() => setPeriod(id)}
            >
              {label}
            </Button>
          ))}
          <Freshness value={query.data} />
        </div>
        {!events ? (
          <State loading={query.isPending} retry={() => void query.refetch()} />
        ) : events.length === 0 ? (
          <p className="signal-empty">
            {period === "upcoming" ? "暂无已公布日程" : "近期暂无财报记录"}
          </p>
        ) : (
          events.map((e) => (
            <article className="signal-event" key={e.date}>
              <time dateTime={e.date}>
                <strong>{e.date.slice(5)}</strong>
                <small>{e.date.slice(0, 4)}</small>
              </time>
              <div>
                <strong>{e.title}</strong>
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
            最近 7 个 UTC 自然日的 Reddit 讨论，来源：Adanos。情绪分 -1 至
            +1，热度 0 至
            100；热度变化不等于股价方向，空值表示信号不足。看多、看空比例采用供应商原始口径。
          </InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Freshness value={query.data} />
        {!data ? (
          query.data?.status === "empty" ? (
            <p className="signal-empty">近期讨论样本不足</p>
          ) : (
            <State
              loading={query.isPending}
              retry={() => void query.refetch()}
            />
          )
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
