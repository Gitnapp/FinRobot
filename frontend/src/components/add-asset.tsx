import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Plus, Search, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@gitnapp/ui/components/ui/dialog";
import { api, write } from "../api/client";
import { useRefresh, useWatchlists } from "../hooks/queries";
import { Button, Input } from "./ui";
import { toast } from "sonner";

export function AddAsset({
  open,
  onOpenChange,
  listId,
}: {
  open: boolean;
  listId?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const refresh = useRefresh();
  const lists = useWatchlists();
  const { data = [] } = useQuery({
    queryKey: ["catalog"],
    queryFn: () =>
      api<{ symbol: string; name: string; sector: string }[]>("/catalog"),
  });
  const filtered = data.filter((a) =>
    (a.symbol + a.name).toLowerCase().includes(search.toLowerCase()),
  );
  async function add(symbol: string) {
    setBusy(true);
    try {
      await write(
        "/watchlists/" + (listId || lists.data?.[0]?.id) + "/symbols",
        { symbol },
      );
      await refresh();
      onOpenChange(false);
      setSearch("");
      navigate(`/stocks/${symbol.toUpperCase()}`);
      toast.success(`已添加 ${symbol.toUpperCase()}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>添加标的</DialogTitle>
          <DialogDescription className="sr-only">
            搜索公司或输入美股代码加入自选
          </DialogDescription>
        </DialogHeader>
        <div className="search-field">
          <Search size={16} />
          <Input
            aria-label="搜索标的"
            placeholder="搜索公司或代码，如 NVDA"
            autoFocus
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
        <div className="symbol-results">
          {filtered.map((item) => (
            <button
              disabled={busy}
              key={item.symbol}
              onClick={() => void add(item.symbol)}
            >
              <span className="symbol-avatar">{item.symbol.slice(0, 2)}</span>
              <span>
                <strong>{item.symbol}</strong>
                <small>{item.name}</small>
              </span>
              <span className="muted">{item.sector}</span>
              <ArrowRight size={15} />
            </button>
          ))}
          {search.trim() &&
            !filtered.some((a) => a.symbol === search.trim().toUpperCase()) && (
              <Button
                disabled={
                  busy ||
                  !/^[A-Za-z0-9][A-Za-z0-9.\-^=]{0,14}$/.test(search.trim())
                }
                variant="outline"
                onClick={() => void add(search.trim())}
              >
                <Plus size={15} />
                添加 {search.toUpperCase()}
              </Button>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
