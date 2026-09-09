import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { ListTodo } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@gitnapp/ui/components/ui/popover";
import { TaskProgress } from "@gitnapp/ui/components/ui/task-progress";
import { Button } from "./ui";
import { useTasks, type Task } from "../hooks/tasks";
import { write } from "../api/client";
import { toast } from "sonner";
const TaskContext = createContext<(task: Task) => void>(() => {});
export const useTaskReceipt = () => useContext(TaskContext);
export function TasksProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const query = useTasks();
  const client = useQueryClient();
  const navigate = useNavigate();
  const previous = useRef<Record<string, string>>({});
  const [retrying, setRetrying] = useState<string | null>(null);
  const tasks = query.data || [];
  const active = tasks.filter(
    (t) => t.status === "queued" || t.status === "running",
  );
  function receive(task: Task) {
    client.setQueryData(["task", task.id], task);
    client.setQueryData<Task[]>(["tasks"], (old) => [
      task,
      ...(old || []).filter((t) => t.id !== task.id),
    ]);
    setOpen(true);
    void client.invalidateQueries({ queryKey: ["tasks"] });
  }
  useEffect(() => {
    for (const task of tasks) {
      const prior = previous.current[task.id];
      if (
        prior &&
        prior !== task.status &&
        (task.status === "completed" || task.status === "failed")
      ) {
        void client.invalidateQueries({ queryKey: ["report", task.id] });
        void client.invalidateQueries({ queryKey: ["reports"] });
        toast(task.status === "completed" ? "研报已完成" : "研究任务未完成", {
          description: task.subject.name,
          position: "bottom-left",
          action: {
            label: "查看",
            onClick: () => navigate(`/reports/${task.id}`),
          },
        });
      }
      previous.current[task.id] = task.status;
    }
  }, [tasks, client, navigate]);
  async function retry(id: string) {
    setRetrying(id);
    try {
      receive(await write<Task>(`/tasks/${id}/retry`, {}));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRetrying(null);
    }
  }
  return (
    <TaskContext.Provider value={receive}>
      {children}
      <div className={`task-center${active.length ? " is-active" : ""}`}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={active.length ? `任务中心，${active.length} 个进行中` : "任务中心"} title="任务中心">
              <ListTodo size={16} />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="end"
            className="w-[min(360px,calc(100vw-32px))] p-3"
          >
            <h2 className="mb-3 text-sm font-semibold">任务</h2>
            <div className="task-center-list">
              {query.isError && (
                <Button variant="ghost" onClick={() => void query.refetch()}>
                  重新获取任务
                </Button>
              )}
              {!tasks.length && (
                <p className="p-3 text-sm text-muted-foreground">暂无任务</p>
              )}
              {tasks.map((t) => (
                <TaskProgress
                  key={t.id}
                  compact
                  title={t.subject.name}
                  status={t.status}
                  steps={t.steps}
                  completedSteps={t.completed_steps}
                  queuePosition={t.queue_position}
                  error={t.error}
                  actions={
                    <>
                      {t.status === "failed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={retrying === t.id}
                          onClick={() => void retry(t.id)}
                        >
                          重试
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          client.setQueryData(["task", t.id], t);
                          navigate(`/reports/${t.id}`);
                          setOpen(false);
                        }}
                      >
                        {t.status === "completed" ? "查看报告" : "查看进度"}
                      </Button>
                    </>
                  }
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </TaskContext.Provider>
  );
}
