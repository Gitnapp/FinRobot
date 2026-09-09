import {
Card,
CardContent,
CardHeader,
CardTitle,
} from "@gitnapp/ui/components/ui/card";
import { InfoLabel } from "@gitnapp/ui/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { ErrorState,Loading,PageHeader } from "../../components/ui";
import { useSettings } from "../../hooks/queries";
import type { Settings } from "../../types";
import { ModelSettings } from "./model-settings";
function SettingsForm({ initial }: { initial: Settings }) {
  const sourceStatus = useQuery({
    queryKey: ["source-health"],
    queryFn: ({ signal }) =>
      api<{ name: string; status: string; reason: string }[]>(
        "/settings/sources",
        { signal },
      ),
  });
  return (
    <div className="settings-sections">
      <ModelSettings settings={initial} />
      <Card>
        <CardHeader>
          <CardTitle>
            <InfoLabel label="数据源">
              中、美、港行情使用 TickFlow，日韩及欧洲行情使用 Yahoo
              Finance。免费服务提供历史日线和收盘价格，实时行情需要配置密钥并取得相应权限。财务资料仍由独立数据源提供。
            </InfoLabel>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="data-source-list">
            {initial.sources.map((s) => {
              const health = sourceStatus.data?.find(
                (item) => item.name === s.name,
              );
              const status = !s.configured
                ? "unconfigured"
                : health?.status ||
                  (sourceStatus.isError ? "unavailable" : "checking");
              return (
                <div key={s.name}>
                  <span
                    aria-hidden="true"
                    className={`source-status-dot source-status-${status}`}
                  />
                  <strong>{s.name}</strong>
                  <InfoLabel
                    label={
                      <span className={`source-status source-status-${status}`}>
                        {s.configured ? "已配置" : "未配置"}
                      </span>
                    }
                  >
                    {health?.reason ||
                      (s.configured
                        ? sourceStatus.isError
                          ? "状态检测失败"
                          : "正在检测连接"
                        : "未配置")}
                  </InfoLabel>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
export default function SettingsPage() {
  const { data, error, isLoading, refetch } = useSettings();
  return (
    <div className="page settings-page">
      <PageHeader title="设置" />
      {isLoading ? (
        <Loading />
      ) : error && !data ? (
        <ErrorState error={error} retry={() => void refetch()} />
      ) : data ? (
        <SettingsForm initial={data} />
      ) : null}
    </div>
  );
}
