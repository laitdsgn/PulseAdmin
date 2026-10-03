import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, LoadingRows } from "./states";

export type Column<T> = {
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  onRowClick?: (row: T) => void;
  selectedKey?: string | number | null;
};

/** A table over a cursor-paginated list (see useInfiniteList). */
export function DataTable<T>(props: Props<T>) {
  const t = useT();
  const { columns, rows, rowKey, onRowClick, selectedKey } = props;

  if (props.isLoading) return <LoadingRows />;
  if (props.error && rows.length === 0) return <ErrorState error={props.error} onRetry={props.onRetry} />;

  return (
    <div className="rounded-lg border">
      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c, i) => (
                <TableHead key={i} className={c.className}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const key = rowKey(row);
              return (
                <TableRow
                  key={key}
                  data-state={selectedKey === key ? "selected" : undefined}
                  className={cn(onRowClick && "cursor-pointer")}
                  onClick={onRowClick && (() => onRowClick(row))}
                  onKeyDown={
                    onRowClick &&
                    ((e) => {
                      if (e.key === "Enter") onRowClick(row);
                    })
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  {columns.map((c, i) => (
                    <TableCell key={i} className={c.className}>
                      {c.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {props.hasNextPage && (
        <div className="flex justify-center border-t p-2">
          <Button variant="ghost" size="sm" disabled={props.isFetchingNextPage} onClick={props.fetchNextPage}>
            {props.isFetchingNextPage ? t("common.loading") : t("common.loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Spreads a useInfiniteList result into DataTable props. */
export const listProps = <T,>(list: {
  items: T[];
  isLoading: boolean;
  error: unknown;
  refetch: () => unknown;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
}) => ({
  rows: list.items,
  isLoading: list.isLoading,
  error: list.error,
  onRetry: () => void list.refetch(),
  hasNextPage: list.hasNextPage,
  isFetchingNextPage: list.isFetchingNextPage,
  fetchNextPage: () => void list.fetchNextPage(),
});
