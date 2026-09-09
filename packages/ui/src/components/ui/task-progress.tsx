import { CheckCircle2, CircleAlert, Clock3 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export type TaskState = "queued" | "running" | "completed" | "failed";
export function TaskProgress({
  title,
  status,
  steps,
  completedSteps,
  queuePosition,
  error,
  actions,
  compact = false,
}: {
  title: string;
  status: TaskState;
  steps: string[];
  completedSteps: number;
  queuePosition?: number | null;
  error?: string | null;
  actions?: ReactNode;
  compact?: boolean;
}) {
  const labels = {
    queued: "等待执行",
    running: steps[completedSteps] || "处理中",
    completed: "已完成",
    failed: "未完成",
  };
  return (
    <section
      data-slot="task-progress"
      className={cn("rounded-lg border bg-card", compact ? "rui-task-compact" : "p-5")}
    >
      <div className="flex items-center justify-between gap-3">
        <strong className="min-w-0 truncate text-sm font-medium">{title}</strong>
        <span
          className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          {status === "completed" ? (
            <CheckCircle2 className="size-4" />
          ) : status === "failed" ? (
            <CircleAlert className="size-4" />
          ) : (
            <Clock3 className="size-4" />
          )}
          {labels[status]}
        </span>
      </div>
      <div
        className="mt-4 flex gap-1"
        role="progressbar"
        aria-label="任务阶段"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={completedSteps}
        aria-valuetext={labels[status]}
      >
        {steps.map((step, i) => (
          <span
            key={step}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-200",
              i < completedSteps || status === "completed"
                ? "bg-foreground"
                : i === completedSteps && status === "running"
                  ? "bg-foreground/50 motion-safe:animate-pulse"
                  : "bg-muted",
            )}
          />
        ))}
      </div>
      {!compact && (
        <ol
          className="mt-3 grid gap-2 text-xs text-muted-foreground"
          style={{ gridTemplateColumns: `repeat(${steps.length},minmax(0,1fr))` }}
        >
          {steps.map((step, i) => (
            <li
              key={step}
              className={
                i === completedSteps && status === "running" ? "text-foreground font-medium" : ""
              }
            >
              {step}
            </li>
          ))}
        </ol>
      )}
      {status === "queued" && queuePosition != null && (
        <p className="mt-3 text-xs text-muted-foreground">排队第 {queuePosition} 位</p>
      )}
      {status === "failed" && (
        <p className="mt-3 text-sm text-muted-foreground">{error || "任务未能完成，可以重试。"}</p>
      )}
      {actions && <div className="mt-4 flex items-center justify-end gap-2">{actions}</div>}
    </section>
  );
}
