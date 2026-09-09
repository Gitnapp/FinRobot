"use client";
import { Slot } from "radix-ui";
import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/** One-line label with a transient, viewport-bound full-text preview. */
export function OverflowText({ text, children }: { text: string; children?: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [truncated, setTruncated] = useState(false);
  const [open, setOpen] = useState(false);
  const measure = useCallback(() => {
    const element = ref.current;
    const clipped = !!element && element.scrollWidth > element.clientWidth;
    setTruncated(clipped);
    if (!clipped) setOpen(false);
    return clipped;
  }, []);
  useLayoutEffect(() => {
    measure();
  });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    let active = true;
    void document.fonts?.ready.then(() => {
      if (active) measure();
    });
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [measure]);
  const Comp = children ? Slot.Root : "span";
  return (
    <Tooltip open={open && truncated} onOpenChange={(next) => setOpen(next && measure())}>
      <TooltipTrigger asChild>
        <Comp
          ref={ref}
          className="block min-w-0 max-w-full truncate"
          {...(!children ? { tabIndex: truncated ? 0 : undefined } : {})}
        >
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
