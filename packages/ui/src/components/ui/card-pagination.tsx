"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "./button";
import { Pagination, PaginationContent, PaginationItem } from "./pagination";

export function useCardPage<T>(items: readonly T[], size: number, scope: string) {
  const [state, setState] = useState({ scope, page: 0 });
  const count = Math.max(1, Math.ceil(items.length / size));
  const page = state.scope === scope ? Math.min(state.page, count - 1) : 0;
  return {
    items: items.slice(page * size, (page + 1) * size),
    page,
    count,
    offset: page * size,
    setPage: (page: number) => setState({ scope, page: Math.max(0, Math.min(page, count - 1)) }),
  };
}
export function CardPagination({
  page,
  count,
  onChange,
  label,
}: {
  page: number;
  count: number;
  onChange: (page: number) => void;
  label: string;
}) {
  return (
    <div className="card-pagination-slot">
      {count > 1 && (
        <Pagination aria-label={label}>
          <PaginationContent>
            <PaginationItem>
              <Button
                variant="outline"
                size="icon"
                aria-label="上一页"
                disabled={page === 0}
                onClick={() => onChange(page - 1)}
              >
                <ChevronLeft size={14} />
              </Button>
            </PaginationItem>
            <PaginationItem>
              <span className="card-page-number" role="status">
                {page + 1} / {count}
              </span>
            </PaginationItem>
            <PaginationItem>
              <Button
                variant="outline"
                size="icon"
                aria-label="下一页"
                disabled={page >= count - 1}
                onClick={() => onChange(page + 1)}
              >
                <ChevronRight size={14} />
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
