import type { ReactNode } from "react";
import { Info, LoaderCircle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@gitnapp/ui/components/ui/tooltip";
export { Button } from "@gitnapp/ui/components/ui/button";
export { Input } from "@gitnapp/ui/components/ui/input";
export { Badge } from "@gitnapp/ui/components/ui/badge";

export function Hint({ children }: { children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="hint" aria-label="查看说明">
          <Info size={14} />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-80">{children}</TooltipContent>
    </Tooltip>
  );
}
export function Source({
  mock,
  source,
  note,
}: {
  mock: boolean;
  source: string;
  note?: string;
}) {
  return (
    <span className={`source ${mock ? "is-demo" : ""}`}>
      {mock ? "模拟" : source}
      {note && <Hint>{note}</Hint>}
    </span>
  );
}
export function Change({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span className={`change ${positive ? "up" : "down"}`}>
      {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{" "}
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}
export const money = (v: number | null | undefined) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
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
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "—";
export function Loading() {
  return (
    <div className="empty" role="status">
      <LoaderCircle size={22} className="spin" />
      <span>正在载入</span>
    </div>
  );
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
export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}
