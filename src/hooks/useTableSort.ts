import { useState, useMemo, useCallback } from 'react';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig<T> {
  key: keyof T | null;
  direction: SortDirection;
}

export interface UseTableSortResult<T> {
  sortedData: T[];
  sortConfig: SortConfig<T>;
  requestSort: (key: keyof T) => void;
  getSortDirection: (key: keyof T) => SortDirection;
  clearSort: () => void;
}

type CompareFn<T> = (a: T, b: T, key: keyof T) => number;

const defaultCompare = <T,>(a: T, b: T, key: keyof T): number => {
  const aVal = a[key];
  const bVal = b[key];

  // Handle null/undefined
  if (aVal == null && bVal == null) return 0;
  if (aVal == null) return 1;
  if (bVal == null) return -1;

  // Handle numbers
  if (typeof aVal === 'number' && typeof bVal === 'number') {
    return aVal - bVal;
  }

  // Handle dates
  if (aVal instanceof Date && bVal instanceof Date) {
    return aVal.getTime() - bVal.getTime();
  }

  // Handle date strings (ISO format)
  if (typeof aVal === 'string' && typeof bVal === 'string') {
    const dateA = Date.parse(aVal);
    const dateB = Date.parse(bVal);
    if (!isNaN(dateA) && !isNaN(dateB) && aVal.includes('-')) {
      return dateA - dateB;
    }
  }

  // Handle strings
  const strA = String(aVal).toLowerCase();
  const strB = String(bVal).toLowerCase();
  return strA.localeCompare(strB, 'pt-BR');
};

export function useTableSort<T>(
  data: T[],
  initialConfig?: Partial<SortConfig<T>>,
  customCompare?: CompareFn<T>
): UseTableSortResult<T> {
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>({
    key: initialConfig?.key ?? null,
    direction: initialConfig?.direction ?? null,
  });

  const compare = customCompare ?? defaultCompare;

  const requestSort = useCallback((key: keyof T) => {
    setSortConfig((current) => {
      if (current.key === key) {
        // Cycle: asc -> desc -> null
        if (current.direction === 'asc') {
          return { key, direction: 'desc' };
        }
        if (current.direction === 'desc') {
          return { key: null, direction: null };
        }
      }
      return { key, direction: 'asc' };
    });
  }, []);

  const getSortDirection = useCallback(
    (key: keyof T): SortDirection => {
      if (sortConfig.key === key) {
        return sortConfig.direction;
      }
      return null;
    },
    [sortConfig]
  );

  const clearSort = useCallback(() => {
    setSortConfig({ key: null, direction: null });
  }, []);

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return data;
    }

    return [...data].sort((a, b) => {
      const result = compare(a, b, sortConfig.key!);
      return sortConfig.direction === 'desc' ? -result : result;
    });
  }, [data, sortConfig, compare]);

  return {
    sortedData,
    sortConfig,
    requestSort,
    getSortDirection,
    clearSort,
  };
}
