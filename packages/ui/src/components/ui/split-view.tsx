"use client";
import { type ReactNode, useState } from "react";

export function usePreviewSelection() {
  const [selected, setSelected] = useState("");
  const [closing, setClosing] = useState(false);
  const close = () => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSelected("");
      setClosing(false);
    } else setClosing(true);
  };
  const toggle = (id: string) => {
    if (selected === id && !closing) close();
    else {
      setClosing(false);
      setSelected(id);
    }
  };
  return {
    selected,
    closing,
    toggle,
    close,
    finishClose: () => {
      setSelected("");
      setClosing(false);
    },
  };
}
export function SplitView({
  open,
  closing,
  onClosed,
  children,
  preview,
}: {
  open: boolean;
  closing: boolean;
  onClosed: () => void;
  children: ReactNode;
  preview: ReactNode;
}) {
  return (
    <div
      className={`split-view${open ? " is-open" : ""}`}
      onTransitionEnd={(event) => {
        if (
          event.target === event.currentTarget &&
          event.propertyName === "grid-template-columns" &&
          closing
        )
          onClosed();
      }}
    >
      <section className="split-view-main">{children}</section>
      <div className="split-view-preview" inert={!open} aria-hidden={!open}>
        {preview}
      </div>
    </div>
  );
}
