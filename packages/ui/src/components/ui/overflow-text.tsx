import { Slot } from "radix-ui";
import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/** One-line label with a transient, viewport-bound full-text preview. */
export function OverflowText({ text, children }: { text: string; children?: ReactNode }) {
  const Comp = children ? Slot.Root : "span";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Comp className="block min-w-0 max-w-full truncate" {...(!children ? { tabIndex: 0 } : {})}>
          {children || text}
        </Comp>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        sideOffset={4}
        className="max-w-[min(32rem,calc(100vw-2rem))] break-words"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
