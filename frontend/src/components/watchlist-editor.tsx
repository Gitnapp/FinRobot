import { useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Pencil,
  MoreHorizontal,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@gitnapp/ui/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@gitnapp/ui/components/ui/dropdown-menu";
import { Label } from "@gitnapp/ui/components/ui/label";
import { Button, Input } from "./ui";
import { api, write } from "../api/client";
import { useRefresh } from "../hooks/queries";
import type { Watchlist } from "../types";
import { toast } from "sonner";

export function WatchlistEditor({
  list,
  onSelect,
}: {
  list?: Watchlist;
  onSelect: (id: string) => void;
}) {
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useRefresh();
  async function save() {
    setBusy(true);
    try {
      if (mode === "create") {
        const created = await write<Watchlist>("/watchlists", { name });
        onSelect(created.id);
      } else if (list) await write("/watchlists/" + list.id, { name }, "PUT");
      await refresh();
      setMode(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!list) return;
    setBusy(true);
    try {
      await api("/watchlists/" + list.id, { method: "DELETE" });
      onSelect("");
      await refresh();
      setMode(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function member(symbol: string, direction: number) {
    if (!list) return;
    setBusy(true);
    try {
      if (direction === 0)
        await api("/watchlists/" + list.id + "/symbols/" + symbol, {
          method: "DELETE",
        });
      else {
        const order = [...list.symbols];
        const i = order.indexOf(symbol);
        [order[i], order[i + direction]] = [order[i + direction], order[i]];
        await write(
          "/watchlists/" + list.id + "/order",
          { symbols: order },
          "PUT",
        );
      }
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="管理列表">
            <MoreHorizontal size={18} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setName("");
              setMode("create");
            }}
          >
            <Plus size={16} />
            新建列表
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setName(list?.name || "");
              setMode("edit");
            }}
          >
            <Pencil size={16} />
            编辑列表
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={!!mode}
        onOpenChange={(v) => {
          if (!v) setMode(null);
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "新建列表" : "编辑列表"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              修改列表名称、成员及排列顺序
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Label htmlFor="list-name" className="mb-2">
              列表名称
            </Label>
            <Input
              id="list-name"
              value={name}
              required
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：科技股"
            />
            {mode === "edit" && (
              <div className="list-members">
                {list?.symbols.map((s, i) => (
                  <div key={s}>
                    <strong>{s}</strong>
                    <div className="actions">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={busy || i === 0}
                        aria-label={"上移 " + s}
                        onClick={() => void member(s, -1)}
                      >
                        <ArrowUp size={14} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={busy || i === list.symbols.length - 1}
                        aria-label={"下移 " + s}
                        onClick={() => void member(s, 1)}
                      >
                        <ArrowDown size={14} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={busy}
                        aria-label={"移出 " + s}
                        onClick={() => void member(s, 0)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="dialog-footer">
              {mode === "edit" && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void remove()}
                >
                  删除列表
                </Button>
              )}
              <Button type="submit" disabled={busy || !name.trim()}>
                保存
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
