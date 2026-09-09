import { LoadingState } from "@gitnapp/ui/components/ui/loading";
import { InfoHint,InfoLabel } from "@gitnapp/ui/components/ui/tooltip";
import { ArrowDownRight,ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
export { Badge } from "@gitnapp/ui/components/ui/badge";
export { Button } from "@gitnapp/ui/components/ui/button";
export { Input } from "@gitnapp/ui/components/ui/input";
export { PageHeader } from "@gitnapp/ui/components/ui/page-header";

export const Hint = InfoHint;
export function Source({
  mock,
  source,
  note,
}: {
  mock: boolean;
  source: string;
  note?: string;
}) {
  if (!mock) return note ? <Hint>{note}</Hint> : null;
  return (
    <InfoLabel className="source is-demo" label="示例">
      {note || "本区为示例数据，不能视为真实经营或价格表现。"}
    </InfoLabel>
  );
}

export function Change({ value }: { value: number | null }) {
  if (value == null) return <span className="muted">—</span>;
  const positive = value >= 0;
  return (
    <span className={`change ${positive ? "up" : "down"}`}>
      {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{" "}
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}
export const money = (v: number | null | undefined, currency = "USD") =>
  v == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(v);
export const compact = (v: number | null | undefined) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 2,
      }).format(v);
export const dateText = (v: string | null | undefined) =>
  v
    ? new Date(v).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      })
    : "—";
export function Loading({message,mode="initial"}:{message?:string;mode?:"initial"|"refresh"} = {}) {
  return <LoadingState inline message={message} mode={mode}/>;
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error;
  retry?: () => void;
}) {
  return (
    <div className="empty" role="alert">
      <strong>暂时无法载入</strong>
      <p>{error.message}</p>
      {retry && (
        <button className="text-link" onClick={retry}>
          重新加载
        </button>
      )}
    </div>
  );
}
export function Empty({
  icon,
  children,
  action,
}: {
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon}
      {children}
      {action}
    </div>
  );
}

export function Updated({
  report,
}: {
  report?: import("../types").Report | null;
}) {
  if (!report) return <span className="muted">待研究</span>;
  return (
    <InfoLabel className="update-status" label="已更新">
      研究更新于 {dateText(report.completed_at)}
    </InfoLabel>
  );
}

export function researchBrief(text = "") {
  const paragraph = text.split(/\n+/).filter(Boolean).at(-1) || "";
  return (paragraph.replace(/\[\d+\]/g, "").match(/[^。！？]+[。！？]?/g) || [])
    .slice(0, 2)
    .join("");
}
