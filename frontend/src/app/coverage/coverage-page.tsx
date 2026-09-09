import { AddAsset } from "../../components/add-asset";
import { AnimatedSwitcher } from "../../components/animated-switcher";
import { AddButton } from "@gitnapp/ui/components/ui/actions";
import { CardGrid } from "@gitnapp/ui/components/ui/data-layout";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { Search, Pencil, Check } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@gitnapp/ui/components/ui/select";
import { api } from "../../api/client";
import {
  Button,
  Input,
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
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
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
  const [search, setSearch] = useState("");
  const term = search.trim().toLocaleLowerCase();
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
      [c.name, c.symbol, c.listing?.ticker, c.symbol ? quotes.data?.[c.symbol]?.data?.quote.name : ""].some(value => value?.toLocaleLowerCase().includes(term)) &&
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
      <PageHeader title="标的跟踪" />
      <div className="coverage-toolbar">
      <div className="coverage-list-picker">
        <Select value={list} onValueChange={setList}>
          <SelectTrigger aria-label="标的跟踪列表" className="w-[168px]">
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
        <AddButton attention="quiet" iconOnly label="添加跟踪标的" onClick={() => setAdding(true)} />
        <Button variant="ghost" size="icon" aria-label={editing ? "完成编辑" : "编辑跟踪条目"} aria-pressed={editing} onClick={() => setEditing(value => !value)}>{editing ? <Check size={16} /> : <Pencil size={16} />}</Button>
        <span className="muted">{members.length} 家公司</span>
      </div>
        <AnimatedSwitcher className="segmented">
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
        </AnimatedSwitcher>
        <div className="search-field coverage-search">
          <Search size={15} aria-hidden="true" />
          <Input type="search" aria-label="搜索标的跟踪标的" placeholder="搜索代码或公司" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <AddAsset open={adding} onOpenChange={setAdding} destination="coverage" />
      {pending && <Loading />}
      {quotes.error && (
        <ErrorState error={quotes.error} retry={() => void quotes.refetch()} />
      )}
      <CardGrid minWidth={300} className="coverage-cards">
        {members
          .filter((c) => c.symbol)
          .map((c) => (
            <CoverageAssetCard
              key={c.id}
              company={c}
              editing={editing}
              snapshot={c.symbol ? quotes.data?.[c.symbol] : undefined}
            />
          ))}
      </CardGrid>
      <UnmatchedSecurities companies={members.filter((c) => !c.symbol)} />
      {!members.length && <Empty>没有匹配的标的</Empty>}
    </div>
  );
}
