"use client";

import { List } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "./button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./dialog";

export function SectionNavigation({
  items,
  active,
}: {
  items: { title: string; id: string }[];
  active: string;
}) {
  const selected = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <nav className="rui-section-nav" aria-label="章节目录">
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={active === item.id ? "location" : undefined}
          >
            <span className="rui-section-nav-dot" aria-hidden="true" />
            <span className="rui-section-nav-label">{item.title}</span>
          </a>
        ))}
      </nav>
      <div className="rui-section-mobile">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" aria-label="打开章节目录">
              <span>{items.find((item) => item.id === active)?.title || "目录"}</span>
              <List size={18} />
            </Button>
          </DialogTrigger>
          <DialogContent
            className="rui-section-panel"
            aria-describedby={undefined}
            onCloseAutoFocus={(event) => {
              if (selected.current) {
                event.preventDefault();
                const target = document.getElementById(selected.current);
                target?.scrollIntoView({ block: "start" });
                target?.focus({ preventScroll: true });
                selected.current = null;
              }
            }}
          >
            <DialogTitle>目录</DialogTitle>
            <nav aria-label="选择章节">
              {items.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  aria-current={active === item.id ? "location" : undefined}
                  onClick={() => {
                    selected.current = item.id;
                    setOpen(false);
                  }}
                >
                  {item.title}
                </a>
              ))}
            </nav>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
