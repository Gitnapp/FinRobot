"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { Button } from "./button";
import { Calendar, zhCN } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export type DateWindow = { from: string; to: string };
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => new Date(`${s}T12:00:00`);
export function DateRangePicker({
  value,
  onChange,
  presets,
  defaultMonth,
  label = "日期范围",
}: {
  value: DateWindow;
  onChange: (value: DateWindow) => void;
  presets: readonly { label: string; range: DateWindow }[];
  defaultMonth?: Date;
  label?: string;
}) {
  if (presets.length > 4)
    throw new Error("DateRangePicker supports at most four presets plus custom selection.");
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<Date>();
  const active = presets.find((p) => p.range.from === value.from && p.range.to === value.to)?.label;
  return (
    <div className="rui-date-range" role="group" aria-label={label}>
      {presets.slice(0, 4).map((p) => (
        <Button
          key={p.label}
          size="sm"
          variant={active === p.label ? "secondary" : "ghost"}
          aria-pressed={active === p.label}
          onClick={() => onChange(p.range)}
        >
          {p.label}
        </Button>
      ))}
      <Popover
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          setStart(undefined);
        }}
      >
        <PopoverTrigger asChild>
          <Button size="sm" variant={!active ? "secondary" : "ghost"} aria-label="自定义日期范围">
            <CalendarDays size={15} />
            <span>自定义</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="rui-date-popover w-auto p-0">
          <Calendar
            mode="range"
            locale={zhCN}
            weekStartsOn={1}
            captionLayout="dropdown"
            startMonth={new Date(1900, 0)}
            endMonth={new Date(new Date().getFullYear() + 2, 11)}
            defaultMonth={value.from ? parse(value.from) : defaultMonth}
            selected={
              start
                ? { from: start, to: undefined }
                : value.from
                  ? { from: parse(value.from), to: value.to ? parse(value.to) : undefined }
                  : undefined
            }
            onDayClick={(day) => {
              if (!start) {
                setStart(day);
                return;
              }
              onChange({
                from: iso(day < start ? day : start),
                to: iso(day < start ? start : day),
              });
              setStart(undefined);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {!active && value.from && (
        <small className="rui-date-selection">
          {value.from} — {value.to}
        </small>
      )}
    </div>
  );
}
