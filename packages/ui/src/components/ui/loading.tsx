import { LoaderCircle } from "lucide-react";
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
      {children}
      {!parent && (active || count > 0) && (
        <div
          role="status"
          aria-label="正在加载"
          className="fixed top-4 right-4 z-[100] flex size-9 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm pointer-events-none"
        >
          <LoaderCircle aria-hidden="true" className="size-5 animate-spin" strokeWidth={1.5} />
        </div>
      )}
    </LoadingContext.Provider>
  );
}

export function LoadingState({ className }: { className?: string }) {
  const register = useContext(LoadingContext);
  useEffect(() => register?.(), [register]);
  if (register) return null;
  return (
    <div
      role="status"
      aria-label="正在加载"
      className={cn("flex min-h-24 items-center justify-center text-muted-foreground", className)}
    >
      <LoaderCircle aria-hidden="true" className="size-5 animate-spin" strokeWidth={1.5} />
    </div>
  );
}

export function LoadingBoundary({ pending, children }: { pending: boolean; children: ReactNode }) {
  return pending ? <LoadingState /> : children;
}
