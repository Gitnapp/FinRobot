import { TasksProvider } from "./components/task-center";
import { LoadingScope } from "@gitnapp/ui/components/ui/loading";
import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, Link } from "react-router";
import {
  QueryClient,
  QueryClientProvider,
  useIsFetching,
} from "@tanstack/react-query";
import { TooltipProvider } from "@gitnapp/ui/components/ui/tooltip";
import { Toaster } from "@gitnapp/ui/components/ui/sonner";
import Shell from "./app/shell";
import { ErrorBoundary } from "./components/error-boundary";
import { Loading } from "./components/ui";
import "./styles.css";
import "@gitnapp/ui/patterns.css";

const MacroPage = lazy(() =>
  import("./app/context/context-page").then((m) => ({ default: m.MacroPage })),
);
const MacroDetailPage = lazy(() =>
  import("./app/context/context-page").then((m) => ({
    default: m.MacroDetailPage,
  })),
);
const CalendarPage = lazy(() =>
  import("./app/context/context-page").then((m) => ({
    default: m.CalendarPage,
  })),
);
const Market = lazy(() => import("./app/market/market-page"));
const Stock = lazy(() => import("./app/market/stock-page"));
const Coverage = lazy(() => import("./app/coverage/coverage-page"));
const Reports = lazy(() => import("./app/reports/reports-page"));
const Report = lazy(() => import("./app/reports/report-page"));
const Debug = lazy(() => import("./app/settings/debug-page"));
const Settings = lazy(() => import("./app/settings/settings-page"));
const client = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10000, retry: 1, refetchOnWindowFocus: false },
  },
});
function ProjectLoading({ children }: { children: React.ReactNode }) {
  const pending = useIsFetching({
    predicate: (query) => query.state.data === undefined,
  });
  return <LoadingScope active={pending > 0}>{children}</LoadingScope>;
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <ProjectLoading>
      <TooltipProvider>
        <BrowserRouter>
          <TasksProvider>
          <ErrorBoundary>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route element={<Shell />}>
                  <Route index element={<Market />} />
                  <Route path="stocks/:symbol" element={<Stock />} />
                  <Route path="coverage" element={<Coverage />} />
                  <Route path="coverage/:symbol" element={<Stock />} />
                  <Route path="macro" element={<MacroPage />} />
                  <Route path="macro/:metric" element={<MacroDetailPage />} />
                  <Route path="calendar" element={<CalendarPage />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="reports/:id" element={<Report />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="settings/debug" element={<Debug />} />
                  <Route
                    path="*"
                    element={
                      <div className="empty">
                        页面不存在<Link to="/">返回看板</Link>
                      </div>
                    }
                  />
                </Route>
              </Routes>
            </Suspense>
          </ErrorBoundary>
          </TasksProvider>
        </BrowserRouter>
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </ProjectLoading>
  </QueryClientProvider>,
);
