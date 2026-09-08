import { LoadingState } from "@gitnapp/ui/components/ui/loading";
import { useState } from "react";
import { useNavigate } from "react-router";
import { FilePlus2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@gitnapp/ui/components/ui/dialog";
import { Textarea } from "@gitnapp/ui/components/ui/textarea";
import { Label } from "@gitnapp/ui/components/ui/label";
import { toast } from "sonner";
import { write } from "../api/client";
import { useRefresh } from "../hooks/queries";
import type { Report } from "../types";
import { Button } from "./ui";

export function ResearchAction({
  symbol,
  active,
}: {
  symbol: string;
  active?: Report | null;
}) {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useRefresh();
  const navigate = useNavigate();

  async function run() {
    setBusy(true);
    try {
      const job = await write<Report>("/research", { symbol, focus });
      await refresh();
      setOpen(false);
      navigate(`/reports/${job.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        onClick={() =>
          active ? navigate(`/reports/${active.id}`) : setOpen(true)
        }
      >
        {active ? <LoadingState /> : <FilePlus2 size={15} />}{" "}
        {active ? "查看进度" : "生成研报"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>研究 {symbol}</DialogTitle>
            <DialogDescription>分析业务、财务、估值与风险。</DialogDescription>
          </DialogHeader>
          <Label htmlFor="research-focus">研究重点（可选）</Label>
          <Textarea
            id="research-focus"
            placeholder="例如：增长的可持续性、资本开支与现金流"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            maxLength={1200}
          />
          <div className="dialog-footer">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button disabled={busy} onClick={() => void run()}>
              {busy ? "提交中…" : "生成研报"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
