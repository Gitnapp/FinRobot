import { Button } from "@gitnapp/ui/components/ui/button";
import { LoadingState } from "@gitnapp/ui/components/ui/loading";
import { InfoLabel } from "@gitnapp/ui/components/ui/tooltip";
import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import "../../styles/async-content.css";
import { ErrorState } from "../ui";

/** A failed refresh never replaces valid content with a blocking error screen. */
export function AsyncContent({
  hasData,
  pending,
  error,
  refreshing = false,
  retry,
  children,
  className = "",
}: {
  hasData: boolean;
  pending: boolean;
  error?: Error | null;
  refreshing?: boolean;
  retry?: () => void;
  children: ReactNode;
  className?: string;
}) {
  if (!hasData)
    return (
      <div className={`async-content ${className}`} aria-busy={pending}>
        {error ? (
          <ErrorState error={error} retry={retry} />
        ) : (
          <LoadingState inline />
        )}
      </div>
    );
  return (
    <div className={`async-content ${className}`} aria-busy={refreshing}>
      <RefreshNotice error={error} retry={retry} />
      {children}
    </div>
  );
}

export function RefreshNotice({
  error,
  retry,
}: {
  error?: Error | null;
  retry?: () => void;
}) {
  if (!error) return null;
  return (
    <div className="async-refresh-error" role="status">
      <InfoLabel label="更新失败">暂时保留最近一次成功加载的数据。</InfoLabel>
      {retry && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="重新更新"
          onClick={retry}
        >
          <RefreshCw size={14} />
        </Button>
      )}
    </div>
  );
}
