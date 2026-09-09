import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@gitnapp/ui/components/ui/dialog";
import { EditableValue } from "@gitnapp/ui/components/ui/editable-value";
import { InfoLabel } from "@gitnapp/ui/components/ui/tooltip";
import { ValueOrigin } from "@gitnapp/ui/components/ui/value-origin";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { api, write } from "../api/client";
import { useRefresh } from "../hooks/queries";
import type { Assumptions } from "../types";
import { AnimatedSwitcher } from "./animated-switcher";
import { Button, ErrorState, Loading } from "./ui";

const fields: [keyof Assumptions, string][] = [
  ["growth", "收入增速"],
  ["gross_margin", "毛利率"],
  ["opex_ratio", "经营费用率"],
  ["tax_rate", "所得税率"],
  ["da_ratio", "折旧摊销率"],
  ["capex_ratio", "资本开支率"],
  ["nwc_ratio", "增量营运资金率"],
  ["share_growth", "股数年变动率"],
  ["exit_multiple", "EV / EBITDA"],
];
type Recommendation = {
  state: "ready" | "stale" | "pending" | "unavailable";
  data: {
    assumptions: Assumptions;
    rationale: Record<keyof Assumptions, string>;
  } | null;
  effective: Assumptions | null;
  overrides: Partial<Assumptions>;
};
const valueText = (value: number, key: keyof Assumptions) =>
  `${(value * (key === "exit_multiple" ? 1 : 100)).toFixed(1)}${key === "exit_multiple" ? "x" : "%"}`;
export function AssumptionsPanel({
  symbol,
  open,
  onOpenChange,
  onSaved,
  initialScenario,
}: {
  symbol: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (scenario: string) => void;
  initialScenario: string;
}) {
  const [scenario, setScenario] = useState(initialScenario);
  const title = useRef<HTMLHeadingElement>(null);
  const query = useQuery({
    queryKey: ["assumptions", symbol, scenario],
    enabled: open,
    queryFn: ({ signal }) =>
      api<Recommendation>(`/data/${symbol}/assumptions?scenario=${scenario}`, {
        signal,
      }),
  });
  type Changes = Partial<Record<keyof Assumptions, number | null>>;
  const [caseChanges, setCaseChanges] = useState<Record<string, Changes>>({});
  const changes = caseChanges[scenario] || {};
  const setChanges = (update: (previous: Changes) => Changes) =>
    setCaseChanges((previous) => ({
      ...previous,
      [scenario]: update(previous[scenario] || {}),
    }));
  const draft = query.data?.effective ? { ...query.data.effective } : null;
  if (draft)
    for (const key of Object.keys(changes) as (keyof Assumptions)[])
      draft[key] = changes[key] ?? query.data!.data!.assumptions[key];
  const [busy, setBusy] = useState(false);
  const refresh = useRefresh("assumptions");
  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      for (const [current, patch] of Object.entries(caseChanges)) {
        await write(`/models/${symbol}?scenario=${current}`, patch, "PUT");
        setCaseChanges((previous) => {
          const next = { ...previous };
          delete next[current];
          return next;
        });
      }
      await refresh();
      onSaved(scenario);
      onOpenChange(false);
      toast.success("假设已更新");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) onOpenChange(v);
      }}
    >
      <DialogContent
        className="assumptions-dialog sm:max-w-lg"
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          title.current?.focus({ preventScroll: true });
        }}
      >
        <DialogHeader>
          <DialogTitle ref={title} tabIndex={-1}>
            预测假设
          </DialogTitle>
        </DialogHeader>
        <AnimatedSwitcher
          className="segmented"
          role="group"
          aria-label="假设情景"
        >
          {[
            ["bear", "保守"],
            ["base", "基准"],
            ["bull", "乐观"],
          ].map(([key, label]) => (
            <button
              key={key}
              disabled={busy}
              className={scenario === key ? "selected" : ""}
              aria-pressed={scenario === key}
              onClick={() => setScenario(key)}
            >
              {label}
            </button>
          ))}
        </AnimatedSwitcher>
        {busy && <Loading />}
        {!draft ? (
          query.error || query.data?.state === "unavailable" ? (
            <ErrorState
              error={query.error || new Error("推荐暂未就绪，请稍后再试")}
              retry={() => void query.refetch()}
            />
          ) : (
            <Loading />
          )
        ) : (
          <>
            <div className="assumptions-tools">
              <InfoLabel
                label={
                  { bear: "保守情景", base: "基准情景", bull: "乐观情景" }[
                    scenario
                  ] || "预测情景"
                }
              >
                AI 推荐随跟踪周期更新；你修改的字段会保留。
                {query.data?.state === "stale" ? "当前保留上次推荐。" : ""}
              </InfoLabel>
            </div>
            <table className="assumptions-display">
              <thead>
                <tr>
                  <th>指标</th>

                  <th>假设</th>
                </tr>
              </thead>
              <tbody>
                {fields.map(([key, label]) => (
                  <tr key={key}>
                    <th scope="row">
                      <InfoLabel label={label}>
                        {changes[key] !== null &&
                        (query.data?.overrides[key] !== undefined ||
                          changes[key] !== undefined)
                          ? "已保留你的设定。"
                          : query.data?.data?.rationale[key]}
                      </InfoLabel>
                    </th>
                    <td>
                      <span className="assumption-value">
                        <EditableValue
                          label={label}
                          value={Number(
                            (
                              draft[key] * (key === "exit_multiple" ? 1 : 100)
                            ).toFixed(4),
                          )}
                          displayValue={valueText(draft[key], key)}
                          disabled={busy}
                          inputProps={{
                            type: "number",
                            step: "0.1",
                            required: true,
                          }}
                          onCommit={(text) => {
                            const value =
                              Number(text) /
                              (key === "exit_multiple" ? 1 : 100);
                            setChanges((previous) => ({
                              ...previous,
                              [key]: value,
                            }));
                          }}
                        />
                        <ValueOrigin
                          manual={
                            changes[key] !== null &&
                            (query.data?.overrides[key] !== undefined ||
                              changes[key] !== undefined)
                          }
                          pending={changes[key] !== undefined}
                          disabled={busy}
                          onReset={() => {
                            setChanges((previous) => ({
                              ...previous,
                              [key]: null,
                            }));
                          }}
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="dialog-footer">
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              <Button disabled={busy} onClick={() => void save()}>
                保存
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
