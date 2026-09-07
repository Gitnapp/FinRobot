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
import type { History } from "../types";

export function PriceChart({
  history,
  small = false,
}: {
  history: History;
  small?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState(90);
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
    if (!container.current) return;
    const points = history.points.slice(-range);
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
      timeScale: { borderVisible: false },
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
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [history, small, range, candles, dark]);
  return (
    <section className="chart-section">
      <div className="section-toolbar">
        <div className="section-title">
          价格走势{" "}
          <Source
            mock={history.mock}
            source={history.source}
            note={history.note}
          />
        </div>
        <div className="chart-controls">
          {[30, 90, 260].map((n, i) => (
            <Button
              key={n}
              variant={range === n ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setRange(n)}
            >
              {["1M", "3M", "1Y"][i]}
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
      <div
        className="price-chart"
        ref={container}
        role="img"
        aria-label={`${history.mock ? "模拟" : "历史"}${candles ? "K线" : "价格"}走势，截至 ${history.as_of}`}
      />
      <div className="chart-caption">
        {history.mock ? "模拟历史日线" : "历史日线"} · USD{" "}
        <span>截至 {history.as_of}</span>
      </div>
    </section>
  );
}
