import { useState } from "react";
import { useNavigate } from "react-router";
import { MoreHorizontal, Pause, Play, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@gitnapp/ui/components/ui/dropdown-menu";
import { Button } from "./ui";
import { api, write } from "../api/client";
import { useRefresh } from "../hooks/queries";
import type { Coverage } from "../types";
import { toast } from "sonner";

export function TrackingControls({
  symbol,
  coverage,
}: {
  symbol: string;
  coverage?: Coverage | null;
}) {
  const [busy, setBusy] = useState(false);
  const refresh = useRefresh();
  const navigate = useNavigate();
  async function update(
    active: boolean,
    cadence = coverage?.cadence || "weekly",
  ) {
    setBusy(true);
    try {
      await write(`/coverage/${symbol}`, { active, cadence }, "PUT");
      await refresh();
      if (!coverage) navigate(`/coverage/${symbol}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await api(`/coverage/${symbol}`, { method: "DELETE" });
      await refresh();
      navigate("/coverage");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!coverage)
    return (
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => void update(true)}
      >
        跟踪
      </Button>
    );
  return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            disabled={busy}
            aria-label="跟踪设置"
          >
            {coverage.active ? "跟踪中" : "已暂停"}
            <MoreHorizontal size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>更新频率</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={coverage.cadence}
            onValueChange={(v) =>
              void update(Boolean(coverage.active), v as "daily" | "weekly")
            }
          >
            <DropdownMenuRadioItem value="daily">每日</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="weekly">每周</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void update(!coverage.active)}>
            {coverage.active ? <Pause size={14} /> : <Play size={14} />}{" "}
            {coverage.active ? "暂停跟踪" : "恢复跟踪"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void remove()}>
            <Trash2 size={14} />
            移除跟踪
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
  );
}
