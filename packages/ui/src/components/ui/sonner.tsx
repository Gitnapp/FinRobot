"use client";

// @gitnapp-customized: 移除 next-themes,固定 theme="system"(铁律 #4:无 theme switcher)。
// 升级本组件禁止直接 `shadcn add -o` 覆盖——先 diff 再手动合入。CI 断言此标记存在(scripts/assert-customization-markers.mjs)。

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

// No next-themes: the design system has no manual theme switcher, dark mode
// is always `prefers-color-scheme` (design.md「铁律」#4). "system" makes
// sonner itself watch the media query.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
