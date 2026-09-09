"use client";
import { type HTMLAttributes, useLayoutEffect, useRef } from "react";

/** Measures the selected control so indicators follow variable labels and resizing. */
export function AnimatedSwitcher({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const measure = () => {
      const active = root.querySelector<HTMLElement>(
        'button[aria-selected="true"], button[aria-pressed="true"], button.selected',
      );
      if (!active || !root.getBoundingClientRect().width) return;
      root.style.setProperty("--switch-x", `${active.offsetLeft}px`);
      root.style.setProperty("--switch-y", `${active.offsetTop}px`);
      root.style.setProperty("--switch-width", `${active.offsetWidth}px`);
      root.style.setProperty("--switch-height", `${active.offsetHeight}px`);
      root.dataset.measured = "true";
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(root);
    for (const button of root.querySelectorAll("button")) resize.observe(button);
    const observer = new MutationObserver(measure);
    observer.observe(root, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "aria-selected", "aria-pressed"],
      childList: true,
    });
    return () => {
      resize.disconnect();
      observer.disconnect();
    };
  }, []);
  return (
    <div {...props} ref={ref} className={`animated-switcher ${className}`}>
      {children}
      <span className="switcher-indicator" aria-hidden="true" />
    </div>
  );
}
