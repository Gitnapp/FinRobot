import { OverflowText } from "@gitnapp/ui/components/ui/overflow-text";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { SlidersHorizontal, Undo2, X } from "lucide-react";
import { InfoHint, InfoLabel } from "@gitnapp/ui/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@gitnapp/ui/components/ui/dialog";
import { Button, Input, Loading, compact, money } from "./ui";
import { api, write } from "../api/client";
import { toast } from "sonner";

type Peer = {
  symbol: string;
  name: string;
  currency: string;
  reason: string;
  source: string;
  price: number | null;
  pe: number | null;
  beta: number | null;
  revenue: number | null;
  ebitda: number | null;
  gross_margin: number | null;
  financial_currency: string | null;
  financial_period: string | null;
  as_of?: string;
  state: string;
  financial_state: string;
};
type Comparison = {
  state: string;
  refreshing: boolean;
  updated_at: string | null;
  data: {
    members: Peer[];
    automatic_members: Peer[];
    selection: "manual" | "automatic";
  };
};

export function PeersPanel({ symbol }: { symbol: string }) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["peers", symbol],
    queryFn: () => api<Comparison>(`/data/${symbol}/peers`),
    refetchInterval: (q) => (q.state.data?.refreshing ? 2000 : 60000),
  });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ symbol: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const candidates = useQuery({
    queryKey: ["catalog", term],
    enabled: open && Boolean(term),
    queryFn: ({ signal }) =>
      api<{ symbol: string; name: string }[]>(
        `/catalog?q=${encodeURIComponent(term)}`,
        { signal },
      ),
  });
  const data = query.data?.data;
  const members = data?.members || [];
  async function save(symbols: string[] | null) {
    setBusy(true);
    try {
      const result = await write<Comparison>(
        `/data/${symbol}/peers`,
        { symbols },
        "PUT",
      );
      client.setQueryData(["peers", symbol], result);
      setOpen(false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="dense-panel peer-comparison">
      <div className="peer-heading">
        <h2>
          <InfoLabel label="同业比较">
            根据行业分类核验同业候选，每周更新名单。同行业不等于直接竞争对手，规模与业务结构可能不同，可自行调整。报价为原币，市盈率为滚动口径，财务指标保留各自年度报表期；缺失值不补零。
          </InfoLabel>
        </h2>
        <div className="actions">
          {data?.selection === "manual" && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="恢复自动同业名单"
              disabled={busy}
              onClick={() => void save(null)}
            >
              <Undo2 size={16} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="调整同业公司"
            onClick={() => {
              setDraft(members);
              setSearch("");
              setOpen(true);
            }}
          >
            <SlidersHorizontal size={16} />
          </Button>
        </div>
      </div>
      {(query.isPending ||
        (query.data?.state === "pending" && !members.length)) && <Loading />}
      <div className="peer-table-scroll">
        <table className="peers-table">
          <thead>
            <tr>
              <th>公司</th>
              <th>股价</th>
              <th>市盈率</th>
              <th>EBITDA</th>
              <th>毛利率</th>
            </tr>
          </thead>
          <tbody>
            {!members.length && (
              <tr>
                <td colSpan={5} className="muted">
                  {query.isError ? "暂未取得同业数据" : "暂无已核实的同业名单"}
                </td>
              </tr>
            )}
            {members.map((p) => (
              <tr key={p.symbol}>
                <td>
                  <InfoLabel
                    label={
                      <OverflowText text={p.name}>
                        <Link to={`/stocks/${p.symbol}`}>{p.name}</Link>
                      </OverflowText>
                    }
                  >
                    {p.reason}。名单来源：{p.source}。
                    {p.as_of ? `报价截至 ${p.as_of}。` : "报价暂缺。"}
                    {p.financial_period
                      ? `财报期 ${p.financial_period}，${p.financial_currency}。`
                      : "财报暂缺。"}
                    {p.state === "stale" || p.financial_state === "stale"
                      ? "部分数据为最近有效记录。"
                      : ""}
                  </InfoLabel>
                </td>
                <td>
                  <OverflowText
                    text={p.currency ? money(p.price, p.currency) : "—"}
                  />
                </td>
                <td>
                  {p.pe != null && p.pe > 0 ? `${p.pe.toFixed(1)}x` : "—"}
                </td>
                <td>
                  {p.ebitda == null ? (
                    "—"
                  ) : (
                    <>
                      {compact(p.ebitda)}
                      <small className="peer-currency">
                        {p.financial_currency}
                      </small>
                    </>
                  )}
                </td>
                <td>
                  {p.gross_margin == null
                    ? "—"
                    : `${(p.gross_margin * 100).toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>同业公司</DialogTitle>
          </DialogHeader>
          <div className="peer-selected">
            {draft.map((p) => (
              <div key={p.symbol}>
                <span>{p.name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`移除 ${p.name}`}
                  onClick={() =>
                    setDraft(draft.filter((x) => x.symbol !== p.symbol))
                  }
                >
                  <X size={14} />
                </Button>
              </div>
            ))}
          </div>
          {draft.length < 6 && (
            <Input
              aria-label="搜索同业公司"
              placeholder="搜索公司名称或代码"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
          {term && draft.length < 6 && (
            <div className="peer-search-results">
              {candidates.data
                ?.filter(
                  (p) =>
                    p.symbol !== symbol &&
                    !draft.some((d) => d.symbol === p.symbol),
                )
                .slice(0, 5)
                .map((p) => (
                  <Button
                    key={p.symbol}
                    variant="ghost"
                    onClick={() => {
                      setDraft([...draft, p]);
                      setSearch("");
                    }}
                  >
                    {p.name}
                  </Button>
                ))}
            </div>
          )}
          <div className="dialog-footer">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              disabled={busy || !draft.length}
              onClick={() => void save(draft.map((p) => p.symbol))}
            >
              保存
            </Button>
          </div>
          {busy && <Loading />}
        </DialogContent>
      </Dialog>
    </section>
  );
}
