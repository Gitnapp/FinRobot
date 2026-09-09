import type { TaskState } from "@gitnapp/ui/components/ui/task-progress";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
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
    queryFn: ({ signal }) =>
      api<Task>(`/tasks/${id}`, { signal, cache: "no-store" }),
  });
export const useTasks = () =>
  useQuery({
    queryKey: ["tasks"],
    queryFn: ({ signal }) =>
      api<Task[]>("/tasks", { signal, cache: "no-store" }),
  });
