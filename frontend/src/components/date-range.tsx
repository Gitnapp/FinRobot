import {
  DateRangePicker,
  type DateWindow,
} from "@gitnapp/ui/components/ui/date-range-picker";
export type { DateWindow };
export function withinDates(date: string, range: DateWindow) {
  return (!range.from || date >= range.from) && (!range.to || date <= range.to);
}
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => new Date(s + "T12:00:00");
export function seriesWindow(anchor: string | undefined, months = 12): DateWindow {
  const reference = anchor ? parse(anchor) : new Date();
  const from = new Date(reference);
  from.setDate(1);
  from.setMonth(from.getMonth() - months);
  from.setDate(
    Math.min(
      reference.getDate(),
      new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate(),
    ),
  );
  return { from: iso(from), to: iso(reference) };
}
export function DateRange({
  value,
  onChange,
  kind = "events",
  anchor,
}: {
  value: DateWindow;
  onChange: (value: DateWindow) => void;
  kind?: "events" | "series";
  anchor?: string;
}) {
  const reference = anchor ? parse(anchor) : new Date();
  const presets = (
    kind === "series" ? ["1M", "3M", "1Y"] : ["今天", "本周", "本月"]
  ).map((label, i) => {
    const from = new Date(reference),
      to = new Date(reference);
    if (kind === "series") {
      return { label, range: seriesWindow(anchor, [1, 3, 12][i]) };
    } else if (i === 1) {
      from.setDate(from.getDate() - ((from.getDay() + 6) % 7));
      to.setTime(from.getTime());
      to.setDate(from.getDate() + 6);
    } else if (i === 2) {
      from.setDate(1);
      to.setMonth(to.getMonth() + 1, 0);
    }
    return { label, range: { from: iso(from), to: iso(to) } };
  });
  presets.push({ label: "全部", range: { from: "", to: "" } });
  return (
    <DateRangePicker
      value={value}
      onChange={onChange}
      presets={presets}
      defaultMonth={reference}
    />
  );
}
