import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { TaskState } from "@gitnapp/ui/components/ui/task-progress";
export type Task = {
  id: string;
  kind: string;
  title: string;
  subject: { symbol: string; name: string };
  status: TaskState;
  steps: string[];
  completed_steps: number;
  queue_position: number | null;
  error: string | null;
  result_url: string | null;
  created_at: string;
  completed_at: string | null;
};
export const useTask = (id: string) =>
  useQuery({
    queryKey: ["task", id],
    enabled: Boolean(id),
    queryFn: () => api<Task>(`/tasks/${id}`, { cache: "no-store" }),
    refetchInterval: (q) =>
      q.state.data?.status === "completed" || q.state.data?.status === "failed"
        ? false
        : 1500,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: "always",
  });
export const useTasks = () =>
  useQuery({
    queryKey: ["tasks"],
    queryFn: () => api<Task[]>("/tasks", { cache: "no-store" }),
    refetchInterval: (q) =>
      q.state.data?.some((t) => t.status === "running" || t.status === "queued")
        ? 1500
        : 15000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: "always",
  });
