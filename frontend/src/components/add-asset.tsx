import { AddButton } from "@gitnapp/ui/components/ui/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@gitnapp/ui/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { api, write } from "../api/client";
import { useRefresh, useWatchlists } from "../hooks/queries";
import { Input } from "./ui";

export function AddAsset({
  open,
  onOpenChange,
  listId,
  stayOnPage = false,
  destination = "watchlist",
}: {
  open: boolean;
  listId?: string;
  stayOnPage?: boolean;
  destination?: "watchlist" | "coverage";
  onOpenChange: (open: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [term, setTerm] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const navigate = useNavigate();
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
  async function add(symbol: string) {
    setBusy(true);
    try {
      const added =
        destination === "coverage"
          ? await write<{ symbol: string }>(
              `/coverage/${symbol}`,
              { active: true, cadence: "weekly" },
              "PUT",
            )
          : await write<{ symbol: string }>(
              "/watchlists/" + (listId || lists.data?.[0]?.id) + "/symbols",
              { symbol },
            );
      await refresh();
      onOpenChange(false);
      setSearch("");
      if (destination === "watchlist" && !stayOnPage)
        navigate(`/stocks/${added.symbol}`);
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
            搜索公司或输入完整交易代码添加标的
          </DialogDescription>
        </DialogHeader>
        <div className="search-field">
          <Search size={16} />
          <Input
            aria-label="搜索标的"
            placeholder="公司名称或代码，如 NVDA、00700.HK"
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
              <AddButton
                attention="primary"
                label={`添加 ${search.toUpperCase()}`}
                disabled={
                  busy ||
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
