import { RefreshNotice } from "../../components/layout/async-content";
import { AddButton } from "@gitnapp/ui/components/ui/actions";
import { CardGrid } from "@gitnapp/ui/components/ui/data-layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@gitnapp/ui/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { Check, Pencil } from "lucide-react";
import { useState } from "react";
import { api } from "../../api/client";
import { AddAsset } from "../../components/add-asset";
import { AnimatedSwitcher } from "../../components/animated-switcher";
import {
  CoverageAssetCard,
  UnmatchedSecurities,
  type CoverageQuote,
  type CoveredCompany,
} from "../../components/coverage-asset-card";
import type { Snapshot } from "../../components/intelligence";
import { FilterToolbar } from "../../components/layout/filter-toolbar";
import {
  Button,
  Empty,
  ErrorState,
  Loading,
  PageHeader,
} from "../../components/ui";
export default function CoveragePage() {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const directory = useQuery({
    queryKey: ["coverage-directory"],
    queryFn: ({ signal }) =>
      api<CoveredCompany[]>("/coverage-directory", { signal }),
  });
  const quotes = useQuery({
    queryKey: ["coverage-market"],
    queryFn: ({ signal }) =>
      api<Record<string, Snapshot<CoverageQuote>>>("/coverage-market", {
        signal,
      }),
  });
  const [list, setList] = useState("all");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const term = search.trim().toLocaleLowerCase();
  if (directory.isPending) return <Loading />;
  if (directory.error && !directory.data)
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
      [
        c.name,
        c.symbol,
        c.listing?.ticker,
        c.symbol ? quotes.data?.[c.symbol]?.data?.quote.name : "",
      ].some((value) => value?.toLocaleLowerCase().includes(term)) &&
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
      <FilterToolbar roomy
        leading={
          <>
            {" "}
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
            <AddButton
              attention="quiet"
              iconOnly
              label="添加跟踪标的"
              onClick={() => setAdding(true)}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label={editing ? "完成编辑" : "编辑跟踪条目"}
              aria-pressed={editing}
              onClick={() => setEditing((value) => !value)}
            >
              {editing ? <Check size={16} /> : <Pencil size={16} />}
            </Button>
            <span className="muted">{members.length} 家公司</span>
          </>
        }
        filters={
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
        }
        search={{
          value: search,
          onChange: setSearch,
          label: "搜索标的跟踪标的",
        }}
      />
      <AddAsset open={adding} onOpenChange={setAdding} destination="coverage" />
      {pending && <Loading />}
      {quotes.error && !quotes.data && (
        <ErrorState error={quotes.error} retry={() => void quotes.refetch()} />
      )}
      <RefreshNotice error={quotes.data ? quotes.error : null} retry={()=>void quotes.refetch()}/>
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
