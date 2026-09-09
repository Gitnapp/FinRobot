"use client";

import { Sparkles, Undo2, UserRound } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

export function ValueOrigin({
  manual,
  pending = false,
  onReset,
  disabled,
}: {
  manual: boolean;
  pending?: boolean;
  onReset?: () => void;
  disabled?: boolean;
}) {
  const label = manual ? "用户设定" : "AI 推荐";
  const Icon = manual ? UserRound : Sparkles;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="rui-value-origin"
          aria-label={manual && onReset ? "恢复 AI 推荐" : label}
          disabled={disabled}
          onClick={manual ? onReset : undefined}
          data-origin={manual ? "user" : "ai"}
        >
          <Icon
            className="rui-value-origin-symbol"
            size={14}
            strokeWidth={1.5}
            aria-hidden="true"
          />
          {manual && onReset && (
            <Undo2
              className="rui-value-origin-undo"
              size={14}
              strokeWidth={1.5}
              aria-hidden="true"
            />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {manual && onReset
          ? "点击恢复 AI 推荐。"
          : manual
            ? pending
              ? "保存后将保留你的设定，不会被自动更新覆盖。"
              : "已保留你的设定，不会被自动更新覆盖。"
            : "AI 推荐值。"}
      </TooltipContent>
    </Tooltip>
  );
}
