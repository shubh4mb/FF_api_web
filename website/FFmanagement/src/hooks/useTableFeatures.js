import { useState, useMemo, useCallback } from 'react';

/**
 * Generic helper hook for table features: search, sort, filter, pagination.
 * Designed to be reusable across any admin table page.
 *
 * @param {Array} data - The full dataset
 * @param {Object} options - Configuration object
 * @param {string[]} options.searchableFields - Dot-notation paths to search (e.g. ['name', 'brandId.name'])
 * @param {{ key: string, direction: 'asc'|'desc' }} options.defaultSort - Initial sort config
 * @param {number} options.pageSize - Default rows per page (default: 10)
 * @param {{ key: string, label: string, options: Array<{label: string, value: any}> }[]} options.filters - Filter definitions
 *
 * @returns {Object} Table state and helpers
 */
export default function useTableFeatures(data = [], options = {}) {
  const {
    searchableFields = [],
    defaultSort = null,
    pageSize: defaultPageSize = 10,
    filters: filterDefs = [],
  } = options;

  // --- Search ---
  const [searchQuery, setSearchQuery] = useState('');

  // --- Sort ---
  const [sortConfig, setSortConfig] = useState(defaultSort); // { key, direction }

  const handleSort = useCallback((key) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        // Cycle: asc → desc → none
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        if (prev.direction === 'desc') return null;
      }
      return { key, direction: 'asc' };
    });
  }, []);

  // --- Filters ---
  const [activeFilters, setActiveFilters] = useState({}); // { [filterKey]: value }

  const setFilter = useCallback((key, value) => {
    setActiveFilters((prev) => {
      if (value === null || value === undefined || value === '') {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setActiveFilters({});
  }, []);

  // --- Pagination ---
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // Helper: resolve nested paths like 'brandId.name'
  const getNestedValue = useCallback((obj, path) => {
    if (!path) return undefined;
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  }, []);

  // --- Processing pipeline: search → filter → sort → paginate ---
  const processedData = useMemo(() => {
    let result = [...data];

    // 1. Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((row) =>
        searchableFields.some((field) => {
          const val = getNestedValue(row, field);
          return val != null && String(val).toLowerCase().includes(q);
        })
      );
    }

    // 2. Filter
    Object.entries(activeFilters).forEach(([key, filterValue]) => {
      const filterDef = filterDefs.find((f) => f.key === key);
      if (!filterDef) return;

      result = result.filter((row) => {
        const rowValue = getNestedValue(row, key);

        // Support custom match function
        if (filterDef.matchFn) {
          return filterDef.matchFn(rowValue, filterValue, row);
        }

        // Default: boolean or strict equality
        if (typeof rowValue === 'boolean') {
          return String(rowValue) === String(filterValue);
        }
        return String(rowValue).toLowerCase() === String(filterValue).toLowerCase();
      });
    });

    // 3. Sort
    if (sortConfig) {
      const { key, direction } = sortConfig;
      result.sort((a, b) => {
        let aVal = getNestedValue(a, key);
        let bVal = getNestedValue(b, key);

        // Handle nulls
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        // Numeric comparison
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return direction === 'asc' ? aVal - bVal : bVal - aVal;
        }

        // String comparison
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, searchQuery, searchableFields, activeFilters, filterDefs, sortConfig, getNestedValue]);

  // Reset to page 1 when filters/search change
  const totalFilteredCount = processedData.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / pageSize));

  // Auto-correct page if it goes out of range
  const safePage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return processedData.slice(start, start + pageSize);
  }, [processedData, safePage, pageSize]);

  // Wrapper to reset page on search/filter change
  const handleSearchChange = useCallback((q) => {
    setSearchQuery(q);
    setCurrentPage(1);
  }, []);

  const handleFilterChange = useCallback((key, value) => {
    setFilter(key, value);
    setCurrentPage(1);
  }, [setFilter]);

  const handlePageSizeChange = useCallback((size) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  return {
    // Search
    searchQuery,
    setSearchQuery: handleSearchChange,

    // Sort
    sortConfig,
    handleSort,

    // Filters
    activeFilters,
    setFilter: handleFilterChange,
    clearFilters: () => { clearFilters(); setCurrentPage(1); },
    filterDefs,

    // Pagination
    currentPage: safePage,
    totalPages,
    setCurrentPage,
    pageSize,
    setPageSize: handlePageSizeChange,

    // Data
    paginatedData,
    totalFilteredCount,
    totalCount: data.length,
  };
}
