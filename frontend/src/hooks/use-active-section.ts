import { useEffect,useState } from "react";

export function useActiveSection(ready: boolean, reportId: string) {
  const [active, setActive] = useState("section-0");
  useEffect(() => {
    if (!ready) return;
    const root = document.getElementById("main-content");
    const body = root?.querySelector(".report-body");
    if (!root || !body) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const sections = Array.from(
        body.querySelectorAll<HTMLElement>(":scope > section[id]"),
      );
      if (!sections.length) return;
      const edge = root.getBoundingClientRect().top + 64;
      let current = sections[0];
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= edge) current = section;
      }
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 2)
        current = sections[sections.length - 1];
      setActive(current.id);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    root.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(body);
    update();
    return () => {
      root.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [ready, reportId]);
  return active;
}
