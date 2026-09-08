import { usePriceHistory } from "../hooks/queries";
import { LoadingState } from "@gitnapp/ui/components/ui/loading";
import { useEffect, useRef, useState } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  type Time,
} from "lightweight-charts";
import { ChartCandlestick, ChartNoAxesCombined } from "lucide-react";
import { Button, Source } from "./ui";

export function PriceChart({
  small = false,
  symbol,
}: {
  small?: boolean;
  symbol: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState(90);
  const archive = usePriceHistory(symbol);
  const shownHistory = archive.data;
  const [candles, setCandles] = useState(false);
  const [dark, setDark] = useState(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const changed = () => setDark(mq.matches);
    mq.addEventListener("change", changed);
    return () => mq.removeEventListener("change", changed);
  }, []);
  useEffect(() => {
    if (!container.current || !shownHistory) return;
    const last = shownHistory.points.at(-1);
    if (!last) return;
    const cutoff = new Date(Date.parse(last.time) - range * 86400000)
      .toISOString()
      .slice(0, 10);
    // Keep the complete series so panning beyond the selected window reveals history.
    const points = shownHistory.points;
    const style = getComputedStyle(document.documentElement);
    const color = dark ? "#a3a3a3" : "#737373";
    const chart = createChart(container.current, {
      height: small ? 218 : 290,
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: color,
        attributionLogo: true,
        fontFamily: style.fontFamily,
        fontSize: 11,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: dark ? "#292929" : "#f1f1f1" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, minBarSpacing: 0.001 },
      handleScroll: !small,
      handleScale: !small,
    });
    if (candles) {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#158567",
        downColor: "#cc5555",
        borderVisible: false,
        wickUpColor: "#158567",
        wickDownColor: "#cc5555",
      });
      series.setData(points.map((p) => ({ ...p, time: p.time as Time })));
    } else {
      const series = chart.addSeries(AreaSeries, {
        lineColor: dark ? "#c6c6c6" : "#333c3b",
        topColor: dark ? "rgba(180,180,180,.13)" : "rgba(40,60,55,.10)",
        bottomColor: "rgba(40,60,55,0)",
        lineWidth: 2,
        priceLineVisible: false,
      });
      series.setData(
        points.map((p) => ({ time: p.time as Time, value: p.close })),
      );
    }
    if (range === 0) {
      chart.timeScale().fitContent();
    } else {
      chart.timeScale().setVisibleRange({
        from: (cutoff < points[0].time ? points[0].time : cutoff) as Time,
        to: last.time as Time,
      });
    }
    return () => chart.remove();
  }, [shownHistory, small, range, candles, dark]);
  return (
    <section className="chart-section">
      <div className="section-toolbar">
        <div className="section-title">
          价格走势{" "}
          <Source
            mock={shownHistory?.mock ?? false}
            source={shownHistory?.source ?? ""}
            note={shownHistory?.note}
          />
        </div>
        <div className="chart-controls">
          {[30, 90, 365, 0].map((n, i) => (
            <Button
              key={n}
              variant={range === n ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setRange(n)}
            >
              {["1M", "3M", "1Y", "全部"][i]}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="icon"
            aria-label={candles ? "切换折线图" : "切换 K 线图"}
            onClick={() => setCandles(!candles)}
          >
            {candles ? (
              <ChartNoAxesCombined size={15} />
            ) : (
              <ChartCandlestick size={15} />
            )}
          </Button>
        </div>
      </div>
      {archive.isPending && <LoadingState />}
      {archive.isError && (
        <div role="status" className="actions">
          <span className="muted">完整历史暂不可用</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void archive.refetch()}
          >
            重试
          </Button>
        </div>
      )}
      <div
        className="price-chart"
        ref={container}
        role="img"
        aria-label={`${shownHistory?.mock ? "模拟" : "历史"}${candles ? "K线" : "价格"}走势，截至 ${shownHistory?.as_of ?? ""}`}
      />
      {range === 0 && shownHistory?.complete === false && (
        <p className="muted text-xs">早期日线暂缺，当前展示可用历史。</p>
      )}
      <div className="chart-caption">
        日线 · USD{" "}
        <span>
          {shownHistory
            ? `${range === 0 ? shownHistory.points[0]?.time + " — " : "截至 "}${shownHistory.as_of}`
            : ""}
        </span>
      </div>
    </section>
  );
}
