import React from "react";

export default function ReusableAdminTable({ columns = [], data = [], actions = [] }) {
  return (
    <div className="overflow-x-auto overflow-y-hidden max-w-full ring-1 ring-gray-100 rounded-2xl">
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
                        action.className ||
                        "text-blue-600 hover:text-blue-800 transition-colors duration-200"
                      }
                    >
                      {action.label}
                    </button>
                  ))}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
