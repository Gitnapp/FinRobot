// @gitnapp-customized: shared spacing, typography and wrapping; preserve on shadcn updates.
"use client";

import { Info } from "lucide-react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "../../lib/utils";

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-fit origin-(--radix-tooltip-content-transform-origin) animate-in rounded-md bg-foreground px-3 py-1.5 text-xs text-wrap text-background fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

function InfoHint({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-slot="info-hint"
          aria-label="查看说明"
          className="relative inline-flex size-4 shrink-0 items-center justify-center align-middle border-0 bg-transparent p-0 text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring after:absolute after:-inset-1"
        >
          <Info className="size-3.5" strokeWidth={1.5} />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-80">{children}</TooltipContent>
    </Tooltip>
  );
}

function InfoLabel({
  label,
  children,
  className,
}: {
  label: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      data-slot="info-label"
      className={cn(
        "inline-flex items-center gap-1 align-middle text-[inherit] leading-[inherit]",
        className,
      )}
    >
      <span>{label}</span>
      {children && <InfoHint>{children}</InfoHint>}
    </span>
  );
}

export { InfoHint, InfoLabel, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
