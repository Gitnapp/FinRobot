import { CardGrid } from "@gitnapp/ui/components/ui/data-layout";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@gitnapp/ui/components/ui/select";
import { api, write } from "../../api/client";
import { useRefresh } from "../../hooks/queries";
import {
  Button,
  Loading,
  ErrorState,
  PageHeader,
  Empty,
} from "../../components/ui";
import {
  CoverageAssetCard,
  UnmatchedSecurities,
  type CoveredCompany,
  type CoverageQuote,
} from "../../components/coverage-asset-card";
import type { Snapshot } from "../../components/intelligence";
export default function CoveragePage() {
  const directory = useQuery({
    queryKey: ["coverage-directory"],
    queryFn: () => api<CoveredCompany[]>("/coverage-directory"),
  });
  const quotes = useQuery({
    queryKey: ["coverage-market"],
    queryFn: () =>
      api<Record<string, Snapshot<CoverageQuote>>>("/coverage-market"),
    refetchInterval: (q) =>
      Object.values(q.state.data || {}).some(
        (s) => s.state === "pending" || s.refreshing,
      )
        ? 1500
        : 30000,
    retry: false,
  });
  const [list, setList] = useState("all");
  const [filter, setFilter] = useState("all");
  if (directory.isPending) return <Loading />;
  if (directory.error)
    return (
      <ErrorState
        error={directory.error}
        retry={() => void directory.refetch()}
      />
    );
  const companies = directory.data || [];
  const members = companies.filter(
    (c) =>
      (list === "all" || c.scene === list) &&
      (filter === "all" ||
        (filter === "active"
          ? !!c.coverage?.active
          : c.coverage?.active === 0)),
  );
  const pending =
    quotes.isPending ||
    Object.values(quotes.data || {}).some(
      (s) => s.state === "pending" && !s.data,
    );
  return (
    <div className="page">
      <PageHeader title="持续跟踪">
        <Button variant="outline" asChild>
          <Link to="/">添加</Link>
        </Button>
      </PageHeader>
      <div className="coverage-list-picker">
        <Select value={list} onValueChange={setList}>
          <SelectTrigger aria-label="持续跟踪列表" className="w-[168px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            {Array.from(new Set(companies.map((c) => c.scene))).map((s) => (
              <SelectItem key={s} value={s}>
                {s === "其他" ? "自选" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="muted">{members.length} 家公司</span>
      </div>
      <div className="coverage-toolbar">
        <div className="segmented">
          {[
            ["all", "全部"],
            ["active", "跟踪中"],
            ["paused", "已暂停"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={filter === key ? "selected" : ""}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {pending && <Loading />}
      {quotes.error && (
        <ErrorState error={quotes.error} retry={() => void quotes.refetch()} />
      )}
      <CardGrid minWidth={300}>
        {members
          .filter((c) => c.symbol)
          .map((c) => (
            <CoverageAssetCard
              key={c.id}
              company={c}
              snapshot={c.symbol ? quotes.data?.[c.symbol] : undefined}
            />
          ))}
      </CardGrid>
      <UnmatchedSecurities companies={members.filter((c) => !c.symbol)} />
      {!members.length && <Empty>没有匹配的标的</Empty>}
    </div>
  );
}
