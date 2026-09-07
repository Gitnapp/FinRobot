import { useState } from "react";
import { Check, CircleDot, FlaskConical, KeyRound, Server } from "lucide-react";
import { Label } from "@gitnapp/ui/components/ui/label";
import { toast } from "sonner";
import { useRefresh, useSettings } from "../../hooks/queries";
import { write } from "../../api/client";
import type { Settings } from "../../types";
import {
  Button,
  ErrorState,
  Hint,
  Input,
  Loading,
  PageHeader,
} from "../../components/ui";

function SettingsForm({ initial }: { initial: Settings }) {
  const [provider, setProvider] = useState(initial.provider);
  const [model, setModel] = useState(initial.model);
  const [dataMode, setDataMode] = useState(initial.data_mode);
  const [busy, setBusy] = useState("");
  const refresh = useRefresh();
  const selected = initial.providers.find((p) => p.id === provider)!;
  async function action(test = false) {
    setBusy(test ? "test" : "save");
    try {
      const result = await write<{ message?: string }>(
        test ? "/settings/test" : "/settings",
        { provider, model, data_mode: dataMode },
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
          <div className="eyebrow">MODEL PROVIDERS</div>
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
                {p.id === "mock" ? (
                  <FlaskConical size={17} />
                ) : (
                  <Server size={17} />
                )}
              </span>
              <span>
                {p.name}
                <small>
                  {p.id === "mock"
                    ? "无需 API Key"
                    : p.configured
                      ? "密钥已配置"
                      : "未配置"}
                </small>
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
                {selected.configured ? "可用配置" : "需要在 Infisical 配置密钥"}
              </span>
            </div>
            <span className="source">
              <KeyRound size={12} />{" "}
              {provider === "mock" ? "Demo" : "Infisical"}
            </span>
          </div>
          <div className="settings-fields">
            <div>
              <Label htmlFor="api-key">
                API Key{" "}
                <Hint>
                  密钥由 Infisical
                  注入后端进程，仅返回是否配置。浏览器不接收密钥值。
                </Hint>
              </Label>
              <Input
                id="api-key"
                type="password"
                value={
                  selected.configured && provider !== "mock" ? "configured" : ""
                }
                readOnly
                placeholder={provider === "mock" ? "不需要密钥" : "尚未配置"}
              />
            </div>
            <div>
              <Label htmlFor="base-url">
                Base URL{" "}
                <Hint>
                  接口地址跟随后端的服务商配置；OpenAI Compatible 可通过
                  OPENAI_BASE_URL 设置。
                </Hint>
              </Label>
              <Input
                id="base-url"
                value={selected.base_url || "本地演示引擎"}
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
                readOnly={provider === "mock"}
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
            市场数据{" "}
            <Hint>
              优先使用已配置服务。限流、付费限制或缺失字段会使用明确标注的演示数据。Tavily
              / Exa 密钥已发现，本版研究使用 Finnhub
              新闻，尚未启用这两个搜索源。
            </Hint>
          </h2>
          <select
            aria-label="市场数据模式"
            value={dataMode}
            onChange={(e) => setDataMode(e.target.value as "auto" | "mock")}
          >
            <option value="auto">真实数据优先</option>
            <option value="mock">全部演示数据</option>
          </select>
        </div>
        <div className="data-source-list">
          {initial.sources.map((s) => (
            <div key={s.name}>
              <CircleDot size={16} />
              <strong>{s.name}</strong>
              <span>
                {s.name === "Tavily" || s.name === "Exa"
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
