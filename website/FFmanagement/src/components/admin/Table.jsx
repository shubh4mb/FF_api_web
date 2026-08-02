import React, { useState, useRef, useEffect } from "react";
import { Search, SlidersHorizontal, ChevronUp, ChevronDown, ChevronsUpDown, MoreVertical, Columns3, X, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * ReusableAdminTable — Enhanced admin data table with optional features.
 *
 * BASIC USAGE (backwards compatible):
 *   <ReusableAdminTable columns={cols} data={data} actions={actions} />
 *
 * ENHANCED USAGE (with useTableFeatures hook):
 *   <ReusableAdminTable
 *     columns={cols} data={paginatedData} actions={actions}
 *     search={{ query, onChange }}
 *     sort={{ config, onSort }}
 *     filters={{ defs, active, onChange, onClear }}
 *     pagination={{ currentPage, totalPages, onPageChange, pageSize, onPageSizeChange, totalCount, filteredCount }}
 *     columnToggle={{ hiddenColumns, onToggle }}
 *     loading={false}
 *     pageOffset={0}  // (currentPage - 1) * pageSize for correct row numbering
 *   />
 */
export default function ReusableAdminTable({
  columns = [],
  data = [],
  actions = [],
  search,       // { query, onChange }
  sort,         // { config, onSort }
  filters,      // { defs, active, onChange, onClear }
  pagination,   // { currentPage, totalPages, onPageChange, pageSize, onPageSizeChange, totalCount, filteredCount }
  columnToggle, // { hiddenColumns, onToggle }
  loading = false,
  pageOffset = 0,
}) {
  const isEnhanced = !!(search || sort || filters || pagination);

  // --- Column Toggle State (managed internally if not provided externally) ---
  const [internalHidden, setInternalHidden] = useState(new Set());
  const hiddenColumns = columnToggle?.hiddenColumns ?? internalHidden;
  const onToggleColumn = columnToggle?.onToggle ?? ((accessor) => {
    setInternalHidden(prev => {
      const next = new Set(prev);
      next.has(accessor) ? next.delete(accessor) : next.add(accessor);
      return next;
    });
  });

  const visibleColumns = columns.filter(col => !hiddenColumns.has(col.accessor));

  // --- Dropdowns ---
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [openActionRow, setOpenActionRow] = useState(null);
  const columnMenuRef = useRef(null);
  const filterMenuRef = useRef(null);
  const actionMenuRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target)) setColumnMenuOpen(false);
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) setFilterMenuOpen(false);
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target)) setOpenActionRow(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const activeFilterCount = filters ? Object.keys(filters.active || {}).length : 0;

  // --- Sort icon helper ---
  const SortIcon = ({ columnKey }) => {
    if (!sort) return null;
    const { config } = sort;
    if (config?.key === columnKey) {
      return config.direction === 'asc'
        ? <ChevronUp className="w-3.5 h-3.5 text-sky-500" />
        : <ChevronDown className="w-3.5 h-3.5 text-sky-500" />;
    }
    return <ChevronsUpDown className="w-3.5 h-3.5 text-slate-300" />;
  };

  // --- Loading skeleton ---
  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-10 bg-slate-100 rounded-xl w-full" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 bg-slate-50 rounded-xl w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ====== TOOLBAR ====== */}
      {isEnhanced && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Search */}
          {search && (
            <div className="relative flex-1 w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search…"
                value={search.query}
                onChange={(e) => search.onChange(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400/40 focus:border-sky-400 transition-all placeholder:text-slate-400"
              />
              {search.query && (
                <button
                  onClick={() => search.onChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter button */}
            {filters && filters.defs.length > 0 && (
              <div className="relative" ref={filterMenuRef}>
                <button
                  onClick={() => setFilterMenuOpen(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-sm rounded-xl border transition-all ${
                    activeFilterCount > 0
                      ? 'bg-sky-50 border-sky-200 text-sky-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span className="hidden sm:inline">Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="ml-1 w-5 h-5 flex items-center justify-center rounded-full bg-sky-500 text-white text-[10px] font-bold">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {filterMenuOpen && (
                  <div className="absolute left-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-50 min-w-[240px] space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filters</span>
                      {activeFilterCount > 0 && (
                        <button
                          onClick={() => { filters.onClear(); setFilterMenuOpen(false); }}
                          className="text-xs text-rose-500 hover:text-rose-600 font-medium transition-colors"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                    {filters.defs.map((fd) => (
                      <div key={fd.key}>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">{fd.label}</label>
                        <select
                          value={filters.active[fd.key] ?? ''}
                          onChange={(e) => filters.onChange(fd.key, e.target.value || null)}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-400/40 focus:border-sky-400 transition-all"
                        >
                          <option value="">All</option>
                          {fd.options.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Column toggle button */}
            <div className="relative" ref={columnMenuRef}>
              <button
                onClick={() => setColumnMenuOpen(v => !v)}
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all"
              >
                <Columns3 className="w-4 h-4" />
                <span className="hidden sm:inline">Columns</span>
              </button>

              {columnMenuOpen && (
                <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 min-w-[200px] space-y-1">
                  <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Toggle Columns</span>
                  {columns.map((col) => (
                    <label
                      key={col.accessor}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={!hiddenColumns.has(col.accessor)}
                        onChange={() => onToggleColumn(col.accessor)}
                        className="w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-400 accent-sky-500"
                      />
                      <span className="text-sm text-slate-700">{col.header}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====== Active filter chips ====== */}
      {filters && activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(filters.active).map(([key, value]) => {
            const fd = filters.defs.find(f => f.key === key);
            const optLabel = fd?.options.find(o => String(o.value) === String(value))?.label || value;
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-xs font-semibold"
              >
                {fd?.label}: {optLabel}
                <button
                  onClick={() => filters.onChange(key, null)}
                  className="hover:bg-sky-200/50 rounded-full p-0.5 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* ====== DESKTOP TABLE ====== */}
      <div className="hidden md:block overflow-hidden rounded-2xl ring-1 ring-slate-200/80">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed divide-y divide-slate-100">
            <thead className="bg-gradient-to-b from-slate-50 to-slate-100/50">
              <tr>
                {visibleColumns.map((col) => (
                  <th
                    key={col.accessor}
                    style={col.width ? { width: col.width } : {}}
                    className={`px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider ${
                      sort && col.sortKey !== false ? 'cursor-pointer select-none hover:text-slate-700 group transition-colors' : ''
                    }`}
                    onClick={() => sort && col.sortKey !== false && sort.onSort(col.sortKey || col.accessor)}
                  >
                    <div className="flex items-center gap-1.5">
                      {col.header}
                      {sort && col.sortKey !== false && <SortIcon columnKey={col.sortKey || col.accessor} />}
                    </div>
                  </th>
                ))}
                {actions.length > 0 && (
                  <th className="px-4 py-3.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider" style={{ width: '60px' }}>
                    
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + (actions.length > 0 ? 1 : 0)} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                        <Search className="w-7 h-7 text-slate-300" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-500">No results found</p>
                        <p className="text-xs text-slate-400 mt-1">Try adjusting your search or filters</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((row, rowIndex) => (
                  <tr key={row._id || rowIndex} className="group transition-colors duration-150 hover:bg-sky-50/30">
                    {visibleColumns.map((col) => (
                      <td key={col.accessor} className="px-4 py-4 text-sm text-slate-600">
                        <div className="truncate" title={typeof row[col.accessor] === 'string' ? row[col.accessor] : undefined}>
                          {col.render
                            ? col.render(row[col.accessor], row, pageOffset + rowIndex)
                            : row[col.accessor]}
                        </div>
                      </td>
                    ))}
                    {actions.length > 0 && (
                      <td className="px-4 py-4 text-center relative">
                        <div className="relative inline-block" ref={openActionRow === rowIndex ? actionMenuRef : undefined}>
                          <button
                            onClick={() => setOpenActionRow(openActionRow === rowIndex ? null : rowIndex)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openActionRow === rowIndex && (
                            <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 min-w-[180px]">
                              {actions.map((action, actionIndex) => {
                                const label = typeof action.label === 'function' ? action.label(row) : action.label;
                                // Determine if this is a "destructive" action
                                const isDestructive = typeof label === 'string' && label.toLowerCase().includes('delete');
                                const isToggle = typeof label === 'string' && label.toLowerCase().includes('toggle');

                                return (
                                  <button
                                    key={actionIndex}
                                    onClick={() => {
                                      action.onClick(row);
                                      setOpenActionRow(null);
                                    }}
                                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                                      isDestructive
                                        ? 'text-rose-600 hover:bg-rose-50'
                                        : isToggle
                                          ? 'text-amber-600 hover:bg-amber-50 font-medium'
                                          : 'text-slate-700 hover:bg-slate-50'
                                    }`}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ====== MOBILE CARD VIEW ====== */}
      <div className="md:hidden space-y-3">
        {data.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <Search className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-500">No results found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          data.map((row, rowIndex) => (
            <div
              key={row._id || rowIndex}
              className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3"
            >
              <div className="space-y-2">
                {visibleColumns.map((col) => {
                  if (col.accessor === '_index') return null;
                  const cellValue = col.render
                    ? col.render(row[col.accessor], row, pageOffset + rowIndex)
                    : row[col.accessor];
                  return (
                    <div key={col.accessor} className="flex items-start justify-between gap-3">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 pt-0.5 min-w-[80px]">
                        {col.header}
                      </span>
                      <span className="text-sm text-slate-700 text-right">
                        {cellValue ?? '—'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {actions.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-50">
                  {actions.map((action, actionIndex) => {
                    const label = typeof action.label === 'function' ? action.label(row) : action.label;
                    const isDestructive = typeof label === 'string' && label.toLowerCase().includes('delete');
                    return (
                      <button
                        key={actionIndex}
                        onClick={() => action.onClick(row)}
                        className={`text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors ${
                          isDestructive
                            ? 'text-rose-600 bg-rose-50 hover:bg-rose-100'
                            : 'text-sky-600 bg-sky-50 hover:bg-sky-100'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ====== PAGINATION BAR ====== */}
      {pagination && pagination.totalPages > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          {/* Result count */}
          <div className="text-xs text-slate-500">
            Showing{' '}
            <span className="font-semibold text-slate-700">
              {data.length === 0 ? 0 : pageOffset + 1}
            </span>
            {' '}to{' '}
            <span className="font-semibold text-slate-700">
              {pageOffset + data.length}
            </span>
            {' '}of{' '}
            <span className="font-semibold text-slate-700">
              {pagination.filteredCount ?? pagination.totalCount}
            </span>
            {' '}results
            {pagination.totalCount !== pagination.filteredCount && pagination.filteredCount !== undefined && (
              <span className="text-slate-400"> ({pagination.totalCount} total)</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Page size selector */}
            {pagination.onPageSizeChange && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Rows:</span>
                <select
                  value={pagination.pageSize}
                  onChange={(e) => pagination.onPageSizeChange(Number(e.target.value))}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-sky-400/40 transition-all"
                >
                  {[10, 25, 50, 100].map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Page navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage <= 1}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page numbers */}
              {generatePageNumbers(pagination.currentPage, pagination.totalPages).map((page, i) => (
                page === '...' ? (
                  <span key={`dots-${i}`} className="px-1 text-xs text-slate-400">…</span>
                ) : (
                  <button
                    key={page}
                    onClick={() => pagination.onPageChange(page)}
                    className={`min-w-[32px] h-8 rounded-lg text-xs font-semibold transition-all ${
                      page === pagination.currentPage
                        ? 'bg-sky-500 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {page}
                  </button>
                )
              ))}

              <button
                onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage >= pagination.totalPages}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Generates a compact list of page numbers with ellipsis.
 * e.g., [1, 2, '...', 5, 6, 7, '...', 10]
 */
function generatePageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = [];
  pages.push(1);

  if (current > 3) pages.push('...');

  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }

  if (current < total - 2) pages.push('...');

  pages.push(total);
  return pages;
}
