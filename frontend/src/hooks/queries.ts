import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { invalidateDomain, type INVALIDATE } from "../api/query-policy";
import type { Asset, Detail, FullReport, Report, Settings } from "../types";

export const useAssets = (listId?: string) =>
  useQuery({
    queryKey: ["assets", listId],
    queryFn: ({ signal }) =>
      api<Asset[]>(listId ? "/assets?list_id=" + listId : "/assets", {
        signal,
      }),
  });
export const useDetail = (symbol: string, coverage = false) =>
  useQuery({
    queryKey: ["detail", symbol, coverage],
    enabled: Boolean(symbol),
    queryFn: ({ signal }) =>
      api<Detail>(
        `/data/${symbol}/detail?context=${coverage ? "coverage" : "stocks"}`,
        { signal },
      ),
  });
export const useReports = () =>
  useQuery({
    queryKey: ["reports"],
    queryFn: ({ signal }) => api<Report[]>("/reports", { signal }),
  });
export const useReport = (id: string, symbol?: string, enabled = true) =>
  useQuery({
    queryKey: ["report", id],
    enabled: Boolean(id) && enabled,
    queryFn: ({ signal }) =>
      api<FullReport>(
        symbol ? `/data/${symbol}/report?report_id=${id}` : `/reports/${id}`,
        { signal, cache: "no-store" },
      ),
  });
export const useSettings = () =>
  useQuery({
    queryKey: ["settings"],
    queryFn: ({ signal }) => api<Settings>("/settings", { signal }),
  });
export function useRefresh(domain: keyof typeof INVALIDATE) {
  const client = useQueryClient();
  return () => invalidateDomain(client, domain);
}

export const useWatchlists = () =>
  useQuery({
    queryKey: ["watchlists"],
    queryFn: ({ signal }) =>
      api<import("../types").Watchlist[]>("/watchlists", { signal }),
  });
export const useCoverage = () =>
  useQuery({
    queryKey: ["coverage"],
    queryFn: ({ signal }) => api<Detail[]>("/coverage", { signal }),
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
  });
