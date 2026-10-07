import { useMemo, useRef, useState } from "react";

export interface SortDef<T> {
  label: string;
  /** Must produce the DEFAULT display order; the direction toggle reverses it. */
  compare: (a: T, b: T) => number;
}

export interface ListControlsOptions<T> {
  searchText: (item: T) => string;
  sorts: Record<string, SortDef<T>>;
  defaultSort: string;
  pageSize?: number;
}

export interface ListControls<T> {
  query: string;
  setQuery: (q: string) => void;
  sortKey: string;
  setSortKey: (k: string) => void;
  sortDir: 1 | -1;
  toggleSortDir: () => void;
  sortOptions: { value: string; label: string }[];
  page: number;
  setPage: (p: number) => void;
  pageCount: number;
  pageSize: number;
  total: number;
  rows: T[];
}

/** Client-side search + filter + sort + paginate + count for list pages. */
export function useListControls<T>(items: T[], opts: ListControlsOptions<T>): ListControls<T> {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState(opts.defaultSort);
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [page, setPage] = useState(1);
  const pageSize = opts.pageSize ?? 10;
  const { searchText, sorts, defaultSort } = opts;

  // Reset to page 1 when the query or sort changes (React-sanctioned
  // render-time adjustment: idempotent, StrictMode-safe).
  const resetKey = `${query}|${sortKey}`;
  const prevResetKey = useRef(resetKey);
  if (prevResetKey.current !== resetKey) {
    prevResetKey.current = resetKey;
    setPage(1);
  }

  const filtered = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return items;
    return items.filter((item) => {
      const hay = searchText(item).toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [items, query, searchText]);

  const sorted = useMemo(() => {
    const def = sorts[sortKey] ?? sorts[defaultSort];
    const out = [...filtered].sort(def.compare);
    if (sortDir === -1) out.reverse();
    return out;
  }, [filtered, sorts, sortKey, sortDir, defaultSort]);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const rows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  return {
    query,
    setQuery,
    sortKey,
    setSortKey,
    sortDir,
    toggleSortDir: () => setSortDir((d) => (d === 1 ? -1 : 1)),
    sortOptions: Object.entries(sorts).map(([value, def]) => ({ value, label: def.label })),
    page: safePage,
    setPage,
    pageCount,
    pageSize,
    total,
    rows,
  };
}
