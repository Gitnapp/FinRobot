"use client";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { cn } from "../../lib/utils";
import { MathCurveLoader } from "./math-curve-loader";

const LoadingContext = createContext<(() => () => void) | null>(null);

// The outermost scope owns the only visible loading indicator, including nested dialogs.
export function LoadingScope({
  active = false,
  children,
}: {
  active?: boolean;
  children: ReactNode;
}) {
  const parent = useContext(LoadingContext);
  useEffect(() => (active && parent ? parent() : undefined), [active, parent]);
  const [count, setCount] = useState(0);
  const register = useCallback(() => {
    setCount((n) => n + 1);
    return () => setCount((n) => n - 1);
  }, []);
  const value = useMemo(() => parent || register, [parent, register]);
  return (
    <LoadingContext.Provider value={value}>
      <div className="rui-loading-scope">
        {children}
        {!parent && (active || count > 0) && (
          <div role="status" aria-label="正在加载" className="rui-loading-scope-indicator">
            <MathCurveLoader />
          </div>
        )}
      </div>
    </LoadingContext.Provider>
  );
}

export function LoadingState({
  className,
  inline = false,
  mode = "initial",
  message = "首次加载可能需要一些时间，请稍候。",
}: {
  className?: string;
  inline?: boolean;
  mode?: "initial" | "refresh";
  message?: string;
}) {
  const register = useContext(LoadingContext);
  const [slow, setSlow] = useState(false);
  useEffect(() => (inline ? undefined : register?.()), [register, inline]);
  useEffect(() => {
    if (mode !== "initial") return;
    const timer = setTimeout(() => setSlow(true), 2000);
    return () => clearTimeout(timer);
  }, [mode]);
  if (register && !inline) return null;
  return (
    <div role="status" aria-label="正在加载" className={cn("rui-loading-state", className)}>
      <div className="rui-loading-center">
        <MathCurveLoader />
      </div>
      {mode === "initial" && slow && <p className="rui-loading-message">{message}</p>}
    </div>
  );
}

export function LoadingBoundary({ pending, children }: { pending: boolean; children: ReactNode }) {
  return pending ? <LoadingState /> : children;
}
