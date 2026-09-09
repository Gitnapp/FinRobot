import { useLayoutEffect, useRef, useState } from "react";

type Path = {
  readonly items: readonly { label: string; href?: string }[];
  readonly compact: boolean;
};
/** Keeps the old path through fade-out, then measures the new width before paint. */
export function useBreadcrumbTransition(items: Path["items"], compact: boolean) {
  const key = JSON.stringify([items, compact]);
  const incoming = useRef({ items, compact, key });
  incoming.current = { items, compact, key };
  const [display, setDisplay] = useState(incoming.current);
  const root = useRef<HTMLElement>(null);
  const previousWidth = useRef<number | null>(null);
  const animations = useRef<Animation[]>([]);
  useLayoutEffect(() => {
    if (key === display.key) return;
    const element = root.current;
    if (!element) return;
    const visibleWidth = element.getBoundingClientRect().width;
    animations.current.forEach((animation) => {
      animation.cancel();
    });
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      previousWidth.current = null;
      element.style.width = "";
      setDisplay(incoming.current);
      return;
    }
    previousWidth.current = visibleWidth;
    element.style.width = `${visibleWidth}px`;
    const content = element.querySelector("ol");
    if (content)
      animations.current = [
        content.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 140,
          easing: "ease-in",
          fill: "forwards",
        }),
      ];
    const timer = setTimeout(() => setDisplay(incoming.current), 140);
    return () => clearTimeout(timer);
  }, [key, display.key]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: measure only after the displayed path commits, not when the target path changes.
  useLayoutEffect(() => {
    const element = root.current,
      from = previousWidth.current;
    if (!element || from === null) return;
    previousWidth.current = null;
    element.style.width = "";
    const to = element.getBoundingClientRect().width;
    const content = element.querySelector("ol");
    const width = element.animate([{ width: `${from}px` }, { width: `${to}px` }], {
      duration: 360,
      easing: "cubic-bezier(.4,0,.2,1)",
    });
    animations.current = [width];
    if (content)
      animations.current.push(
        content.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: "ease-out" }),
      );
  }, [display.key]);
  useLayoutEffect(
    () => () =>
      animations.current.forEach((animation) => {
        animation.cancel();
      }),
    [],
  );
  return { root, items: display.items, compact: display.compact, key: display.key };
}
