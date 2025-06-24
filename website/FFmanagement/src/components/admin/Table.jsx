import React from "react";

export default function ReusableAdminTable({ columns = [], data = [], actions = [] }) {
  return (
    <div className="p-4 overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-200 rounded-lg">
        <thead className="bg-gray-100 text-sm text-left">
          <tr>
            {columns.map((col, index) => (
              <th key={index} className="p-3 border">
                {col.header}
              </th>
            ))}
            {actions.length > 0 && <th className="p-3 border">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t hover:bg-gray-50">
              {columns.map((col, colIndex) => (
               <td key={colIndex} className="p-3">
    {col.render
      ? col.render(row[col.accessor], row, rowIndex) // ✅ pass rowIndex here
      : row[col.accessor]}
  </td>
              ))}
              {actions.length > 0 && (
                <td className="p-3 space-x-2">
                  {actions.map((action, actionIndex) => (
                    <button
                      key={actionIndex}
                      onClick={() => action.onClick(row)}
                      className={
                        action.className ||
                        "text-blue-600 hover:underline text-sm"
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
