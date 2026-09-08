import { InfoLabel } from "@gitnapp/ui/components/ui/tooltip";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, SlidersHorizontal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@gitnapp/ui/components/ui/dialog";
import { Label } from "@gitnapp/ui/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@gitnapp/ui/components/ui/table";
import { toast } from "sonner";
import { api, write } from "../api/client";
import { useRefresh } from "../hooks/queries";
import type { Assumptions, FinancialModel } from "../types";
import { Button, Input, Source, Loading, ErrorState } from "./ui";

export function modelValue(value: number | null, kind: string) {
  if (value === null) return "—";
  if (kind === "percent") return `${(value * 100).toFixed(1)}%`;
  if (kind === "multiple") return `${value.toFixed(1)}x`;
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
}
const fields: [keyof Assumptions, string][] = [
  ["growth", "收入增速"],
  ["gross_margin", "毛利率"],
  ["opex_ratio", "经营费用率"],
  ["tax_rate", "所得税率"],
  ["da_ratio", "折旧摊销率"],
  ["capex_ratio", "资本开支率"],
  ["nwc_ratio", "增量营运资金率"],
  ["exit_multiple", "退出 EV / EBITDA"],
];

export function ModelTable({ symbol }: { symbol: string }) {
  const [scenario, setScenario] = useState("base");
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<Assumptions | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useRefresh();
  const query = useQuery({
    queryKey: ["model", symbol, scenario],
    queryFn: () =>
      api<FinancialModel>(`/models/${symbol}?scenario=${scenario}`),
  });
  const model = query.data;
  if (!model)
    return query.error ? <ErrorState error={query.error} /> : <Loading />;
  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      await write(`/models/${symbol}`, draft, "PUT");
      await refresh();
      setScenario("base");
      setEdit(false);
      toast.success("假设已保存");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="model-panel">
      <div className="section-toolbar model-toolbar">
        <div>
          <div className="section-title">
            <InfoLabel label="简单模型">{model.notes.join(" ")}</InfoLabel>
          </div>
          <div className="model-meta">
            百万美元 <span>·</span>{" "}
            <Source
              mock={model.mock}
              source={model.mock ? "模拟" : model.source}
              note={`基期 ${model.as_of} · ${model.source}`}
            />
          </div>
        </div>
        <>
          <div className="actions">
            {[
              ["bear", "保守"],
              ["base", "基准"],
              ["bull", "乐观"],
            ].map(([key, name]) => (
              <Button
                key={key}
                size="sm"
                variant={scenario === key ? "secondary" : "ghost"}
                onClick={() => setScenario(key)}
              >
                {name}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft({ ...model.assumptions });
                setEdit(true);
              }}
              disabled={scenario !== "base"}
            >
              <SlidersHorizontal size={14} />
              假设
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <a
                href={`/api/models/${symbol}/export?scenario=${scenario}`}
                download
                aria-label="导出模型 CSV"
              >
                <Download size={15} />
              </a>
            </Button>
          </div>
        </>
      </div>
      <div className="model-assumptions">
        <span>
          收入增速 <b>{(model.assumptions.growth * 100).toFixed(0)}%</b>
        </span>
        <span>
          毛利率 <b>{(model.assumptions.gross_margin * 100).toFixed(0)}%</b>
        </span>
        <span>
          费用率 <b>{(model.assumptions.opex_ratio * 100).toFixed(0)}%</b>
        </span>
        <span>
          退出倍数 <b>{model.assumptions.exit_multiple}x</b>
        </span>
      </div>
      <Table className="financial-table">
        <TableHeader>
          <TableRow>
            <TableHead className="row-number">#</TableHead>
            <TableHead>行项目</TableHead>
            {model.columns.map((year, i) => (
              <TableHead key={year} className={i === 0 ? "actual-column" : ""}>
                {year}
                <span className="year-kind">
                  {i === 0 ? (model.mock ? "模拟基期" : "基期") : "预测"}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {model.rows.map((row, i) => (
            <TableRow
              key={row.key}
              className={
                ["revenue", "ebitda", "net_income", "fcf", "ev"].includes(
                  row.key,
                )
                  ? "total-row"
                  : ""
              }
            >
              <TableCell className="row-number">
                {String(i + 1).padStart(2, "0")}
              </TableCell>
              <TableCell>
                <InfoLabel label={row.label}>{row.formula}</InfoLabel>
              </TableCell>
              {row.values.map((v, j) => (
                <TableCell
                  key={j}
                  className={`${j === 0 ? "actual-column" : ""} ${row.format === "percent" ? "ratio-cell" : ""}`}
                >
                  {modelValue(v, row.format)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="model-footnote">
        <InfoLabel label="A 基期 · E 预测">{model.notes.join(" ")}</InfoLabel>
        <span>EV 为预测末年未折现企业价值</span>
      </div>
      <Dialog open={edit} onOpenChange={setEdit}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>预测假设 · {symbol}</DialogTitle>
            <DialogDescription>调整基准情景的预测假设。</DialogDescription>
          </DialogHeader>
          {draft && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <div className="assumption-fields">
                {fields.slice(0, 4).map(([key, label]) => (
                  <div key={key}>
                    <Label htmlFor={key}>{label} (%)</Label>
                    <Input
                      id={key}
                      type="number"
                      step="0.1"
                      required
                      value={Number((draft[key] * 100).toFixed(4))}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          [key]: Number(e.target.value) / 100,
                        })
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="assumption-fields">
                {fields.slice(4).map(([key, label]) => (
                  <div key={key}>
                    <Label htmlFor={key}>
                      {label} {key === "exit_multiple" ? "(x)" : "(%)"}
                    </Label>
                    <Input
                      id={key}
                      type="number"
                      step="0.1"
                      required
                      value={Number(
                        (
                          draft[key] * (key === "exit_multiple" ? 1 : 100)
                        ).toFixed(4),
                      )}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          [key]:
                            Number(e.target.value) /
                            (key === "exit_multiple" ? 1 : 100),
                        })
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="dialog-footer">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEdit(false)}
                >
                  取消
                </Button>
                <Button disabled={busy} type="submit">
                  {busy ? "保存中…" : "保存假设"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
