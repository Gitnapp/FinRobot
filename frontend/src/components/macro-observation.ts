import type { MacroSeries } from "./intelligence";
type Point = MacroSeries["points"][number];
export function observationChanges(
  points: Point[],
  current: Point,
  unit: string,
) {
  // CPI changes are supplied by the source. Never calculate growth of an inflation rate.
  if ("yoy" in current)
    return { yoy: current.yoy, mom: current.mom, unit: "%", direct: true };
  const change = (months: number) => {
    const date = new Date(current.date + "T00:00:00Z");
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - months);
    const month = date.toISOString().slice(0, 7);
    const prior = points.filter((p) => p.date.startsWith(month)).at(-1);
    return prior ? current.value - prior.value : null;
  };
  return {
    yoy: change(12),
    mom: change(1),
    unit: unit === "%" || unit === "百分点" ? "个百分点" : "点",
    direct: false,
  };
}
