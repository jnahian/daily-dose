import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  /** Text used for searching. Falls back to the raw `key` value on the row. */
  value?: (row: T) => string | number | null | undefined;
  /** Set false to exclude a column from search (e.g. an actions column). */
  searchable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  /** Show the search box. */
  searchable?: boolean;
  /** Rows per page. Pass 0 to disable pagination. */
  pageSize?: number;
  searchPlaceholder?: string;
  /** Per-row class, e.g. to dim rows that are no longer relevant. */
  rowClassName?: (row: T) => string;
}

const PAGE_SIZES = [10, 25, 50, 100];

function cellText<T>(col: Column<T>, row: T): string {
  const raw = col.value
    ? col.value(row)
    : (row as Record<string, unknown>)[col.key];
  if (raw === null || raw === undefined) return '';
  return String(raw);
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  onRowClick,
  emptyMessage = 'No data',
  searchable = true,
  pageSize: initialPageSize = 25,
  searchPlaceholder = 'Search…',
  rowClassName,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const paginated = pageSize > 0;
  // With a handful of rows there is nothing to search — keep the chrome out of
  // the way rather than showing a control that can't help.
  const showSearch = searchable && rows.length > 5;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    const cols = columns.filter(c => c.searchable !== false);
    return rows.filter(row =>
      cols.some(col => cellText(col, row).toLowerCase().includes(q))
    );
  }, [rows, query, columns]);

  const pageCount = paginated
    ? Math.max(1, Math.ceil(filtered.length / pageSize))
    : 1;

  // Deleting the last row on the final page, or narrowing the search, can
  // leave `page` past the end — clamp instead of rendering an empty table.
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const visible = useMemo(() => {
    if (!paginated) return filtered;
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize, paginated]);

  const showPager = paginated && filtered.length > pageSize;
  const firstShown = filtered.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastShown = Math.min(page * pageSize, filtered.length);

  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
      {showSearch && (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="search"
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(1); }}
              placeholder={searchPlaceholder}
              aria-label="Search table"
              className="w-full bg-[#0d1117] border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#00CFFF]/40"
            />
          </div>
          {query && (
            <span className="text-xs text-white/40 whitespace-nowrap">
              {filtered.length} of {rows.length}
            </span>
          )}
          {paginated && rows.length > PAGE_SIZES[0] && (
            <label className="ml-auto flex items-center gap-2 text-xs text-white/40">
              <span className="sr-only">Rows per page</span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="bg-[#0d1117] border border-white/10 rounded-lg px-2 py-1 text-xs text-white/70 focus:outline-none"
              >
                {PAGE_SIZES.map(n => <option key={n} value={n}>{n} / page</option>)}
              </select>
            </label>
          )}
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            {columns.map(col => (
              <th key={col.key} className="text-left px-4 py-3 text-white/40 font-medium text-xs uppercase tracking-wide">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-white/30 text-sm">
                {query ? `No matches for “${query}”` : emptyMessage}
              </td>
            </tr>
          ) : visible.map(row => (
            <tr
              key={row.id}
              onClick={() => onRowClick?.(row)}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={onRowClick ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onRowClick(row);
                }
              } : undefined}
              className={`border-b border-white/5 last:border-0 transition-colors ${onRowClick ? 'cursor-pointer hover:bg-white/[0.03]' : ''} ${rowClassName?.(row) ?? ''}`}
            >
              {columns.map(col => (
                <td key={col.key} className="px-4 py-3 text-white/80">
                  {col.render ? col.render(row) : (row as Record<string, unknown>)[col.key] as ReactNode}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {showPager && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
          <span className="text-xs text-white/40 tabular-nums">
            {firstShown}–{lastShown} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Previous page"
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5 disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-white/50 px-2 tabular-nums">
              {page} / {pageCount}
            </span>
            <button
              onClick={() => setPage(p => Math.min(pageCount, p + 1))}
              disabled={page === pageCount}
              aria-label="Next page"
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5 disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
