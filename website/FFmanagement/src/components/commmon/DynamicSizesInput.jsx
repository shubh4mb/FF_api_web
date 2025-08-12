import { useState, useEffect } from "react";

export default function DynamicSizesInput({ sizes, setSizes }) {
  const [entries, setEntries] = useState(sizes || [{ size: "", stock: 0 }]);

  useEffect(() => {
    setSizes(entries);
  }, [entries]);

  const handleChange = (index, field, value) => {
    const updated = [...entries];a
    updated[index][field] = field === "stock" ? Number(value) : value;
    setEntries(updated);
  };

  const addSize = () => {
    setEntries([...entries, { size: "", stock: 0 }]);
  };

  const removeSize = (index) => {
    const updated = entries.filter((_, i) => i !== index);
    setEntries(updated);
  };

  return (
    <div className="mt-4">
      <h3 className="text-lg font-semibold mb-2">Size and Stock </h3>
      {entries.map((entry, index) => (
        <div key={index} className="flex space-x-2 mb-2">
          <input
            type="text"
            placeholder="Size (e.g. M or 32)"
            value={entry.size}
            onChange={(e) => handleChange(index, "size", e.target.value)}
            className="border p-2 rounded w-1/2"
          />
          <input
            type="number"
            placeholder="Stock"
            value={entry.stock}
            onChange={(e) => handleChange(index, "stock", e.target.value)}
            className="border p-2 rounded w-1/2"
          />
          <button
            onClick={() => removeSize(index)}
            className="bg-red-500 text-white px-2 rounded"
          >
            X
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addSize}
        className="bg-blue-500 text-white px-4 py-1 rounded"
      >
        + Add Size
      </button>
    </div>
  );
}
