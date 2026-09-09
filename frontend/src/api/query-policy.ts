import { QueryClient,type Query } from "@tanstack/react-query";
import { ApiError } from "./client";

export const POLL = {
  active: 1_500,
  market: 30_000,
  snapshots: 60_000,
  tasksIdle: 15_000,
  diagnostics: 5_000,
  health: 300_000,
} as const;
export const CACHE = {
  market: 15_000,
  snapshots: 30_000,
  reference: 300_000,
  signals: 900_000,
  inactive: 30 * 60_000,
} as const;
export const isActiveTask = (value?: { status?: string }) =>
  value?.status === "queued" || value?.status === "running";
export const isRefreshingSnapshot = (value?: {
  state?: string;
  refreshing?: boolean;
  recommendation_state?: string;
}) =>
  value?.state === "pending" ||
  value?.refreshing === true ||
  value?.recommendation_state === "pending";

export function retryRead(attempt: number, error: Error) {
  if (error.name === "AbortError" || error.name === "TimeoutError")
    return false;
  return attempt < 1 && (!(error instanceof ApiError) || error.status >= 500);
}
const snapshotPoll = (query: Query) =>
  isRefreshingSnapshot(
    query.state.data as Parameters<typeof isRefreshingSnapshot>[0],
  )
    ? POLL.active
    : POLL.snapshots;
const mapPoll = (query: Query) =>
  Object.values(
    (query.state.data || {}) as Record<
      string,
      Parameters<typeof isRefreshingSnapshot>[0]
    >,
  ).some(isRefreshingSnapshot)
    ? POLL.active
    : POLL.snapshots;

/** One policy per data family. Only task receipts continue polling in hidden tabs. */
export function createQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: CACHE.reference,
        gcTime: CACHE.inactive,
        retry: retryRead,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchIntervalInBackground: false,
      },
      mutations: { retry: false },
    },
  });
  for (const key of ["assets", "detail", "coverage"])
    client.setQueryDefaults([key], {
      staleTime: CACHE.market,
      refetchInterval: POLL.market,
    });
  for (const key of [
    "model",
    "assumptions",
    "evidence",
    "research-leads",
    "peers",
    "disclosures",
  ])
    client.setQueryDefaults([key], {
      staleTime: CACHE.snapshots,
      refetchInterval: snapshotPoll,
    });
  for (const key of ["coverage-market", "macro-context"])
    client.setQueryDefaults([key], {
      staleTime: CACHE.snapshots,
      refetchInterval: mapPoll,
    });
  client.setQueryDefaults(["full-history"], {
    staleTime: CACHE.snapshots,
    refetchInterval: POLL.snapshots,
  });
  client.setQueryDefaults(["signals"], {
    staleTime: CACHE.signals,
    refetchInterval: CACHE.signals,
  });
  client.setQueryDefaults(["reports"], {
    staleTime: CACHE.market,
    refetchInterval: (query) =>
      ((query.state.data || []) as { status: string }[]).some(isActiveTask)
        ? POLL.active
        : POLL.tasksIdle,
  });
  client.setQueryDefaults(["report"], {
    staleTime: CACHE.reference,
    refetchInterval: (query) =>
      isActiveTask(query.state.data as { status: string })
        ? POLL.active
        : false,
  });
  client.setQueryDefaults(["tasks"], {
    staleTime: 0,
    refetchIntervalInBackground: true,
    refetchInterval: (query) =>
      ((query.state.data || []) as { status: string }[]).some(isActiveTask)
        ? POLL.active
        : POLL.tasksIdle,
  });
  client.setQueryDefaults(["task"], {
    staleTime: 0,
    refetchIntervalInBackground: true,
    refetchInterval: (query) =>
      !query.state.data || isActiveTask(query.state.data as { status: string })
        ? POLL.active
        : false,
  });
  client.setQueryDefaults(["source-health"], {
    staleTime: CACHE.reference,
    refetchInterval: POLL.health,
  });
  client.setQueryDefaults(["debug-plans"], {
    staleTime: 0,
    refetchInterval: POLL.diagnostics,
  });
  client.setQueryDefaults(["debug-logs"], {
    staleTime: 0,
    refetchInterval: (query) => (query.queryKey[1] ? false : POLL.diagnostics),
  });
  client.setQueryDefaults(["calendar-months"], {
    staleTime: CACHE.snapshots,
    refetchInterval: (query) =>
      (
        query.state.data as
          | {
              pages: { snapshot: Parameters<typeof isRefreshingSnapshot>[0] }[];
            }
          | undefined
      )?.pages.some((page) => isRefreshingSnapshot(page.snapshot))
        ? POLL.active
        : false,
  });
  client.setQueryDefaults(["catalog"], { staleTime: CACHE.reference });
  return client;
}

export const INVALIDATE = {
  settings: ["settings"],
  watchlists: ["watchlists", "assets"],
  tracking: [
    "assets",
    "coverage-directory",
    "coverage-market",
    "coverage",
    "detail",
    "model",
    "assumptions",
    "tasks",
  ],
  assumptions: ["assumptions", "model", "detail"],
  research: ["tasks", "reports", "assets", "detail", "coverage-directory"],
} as const;
export function invalidateDomain(
  client: QueryClient,
  domain: keyof typeof INVALIDATE,
) {
  return Promise.all(
    INVALIDATE[domain].map((key) =>
      client.invalidateQueries({ queryKey: [key] }),
    ),
  );
}
