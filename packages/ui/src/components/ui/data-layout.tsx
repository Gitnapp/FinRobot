import type { CSSProperties, ReactNode } from "react";
import { cn } from "../../lib/utils";

export function CardGrid({
  children,
  minWidth = 320,
  className,
}: {
  children: ReactNode;
  minWidth?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("rui-card-grid", className)}
      style={{ "--rui-card-min": `${minWidth}px` } as CSSProperties}
    >
      {children}
    </div>
  );
}
export function MetricGrid({
  items,
  label,
  className,
}: {
  items: readonly { id: string; label: ReactNode; value: ReactNode }[];
  label?: string;
  className?: string;
}) {
  return (
    <dl aria-label={label} className={cn("rui-metric-grid", className)}>
      {items.map((item) => (
        <div key={item.id}>
          <dt>{item.label}</dt>
          <dd>{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
export function ReadingLayout({
  navigation,
  children,
}: {
  navigation: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rui-reading-container">
      <div className="rui-reading-layout">
        {navigation}
        <div className="rui-reading-body">{children}</div>
      </div>
    </div>
  );
}

export function KeyValueGrid({
  items,
  label,
  className,
}: {
  items: readonly { id: string; label: ReactNode; value: ReactNode }[];
  label?: string;
  className?: string;
}) {
  return (
    <dl aria-label={label} className={cn("rui-key-value-grid", className)}>
      {items.map((item) => (
        <div key={item.id}>
          <dt>{item.label}</dt>
          <dd>{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
