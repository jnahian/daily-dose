import type { ReactNode } from 'react';

interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

export function DataTable<T extends { id: string }>({ columns, rows, onRowClick, emptyMessage = 'No data' }: DataTableProps<T>) {
  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
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
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-white/30 text-sm">
                {emptyMessage}
              </td>
            </tr>
          ) : rows.map(row => (
            <tr
              key={row.id}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-white/5 last:border-0 transition-colors ${onRowClick ? 'cursor-pointer hover:bg-white/[0.03]' : ''}`}
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
    </div>
  );
}
