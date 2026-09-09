import { KeyValueGrid } from "@gitnapp/ui/components/ui/data-layout";
import { InfoLabel } from "@gitnapp/ui/components/ui/tooltip";
import { Fragment, useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, SlidersHorizontal } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@gitnapp/ui/components/ui/table";
import { toast } from "sonner";
import { api } from "../api/client";
import { AssumptionsPanel } from "./assumptions-panel";
import type { FinancialModel } from "../types";
import { Button, Loading, ErrorState } from "./ui";

export function modelValue(
  value: number | null,
  kind: string,
  currency = "USD",
) {
  if (value === null) return "—";
  if (kind === "percent") return `${(value * 100).toFixed(1)}%`;
  if (kind === "price")
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(value);
  if (kind === "multiple") return `${value.toFixed(1)}x`;
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
}
export function ModelTable({ symbol }: { symbol: string }) {
  const [scenario, setScenario] = useState("base");
  const [edit, setEdit] = useState(false);
  const query = useQuery({
    queryKey: ["model", symbol, scenario],
    refetchInterval: (q) =>
      q.state.data?.recommendation_state === "pending" ? 1500 : 30000,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === symbol ? previous : undefined,
    queryFn: () =>
      api<FinancialModel>(`/models/${symbol}?scenario=${scenario}`),
  });
  const previous = useRef<{ symbol: string; model: FinancialModel } | null>(
    null,
  );
  useEffect(() => {
    if (query.data && !query.isPlaceholderData)
      previous.current = { symbol, model: query.data };
  }, [query.data, query.isPlaceholderData, symbol]);
  useEffect(() => {
    if (query.error && previous.current?.symbol === symbol) {
      toast.error("情景更新失败，已保留原结果");
      setScenario(previous.current.model.scenario);
    }
  }, [query.error, symbol]);
  const model =
    query.data ||
    (previous.current?.symbol === symbol ? previous.current.model : null);
  if (!model)
    return query.error ? <ErrorState error={query.error} /> : <Loading />;
  return (
    <section className="model-panel" aria-busy={query.isFetching}>
      <div className="model-toolbar">
        <div className="model-heading-row">
          <div className="section-title">
            <InfoLabel label="简单模型">{model.notes.join(" ")}</InfoLabel>
          </div>
          <div className="actions">
            <Button
              variant="ghost"
              size="icon"
              aria-label="查看假设"
              disabled={!model.assumptions}
              onClick={() => setEdit(true)}
            >
              <SlidersHorizontal size={16} />
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <a
                href={
                  model.assumptions
                    ? `/api/models/${symbol}/export?scenario=${scenario}`
                    : undefined
                }
                aria-disabled={!model.assumptions}
                download
                aria-label="导出模型 CSV"
              >
                <Download size={16} />
              </a>
            </Button>
          </div>
        </div>
        <div className="model-cases" role="group" aria-label="预测情景">
          {[
            ["bear", "保守"],
            ["base", "基准"],
            ["bull", "乐观"],
          ].map(([key, name]) => (
            <Button
              key={key}
              size="sm"
              disabled={!model.assumptions}
              aria-pressed={scenario === key}
              variant="ghost"
              onClick={() => setScenario(key)}
            >
              {name}
            </Button>
          ))}
        </div>
      </div>
      <KeyValueGrid
        className="model-assumptions"
        label="当前假设"
        items={[
          {
            id: "growth",
            label: "收入增速",
            value: model.assumptions
              ? `${(model.assumptions.growth * 100).toFixed(0)}%`
              : null,
          },
          {
            id: "margin",
            label: "毛利率",
            value: model.assumptions
              ? `${(model.assumptions.gross_margin * 100).toFixed(0)}%`
              : null,
          },
          {
            id: "opex",
            label: "费用率",
            value: model.assumptions
              ? `${(model.assumptions.opex_ratio * 100).toFixed(0)}%`
              : null,
          },
          {
            id: "multiple",
            label: "退出倍数",
            value: model.assumptions
              ? `${model.assumptions.exit_multiple}x`
              : null,
          },
        ]}
      />
      <Table className="financial-table">
        <TableHeader>
          <TableRow>
            <TableHead className="row-number">#</TableHead>
            <TableHead>行项目</TableHead>
            {model.columns.map((year, i) => (
              <TableHead key={year} className={i === 0 ? "actual-column" : ""}>
                {year}
                {i === 0 && <sup>[1]</sup>}
                <span className="year-kind">
                  {i === 0 ? (model.mock ? "模拟基期" : "基期") : "预测"}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {model.rows.map((row, i) => (
            <Fragment key={row.key}>
              {["revenue", "capex", "multiple"].includes(row.key) && (
                <TableRow className="model-group">
                  <TableCell colSpan={6}>
                    {
                      {
                        revenue: "规模与盈利",
                        capex: "现金流",
                        multiple: "估值与每股价格",
                      }[row.key]
                    }
                  </TableCell>
                </TableRow>
              )}
              <TableRow
                key={row.key}
                className={
                  [
                    "revenue",
                    "ebitda",
                    "net_income",
                    "fcf",
                    "ev",
                    "equity_value",
                    "price",
                  ].includes(row.key)
                    ? "total-row"
                    : ""
                }
              >
                <TableCell className="row-number">
                  {String(i + 1).padStart(2, "0")}
                </TableCell>
                <TableCell>
                  <InfoLabel
                    label={
                      <>
                        {row.label}
                        {row.key === "price" && <sup>[2]</sup>}
                      </>
                    }
                  >
                    {row.formula}
                  </InfoLabel>
                </TableCell>
                {row.values.map((v, j) => (
                  <TableCell
                    key={j}
                    className={`${j === 0 ? "actual-column" : ""} ${row.format === "percent" ? "ratio-cell" : ""}`}
                  >
                    {modelValue(v, row.format, model.currency)}
                  </TableCell>
                ))}
              </TableRow>
            </Fragment>
          ))}
        </TableBody>
      </Table>
      <div className="model-footnote">
        <div className="model-note">
          <span>*</span>
          <span>A 为基期，E 为预测。{model.unit}。</span>
        </div>
        <div className="model-note">
          <span>*</span>
          <span>
            净债务保持基期水平；预测股数以摊薄加权平均股数为起点。估值未经折现，不代表当前目标价。缺失输入以“—”显示。
          </span>
        </div>
        <div className="model-note">
          <span>[1]</span>
          <span>
            基期财务：{model.source}，截至 {model.as_of}。
          </span>
        </div>
        <div className="model-note">
          <span>[2]</span>
          <span>
            每股估值＝（企业价值−净债务）÷摊薄股数；股数与金额按相同百万单位计算。
          </span>
        </div>
      </div>
      <AssumptionsPanel
        symbol={symbol}
        open={edit}
        onOpenChange={setEdit}
        onSaved={() => setScenario("base")}
      />
    </section>
  );
}
