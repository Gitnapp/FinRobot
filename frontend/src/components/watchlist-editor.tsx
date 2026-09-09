import { AddButton } from "@gitnapp/ui/components/ui/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@gitnapp/ui/components/ui/dialog";
import { Label } from "@gitnapp/ui/components/ui/label";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { api, write } from "../api/client";
import { useRefresh, useWatchlists } from "../hooks/queries";
import type { Watchlist } from "../types";
import { AddAsset } from "./add-asset";
import { SortableMembers } from "./sortable-members";
import { Button, Input } from "./ui";

export function WatchlistEditor({
  list,
  onSelect,
}: {
  list?: Watchlist;
  onSelect: (id: string) => void;
}) {
  const lists = useWatchlists();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<{ id?: string; name: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const refresh = useRefresh("watchlists");
  const current = lists.data?.find((row) => row.id === selected);
  const ids = useMemo(
    () => lists.data?.map((row) => row.id) || [],
    [lists.data],
  );
  const labels = useMemo(
    () =>
      Object.fromEntries((lists.data || []).map((row) => [row.id, row.name])),
    [lists.data],
  );
  async function mutate(action: () => Promise<unknown>) {
    if (busy) return false;
    setBusy(true);
    try {
      await action();
      await refresh();
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="管理列表"
        onClick={() => {
          setSelected(null);
          setForm(null);
          setOpen(true);
        }}
      >
        <MoreHorizontal size={18} />
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent className="list-manager-dialog sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{current ? current.name : "编辑列表"}</DialogTitle>
            <DialogDescription className="sr-only">
              拖动手柄排序，点击列表编辑标的
            </DialogDescription>
          </DialogHeader>
          <div className="actions">
            {current ? (
              <>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setSelected(null)}
                >
                  <ArrowLeft size={14} />
                  全部列表
                </Button>
                <AddButton
                  attention="quiet"
                  label="添加标的"
                  disabled={busy}
                  onClick={() => setAdding(true)}
                />
              </>
            ) : (
              <AddButton
                attention="quiet"
                label="新建列表"
                disabled={busy}
                onClick={() => setForm({ name: "" })}
              />
            )}
          </div>
          {form && (
            <form
              className="list-name-editor"
              onSubmit={(event) => {
                event.preventDefault();
                const value = form;
                void mutate(async () => {
                  if (value.id)
                    await write(
                      `/watchlists/${value.id}`,
                      { name: value.name },
                      "PUT",
                    );
                  else await write("/watchlists", { name: value.name });
                  setForm(null);
                });
              }}
            >
              <Label htmlFor="list-name">
                {form.id ? "重命名列表" : "列表名称"}
              </Label>
              <Input
                id="list-name"
                autoFocus
                required
                maxLength={40}
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
              <Button type="submit" disabled={busy || !form.name.trim()}>
                保存
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => setForm(null)}
              >
                取消
              </Button>
            </form>
          )}
          {current ? (
            <SortableMembers
              key={current.id}
              symbols={current.symbols}
              disabled={busy}
              onReorder={(symbols) =>
                mutate(() =>
                  write(`/watchlists/${current.id}/order`, { symbols }, "PUT"),
                )
              }
              onRemove={(symbol) =>
                void mutate(() =>
                  api(`/watchlists/${current.id}/symbols/${symbol}`, {
                    method: "DELETE",
                  }),
                )
              }
            />
          ) : (
            <SortableMembers
              key="lists"
              symbols={ids}
              labels={labels}
              disabled={busy}
              onOpen={(id) => {
                setSelected(id);
                setForm(null);
              }}
              onRename={(id) => setForm({ id, name: labels[id] })}
              onReorder={(order) =>
                mutate(() => write("/watchlists/order", { ids: order }, "PUT"))
              }
              onRemove={(id) =>
                void mutate(async () => {
                  await api(`/watchlists/${id}`, { method: "DELETE" });
                  if (list?.id === id) onSelect("");
                })
              }
            />
          )}
        </DialogContent>
      </Dialog>
      {current && (
        <AddAsset
          open={adding}
          onOpenChange={setAdding}
          listId={current.id}
          stayOnPage
        />
      )}
    </>
  );
}
