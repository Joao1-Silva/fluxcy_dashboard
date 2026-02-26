'use client';

import { useMemo, useState } from 'react';
import { ArrowDownUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumeric } from '@/lib/time';
import type { TableRow } from '@/types/dashboard';

type Column = {
  key: string;
  label: string;
  unit?: string;
};

type DataTablePanelProps = {
  title: string;
  rows: TableRow[];
  columns: Column[];
  loading?: boolean;
  pageSize?: number;
};

export function DataTablePanel({
  title,
  rows,
  columns,
  loading = false,
  pageSize = 8,
}: DataTablePanelProps) {
  const [page, setPage] = useState(0);
  const [desc, setDesc] = useState(true);

  const sorted = useMemo(() => {
    const cloned = [...rows];
    cloned.sort((a, b) => (desc ? b.time.localeCompare(a.time) : a.time.localeCompare(b.time)));
    return cloned;
  }, [rows, desc]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const paginated = sorted.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  return (
    <Card className="h-full">
      <CardHeader className="mb-2">
        <CardTitle>{title}</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setDesc((current) => !current)}>
          <ArrowDownUp className="mr-1 h-4 w-4" />
          Fecha
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading ? (
          <Skeleton className="h-56 w-full rounded-xl" />
        ) : (
          <div className="max-h-64 overflow-auto rounded-xl border border-slate-700/60">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="sticky top-0 z-10 bg-slate-900/95 text-xs uppercase tracking-wide text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left">Time</th>
                  {columns.map((column) => (
                    <th key={column.key} className="px-3 py-2 text-left">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((row, index) => (
                  <tr key={`${row.time}-${index}`} className="border-t border-slate-800/80 text-slate-200">
                    <td className="px-3 py-2 text-xs text-slate-400">{new Date(row.time).toLocaleString()}</td>
                    {columns.map((column) => (
                      <td key={`${row.time}-${column.key}`} className="px-3 py-2">
                        {typeof row[column.key] === 'number'
                          ? `${formatNumeric(row[column.key] as number)}${column.unit ? ` ${column.unit}` : ''}`
                          : row[column.key] || '--'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>
            Page {currentPage + 1} / {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage + 1 >= totalPages}
              onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


