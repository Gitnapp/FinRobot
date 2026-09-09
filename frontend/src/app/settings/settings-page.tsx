import { InfoLabel } from "@gitnapp/ui/components/ui/tooltip";
import { useState } from "react";
import { Check, CircleDot, KeyRound, Server } from "lucide-react";
import { Label } from "@gitnapp/ui/components/ui/label";
import { toast } from "sonner";
import { useRefresh, useSettings } from "../../hooks/queries";
import { write } from "../../api/client";
import type { Settings } from "../../types";
import {
  Button,
  ErrorState,
  Input,
  Loading,
  PageHeader,
} from "../../components/ui";

function SettingsForm({ initial }: { initial: Settings }) {
  const [provider, setProvider] = useState(initial.provider);
  const [model, setModel] = useState(initial.model);
  const [busy, setBusy] = useState("");
  const refresh = useRefresh();
  const selected = initial.providers.find((p) => p.id === provider)!;
  async function action(test = false) {
    setBusy(test ? "test" : "save");
    try {
      const result = await write<{ message?: string }>(
        test ? "/settings/test" : "/settings",
        { provider, model, data_mode: "auto" },
        test ? "POST" : "PUT",
      );
      if (!test) await refresh();
      toast.success(result.message || "模型设置已保存");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="settings-layout">
        <aside className="providers-list">
          <div className="eyebrow">模型服务</div>
          {initial.providers.map((p) => (
            <button
              className={p.id === provider ? "selected" : ""}
              key={p.id}
              onClick={() => {
                setProvider(p.id);
                setModel(p.models[0]);
              }}
            >
              <span className="provider-icon">
                <Server size={17} />
              </span>
              <span>
                {p.name}
                <small>{p.configured ? "密钥已配置" : "未配置"}</small>
              </span>
              {p.id === provider && <Check size={15} />}
            </button>
          ))}
        </aside>
        <section className="provider-settings">
          <div className="provider-title">
            <div>
              <h2>{selected.name}</h2>
              <span className="muted">
                {selected.configured ? "可用配置" : "需要配置密钥"}
              </span>
            </div>
            <span className="source">
              <KeyRound size={12} /> {selected.configured ? "已配置" : "未配置"}
            </span>
          </div>
          <div className="settings-fields">
            <div>
              <Label htmlFor="api-key">
                <InfoLabel label="API Key">
                  密钥仅用于请求对应服务，不会返回浏览器。
                </InfoLabel>
              </Label>
              <Input
                id="api-key"
                type="password"
                value={selected.configured ? "configured" : ""}
                readOnly
                placeholder="尚未配置"
              />
            </div>
            <div>
              <Label htmlFor="base-url">
                <InfoLabel label="Base URL">
                  接口地址跟随后端的服务商配置；OpenAI Compatible 可通过
                  OPENAI_BASE_URL 设置。
                </InfoLabel>
              </Label>
              <Input
                id="base-url"
                value={selected.base_url || "未配置"}
                readOnly
              />
            </div>
            <div>
              <Label htmlFor="model-name">模型名称</Label>
              <Input
                id="model-name"
                list="model-options"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
              <datalist id="model-options">
                {selected.models.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="settings-actions">
            <Button
              variant="outline"
              disabled={!!busy || !selected.configured || !model}
              onClick={() => void action(true)}
            >
              {busy === "test" ? "连接中…" : "测试连接"}
            </Button>
            <Button
              disabled={!!busy || !selected.configured || !model}
              onClick={() => void action()}
            >
              {busy === "save" ? "保存中…" : "保存设置"}
            </Button>
          </div>
        </section>
      </div>
      <section className="data-settings">
        <div className="section-toolbar">
          <h2>
            <InfoLabel label="市场数据">
              中、美、港行情使用 TickFlow，日韩及欧洲行情使用 Yahoo
              Finance。免费服务提供历史日线和收盘价格，实时行情需要配置密钥并取得相应权限。财务资料仍由独立数据源提供。
            </InfoLabel>
          </h2>
        </div>
        <div className="data-source-list">
          {initial.sources.map((s) => (
            <div key={s.name}>
              <CircleDot size={16} />
              <strong>{s.name}</strong>
              <span>
                {s.name === "Yahoo Finance"
                  ? "公开数据"
                  : s.name === "TickFlow" && !s.configured
                    ? "免费日线"
                    : s.name === "Exa"
                      ? "未启用"
                      : s.configured
                        ? "密钥已配置"
                        : "未配置"}
              </span>
            </div>
          ))}
        </div>
        <div className="settings-actions">
          <Button
            variant="outline"
            disabled={!!busy}
            onClick={() => void action()}
          >
            保存数据模式
          </Button>
        </div>
      </section>
    </>
  );
}

export default function SettingsPage() {
  const { data, error, isLoading, refetch } = useSettings();
  return (
    <div className="page settings-page">
      <PageHeader eyebrow="PREFERENCES / PROVIDERS" title="模型与数据" />
      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} retry={() => void refetch()} />
      ) : data ? (
        <SettingsForm initial={data} />
      ) : null}
    </div>
  );
}
