import { ReactNode } from 'react';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  actions?: (item: T) => ReactNode;
  keyExtractor?: (item: T, index: number) => string;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
}

export function Table<T>({ columns, data, actions, keyExtractor, emptyMessage = 'Nenhum dado encontrado.', emptyIcon }: TableProps<T>) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {columns.map((col, i) => (
                <th
                  key={i}
                  scope="col"
                  className={`py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground ${col.className ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
              {actions && (
                <th scope="col" className="relative py-3 px-4">
                  <span className="sr-only">Ações</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="px-4 py-12 text-center"
                >
                  <div className="flex flex-col items-center gap-2">
                    {emptyIcon && <div className="text-muted-foreground/40">{emptyIcon}</div>}
                    <p className="text-sm text-muted-foreground font-medium">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((item, rowIdx) => {
                const key = keyExtractor ? keyExtractor(item, rowIdx) : rowIdx.toString();
                return (
                  <tr key={key} className="transition-colors hover:bg-muted/30">
                    {columns.map((col, colIdx) => (
                      <td
                        key={colIdx}
                        className={`whitespace-nowrap py-3.5 px-4 text-sm text-foreground/80 ${col.className ?? ''}`}
                      >
                        {col.cell
                          ? col.cell(item)
                          : col.accessorKey
                          ? (item[col.accessorKey] as ReactNode)
                          : null}
                      </td>
                    ))}
                    {actions && (
                      <td className="relative whitespace-nowrap py-3.5 px-4 text-right text-sm font-medium">
                        {actions(item)}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
