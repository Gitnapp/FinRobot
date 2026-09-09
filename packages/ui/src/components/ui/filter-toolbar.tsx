"use client";
import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { Input } from "./input";

export function FilterToolbar({
  leading,
  filters,
  search,
  roomy = false,
}: {
  roomy?: boolean;
  leading?: ReactNode;
  filters?: ReactNode;
  search: {
    value: string;
    onChange: (value: string) => void;
    label: string;
    placeholder?: string;
  };
}) {
  return (
    <div className={`filter-toolbar${roomy ? " filter-toolbar-roomy" : ""}`}>
      {leading && <div className="filter-toolbar-leading">{leading}</div>}
      <div className="filter-toolbar-trailing">
        {filters}
        <div className="search-field filter-toolbar-search">
          <Search size={15} aria-hidden="true" />
          <Input
            type="search"
            aria-label={search.label}
            placeholder={search.placeholder || "搜索"}
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
