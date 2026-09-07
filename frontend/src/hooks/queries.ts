import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Asset, Detail, FullReport, Report, Settings } from "../types";

export const useAssets = () =>
  useQuery({
    queryKey: ["assets"],
    queryFn: () => api<Asset[]>("/assets"),
    refetchInterval: 10000,
  });
export const useDetail = (symbol: string) =>
  useQuery({
    queryKey: ["detail", symbol],
    enabled: Boolean(symbol),
    queryFn: () => api<Detail>(`/assets/${symbol}`),
    refetchInterval: (query) =>
      query.state.data?.reports.some(
        (r) => r.status === "running" || r.status === "queued",
      )
        ? 2500
        : 15000,
  });
export const useReports = () =>
  useQuery({
    queryKey: ["reports"],
    queryFn: () => api<Report[]>("/reports"),
    refetchInterval: 3000,
  });
export const useReport = (id: string) =>
  useQuery({
    queryKey: ["report", id],
    queryFn: () => api<FullReport>(`/reports/${id}`),
    refetchInterval: (q) =>
      q.state.data?.status === "completed" || q.state.data?.status === "failed"
        ? false
        : 2500,
  });
export const useSettings = () =>
  useQuery({
    queryKey: ["settings"],
    queryFn: () => api<Settings>("/settings"),
  });
export function useRefresh() {
  const client = useQueryClient();
  return () => client.invalidateQueries();
}
