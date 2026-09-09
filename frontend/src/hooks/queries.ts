import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Asset, Detail, FullReport, Report, Settings } from "../types";

export const useAssets = (listId?: string) =>
  useQuery({
    queryKey: ["assets", listId],
    queryFn: () =>
      api<Asset[]>(listId ? "/assets?list_id=" + listId : "/assets"),
    refetchInterval: 10000,
  });
export const useDetail = (symbol: string, coverage = false) =>
  useQuery({
    queryKey: ["detail", symbol, coverage],
    enabled: Boolean(symbol),
    queryFn: () =>
      api<Detail>(`/data/${symbol}/detail?context=${coverage ? "coverage" : "stocks"}`),
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
export const useReport = (id: string, symbol?: string, enabled = true) =>
  useQuery({
    queryKey: ["report", id],
    enabled: Boolean(id) && enabled,
    queryFn: () => api<FullReport>(symbol ? `/data/${symbol}/report?report_id=${id}` : `/reports/${id}`, { cache: "no-store" }),
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
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

export const useWatchlists = () =>
  useQuery({
    queryKey: ["watchlists"],
    queryFn: () => api<import("../types").Watchlist[]>("/watchlists"),
  });
export const useCoverage = () =>
  useQuery({
    queryKey: ["coverage"],
    queryFn: () => api<Detail[]>("/coverage"),
    refetchInterval: 10000,
  });

export const usePriceHistory = (symbol: string) =>
  useQuery({
    queryKey: ["full-history", symbol],
    enabled: Boolean(symbol),
    queryFn: async ({ signal }) => {
      const result = await api<{ data: import("../types").History | null }>(
        `/data/${symbol}/prices`,
        { signal },
      );
      if (!result.data) throw new Error("历史行情暂不可用");
      return result.data;
    },
    staleTime: 21600000,
    retry: false,
  });
