import { MathCurveLoader } from "@gitnapp/ui/components/ui/math-curve-loader";
import { AddButton } from "@gitnapp/ui/components/ui/actions";
import {
Dialog,
DialogContent,
DialogDescription,
DialogHeader,
DialogTitle,
} from "@gitnapp/ui/components/ui/dialog";
import { Label } from "@gitnapp/ui/components/ui/label";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@gitnapp/ui/components/ui/select";
import { useQuery,useQueryClient } from "@tanstack/react-query";
import { Check,Plus,Search } from "lucide-react";
import { useEffect,useRef,useState } from "react";
import { toast } from "sonner";
import { api } from "../api/client";
import { useRefresh,useWatchlists } from "../hooks/queries";
import { useSubmitTask } from "../hooks/submit-task";
import { useTasks } from "../hooks/tasks";
import { Input } from "./ui";

export function AddAsset({
  open,
  onOpenChange,
  listId,
  destination = "watchlist",
}: {
  open: boolean;
  listId?: string;
  destination?: "watchlist" | "coverage";
  onOpenChange: (open: boolean) => void;
}) {
  const [groupId, setGroupId] = useState(listId || "");
  useEffect(() => { if (open) setGroupId(listId || ""); }, [open, listId]);
  const [search, setSearch] = useState("");
  const [pendingSymbol, setPendingSymbol] = useState<string | null>(null);
  const busy = pendingSymbol !== null;
  const inFlight = useRef(false);
  const [term, setTerm] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const submitTask = useSubmitTask();
  const tasks = useTasks();
  const refresh = useRefresh(
    destination === "coverage" ? "tracking" : "watchlists",
  );
  const lists = useWatchlists();
  const { data = [] } = useQuery({
    queryKey: ["catalog", term],
    enabled: open,
    queryFn: ({ signal }) =>
      api<{ symbol: string; name: string; sector: string }[]>(
        "/catalog?q=" + encodeURIComponent(term),
        { signal },
      ),
  });
  const filtered = data;
  const validGroup = lists.data?.some(list => list.id === groupId) || false;
  const cannotAdd = busy || (destination === "watchlist" && !validGroup);
  async function add(symbol: string) {
    if (inFlight.current) return;
    const targetList = groupId;
    if (destination === "watchlist" && !validGroup) { toast.error("请先选择分组"); return; }
    symbol = symbol.trim().toUpperCase();
    inFlight.current = true;
    setPendingSymbol(symbol);
    try {
      if (destination === "watchlist") {
        await submitTask({kind:"add_asset",symbol,list_id:targetList},false);
        toast.success(`已排队添加 ${symbol}`, {description:"数据将在后台准备，可能需要一些时间。可在任务中心查看进度。"});
      } else {
        await submitTask({kind:"track_asset",symbol},false);
        void refresh();
        onOpenChange(false);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      inFlight.current = false;
      setPendingSymbol(null);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>添加标的</DialogTitle>
          <DialogDescription className="sr-only">
            搜索公司或输入完整交易代码添加标的
          </DialogDescription>
        </DialogHeader>
        {destination === "watchlist" && <div className="add-asset-group">
          <Label htmlFor="asset-group">添加到分组</Label>
          <Select value={validGroup ? groupId : ""} onValueChange={setGroupId} disabled={busy}>
            <SelectTrigger id="asset-group" aria-label="添加到分组" className="w-full"><SelectValue placeholder="请选择分组"/></SelectTrigger>
            <SelectContent>{lists.data?.map(list=><SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>}
        <div className="search-field">
          <Search size={16} />
          <Input
            aria-label="搜索标的"
            placeholder="公司名称或代码，如 NVDA、00700.HK"
            autoFocus
            disabled={busy}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                /^[A-Za-z0-9][A-Za-z0-9.\-^=]{0,14}$/.test(search.trim())
              )
                void add(search.trim());
            }}
          />
        </div>
        {busy && <div className="add-asset-progress" role="status">正在添加 {pendingSymbol}…</div>}
        <div className="symbol-results">
          {filtered.map((item) => {
            const queued=tasks.data?.some(task=>task.subject.symbol===item.symbol && task.kind==='add_asset' && task.scope?.list_id===groupId && ['queued','running'].includes(task.status));
            const existing=lists.data?.find(list=>list.id===groupId)?.symbols.includes(item.symbol);
            return (
            <button
              type="button"
              disabled={cannotAdd || queued || existing}
              aria-busy={pendingSymbol === item.symbol}
              key={item.symbol}
              aria-label={`添加 ${item.symbol}`}
              onClick={() => void add(item.symbol)}
            >
              <span className="symbol-avatar">{item.symbol.slice(0, 2)}</span>
              <span>
                <strong>{item.symbol}</strong>
                <small>{item.name}</small>
              </span>
              <span className="muted">{item.sector}</span>
              {pendingSymbol === item.symbol ? <MathCurveLoader size={18}/> : queued ? <span className="muted">准备中</span> : existing ? <Check size={15} aria-label="已添加"/> : <Plus size={16} aria-hidden="true"/>}
            </button>
          );})}
          {search.trim() &&
            !filtered.some((a) => a.symbol === search.trim().toUpperCase()) && (
              <AddButton
                attention="primary"
                label={`添加 ${search.toUpperCase()}`}
                disabled={
                  cannotAdd ||
                  !/^[A-Za-z0-9][A-Za-z0-9.\-^=]{0,14}$/.test(search.trim())
                }
                onClick={() => void add(search.trim())}
              />
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
