import { useLayoutEffect, useRef, useState } from "react";
import {
  createChart,
  LineSeries,
  ColorType,
  type Time,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import type { MacroSeries } from "./intelligence";
import type { DateWindow } from "./date-range";
import { observationChanges } from "./macro-observation";
export function MacroChart({
  points,
  unit,
  compact = false,
  range,
  comparisonPoints,
}: {
  points: MacroSeries["points"];
  unit: string;
  compact?: boolean;
  range?: DateWindow;
  comparisonPoints?: MacroSeries["points"];
}) {
  const root = useRef<HTMLDivElement>(null);
  const chartRef = useRef<{
    chart: IChartApi;
    series: ISeriesApi<"Line">;
  } | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const visible = points.filter(
    (p) =>
      (!range?.from || p.date >= range.from) &&
      (!range?.to || p.date <= range.to),
  );
  useLayoutEffect(() => {
    if (!root.current) return;
    const color = matchMedia("(prefers-color-scheme: dark)").matches
      ? "#a3a3a3"
      : "#525252";
    const chart = createChart(root.current, {
      autoSize: true,
      height: compact ? 150 : 300,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: color,
        fontSize: 11,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: !compact, color: "#88888822" },
      },
      rightPriceScale: {
        visible: !compact,
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: compact ? 0.32 : 0.16 },
      },
      timeScale: { borderVisible: false, minBarSpacing: 0.001 },
      handleScale: !compact,
      handleScroll: !compact,
    });
    const series = chart.addSeries(LineSeries, {
      color,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: !compact,
    });
    chartRef.current = { chart, series };
    chart.subscribeCrosshairMove((event) => {
      if (!event.time || !event.point || !event.seriesData.get(series)) {
        setHoverDate(null);
        return;
      }
      const t = event.time;
      setHoverDate(
        typeof t === "object"
          ? `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`
          : String(t),
      );
    });
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [compact]);
  useLayoutEffect(() => {
    chartRef.current?.series.setData(
      points.map((p) => ({ time: p.date as Time, value: p.value })),
    );
  }, [points, compact]);
  useLayoutEffect(() => {
    setHoverDate(null);
    const chart = chartRef.current?.chart;
    if (!chart || !points.length) return;
    const selected = points.filter(
      (p) =>
        (!range?.from || p.date >= range.from) &&
        (!range?.to || p.date <= range.to),
    );
    if (!selected.length) return;
    if (!range?.from && !range?.to) chart.timeScale().fitContent();
    else {
      const first = points.indexOf(selected[0]),
        last = points.indexOf(selected[selected.length - 1]);
      chart
        .timeScale()
        .setVisibleLogicalRange({ from: first - 0.5, to: last + 0.5 });
    }
  }, [points, compact, range?.from, range?.to]);
  const current =
    hoverDate ? points.find((p) => p.date === hoverDate) : undefined;
  const original = current && (comparisonPoints || points).find(p => p.date === current.date);
  const changes = original ? observationChanges(comparisonPoints || points, original, unit) : null;
  const displayed = current || visible.at(-1);
  const format = (value: number | null | undefined) =>
    value == null ? "—" : value.toFixed(2);
  return (
    <div className="macro-chart" onPointerLeave={() => setHoverDate(null)}>
      <div className="macro-headline">
        <div className="context-value" aria-live="polite">{displayed ? displayed.value.toFixed(2) : "—"}<small>{unit}</small></div>
        <dl className="macro-hover-changes" data-visible={Boolean(current)} aria-hidden={!current}>
          <div><dt>同比{changes?.direct ? "" : "变化"}</dt><dd>{format(changes?.yoy)} {changes?.unit}</dd></div>
          <div><dt>环比{changes?.direct ? "" : "变化"}</dt><dd>{format(changes?.mom)} {changes?.unit}</dd></div>
        </dl>
      </div>
      <div
        ref={root}
        style={{ height: compact ? 150 : 300, visibility: visible.length ? "visible" : "hidden" }}
        aria-label="指标历史走势图"
      />
    </div>
  );
}
