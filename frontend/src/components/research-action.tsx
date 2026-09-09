import {
Dialog,
DialogContent,
DialogDescription,
DialogHeader,
DialogTitle,
} from "@gitnapp/ui/components/ui/dialog";
import { Label } from "@gitnapp/ui/components/ui/label";
import { Textarea } from "@gitnapp/ui/components/ui/textarea";
import { FileText } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useRefresh } from "../hooks/queries";
import { useSubmitTask } from "../hooks/submit-task";
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
  const refresh = useRefresh("research");
  const submitTask = useSubmitTask();
  const navigate = useNavigate();

  async function run() {
    setBusy(true);
    try {
      await submitTask({
        kind: "research",
        symbol,
        focus,
      });
      setOpen(false);
      void refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        variant="outline"
        onClick={() =>
          active ? navigate(`/reports/${active.id}`) : setOpen(true)
        }
      >
        <FileText size={15} /> {active ? "查看进度" : "生成研报"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>生成研报</DialogTitle>
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
