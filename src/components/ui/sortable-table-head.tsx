import * as React from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SortDirection } from "@/hooks/useTableSort";

export interface SortableTableHeadProps
  extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortDirection?: SortDirection;
  onSort?: () => void;
  sortable?: boolean;
}

const SortableTableHead = React.forwardRef<
  HTMLTableCellElement,
  SortableTableHeadProps
>(({ className, children, sortDirection, onSort, sortable = true, ...props }, ref) => {
  const isSortable = sortable && onSort;

  return (
    <th
      ref={ref}
      className={cn(
        "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
        isSortable && "cursor-pointer select-none hover:bg-muted/50 transition-colors",
        className
      )}
      onClick={isSortable ? onSort : undefined}
      {...props}
    >
      <div className="flex items-center gap-1">
        <span>{children}</span>
        {isSortable && (
          <span className="inline-flex shrink-0">
            {sortDirection === 'asc' && (
              <ArrowUp className="h-4 w-4 text-primary" />
            )}
            {sortDirection === 'desc' && (
              <ArrowDown className="h-4 w-4 text-primary" />
            )}
            {!sortDirection && (
              <ArrowUpDown className="h-4 w-4 text-muted-foreground/50" />
            )}
          </span>
        )}
      </div>
    </th>
  );
});

SortableTableHead.displayName = "SortableTableHead";

export { SortableTableHead };
