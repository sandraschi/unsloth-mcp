import { ArrowDownUp, LayoutGrid, List, Search } from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
}

interface ListToolbarProps {
  /** testid prefix, e.g. "jobs" -> jobs-search, jobs-sort, jobs-count ... */
  id: string;
  query: string;
  onQuery: (q: string) => void;
  searchPlaceholder?: string;
  sortKey: string;
  onSortKey: (k: string) => void;
  sortOptions: { value: string; label: string }[];
  onToggleSortDir: () => void;
  filterValue?: string;
  filterOptions?: FilterOption[];
  onFilter?: (v: string) => void;
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
  total: number;
  view?: "grid" | "list";
  onView?: (v: "grid" | "list") => void;
}

export function ListToolbar(props: ListToolbarProps) {
  const { id } = props;
  return (
    <div className="mb-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={props.query}
            onChange={(e) => props.onQuery(e.target.value)}
            placeholder={props.searchPlaceholder ?? "Search..."}
            data-testid={`${id}-search`}
            data-list-search
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-1.5 pl-8 pr-2 text-sm placeholder:text-zinc-500"
          />
        </div>
        {props.filterOptions && (
          <select
            value={props.filterValue}
            onChange={(e) => props.onFilter?.(e.target.value)}
            data-testid={`${id}-filter`}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm"
          >
            {props.filterOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        <select
          value={props.sortKey}
          onChange={(e) => props.onSortKey(e.target.value)}
          data-testid={`${id}-sort`}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm"
        >
          {props.sortOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          onClick={props.onToggleSortDir}
          data-testid={`${id}-sort-dir`}
          title="Reverse sort order"
          className="rounded-lg border border-zinc-700 px-2 py-1.5 text-sm hover:bg-zinc-800"
        >
          <ArrowDownUp className="h-4 w-4" />
        </button>
        {props.onView && (
          <button
            onClick={() => props.onView?.(props.view === "grid" ? "list" : "grid")}
            data-testid={`${id}-view`}
            title="Toggle grid/list view"
            className="rounded-lg border border-zinc-700 px-2 py-1.5 text-sm hover:bg-zinc-800"
          >
            {props.view === "grid" ? (
              <List className="h-4 w-4" />
            ) : (
              <LayoutGrid className="h-4 w-4" />
            )}
          </button>
        )}
        <span data-testid={`${id}-count`} className="ml-auto text-sm text-zinc-300">
          {props.total} item{props.total === 1 ? "" : "s"}
        </span>
      </div>
      {props.pageCount > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => props.onPage(props.page - 1)}
            disabled={props.page <= 1}
            data-testid={`${id}-prev`}
            className="rounded-lg border border-zinc-700 px-3 py-1 hover:bg-zinc-800 disabled:opacity-50"
          >
            Prev
          </button>
          <span data-testid={`${id}-page`} className="text-zinc-300">
            Page {props.page} / {props.pageCount}
          </span>
          <button
            onClick={() => props.onPage(props.page + 1)}
            disabled={props.page >= props.pageCount}
            data-testid={`${id}-next`}
            className="rounded-lg border border-zinc-700 px-3 py-1 hover:bg-zinc-800 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
