import React from "react";

export default function ReusableAdminTable({ columns = [], data = [], actions = [] }) {
  return (
    <>
      {/* Desktop table — hidden on mobile */}
      <div className="hidden md:block overflow-x-auto overflow-y-hidden max-w-full ring-1 ring-gray-100 rounded-2xl">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50/50">
            <tr>
              {columns.map((col, index) => (
                <th key={index} className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {col.header}
                </th>
              ))}
              {actions.length > 0 && <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-50">
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className="group transition-colors duration-150 hover:bg-blue-50/30">
                {columns.map((col, colIndex) => (
                  <td key={colIndex} className="whitespace-nowrap px-6 py-5 text-sm text-gray-600">
                    {col.render
                      ? col.render(row[col.accessor], row, rowIndex) // ✅ pass rowIndex here
                      : row[col.accessor]}
                  </td>
                ))}
                {actions.length > 0 && (
                  <td className="whitespace-nowrap px-6 py-5 text-sm font-medium space-x-3">
                    {actions.map((action, actionIndex) => (
                      <button
                        key={actionIndex}
                        onClick={() => action.onClick(row)}
                        className={
                          (typeof action.className === 'function' ? action.className(row) : action.className) ||
                          "text-blue-600 hover:text-blue-800 transition-colors duration-200"
                        }
                      >
                        {typeof action.label === 'function' ? action.label(row) : action.label}
                      </button>
                    ))}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card view — shown only on small screens */}
      <div className="md:hidden space-y-3">
        {data.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">No data to display</p>
        ) : (
          data.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3"
            >
              {/* Data fields */}
              <div className="space-y-2">
                {columns.map((col, colIndex) => {
                  // Skip the index column (#) on mobile — it's not useful
                  if (col.accessor === '_index') return null;

                  const cellValue = col.render
                    ? col.render(row[col.accessor], row, rowIndex)
                    : row[col.accessor];

                  return (
                    <div key={colIndex} className="flex items-start justify-between gap-3">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0 pt-0.5 min-w-[80px]">
                        {col.header}
                      </span>
                      <span className="text-sm text-gray-700 text-right">
                        {cellValue ?? '—'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Action buttons */}
              {actions.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-50">
                  {actions.map((action, actionIndex) => (
                    <button
                      key={actionIndex}
                      onClick={() => action.onClick(row)}
                      className={
                        (typeof action.className === 'function' ? action.className(row) : action.className) ||
                        "text-blue-600 hover:text-blue-800 transition-colors duration-200 text-xs font-semibold py-1 px-2 bg-blue-50 rounded-lg"
                      }
                    >
                      {typeof action.label === 'function' ? action.label(row) : action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
